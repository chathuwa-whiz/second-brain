"""
The orchestrator: a small LangGraph graph with two nodes.

  plan  -- given a natural-language request + the list of tools available from
           connected MCP servers, ask the LLM to pick a tool, fill its args,
           and state its confidence + reasoning. Falls back to a rule-based
           guess if the LLM call fails or returns something unparseable.

  act   -- call the chosen MCP tool, then write the whole decision (module,
           action, reasoning, confidence, result) to the trust-layer log,
           BEFORE surfacing the result to the caller. If confidence is below
           AUTO_EXECUTE_CONFIDENCE_THRESHOLD, the action is logged as
           "pending" and NOT executed -- it waits for a human to approve it
           from the dashboard instead.

This is intentionally the whole orchestrator for Phase 0. Later modules don't
change this graph -- they just add more MCP servers to `MCP_SERVERS` and the
planner automatically sees their tools.
"""

import asyncio
import json
import sys
from pathlib import Path
from typing import Any, Optional, TypedDict

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
from mcp_client import list_tools, call_tool

llm_client = OpenAI(base_url=LLM_BASE_URL, api_key=LLM_API_KEY)

# Which module each MCP server belongs to, for logging purposes. Extend this
# as more MCP servers get added in later phases.
MODULE_BY_SERVER = {
    "task-mcp": "tasks",
}


class OrchestratorState(TypedDict, total=False):
    request: str                 # the user's natural-language request
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
guessing at argument values the user didn't actually provide.
"""


def _keyword_fallback(request: str, tools: list[dict]) -> dict:
    """Rule-based safety net if the LLM call fails or returns bad JSON."""
    lowered = request.lower()
    if any(w in lowered for w in ("add task", "create task", "new task", "todo")):
        name = next((t["name"] for t in tools if t["name"] == "add_task"), None)
        if name:
            return {
                "tool_name": name,
                "tool_args": {"title": request},
                "reasoning": "Keyword fallback matched task-creation phrasing.",
                "confidence": 0.4,
            }
    if any(w in lowered for w in ("list task", "show task", "my tasks", "pending task")):
        name = next((t["name"] for t in tools if t["name"] == "get_tasks"), None)
        if name:
            return {
                "tool_name": name,
                "tool_args": {},
                "reasoning": "Keyword fallback matched task-listing phrasing.",
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
    except Exception:
        decision = _keyword_fallback(state["request"], tools)

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
    module = MODULE_BY_SERVER.get("task-mcp", "unknown")  # single server in Phase 0

    if tool_name is None:
        entry = ActionLogEntry(
            module=module,
            action="no_op",
            reasoning=state["reasoning"],
            confidence=confidence,
            status="failed",
            metadata={"request": state["request"]},
        )
        log_id = log_action(entry)
        return {**state, "result": None, "log_id": log_id, "status": "failed"}

    if confidence < AUTO_EXECUTE_CONFIDENCE_THRESHOLD:
        entry = ActionLogEntry(
            module=module,
            action=tool_name,
            reasoning=state["reasoning"],
            confidence=confidence,
            status="pending",
            metadata={"request": state["request"], "tool_args": state["tool_args"]},
        )
        log_id = log_action(entry)
        return {**state, "result": None, "log_id": log_id, "status": "pending"}

    result = await call_tool(tool_name, state["tool_args"])
    entry = ActionLogEntry(
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
    return {**state, "result": result, "log_id": log_id, "status": "auto_executed"}


def build_graph():
    graph = StateGraph(OrchestratorState)
    graph.add_node("plan", plan_node)
    graph.add_node("act", act_node)
    graph.set_entry_point("plan")
    graph.add_edge("plan", "act")
    graph.add_edge("act", END)
    return graph.compile()


async def handle_request(request: str) -> OrchestratorState:
    app = build_graph()
    return await app.ainvoke({"request": request})


if __name__ == "__main__":
    request = " ".join(sys.argv[1:]) or "Add a task: renew VPS domain, high priority"
    result = asyncio.run(handle_request(request))
    print(json.dumps(result, indent=2, default=str))
