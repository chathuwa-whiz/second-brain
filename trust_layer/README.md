# Logging / Observability Layer

The "trust layer." Every agent action — planned, executed, or awaiting human
approval — gets a row in `agent_actions`.

## Setup

This project uses **Oracle Autonomous AI Database Serverless (23ai)**. Never put your real
connection credentials in code or commit them — they only ever live in a local `.env`
(gitignored) or your deploy target's environment.

1. In your Oracle Cloud console, grab the **Connection String** (e.g. `secondbrain_high`) from
   **Database connection** -> **Connection strings**.

2. Install deps and smoke-test:

   ```bash
   pip install -r requirements.txt
   cp ../.env.example .env   # if you haven't already, then edit it
   python logger.py
   ```

   You should see `Logged action id=1` and a list containing that row.
   `logger.py` loads `.env` itself (via `python-dotenv`) using `python-oracledb` in Thin mode
   (no Oracle Instant Client C binaries required).

## Usage from other modules

```python
from trust_layer.logger import log_action, ActionLogEntry

log_action(ActionLogEntry(
    module="tasks",
    action="reprioritize",
    reasoning="Task X is due in 2 hours and marked high-priority; moved to top.",
    confidence=0.92,
    status="auto_executed",
    metadata={"task_id": "abc123"},
))
```

For actions that should wait for your sign-off (e.g. sending a job application email),
log with `status="pending"` and call `update_status(id, "approved")` once you
approve it from the dashboard.
