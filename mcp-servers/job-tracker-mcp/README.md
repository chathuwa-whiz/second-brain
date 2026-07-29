# job-tracker-mcp — Phase 1: Job Finding

Tools exposed:

| Tool | What it does |
|---|---|
| `add_application` | Log a new application (company, role, url, resume version, notes) |
| `get_applications` | List applications, optionally filtered by status |
| `update_application_status` | Move an application to interview/offer/rejected/etc. |
| `get_pending_followups` | Applications still "applied" past N days — candidates for a follow-up |
| `get_job_matches` | List postings the automated job search found (see below) |
| `update_job_match_status` | Mark a match applied/dismissed |
| `match_resume_to_posting` | LLM-scored fit between a resume and a job posting, + missing keywords |
| `select_best_resume` | Pick the best of your stored resumes for a given posting |
| `draft_cover_letter` | LLM-drafted cover letter — **draft only, nothing is ever sent** |

## Setup

```bash
pip install -r requirements.txt
cp .env.example .env   # then edit with your real Atlas connection string
python server.py
```

`server.py` loads `.env` itself (via `python-dotenv`) — no manual
`export`/`$env:` step needed, and this works the same on Windows, macOS,
and Linux.

Same as task-mcp: raises a clear error if `MONGO_URL` is missing, runs over
stdio for local dev, switch to `sse`/`streamable-http` transport when this
moves to your VPS.

## Why no `send_email` tool

Sending is a real-world side effect with real consequences (a bad cover
letter going to a recruiter can't be un-sent). `draft_cover_letter` always
returns a draft for you to review — the send step is intentionally left for
a later phase, wired through Gmail's MCP connector *and* gated by the
trust-layer approval flow in the dashboard, not bolted on here as a
convenience.

## job_matches: how n8n feeds this system

The n8n "Job Search Matcher v3" workflow (on the VPS, `chathushka.xubi.org`)
scrapes/pulls job postings daily, scores each with the LLM gateway, and
used to Telegram anything scoring >= 7. It now instead POSTs each good
match to **`webhook_server.py`**, a small separate FastAPI app that lives
next to this MCP server and writes into the same MongoDB database, in a
new `job_matches` collection.

Why a separate webhook file instead of exposing `server.py` itself over
the network: `server.py` speaks MCP (JSON-RPC), and n8n's HTTP Request node
can't speak that directly without significant extra setup. `webhook_server.py`
is a plain REST door n8n can hit with a normal POST, sharing the exact same
insert logic (`job_matches_store.py`) that `server.py`'s `get_job_matches`/
`update_job_match_status` tools read and write.

**A match is not an application.** The webhook only ever creates rows with
`status: "new"` in `job_matches`. Nothing here writes to `job_applications`
or calls `add_application` automatically — you (or the orchestrator, when
you ask it to) decide which matches are worth actually applying to, and
log those separately with `add_application`, then mark the match
`"applied"` with `update_job_match_status` so it doesn't show up as `"new"`
anymore.

### Running webhook_server.py

```bash
pip install -r requirements.txt
cp .env.example .env   # set MONGO_URL, MONGO_DB, and a WEBHOOK_SECRET
uvicorn webhook_server:app --host 127.0.0.1 --port 8090
```

Generate `WEBHOOK_SECRET` with `openssl rand -hex 32`. n8n sends it back as
the `X-Webhook-Secret` header on every request; requests without a matching
secret get a 401.

### Deploying on the VPS, reachable by n8n

Run it as a systemd service alongside n8n (adjust paths to wherever you
clone this repo on the VPS):

```ini
# /etc/systemd/system/job-tracker-webhook.service
[Unit]
Description=job-tracker-mcp webhook
After=network.target

[Service]
WorkingDirectory=/opt/second-brain/mcp-servers/job-tracker-mcp
ExecStart=/opt/second-brain/mcp-servers/job-tracker-mcp/.venv/bin/uvicorn webhook_server:app --host 127.0.0.1 --port 8090
Restart=on-failure
User=www-data

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload
systemctl enable --now job-tracker-webhook
```

Then add an Nginx location block on the same server block that already
proxies n8n at `chathushka.xubi.org`, so it's reachable at a path instead
of a new port/subdomain:

```nginx
location /job-tracker/ {
    proxy_pass http://127.0.0.1:8090/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

`nginx -t && systemctl reload nginx`, and the endpoint n8n's HTTP Request
node should call is:

```
https://chathushka.xubi.org/job-tracker/webhook/job-match
```

Quick check once it's up:

```bash
curl https://chathushka.xubi.org/job-tracker/health
# {"ok": true}
```

## MongoDB

`job_applications` collection, created on first insert:

```json
{
  "_id": ObjectId(...),
  "company": "string",
  "role": "string",
  "job_url": "string",
  "resume_version": "string",
  "notes": "string",
  "status": "applied | interview | offer | rejected | no_response | withdrawn",
  "date_applied": "ISO datetime",
  "created_at": "ISO datetime",
  "updated_at": "ISO datetime"
}
```

`job_matches` collection, created on first webhook POST (upserted by `url`
so the daily n8n run refreshes score/reason on a repeat posting instead of
duplicating it):

```json
{
  "_id": ObjectId(...),
  "title": "string",
  "company": "string",
  "url": "string",
  "location": "string",
  "remote": true,
  "source": "Arbeitnow | RemoteOK | Jobber.lk | Finders.lk",
  "score": 8,
  "reason": "string",
  "status": "new | applied | dismissed",
  "found_at": "ISO datetime",
  "created_at": "ISO datetime",
  "updated_at": "ISO datetime"
}
```

## Using `match_resume_to_posting` with your existing resumes

You have three tailored resume versions (web/full-stack, general, marketing).
Pass whichever one's text is most relevant as `resume_text`, and the job
posting text as `job_description` — the tool scores fit and flags gaps
between them, so you can pick the best-matching version per posting or
patch the gaps before you apply.
