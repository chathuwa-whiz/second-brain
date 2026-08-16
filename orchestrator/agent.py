"""
The orchestrator: a small LangGraph graph with two nodes.

  plan  -- given a natural-language request + the list of tools available from
           connected MCP servers, ask the LLM to pick a tool, fill its args,
           and state its confidence + reasoning. Falls back to a rule-based
           guess if the LLM call fails or returns something unparseable.
           Destructive tools (deletes, sends, etc.) get a hard confidence
           cap applied here in code — see _is_destructive_tool — rather than
           relying solely on the system prompt telling the LLM to be
           conservative, since that alone wasn't reliable (an explicit,
           unambiguous delete request got confidence 1.0 in testing despite
           the prompt saying deletes should stay below 0.75).

  act   -- call the chosen MCP tool, then write the whole decision (module,
           action, reasoning, confidence, result) to the trust-layer log,
           BEFORE surfacing the result to the caller. If confidence is below
           AUTO_EXECUTE_CONFIDENCE_THRESHOLD, the action is logged as
           "pending" and NOT executed -- it waits for a human to approve it
           from the dashboard instead.

This graph doesn't change as more modules get added -- they just add more
MCP servers to config.MCP_SERVERS and the planner automatically sees their
tools, and act_node automatically routes to the right server and logs under
the right module.
"""

import asyncio
import json
import sys
from pathlib import Path
from typing import Any, Optional, TypedDict

from dotenv import load_dotenv

# Load orchestrator/.env into the process environment BEFORE importing
# anything (config, logger) that reads os.environ at import time. This is
# required on Windows/PowerShell, where `export $(cat .env | xargs)` (a Bash
# idiom) does nothing — without this, os.environ.get(...) calls below would
# see nothing even with a correctly filled-in .env file sitting right there.
load_dotenv(Path(__file__).resolve().parent / ".env")

from langgraph.graph import StateGraph, END
from openai import OpenAI

sys.path.append(str(Path(__file__).resolve().parent.parent / "trust_layer"))
from logger import ActionLogEntry, log_action  # noqa: E402

from config import (
    LLM_BASE_URL,
    LLM_MODEL,
    LLM_API_KEY,
    AUTO_EXECUTE_CONFIDENCE_THRESHOLD,
)
from mcp_client import list_tools, call_tool, find_server_for_tool

llm_client = OpenAI(base_url=LLM_BASE_URL, api_key=LLM_API_KEY)


class OrchestratorState(TypedDict, total=False):
    request: str                 # the user's natural-language request
    user_id: Optional[str]       # multi-tenant user ID
    tools: list[dict]            # tools discovered from MCP servers
    tool_name: Optional[str]
    tool_args: dict[str, Any]
    reasoning: str
    confidence: float
    module: str
    result: Optional[dict]
    log_id: Optional[int]
    status: str                  # auto_executed | pending | failed


PLANNER_SYSTEM_PROMPT = """You are the planning step of a personal automation agent.
You are given a user request and a list of available tools (from MCP servers).
Pick exactly one tool to call, fill in its arguments, and explain your reasoning.

Respond with ONLY a JSON object, no markdown fences, matching this shape:
{
  "tool_name": "<one of the given tool names, or null if none fit>",
  "tool_args": { ... },
  "reasoning": "<why this tool and these args>",
  "confidence": <float between 0 and 1>
}

Be conservative with confidence: use below 0.75 whenever the request is
ambiguous, could be destructive (deletes, sends, payments), or you're
guessing at argument values the user didn't actually provide. This applies
even when the request gives an exact, unambiguous ID or target for a
destructive action — knowing exactly WHAT to delete is not the same as
being confident it SHOULD be deleted right now without a human glancing
at it first. Treat any delete/remove/send/payment tool as needing human
review by default, regardless of how precisely specified the request is.
"""

# Deliberate second line of defense, enforced in code rather than left to
# the LLM's judgment alone: destructive tools are ALWAYS capped below the
# auto-execute threshold, no matter what confidence the planner (or the
# keyword fallback) assigns. Prompt instructions are a request, not a
# guarantee — this is the guarantee. Extend this list as new modules add
# their own destructive/high-stakes tools (e.g. future send_email).
DESTRUCTIVE_TOOL_PREFIXES = ("delete_", "remove_")
DESTRUCTIVE_TOOL_KEYWORDS = ("send_", "payment", "withdraw")


def _is_destructive_tool(tool_name: Optional[str]) -> bool:
    if not tool_name:
        return False
    lowered = tool_name.lower()
    if lowered.startswith(DESTRUCTIVE_TOOL_PREFIXES):
        return True
    return any(k in lowered for k in DESTRUCTIVE_TOOL_KEYWORDS)


def _apply_destructive_confidence_cap(decision: dict) -> dict:
    """Force destructive-tool confidence below AUTO_EXECUTE_CONFIDENCE_THRESHOLD,
    regardless of what the planner (LLM or keyword fallback) assigned.
    Recomputes the cap from the live threshold each call so this stays
    correct even if AUTO_EXECUTE_CONFIDENCE_THRESHOLD is tuned via env var.
    """
    tool_name = decision.get("tool_name")
    confidence = float(decision.get("confidence", 0.0))

    if not _is_destructive_tool(tool_name):
        return decision

    cap = min(0.5, AUTO_EXECUTE_CONFIDENCE_THRESHOLD - 0.01)
    if confidence < cap:
        return decision  # already below the cap, nothing to do

    decision = dict(decision)
    decision["confidence"] = cap
    decision["reasoning"] = (
        f"{decision.get('reasoning', '')} "
        f"[confidence capped at {cap:.2f}: {tool_name!r} is a destructive "
        "action and always requires human approval regardless of how "
        "precisely specified the request was.]"
    ).strip()
    return decision


def _extract_task_title(request: str) -> str:
    """Best-effort title extraction for the keyword fallback: strip a leading
    "add a task:"/"add task -"/"new task:" style prefix if present, otherwise
    just use the whole request."""
    lowered = request.lower()
    if ":" in request:
        # e.g. "add a task: renew VPS domain" -> "renew VPS domain"
        return request.split(":", 1)[1].strip() or request.strip()
    for lead in ("add a task", "add task", "create a task", "create task", "new task"):
        if lowered.startswith(lead):
            rest = request[len(lead):].strip(" -–—")
            if rest:
                return rest
    return request.strip()


def _keyword_fallback(request: str, tools: list[dict]) -> dict:
    """Rule-based safety net if the LLM call fails or returns bad JSON.

    Deliberately loose (substring/word checks, not exact phrases) since this
    is the safety net for when the LLM is unavailable — better to catch
    "add a task: x" and "please add task x" alike than to require one exact
    phrasing. Confidence stays low (0.3-0.4) so these still land in the
    human-approval queue rather than auto-executing.
    """
    lowered = request.lower()

    if "task" in lowered and any(w in lowered for w in ("add", "create", "new", "todo")):
        name = next((t["name"] for t in tools if t["name"] == "add_task"), None)
        if name:
            return {
                "tool_name": name,
                "tool_args": {"title": _extract_task_title(request)},
                "reasoning": "Keyword fallback matched task-creation phrasing.",
                "confidence": 0.4,
            }
    if "task" in lowered and any(w in lowered for w in ("list", "show", "my", "pending")):
        name = next((t["name"] for t in tools if t["name"] == "get_tasks"), None)
        if name:
            return {
                "tool_name": name,
                "tool_args": {},
                "reasoning": "Keyword fallback matched task-listing phrasing.",
                "confidence": 0.4,
            }
    if any(w in lowered for w in ("applied to", "add application", "log application", "new application")):
        name = next((t["name"] for t in tools if t["name"] == "add_application"), None)
        if name:
            return {
                "tool_name": name,
                "tool_args": {},
                "reasoning": "Keyword fallback matched application-logging phrasing; "
                "args left empty since company/role couldn't be reliably extracted "
                "without the LLM — this will need review before executing.",
                "confidence": 0.3,
            }
    if any(w in lowered for w in ("follow up", "followup", "haven't heard back")):
        name = next((t["name"] for t in tools if t["name"] == "get_pending_followups"), None)
        if name:
            return {
                "tool_name": name,
                "tool_args": {},
                "reasoning": "Keyword fallback matched follow-up phrasing.",
                "confidence": 0.4,
            }
    return {
        "tool_name": None,
        "tool_args": {},
        "reasoning": "No LLM decision available and no keyword fallback matched.",
        "confidence": 0.0,
    }


async def plan_node(state: OrchestratorState) -> OrchestratorState:
    tools = await list_tools()
    tool_summaries = [
        {"name": t["name"], "description": t["description"]} for t in tools
    ]

    try:
        completion = llm_client.chat.completions.create(
            model=LLM_MODEL,
            messages=[
                {"role": "system", "content": PLANNER_SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": json.dumps(
                        {"request": state["request"], "available_tools": tool_summaries}
                    ),
                },
            ],
            temperature=0,
        )
        raw = completion.choices[0].message.content.strip()
        raw = raw.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        decision = json.loads(raw)
    except Exception as e:
        # Surface the real failure reason instead of silently falling back —
        # otherwise "gateway unreachable" and "model returned bad JSON" both
        # look identical from the outside (a low-confidence no-op).
        print(f"[plan_node] LLM call failed, using keyword fallback: "
              f"{type(e).__name__}: {e}", file=sys.stderr)
        decision = _keyword_fallback(state["request"], tools)

    decision = _apply_destructive_confidence_cap(decision)

    return {
        **state,
        "tools": tools,
        "tool_name": decision.get("tool_name"),
        "tool_args": decision.get("tool_args") or {},
        "reasoning": decision.get("reasoning", "no reasoning provided"),
        "confidence": float(decision.get("confidence", 0.0)),
    }


async def act_node(state: OrchestratorState) -> OrchestratorState:
    tool_name = state.get("tool_name")
    confidence = state.get("confidence", 0.0)
    tools = state.get("tools", [])
    user_id = state.get("user_id")

    tool_meta = next((t for t in tools if t["name"] == tool_name), None)
    module = tool_meta["module"] if tool_meta else "unknown"

    if tool_name is None or tool_meta is None:
        entry = ActionLogEntry(
            user_id=user_id,
            module=module,
            action="no_op",
            reasoning=state["reasoning"],
            confidence=confidence,
            status="failed",
            metadata={"request": state["request"]},
        )
        log_id = log_action(entry)
        return {**state, "module": module, "result": None, "log_id": log_id, "status": "failed"}

    if confidence < AUTO_EXECUTE_CONFIDENCE_THRESHOLD:
        entry = ActionLogEntry(
            user_id=user_id,
            module=module,
            action=tool_name,
            reasoning=state["reasoning"],
            confidence=confidence,
            status="pending",
            metadata={"request": state["request"], "tool_args": state["tool_args"]},
        )
        log_id = log_action(entry)
        return {**state, "module": module, "result": None, "log_id": log_id, "status": "pending"}

    server = find_server_for_tool(tool_name, tools)
    result = await call_tool(server, tool_name, state["tool_args"])
    entry = ActionLogEntry(
        user_id=user_id,
        module=module,
        action=tool_name,
        reasoning=state["reasoning"],
        confidence=confidence,
        status="auto_executed",
        metadata={
            "request": state["request"],
            "tool_args": state["tool_args"],
            "result": result,
        },
    )
    log_id = log_action(entry)
    return {**state, "module": module, "result": result, "log_id": log_id, "status": "auto_executed"}


def build_graph():
    graph = StateGraph(OrchestratorState)
    graph.add_node("plan", plan_node)
    graph.add_node("act", act_node)
    graph.set_entry_point("plan")
    graph.add_edge("plan", "act")
    graph.add_edge("act", END)
    return graph.compile()


async def handle_request(request: str, user_id: Optional[str] = None) -> OrchestratorState:
    app = build_graph()
    initial_state: OrchestratorState = {"request": request}
    if user_id:
        initial_state["user_id"] = user_id
    return await app.ainvoke(initial_state)


if __name__ == "__main__":
    request = " ".join(sys.argv[1:]) or "Add a task: renew VPS domain, high priority"
    result = asyncio.run(handle_request(request))
    print(json.dumps(result, indent=2, default=str))
