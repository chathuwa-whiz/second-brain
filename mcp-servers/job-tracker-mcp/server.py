"""
job-tracker-mcp — Phase 1's MCP server, built on the task-mcp template.

Same shape as task-mcp: one Motor client, @mcp.tool() functions, JSON-safe
returns, errors returned as {"error": ...} instead of raised.

Three of these tools (match_resume_to_posting, draft_cover_letter,
select_best_resume) also call the LLM gateway. That's a deliberate choice
to keep here rather than in the orchestrator: the orchestrator's planner
LLM call decides *which* tool to invoke, but the tool itself may need its
own LLM call to do its job (score a resume, write a draft, pick the best
of several resumes). Those are different LLM calls for different
purposes — keeping them separate keeps the planner prompt small and keeps
this logic testable independent of the orchestrator.

IMPORTANT: draft_cover_letter only ever returns a draft. There is no
send_email tool here on purpose — sending anything is a separate, future
action that must go through the trust-layer approval flow. Nothing in this
file sends anything anywhere.

Run:
    pip install -r requirements.txt
    cp .env.example .env   # then edit with real values
    python server.py
"""

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorClient
from mcp.server.fastmcp import FastMCP
from openai import OpenAI
from dotenv import load_dotenv

from drive_resumes import list_resume_files, get_resume_text

# Loads job-tracker-mcp/.env if present. No-op when launched by the
# orchestrator (which passes MONGO_URL etc. through explicitly already) —
# only matters for standalone runs. Never overwrites vars already set.
load_dotenv(Path(__file__).resolve().parent / ".env")

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

# Optional: your name, used to sign cover letter drafts. Falls back to a
# generic sign-off (no fabricated name) if not set.
CANDIDATE_NAME = os.environ.get("CANDIDATE_NAME", "")

# Optional: default Drive folder ID for select_best_resume, so callers
# don't have to pass folder_id every time. Can still be overridden per-call.
RESUME_DRIVE_FOLDER_ID = os.environ.get("RESUME_DRIVE_FOLDER_ID", "")

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
async def select_best_resume(job_description: str, folder_id: str = "") -> dict:
    """Look through your resumes stored in Google Drive and pick the one
    that best matches a job posting. Reads .docx/.pdf/Google Docs from a
    Drive folder (shared with the service account — see drive_resumes.py
    for one-time setup), scores each against the posting with the LLM in a
    single comparison call, and returns the winning resume's full text —
    ready to feed straight into match_resume_to_posting or
    draft_cover_letter.

    Args:
        job_description: The full text of the job posting to match against.
        folder_id: Google Drive folder ID to search. If omitted, uses
            RESUME_DRIVE_FOLDER_ID from .env.
    """
    target_folder = folder_id.strip() or RESUME_DRIVE_FOLDER_ID
    if not target_folder:
        return {"error": "No folder_id given and RESUME_DRIVE_FOLDER_ID is not set in .env"}
    if not job_description.strip():
        return {"error": "job_description is required"}

    try:
        files = list_resume_files(target_folder)
    except Exception as e:
        return {"error": f"Could not list Drive folder {target_folder}: {e}"}

    if not files:
        return {
            "error": f"No supported resume files (.docx/.pdf/Google Doc) "
            f"found in Drive folder {target_folder}"
        }

    candidates = []
    for f in files:
        try:
            text = get_resume_text(f["id"], f["mimeType"])
        except Exception as e:
            candidates.append({"file_name": f["name"], "file_id": f["id"], "extract_error": str(e)})
            continue
        if text.strip():
            candidates.append({"file_name": f["name"], "file_id": f["id"], "text": text})
        else:
            candidates.append({"file_name": f["name"], "file_id": f["id"], "extract_error": "empty after extraction"})

    usable = [c for c in candidates if "text" in c]
    if not usable:
        return {
            "error": "Found resume files in Drive but couldn't extract text from any of them",
            "details": candidates,
        }

    # One LLM call comparing all candidates at once, rather than N separate
    # match_resume_to_posting calls — a single round trip, and lets the
    # model weigh candidates directly against each other rather than
    # against independently-generated scores that may not be comparable.
    listing = "\n\n".join(
        f"--- RESUME {i + 1}: {c['file_name']} ---\n{c['text']}"
        for i, c in enumerate(usable)
    )
    prompt = (
        "You are choosing which of several resumes best matches a job posting.\n\n"
        f"JOB POSTING:\n{job_description}\n\n{listing}\n\n"
        "Respond with ONLY a JSON object, no markdown fences:\n"
        "{\n"
        '  "best_match_index": <integer, 1-based index of the best resume above>,\n'
        '  "score": <integer 0-100, how well that resume matches the posting>,\n'
        '  "reasoning": "<why this resume beats the others for this specific posting>"\n'
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
        decision = json.loads(raw)
    except Exception as e:
        return {"error": f"LLM selection failed: {e}"}

    idx = decision.get("best_match_index", 1) - 1
    if not isinstance(idx, int) or not (0 <= idx < len(usable)):
        return {"error": f"LLM returned an out-of-range index: {decision.get('best_match_index')!r}"}

    chosen = usable[idx]
    return {
        "file_name": chosen["file_name"],
        "file_id": chosen["file_id"],
        "resume_text": chosen["text"],
        "score": decision.get("score"),
        "reasoning": decision.get("reasoning"),
        "candidates_considered": [c["file_name"] for c in usable],
    }


@mcp.tool()
async def draft_cover_letter(
    resume_text: str,
    job_description: str,
    company: str = "",
    role: str = "",
    candidate_name: str = "",
) -> dict:
    """Draft a cover letter from a resume and job posting. Returns a DRAFT
    only — this tool never sends anything anywhere. The draft is meant to be
    reviewed and edited by a human before it's used.

    Args:
        resume_text: The full text of the resume to draw from.
        job_description: The full text of the job posting.
        company: Company name, for personalization.
        role: Role title, for personalization.
        candidate_name: Your name, to sign the letter. Falls back to the
            CANDIDATE_NAME env var, then to a generic sign-off if neither
            is set — never fabricated.
    """
    if not resume_text.strip() or not job_description.strip():
        return {"error": "both resume_text and job_description are required"}

    name = (candidate_name or CANDIDATE_NAME).strip()
    signoff_instruction = (
        f'End with "Sincerely," on its own line, then "{name}" on the next line.'
        if name
        else 'End with "Sincerely," on its own line and nothing after it — '
        "do not invent or guess a name."
    )

    prompt = (
        "Write a real cover letter — the kind a person actually sends, not "
        "a categorized summary of a resume. It must read as connected "
        "prose: full sentences, natural transitions between ideas, no "
        "section headers, no labels like 'Experience:' or 'Skills:', and "
        "no bullet points or lists of any kind.\n\n"
        "Structure it as exactly four parts, each 2-4 sentences, written "
        "as flowing paragraphs (not labeled):\n"
        f"1. Opening: state the role ({role or 'the role'}) and company "
        f"({company or 'the company'}) being applied to, and one honest, "
        "specific reason this role is a good fit — not generic enthusiasm.\n"
        "2. Body: pick the 2-3 most relevant pieces of experience from the "
        "resume and connect them explicitly to what the job posting is "
        "asking for. Weave them into a narrative, don't list them.\n"
        "3. Body: one more concrete example (a project or achievement) "
        "that demonstrates fit, again in prose.\n"
        "4. Closing: a brief, confident closing line inviting next steps.\n\n"
        f"Start with 'Dear Hiring Manager,' on its own line. {signoff_instruction}\n\n"
        "Ground every single claim in the resume text below — never invent "
        "experience, skills, or achievements that aren't there. Keep the "
        "whole letter under 300 words. Plain text only: no markdown, no "
        "asterisks, no placeholder brackets like [Company Name].\n\n"
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
