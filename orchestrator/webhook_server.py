"""
webhook_server.py — the always-on front door to the orchestrator.

agent.py's handle_request() is a plain async function; this wraps it in a
tiny FastAPI app so something external — n8n, a Telegram bot, curl, a future
chat UI — can hand the orchestrator a natural-language request over HTTP and
get back the same OrchestratorState dict that `python agent.py "..."` prints
to stdout: which tool was picked, the reasoning, the confidence, whether it
ran or is waiting for approval, and the result if it ran.

This is the one thing in the whole system that most needs a lock on the
front door: an unauthenticated POST here can pick a tool and (if confidence
clears the threshold) actually execute it, immediately, with no dashboard
approval step in the way. WEBHOOK_SECRET gates it — same shared-secret
pattern as job-tracker-mcp's webhook_server.py, applied here for a higher-
stakes endpoint.

Run:
    pip install -r requirements.txt
    cp .env.example .env   # then edit with real values, generate a WEBHOOK_SECRET
    uvicorn webhook_server:app --host 127.0.0.1 --port 8092

Deploy behind Nginx on the VPS so it's reachable at, e.g.:
    https://chathushka.xubi.org/agent/webhook/request
See DEPLOY.md at the repo root for the full systemd + Nginx setup.
"""

import hmac
import os
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel

# Load orchestrator/.env before importing agent.py, which imports config.py,
# which reads several os.environ.get(...) calls at import time — same
# ordering requirement agent.py itself follows, for the same reason.
load_dotenv(Path(__file__).resolve().parent / ".env")

from agent import handle_request  # noqa: E402

WEBHOOK_SECRET = (
    os.environ.get("ORCHESTRATOR_WEBHOOK_SECRET")
    or os.environ.get("WEBHOOK_SECRET")
    or "second-brain-secret"
)


app = FastAPI(title="second-brain orchestrator webhook")


class AgentRequest(BaseModel):
    request: str


def _check_secret(x_webhook_secret: Optional[str]) -> None:
    if not x_webhook_secret or not hmac.compare_digest(x_webhook_secret, WEBHOOK_SECRET):
        raise HTTPException(status_code=401, detail="invalid or missing X-Webhook-Secret")


@app.get("/health")
async def health():
    return {"ok": True}


@app.post("/webhook/request")
async def receive_request(
    payload: AgentRequest,
    x_webhook_secret: Optional[str] = Header(default=None),
):
    """Hand the orchestrator a natural-language request. Returns the same
    shape `python agent.py "..."` prints: tool_name, reasoning, confidence,
    status (auto_executed | pending | failed), and result if it ran.

    A "pending" status here is not a failure — it means the planner's
    confidence was below the auto-execute threshold (or the tool is
    destructive), so the action is now sitting in the dashboard's Approvals
    queue rather than having run. That's the trust layer working as
    designed, not this endpoint doing something wrong.
    """
    _check_secret(x_webhook_secret)
    if not payload.request.strip():
        raise HTTPException(status_code=422, detail="request must not be empty")

    try:
        result = await handle_request(payload.request)
    except Exception as e:
        # Surface the real failure rather than a bare 500 — this is the one
        # network-reachable entrypoint into the orchestrator, so whoever
        # called it (n8n, a bot, curl) needs an actionable error, not silence.
        raise HTTPException(
            status_code=502, detail=f"orchestrator failed: {type(e).__name__}: {e}"
        )

    return dict(result)
