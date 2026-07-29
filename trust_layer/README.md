# Logging / Observability Layer

The "trust layer." Every agent action — planned, executed, or awaiting human
approval — gets a row in `agent_actions`.

## Setup

This project uses [Neon](https://neon.tech) for Postgres. Never put your real
connection string in code or commit it — it only ever lives in a local `.env`
(gitignored) or your deploy target's secret manager.

1. In the Neon dashboard, grab the **pooled connection** string from
   Connection Details. It already includes `?sslmode=require`, which
   psycopg2 picks up automatically.

2. Apply the schema (run once) — paste your actual connection string in
   place of the placeholder:

   ```bash
   psql "postgresql://<user>:<password>@<project>.neon.tech/<database>?sslmode=require" -f schema.sql
   ```

   (On Windows, run this from PowerShell or the psql shell directly — same
   command, just don't rely on `$LOG_DATABASE_URL` shell expansion, which is
   Bash-only.)

3. Install deps and smoke-test:

   ```bash
   pip install -r requirements.txt
   cp ../.env.example .env   # if you haven't already, then edit it
   python logger.py
   ```

   You should see `Logged action id=1` and a list containing that row.
   `logger.py` loads `.env` itself (via `python-dotenv`) — no manual
   `export`/`$env:` step needed, and this works the same on Windows,
   macOS, and Linux.

`logger.py` raises a clear error if `LOG_DATABASE_URL` isn't set — this is
intentional, so there's never a tempting "just hardcode it for now" default
sitting in committed code.

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

For actions that should wait for your sign-off (e.g. sending a cover letter),
log with `status="pending"` and call `update_status(id, "approved")` once you
approve it from the dashboard.
