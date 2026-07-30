# Deploying second-brain to the VPS

Everything here targets the box already running n8n, Nginx, and 3x-ui/Xray —
1 vCPU, 1GB RAM, 2GB swap. That budget shapes several choices below (the
Next.js standalone build, per-service `MemoryMax` caps, running the
orchestrator's MCP servers as on-demand subprocesses rather than their own
always-on services). Read the "Memory budget" section before starting
anything if you want the reasoning, or skip straight to the steps.

Target layout on disk: everything under `/opt/second-brain`, owned by
`www-data` (the user each systemd service runs as) so it can write to
`RESUME_DIR` and read its own `.env` files without running as root.

## 0. What's changing

- **n8n moves from `/` to `/n8n/`.** It's been living at the domain root;
  the second-brain control panel takes that role instead, so n8n needs its
  own path from here on.
- **New services, all always-on via systemd:**
  | Service | Port | What it does |
  |---|---|---|
  | `second-brain-dashboard` | 3001 | The control panel (Next.js) |
  | `second-brain-job-tracker-webhook` | 8090 | n8n → `job_matches` (already documented in `mcp-servers/job-tracker-mcp/README.md`) |
  | `second-brain-orchestrator-webhook` | 8092 | The agent's front door — hand it a request, it plans + (maybe) acts |
  | `second-brain-approval-executor` | — (no port, just polls Postgres) | Actually runs actions once you approve them from the dashboard |
- **Nginx** gets one new server block (`nginx/chathushka.xubi.org.conf` in
  this folder) replacing whatever currently proxies `/` to n8n.

## 1. Get the code onto the VPS

```bash
sudo mkdir -p /opt/second-brain
sudo chown $USER:$USER /opt/second-brain
git clone https://github.com/chathuwa-whiz/second-brain.git /opt/second-brain
cd /opt/second-brain
```

For updates later, it's just `git pull` in this directory followed by
re-running whichever of steps 2-4 changed, then restarting the relevant
service(s) (step 6).

## 2. Python services: job-tracker-mcp + orchestrator

Both need a venv. Repeat for each:

```bash
cd /opt/second-brain/mcp-servers/job-tracker-mcp
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
cp .env.example .env
nano .env   # fill in MONGO_URL, LLM_*, RESUME_DIR, CANDIDATE_NAME, and a
            # WEBHOOK_SECRET (openssl rand -hex 32) — matches what you set
            # in n8n's "job-tracker-webhook-secret" credential

cd /opt/second-brain/orchestrator
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt fastapi "uvicorn[standard]"
cp .env.example .env
nano .env   # fill in LOG_DATABASE_URL (Neon), LLM_*, and a new
            # ORCHESTRATOR_WEBHOOK_SECRET (openssl rand -hex 32, different
            # from job-tracker's — these gate different things)
```

`task-mcp` doesn't need its own venv or service — the orchestrator spawns it
as a subprocess per request (see `orchestrator/config.py`), using the
orchestrator's own venv and `.env`. Same for `job-tracker-mcp/server.py`
itself (the MCP tool server, as opposed to its webhook) — only the webhook
needs to be always-on and network-reachable; the MCP server is spawned
on-demand by whatever's calling it (the orchestrator, or your own testing).

Add `ORCHESTRATOR_WEBHOOK_SECRET=<generated>` to `orchestrator/.env.example`'s
pattern if it's not already there — it should be, but double check before
copying to `.env`.

## 3. Dashboard: build the standalone Next.js server

```bash
cd /opt/second-brain/dashboard
npm install
cp .env.example .env.production
nano .env.production
```

Fill in `.env.production` with real values — critically:

```bash
NEXTAUTH_URL=https://chathushka.xubi.org/secondbrain
NEXT_BASE_PATH=/secondbrain
NEXT_PUBLIC_BASE_PATH=/secondbrain
LOG_DATABASE_URL=<same Neon string as orchestrator/.env>
MONGO_URL=<same MongoDB string as mcp-servers/job-tracker-mcp/.env>
RESUME_DIR=<same absolute path as mcp-servers/job-tracker-mcp/.env's RESUME_DIR>
NEXT_PUBLIC_AUTO_EXECUTE_CONFIDENCE_THRESHOLD=0.75   # match orchestrator/config.py
DASHBOARD_USERNAME=<pick one>
DASHBOARD_PASSWORD=<pick one>
NEXTAUTH_SECRET=<openssl rand -base64 32>
```

`NEXT_BASE_PATH` and `NEXT_PUBLIC_BASE_PATH` get **baked into the build** —
they have to be set in the environment `next build` actually runs in, not
just written to `.env.production` for later. Build with them explicitly
exported:

```bash
export $(grep -v '^#' .env.production | xargs -d '\n')
npx next build
```

This produces `.next/standalone/server.js`, a self-contained server that
doesn't need the full `node_modules` tree — but it does need the static
assets and any public files copied alongside it manually (Next doesn't do
this automatically):

```bash
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public 2>/dev/null || true
```

`second-brain-dashboard.service`'s `EnvironmentFile` points at
`.env.production` directly, so the running server still gets `MONGO_URL`,
`LOG_DATABASE_URL`, etc. at runtime — the build step only needed the two
`NEXT_...BASE_PATH` vars specifically.

## 4. Database migration (if you haven't already)

The `job_matches` collection and the `job_matches_store.py` module need no
migration (MongoDB is schemaless), but if this is a fresh Postgres database,
apply the trust-layer schema and the execution-columns migration:

```bash
psql "$LOG_DATABASE_URL" -f /opt/second-brain/trust_layer/schema.sql
psql "$LOG_DATABASE_URL" -f /opt/second-brain/trust_layer/migrations/001_add_execution_columns.sql
```

Skip this if you've been running everything locally against the same Neon
database already — it's the same database, just reached from a different
machine.

## 5. Nginx

```bash
sudo cp nginx/chathushka.xubi.org.conf /etc/nginx/sites-available/chathushka.xubi.org
```

**Read the file first** — it assumes it's replacing the entire existing
server block for this domain (specifically, whatever currently proxies `/`
to n8n) and includes a `location = /` redirect plus the four new location
blocks. Merge in your actual TLS certificate paths (commented placeholders
are in there) rather than copying blind.

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 6. Point n8n at its new path

n8n needs to know it's no longer at the root, or its own generated URLs
(webhook nodes, etc.) will still point at the old ones. Add to wherever n8n's
environment is configured (docker-compose.yml, or an env file it reads) and
restart the container:

```bash
N8N_PATH=/n8n/
WEBHOOK_URL=https://chathushka.xubi.org/n8n/
```

```bash
docker compose restart n8n   # or however you currently restart it
```

Confirm n8n loads at `https://chathushka.xubi.org/n8n/` before moving on —
if this step is wrong, `location /n8n/` in the Nginx config won't save you.

## 7. Install and start the services

```bash
cd /opt/second-brain/deploy/systemd
sudo cp *.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now second-brain-dashboard
sudo systemctl enable --now second-brain-job-tracker-webhook
sudo systemctl enable --now second-brain-orchestrator-webhook
sudo systemctl enable --now second-brain-approval-executor
```

Check each came up clean:

```bash
sudo systemctl status second-brain-dashboard second-brain-job-tracker-webhook second-brain-orchestrator-webhook second-brain-approval-executor
journalctl -u second-brain-orchestrator-webhook -f   # tail logs for any one of them
```

## 8. Verify end to end

```bash
curl https://chathushka.xubi.org/job-tracker/health
# {"ok":true}

curl https://chathushka.xubi.org/agent/health
# {"ok":true}

curl -X POST https://chathushka.xubi.org/agent/webhook/request \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: <ORCHESTRATOR_WEBHOOK_SECRET>" \
  -d '{"request": "Do I have any job applications that need a follow-up?"}'
# should return the same shaped JSON `python agent.py "..."` prints locally
```

Then open `https://chathushka.xubi.org/secondbrain` in a browser, log in,
and confirm the Overview page loads with real data (or an honest empty
state if the databases are fresh).

Last piece: in n8n's "Job Search Matcher v3" workflow, the "Send Job Match
to job-tracker-mcp" node's credential and the webhook URL should already be
correct from earlier setup — but since n8n just moved to `/n8n/`, re-open
the workflow once to confirm nothing about the move broke its own saved
state (it shouldn't; that path change only affects n8n's *own* URLs, not
URLs it calls out to).

## 9. Wire something up to the orchestrator webhook (optional, next step)

`/agent/webhook/request` is live but nothing calls it yet. The natural next
step is an n8n workflow with a Telegram trigger (or a scheduled one) that
POSTs to it — but that's a separate, deliberate piece of work, not something
to bolt on as an afterthought here.

---

## Memory budget

Postgres and MongoDB are both managed/cloud (Neon, Atlas) — nothing
database-shaped runs locally, which is most of why this fits at all. What's
left, roughly:

| Process | Rough RSS |
|---|---|
| n8n (already running) | ~250-350MB |
| Nginx + Xray/3x-ui (already running) | ~50-100MB |
| Dashboard (Next.js standalone, capped) | ≤320MB |
| job-tracker-mcp webhook (capped) | ≤160MB |
| Orchestrator webhook (capped) | ≤280MB |
| Approval executor (capped) | ≤200MB |

That's a tight fit on 1GB even before the OS itself, which is what the
`MemoryMax` cgroup limits in each `.service` file are for — a runaway
process gets killed and restarted by systemd (`Restart=on-failure`) rather
than taking the whole box down via the OOM killer picking targets somewhat
arbitrarily. The 2GB swapfile is the second line of defense; expect some
swap usage under load, not none.

If things feel tight in practice: `task-mcp` and `job-tracker-mcp`'s actual
MCP server (not its webhook) only run as short-lived subprocesses spawned
per orchestrator request, so they don't add to the always-on baseline above
— that's deliberate, not an oversight. The biggest lever if you need more
headroom later is trimming the orchestrator webhook's `MemoryMax` down
further and watching whether it OOMs under real usage before assuming it
needs the full 280MB.
