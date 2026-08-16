"""
Shared job_matches collection helpers.

Two front doors write/read the same "job_matches" collection:
  - server.py's MCP tools (get_job_matches, update_job_match_status) — for
    the orchestrator/dashboard, speaking MCP.
  - webhook_server.py's POST /webhook/job-match — for the n8n "Job Search
    Matcher v3" workflow, which can't speak MCP and just needs a plain
    HTTP endpoint to post scored job listings to.

Keeping the insert/list logic here, imported by both, means there's one
definition of what a "job match" document looks like — not two copies
that can drift.
"""

import os
from datetime import datetime, timezone
from typing import Optional

from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId

MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("MONGO_DB", "second_brain")

VALID_MATCH_STATUSES = ("new", "applied", "dismissed")

_client: Optional[AsyncIOMotorClient] = None
_collection = None


def get_matches_collection():
    """Lazily creates the Motor client/collection on first use, so importing
    this module doesn't require MONGO_URL to be set (only calling it does).
    """
    global _client, _collection
    if _collection is None:
        if not MONGO_URL:
            raise RuntimeError(
                "MONGO_URL is not set. Put your MongoDB connection string "
                "in a local .env file — see .env.example."
            )
        _client = AsyncIOMotorClient(MONGO_URL)
        _collection = _client[DB_NAME]["job_matches"]
    return _collection


def _serialize(doc: dict) -> dict:
    doc = dict(doc)
    doc["id"] = str(doc.pop("_id"))
    for field in ("found_at", "created_at", "updated_at"):
        if isinstance(doc.get(field), datetime):
            doc[field] = doc[field].isoformat()
    return doc


async def upsert_match(
    *,
    title: str,
    company: str = "",
    url: str = "",
    location: str = "",
    remote: Optional[bool] = None,
    source: str = "",
    score: Optional[float] = None,
    reason: str = "",
    user_id: Optional[str] = None,
) -> dict:
    """Insert a new job match, or update an existing one if a match with the
    same url already exists for this user.
    """
    if not title.strip():
        raise ValueError("title is required")
    if not url.strip():
        raise ValueError("url is required")

    now = datetime.now(timezone.utc)
    coll = get_matches_collection()

    filter_query: dict = {"url": url.strip()}
    if user_id:
        filter_query["user_id"] = user_id

    existing = await coll.find_one(filter_query)
    if existing:
        update = {
            "title": title.strip(),
            "company": company.strip(),
            "location": location.strip(),
            "remote": remote,
            "source": source.strip(),
            "score": score,
            "reason": reason.strip(),
            "updated_at": now,
        }
        if user_id and "user_id" not in existing:
            update["user_id"] = user_id
        await coll.update_one({"_id": existing["_id"]}, {"$set": update})
        merged = {**existing, **update}
        return _serialize(merged)

    doc = {
        "title": title.strip(),
        "company": company.strip(),
        "url": url.strip(),
        "location": location.strip(),
        "remote": remote,
        "source": source.strip(),
        "score": score,
        "reason": reason.strip(),
        "status": "new",
        "found_at": now,
        "created_at": now,
        "updated_at": now,
    }
    if user_id:
        doc["user_id"] = user_id

    result = await coll.insert_one(doc)
    doc["_id"] = result.inserted_id
    return _serialize(doc)


async def list_matches(
    status: Optional[str] = None,
    limit: int = 50,
    user_id: Optional[str] = None,
) -> list:
    coll = get_matches_collection()
    query: dict = {}
    if status:
        query["status"] = status
    if user_id:
        query["user_id"] = user_id

    cursor = coll.find(query).sort("found_at", -1).limit(limit)
    return [_serialize(doc) async for doc in cursor]


async def set_match_status(match_id: str, status: str) -> dict:
    if status not in VALID_MATCH_STATUSES:
        raise ValueError(f"status must be one of {VALID_MATCH_STATUSES}, got {status!r}")
    try:
        oid = ObjectId(match_id)
    except Exception:
        raise ValueError(f"invalid match_id: {match_id!r}")

    coll = get_matches_collection()
    result = await coll.find_one_and_update(
        {"_id": oid},
        {"$set": {"status": status, "updated_at": datetime.now(timezone.utc)}},
        return_document=True,
    )
    if result is None:
        raise LookupError(f"no job match found with id {match_id}")
    return _serialize(result)
