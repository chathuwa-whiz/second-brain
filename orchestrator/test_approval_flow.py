"""
test_approval_flow.py — logs one genuinely pending action directly to the
trust layer, bypassing the LLM planner entirely, so the dashboard
approve -> approval_executor.py -> actual tool call loop can be verified
in isolation from the planner's confidence calibration.

(Separately worth knowing: the planner is supposed to keep confidence
below 0.75 for destructive actions like deletes per its system prompt,
but gave 1.0 for an exact-task-id delete request — a real calibration gap
to revisit, but not what this script is testing.)

Run from orchestrator/:
    python test_approval_flow.py

Then:
    1. Open the dashboard's /actions page — you should see a new pending
       row: "tasks / add_task" with the reasoning below.
    2. Click Approve.
    3. Make sure approval_executor.py is running in another terminal.
    4. Within ~5-10s it should flip to "executed" with a result showing
       the created task, and the task should actually exist in Mongo
       (check with `python agent.py "show my tasks"`).
"""

import sys
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / ".env")

sys.path.append(str(Path(__file__).resolve().parent.parent / "trust_layer"))
from logger import ActionLogEntry, log_action  # noqa: E402

entry = ActionLogEntry(
    module="tasks",
    action="add_task",
    reasoning="Test row from test_approval_flow.py, logged directly to "
    "verify the dashboard approve -> approval_executor.py -> actual "
    "MCP tool call loop, independent of the LLM planner.",
    confidence=0.4,
    status="pending",
    metadata={
        "request": "(test_approval_flow.py direct log, not from a real user request)",
        "tool_args": {
            "title": "Approval flow test task",
            "description": "Created via the dashboard approval queue — safe to delete once confirmed.",
            "priority": "low",
        },
    },
)

log_id = log_action(entry)
print(f"Logged pending action id={log_id}. Check the dashboard's /actions page.")
