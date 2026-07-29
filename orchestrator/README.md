# Orchestrator

A two-node LangGraph graph: `plan` → `act`.

- `plan` discovers tools from connected MCP servers (task-mcp for now), asks
  the LLM to pick one + fill args + give a confidence score and reasoning,
  with a keyword-based fallback if the LLM call fails.
- `act` calls the tool (if confidence clears the threshold) and writes the
  full decision to the trust-layer Postgres log either way. Low-confidence
  decisions are logged as `pending` and **not executed** — they wait for a
  human approval step (which the dashboard will surface in a later phase).

## Setup

```bash
pip install -r requirements.txt
cp .env.example .env   # edit as needed
export $(cat .env | xargs)   # or use python-dotenv / direnv

python agent.py "Add a task: renew VPS domain, high priority"
```

Requires:
- Postgres with the trust_layer schema applied (see `../trust_layer/`)
- MongoDB running (see `../mcp-servers/task-mcp/`)
- Your LLM gateway reachable (defaults to the same 9router endpoint your
  n8n workflows use)

## What "Phase 0 done" looks like

Run the command above a few times with different requests ("add a task to
follow up on the SLIIT project", "show my open tasks", "delete this random
nonsense" to test the fallback/low-confidence path) and confirm:

1. Each call prints a result with `status` of `auto_executed`, `pending`, or
   `failed`.
2. `SELECT * FROM agent_actions ORDER BY created_at DESC;` in Postgres shows
   a matching row for every call, with real `reasoning` text — not empty or
   generic.
3. Low-confidence / ambiguous requests land as `status = 'pending'` rather
   than silently executing.

That loop (plan → confidence-gated act → logged) is the whole story you're
building on top of for every later module.

## Extending in later phases

Adding a new module (e.g. Job Finding in Phase 1) means:

1. Copy `../mcp-servers/task-mcp/` to `../mcp-servers/job-tracker-mcp/`,
   write its tools.
2. Add it to `mcp_client.py` (or, once there's more than one server, switch
   to iterating over a list of server configs instead of a single one) and
   to `MODULE_BY_SERVER` in `agent.py`.
3. Nothing else changes — the planner automatically sees the new tools next
   time it calls `list_tools()`.
