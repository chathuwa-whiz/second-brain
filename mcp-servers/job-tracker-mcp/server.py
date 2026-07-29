"""
job-tracker-mcp — Phase 1's MCP server, built on the task-mcp template.

Same shape as task-mcp: one Motor client, @mcp.tool() functions, JSON-safe
returns, errors returned as {"error": ...} instead of raised.

Two of these tools (match_resume_to_posting, draft_cover_letter) also call
the LLM gateway. That's a deliberate choice to keep here rather than in the
orchestrator: the orchestrator's planner LLM call decides *which* tool to
invoke, but the tool itself may need its own LLM call to do its job (score
a resume, write a draft). Those are two different LLM calls for two
different purposes — keeping them separate keeps the planner prompt small
and keeps this logic testable independent of the orchestrator.

IMPORTANT: draft_cover_letter only ever returns a draft. There is no
send_email tool here on purpose — sending anything is a separate, future
action that must go through the trust-layer approval flow. Nothing in this
file sends anything anywhere.

Run:
    pip install -r requirements.txt
    cp .env.example .env   # then edit with real values
    export $(grep -v '^#' .env | xargs)
    python server.py
"""

import json
import os
from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorClient
from mcp.server.fastmcp import FastMCP
from openai import OpenAI

MONGO_URL = os.environ.get("MONGO_URL")
if not MONGO_URL:
    raise RuntimeError(
        "MONGO_URL is not set. Put your MongoDB connection string "
        "(e.g. a MongoDB Atlas mongodb+srv:// string) in a local .env file — "
        "never hardcode it here or commit it. See .env.example."
    )
DB_NAME = os.environ.get("MONGO_DB", "second_brain")

LLM_BASE_URL = os.environ.get("LLM_BASE_URL", "http://62.171.163.6:20128/v1")
LLM_MODEL = os.environ.get("LLM_MODEL", "GeminiALL")
LLM_API_KEY = os.environ.get("LLM_API_KEY", "not-needed")

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]
applications_collection = db["job_applications"]

llm_client = OpenAI(base_url=LLM_BASE_URL, api_key=LLM_API_KEY)

mcp = FastMCP("job-tracker-mcp")

VALID_STATUSES = ("applied", "interview", "offer", "rejected", "no_response", "withdrawn")


def _serialize(doc: dict) -> dict:
    doc = dict(doc)
    doc["id"] = str(doc.pop("_id"))
    for field in ("date_applied", "created_at", "updated_at"):
        if isinstance(doc.get(field), datetime):
            doc[field] = doc[field].isoformat()
    return doc


@mcp.tool()
async def add_application(
    company: str,
    role: str,
    job_url: str = "",
    resume_version: str = "",
    notes: str = "",
) -> dict:
    """Log a new job application.

    Args:
        company: Company name. Required.
        role: Job title/role applied to. Required.
        job_url: Link to the job posting, if any.
        resume_version: Which resume you sent (e.g. "web", "general", "marketing").
        notes: Any free-text notes.
    """
    if not company.strip() or not role.strip():
        return {"error": "company and role are required"}

    now = datetime.now(timezone.utc)
    doc = {
        "company": company.strip(),
        "role": role.strip(),
        "job_url": job_url.strip(),
        "resume_version": resume_version.strip(),
        "notes": notes.strip(),
        "status": "applied",
        "date_applied": now,
        "created_at": now,
        "updated_at": now,
    }
    result = await applications_collection.insert_one(doc)
    doc["_id"] = result.inserted_id
    return {"application": _serialize(doc)}


@mcp.tool()
async def get_applications(status: Optional[str] = None, limit: int = 50) -> dict:
    """List job applications, optionally filtered by status.

    Args:
        status: One of "applied", "interview", "offer", "rejected",
                "no_response", "withdrawn". Omit for all.
        limit: Max number of applications to return (default 50).
    """
    query = {}
    if status:
        if status not in VALID_STATUSES:
            return {"error": f"status must be one of {VALID_STATUSES}, got {status!r}"}
        query["status"] = status

    cursor = applications_collection.find(query).sort("date_applied", -1).limit(limit)
    results = [_serialize(doc) async for doc in cursor]
    return {"applications": results, "count": len(results)}


@mcp.tool()
async def update_application_status(application_id: str, status: str) -> dict:
    """Update a job application's status.

    Args:
        application_id: The application's id, as returned by add_application/get_applications.
        status: One of "applied", "interview", "offer", "rejected", "no_response", "withdrawn".
    """
    if status not in VALID_STATUSES:
        return {"error": f"status must be one of {VALID_STATUSES}, got {status!r}"}
    try:
        oid = ObjectId(application_id)
    except Exception:
        return {"error": f"invalid application_id: {application_id!r}"}

    result = await applications_collection.find_one_and_update(
        {"_id": oid},
        {"$set": {"status": status, "updated_at": datetime.now(timezone.utc)}},
        return_document=True,
    )
    if result is None:
        return {"error": f"no application found with id {application_id}"}
    return {"application": _serialize(result)}


@mcp.tool()
async def get_pending_followups(days_since_applied: int = 7) -> dict:
    """Find applications that may need a follow-up: still "applied" status
    (no interview/offer/rejection recorded) and past the given number of
    days since you applied.

    Args:
        days_since_applied: Threshold in days. Defaults to 7.
    """
    if days_since_applied < 0:
        return {"error": "days_since_applied must be >= 0"}

    cutoff = datetime.now(timezone.utc).timestamp() - (days_since_applied * 86400)
    cutoff_dt = datetime.fromtimestamp(cutoff, tz=timezone.utc)

    cursor = applications_collection.find(
        {"status": "applied", "date_applied": {"$lte": cutoff_dt}}
    ).sort("date_applied", 1)
    results = [_serialize(doc) async for doc in cursor]
    return {"pending_followups": results, "count": len(results)}


@mcp.tool()
async def match_resume_to_posting(resume_text: str, job_description: str) -> dict:
    """Score how well a resume matches a job posting using the LLM, and list
    missing keywords/skills worth addressing. Read-only — doesn't touch the
    database.

    Args:
        resume_text: The full text of the resume being evaluated.
        job_description: The full text of the job posting.
    """
    if not resume_text.strip() or not job_description.strip():
        return {"error": "both resume_text and job_description are required"}

    prompt = (
        "You are evaluating how well a resume matches a job posting.\n\n"
        f"RESUME:\n{resume_text}\n\nJOB POSTING:\n{job_description}\n\n"
        "Respond with ONLY a JSON object, no markdown fences:\n"
        "{\n"
        '  "score": <integer 0-100>,\n'
        '  "matching_skills": ["...", ...],\n'
        '  "missing_keywords": ["...", ...],\n'
        '  "summary": "<2-3 sentence assessment>"\n'
        "}"
    )

    try:
        completion = llm_client.chat.completions.create(
            model=LLM_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0,
        )
        raw = completion.choices[0].message.content.strip()
        raw = raw.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        return json.loads(raw)
    except Exception as e:
        return {"error": f"LLM matching failed: {e}"}


@mcp.tool()
async def draft_cover_letter(
    resume_text: str,
    job_description: str,
    company: str = "",
    role: str = "",
) -> dict:
    """Draft a cover letter from a resume and job posting. Returns a DRAFT
    only — this tool never sends anything anywhere. The draft is meant to be
    reviewed and edited by a human before it's used.

    Args:
        resume_text: The full text of the resume to draw from.
        job_description: The full text of the job posting.
        company: Company name, for personalization.
        role: Role title, for personalization.
    """
    if not resume_text.strip() or not job_description.strip():
        return {"error": "both resume_text and job_description are required"}

    prompt = (
        "Write a concise, specific cover letter (under 300 words) for the "
        f"role of {role or 'this role'} at {company or 'this company'}, "
        "based on the resume and job posting below. Ground every claim in "
        "the resume — do not invent experience. Plain text, no markdown, "
        "no placeholder brackets.\n\n"
        f"RESUME:\n{resume_text}\n\nJOB POSTING:\n{job_description}"
    )

    try:
        completion = llm_client.chat.completions.create(
            model=LLM_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.4,
        )
        return {"cover_letter_draft": completion.choices[0].message.content.strip()}
    except Exception as e:
        return {"error": f"LLM drafting failed: {e}"}


if __name__ == "__main__":
    mcp.run(transport="stdio")
