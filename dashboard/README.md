# Dashboard

Next.js shell: single-user login + one page (`/actions`) listing rows from
`agent_actions`, with approve/reject buttons for anything the orchestrator
logged as `pending` (low-confidence decisions it deliberately didn't execute).

## Setup

```bash
npm install
cp .env.example .env.local   # edit values
# generate a real secret:
openssl rand -base64 32

npm run dev
```

Visit `http://localhost:3000` → redirects to `/login` → sign in with
`DASHBOARD_USERNAME` / `DASHBOARD_PASSWORD` → `/actions`.

Requires the same Postgres DB + `agent_actions` table the orchestrator writes
to (see `../trust_layer/schema.sql`).

## What's here vs. what's coming

Phase 0 scope, deliberately thin:
- `/login` — single-user credentials auth (NextAuth, JWT session)
- `/actions` — server-rendered list of the 100 most recent agent actions
- `PATCH /api/actions/[id]` — approve/reject a pending action

Later phases extend this same page rather than replacing it: filters by
module/status, the "what should I focus on today" summary (Phase 2), and
eventually the full approval-queue UI called out in Phase 5.
