"""
job-tracker-mcp webhook — the plain-HTTP front door for n8n.

n8n's "Job Search Matcher v3" workflow (running on the VPS, secondbrain.xubi.org)
scores job postings and POSTs good matches here. Matches land in MongoDB's
"job_matches" collection.

Run:
    pip install -r requirements.txt
    cp .env.example .env   # set MONGO_URL, MONGO_DB, WEBHOOK_SECRET
    uvicorn webhook_server:app --host 127.0.0.1 --port 8090

Deploy behind Nginx (same VPS as n8n) so it's reachable at, e.g.:
    https://secondbrain.xubi.org/job-tracker/webhook/job-match
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
    x_user_id: Optional[str] = Header(default=None),
):
    """Called by the n8n Job Search Matcher v3 workflow, once per job posting
    that scores >= 7. Upserts by url for the given user.
    """
    _check_secret(x_webhook_secret)
    try:
        match = await upsert_match(**payload.model_dump(), user_id=x_user_id)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    return {"match": match}


@app.get("/matches")
async def get_matches(
    status: Optional[str] = None,
    limit: int = 50,
    x_webhook_secret: Optional[str] = Header(default=None),
    x_user_id: Optional[str] = Header(default=None),
):
    """Optional convenience endpoint — same data get_job_matches (MCP tool)
    returns, useful for a quick curl check that matches are landing.
    """
    _check_secret(x_webhook_secret)
    results = await list_matches(status=status, limit=limit, user_id=x_user_id)
    return {"matches": results, "count": len(results)}
