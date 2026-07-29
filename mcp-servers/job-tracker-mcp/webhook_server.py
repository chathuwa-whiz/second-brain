"""
job-tracker-mcp webhook — the plain-HTTP front door for n8n.

n8n's "Job Search Matcher v3" workflow (running on the VPS, chathushka.xubi.org)
scores job postings and used to send matches (score >= 7) to Telegram. This
replaces that step: n8n now POSTs each good match here instead, and it lands
in the same MongoDB "job_matches" collection the orchestrator/dashboard can
read via job-tracker-mcp's get_job_matches tool.

Why a separate plain HTTP server instead of exposing job-tracker-mcp itself
over the network: job-tracker-mcp speaks MCP (JSON-RPC over stdio/SSE), which
n8n's HTTP Request node can't speak without a lot of extra plumbing. This is
a five-line REST endpoint an HTTP Request node can hit directly. Both this
file and server.py's MCP tools import the same job_matches_store.py, so
there's one insert path either way — this is just a second, simpler door
into it.

Auth: a shared secret header (X-Webhook-Secret), not a full OAuth dance —
proportionate to what this endpoint does (write one job-match row) and to
who's calling it (a workflow you built, from a VPS you control).

Run:
    pip install -r requirements.txt
    cp .env.example .env   # set MONGO_URL, MONGO_DB, WEBHOOK_SECRET
    uvicorn webhook_server:app --host 127.0.0.1 --port 8090

Deploy behind Nginx (same VPS as n8n) so it's reachable at, e.g.:
    https://chathushka.xubi.org/job-tracker/webhook/job-match
See mcp-servers/job-tracker-mcp/README.md for the Nginx + systemd snippets.
"""

import hmac
import os
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel

from job_matches_store import list_matches, upsert_match

load_dotenv(Path(__file__).resolve().parent / ".env")

WEBHOOK_SECRET = os.environ.get("WEBHOOK_SECRET")
if not WEBHOOK_SECRET:
    raise RuntimeError(
        "WEBHOOK_SECRET is not set. Generate one (e.g. `openssl rand -hex 32`) "
        "and put it in .env — this endpoint is unauthenticated without it. "
        "See .env.example."
    )

app = FastAPI(title="job-tracker-mcp webhook")


class JobMatchPayload(BaseModel):
    title: str
    company: str = ""
    url: str
    location: str = ""
    remote: Optional[bool] = None
    source: str = ""
    score: Optional[float] = None
    reason: str = ""


def _check_secret(x_webhook_secret: Optional[str]) -> None:
    if not x_webhook_secret or not hmac.compare_digest(x_webhook_secret, WEBHOOK_SECRET):
        raise HTTPException(status_code=401, detail="invalid or missing X-Webhook-Secret")


@app.get("/health")
async def health():
    return {"ok": True}


@app.post("/webhook/job-match")
async def receive_job_match(
    payload: JobMatchPayload,
    x_webhook_secret: Optional[str] = Header(default=None),
):
    """Called by the n8n Job Search Matcher v3 workflow, once per job posting
    that scores >= 7. Upserts by url — a posting seen again on a later daily
    run refreshes its score/reason instead of creating a duplicate row.
    """
    _check_secret(x_webhook_secret)
    try:
        match = await upsert_match(**payload.model_dump())
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    return {"match": match}


@app.get("/matches")
async def get_matches(
    status: Optional[str] = None,
    limit: int = 50,
    x_webhook_secret: Optional[str] = Header(default=None),
):
    """Optional convenience endpoint — same data get_job_matches (MCP tool)
    returns, useful for a quick curl check that matches are landing.
    """
    _check_secret(x_webhook_secret)
    results = await list_matches(status=status, limit=limit)
    return {"matches": results, "count": len(results)}
