# Second Brain — Phase 0: Foundation

This is the skeleton every later module (Job Finding, Tasks, Research/RAG, Lectures,
Business) plugs into. Nothing here is flashy — it's the plumbing:

```
second-brain/
├── orchestrator/        # LangGraph planner agent — decides which module to invoke
├── mcp-servers/
│   └── task-mcp/         # Template MCP server (FastMCP + MongoDB) — clone this pattern
│                          # for every future module's MCP server
├── trust_layer/              # Postgres "trust layer" — every agent action logged here
└── dashboard/            # Next.js shell — auth + a page that reads the log table
```

## Why this order

- **trust_layer/** first, conceptually — everything else writes to it.
- **mcp-servers/task-mcp/** is the *template*. It's deliberately the simplest possible
  useful MCP server (task CRUD over MongoDB) so the pattern — FastMCP tool definitions,
  Mongo connection handling, error shapes — is boring and copy-pasteable for Job Finding,
  Research, Business, etc.
- **orchestrator/** is a LangGraph graph with two nodes: `plan` (decide which
  tool/module to call, with a confidence score and reasoning string) and `act`
  (call the MCP tool, then write the decision to the log table). This is the part
  interviewers will ask about — "how does your agent decide, and how do you know
  it's not hallucinating an action?" The answer lives in `orchestrator/agent.py`.
- **dashboard/** is intentionally thin right now: single-user login + one page
  (`/actions`) that lists rows from `agent_actions`. This becomes the "approval queue"
  UI in Phase 5.

## Setup order

1. `trust_layer/` — stand up Postgres, run `schema.sql`, confirm `logger.py` can insert/read.
2. `mcp-servers/task-mcp/` — stand up MongoDB, run the server, confirm tools work via
   the MCP inspector or a quick client script.
3. `orchestrator/` — point it at the MCP server + logger, run a few requests through it,
   check rows land in `agent_actions`.
4. `dashboard/` — point it at the same Postgres DB, log in, confirm the actions list
   renders.

Each subfolder has its own README with exact run instructions and env vars.

## Tech stack (matches the full roadmap)

- Agent orchestration: Python, LangGraph
- MCP servers: Python, FastMCP — one per module, scoped tool access
- Data: MongoDB (module data) + Postgres (agent action log / trust layer)
- Dashboard: Next.js + TypeScript + Tailwind + NextAuth
- Deployment target: your existing VPS (chathushka.xubi.org) + Nginx, same pattern
  as your n8n setup
