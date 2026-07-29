"""
approval_executor.py — actually runs the MCP tool calls for actions a
human has approved from the dashboard.

Why this exists as a separate process rather than the dashboard just
executing on approve: the dashboard is a Next.js/TypeScript app, but the
MCP servers (and the mcp_client stdio-spawning logic) are Python. Rather
than reimplementing an MCP client in TypeScript, this small Python poller
watches Postgres for status='approved' rows with executed_at IS NULL,
executes the underlying tool via the same mcp_client used by agent.py,
and records the result. Approving from the dashboard is instant (just a
Postgres UPDATE); execution happens within POLL_INTERVAL_SECONDS after.

Run continuously (e.g. as a background service alongside agent.py):
    python approval_executor.py

Or process whatever's currently pending once and exit (useful for testing,
or for running via cron instead of a long-lived process):
    python approval_executor.py --once
"""

import asyncio
import sys
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / ".env")

sys.path.append(str(Path(__file__).resolve().parent.parent / "trust_layer"))
from logger import get_approved_unexecuted, mark_executed, mark_execution_failed  # noqa: E402

from mcp_client import list_tools, call_tool, find_server_for_tool

POLL_INTERVAL_SECONDS = 5


async def _execute_one(action: dict, tools: list[dict]) -> None:
    action_id = action["id"]
    tool_name = action["action"]
    tool_args = (action.get("metadata") or {}).get("tool_args", {})

    server = find_server_for_tool(tool_name, tools)
    if server is None:
        mark_execution_failed(
            action_id,
            f"No MCP server currently exposes a tool named {tool_name!r} "
            "(server may be misconfigured, or the tool was renamed/removed "
            "since this action was approved).",
        )
        print(f"[approval_executor] action {action_id}: FAILED — tool {tool_name!r} not found")
        return

    try:
        result = await call_tool(server, tool_name, tool_args)
    except Exception as e:
        mark_execution_failed(action_id, f"{type(e).__name__}: {e}")
        print(f"[approval_executor] action {action_id}: FAILED — {type(e).__name__}: {e}")
        return

    mark_executed(action_id, result)
    status = "ERROR (tool returned is_error)" if result.get("is_error") else "OK"
    print(f"[approval_executor] action {action_id}: executed {tool_name} — {status}")


async def _run_once() -> int:
    pending = get_approved_unexecuted()
    if not pending:
        return 0

    tools = await list_tools()
    for action in pending:
        await _execute_one(action, tools)
    return len(pending)


async def main():
    once = "--once" in sys.argv

    if once:
        count = await _run_once()
        print(f"[approval_executor] processed {count} approved action(s), exiting (--once)")
        return

    print(f"[approval_executor] polling every {POLL_INTERVAL_SECONDS}s for approved actions. Ctrl+C to stop.")
    while True:
        try:
            count = await _run_once()
            if count:
                print(f"[approval_executor] processed {count} approved action(s)")
        except Exception as e:
            # Keep the poller alive even if one cycle errors (e.g. a
            # transient DB or MCP connection issue) — log and retry next tick
            # rather than crashing a long-running background process.
            print(f"[approval_executor] poll cycle error: {type(e).__name__}: {e}")
        await asyncio.sleep(POLL_INTERVAL_SECONDS)


if __name__ == "__main__":
    asyncio.run(main())
