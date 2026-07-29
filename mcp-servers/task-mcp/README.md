# task-mcp — the module MCP server template

Tools exposed: `add_task`, `get_tasks`, `update_task_status`, `delete_task`.

Every future module server (`job-tracker-mcp`, `research-mcp`, `business-mcp`, ...)
should be a copy of this file's structure: one Motor client, `@mcp.tool()`
functions, JSON-serializable returns, errors returned as `{"error": ...}` rather
than raised.

## Setup

This project uses MongoDB Atlas. Never put your real connection string in
code or commit it — it only ever lives in a local `.env` (gitignored) or
your deploy target's secret manager.

```bash
pip install -r requirements.txt
cp ../../orchestrator/.env.example .env   # or write your own
export $(grep -v '^#' .env | xargs)       # exports MONGO_URL, MONGO_DB, etc.
python server.py
```

`server.py` raises a clear error if `MONGO_URL` isn't set, rather than
silently falling back to a local instance — that's intentional, so nothing
here tempts you to hardcode a real string as a "default".

This runs the server over stdio, which is what the orchestrator's MCP client
expects for local dev. When you're ready to run this on your VPS alongside
n8n, switch `mcp.run(transport="stdio")` to `mcp.run(transport="sse")` (or
`"streamable-http"`, depending on your installed `mcp` version) and point the
orchestrator's MCP client config at the resulting URL instead of a subprocess.

## Quick manual test (no orchestrator needed)

The `mcp` package ships an inspector:

```bash
npx @modelcontextprotocol/inspector python server.py
```

This opens a browser UI where you can call `add_task`, `get_tasks`, etc.
directly and see the raw responses — the fastest way to confirm the server
works before wiring the orchestrator to it.

## MongoDB

No manual schema setup needed — Motor/PyMongo create the `tasks` collection
on first insert. Each task document:

```json
{
  "_id": ObjectId(...),
  "title": "string",
  "description": "string",
  "priority": "low | medium | high",
  "status": "open | done",
  "created_at": "ISO datetime",
  "updated_at": "ISO datetime"
}
```
