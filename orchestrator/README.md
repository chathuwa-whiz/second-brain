# Orchestrator

A two-node LangGraph graph: `plan` → `act`.

- `plan` discovers tools from every connected MCP server (`task-mcp`,
  `job-tracker-mcp`, and any more added to `config.MCP_SERVERS`), asks the
  LLM to pick one + fill args + give a confidence score and reasoning, with
  a keyword-based fallback if the LLM call fails.
- `act` looks up which server owns the chosen tool, calls it (if confidence
  clears the threshold), and writes the full decision to the trust-layer
  Postgres log either way, tagged with that server's `module`. Low-confidence
  decisions are logged as `pending` and **not executed** — they wait for a
  human approval step (which the dashboard surfaces).

## Setup

```bash
pip install -r requirements.txt
cp .env.example .env   # then edit .env with your real values

python agent.py "Add a task: renew VPS domain, high priority"
python agent.py "Log an application to Acme Corp for Backend Engineer"
python agent.py "Do I have any job applications that need a follow-up?"
```

`agent.py` loads `.env` itself (via `python-dotenv`) — no need to `export`
anything manually, and this works identically on Windows/PowerShell,
macOS, and Linux. Just make sure `.env` sits next to `agent.py` in this
folder with real values filled in.

Requires:
- Postgres with the trust_layer schema applied (see `../trust_layer/`)
- MongoDB reachable (see `../mcp-servers/task-mcp/` and `../mcp-servers/job-tracker-mcp/`)
- Your LLM gateway reachable (defaults to the same 9router endpoint your
  n8n workflows use)

The orchestrator launches each MCP server as a subprocess and passes its own
process environment through to it explicitly (see `mcp_client.py`), so once
`.env` is loaded here, both `task-mcp` and `job-tracker-mcp` get `MONGO_URL`,
`LLM_BASE_URL`, etc. automatically — no separate `.env` needed per server
unless you want different databases per module.

## What "done" looks like

Run a few requests through each module and confirm:

1. Each call prints a result with `status` of `auto_executed`, `pending`, or
   `failed`.
2. `SELECT * FROM agent_actions ORDER BY created_at DESC;` in Postgres shows
   a matching row for every call, with real `reasoning` text, and `module`
   correctly set to `tasks` or `job_finding` depending on which tool ran.
3. Low-confidence / ambiguous requests (e.g. "log an application" with no
   company/role given) land as `status = 'pending'` rather than silently
   executing — this matters more for job_finding, since a bad auto-filled
   application record is actually annoying to clean up.

## Extending in later phases

Adding a new module means:

1. Copy `../mcp-servers/task-mcp/` to a new `../mcp-servers/<name>-mcp/`,
   write its tools.
2. Add an entry to `MCP_SERVERS` in `config.py` with a `name`, `module`, and
   `command`/`args`.
3. Nothing else changes — `list_tools()` in `mcp_client.py` picks it up
   automatically, and the planner sees the new tools next call.
