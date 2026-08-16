"""
Trust-layer logger. Every module and the orchestrator import this and call
`log_action(...)` right before (or instead of) actually executing something.
100% MongoDB NoSQL Backend.
"""

import os
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from dotenv import load_dotenv
from pymongo import MongoClient
from bson import ObjectId

load_dotenv(Path(__file__).resolve().parent / ".env")

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
MONGO_DB = os.environ.get("MONGO_DB", "second_brain")

_client = None


def get_mongo_db():
    global _client
    if _client is None:
        _client = MongoClient(MONGO_URL)
    return _client[MONGO_DB]


@dataclass
class ActionLogEntry:
    module: str
    action: str
    reasoning: str
    confidence: float
    status: str = "auto_executed"  # pending | approved | rejected | auto_executed | failed
    metadata: dict[str, Any] = field(default_factory=dict)
    user_id: Optional[str] = None


def log_action(entry: ActionLogEntry) -> str:
    """Insert a log row into MongoDB agent_actions, return its id."""
    if not (0.0 <= entry.confidence <= 1.0):
        raise ValueError("confidence must be between 0 and 1")

    db = get_mongo_db()
    action_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    doc = {
        "id": action_id,
        "user_id": entry.user_id,
        "module": entry.module,
        "action": entry.action,
        "reasoning": entry.reasoning,
        "confidence": float(entry.confidence),
        "status": entry.status,
        "metadata": entry.metadata,
        "reviewed_at": None,
        "reviewed_by": None,
        "executed_at": now if entry.status == "auto_executed" else None,
        "execution_result": None,
        "created_at": now,
    }

    db.agent_actions.insert_one(doc)
    return action_id


def update_status(action_id: Any, status: str, reviewed_by: Optional[str] = None) -> None:
    db = get_mongo_db()
    now = datetime.now(timezone.utc).isoformat()
    filter_query: dict[str, Any] = {"$or": [{"id": str(action_id)}, {"id": action_id}]}
    if isinstance(action_id, str) and ObjectId.is_valid(action_id):
        filter_query["$or"].append({"_id": ObjectId(action_id)})

    db.agent_actions.update_one(
        filter_query,
        {"$set": {"status": status, "reviewed_at": now, "reviewed_by": reviewed_by}},
    )


def get_approved_unexecuted() -> list[dict]:
    """Return all actions with status='approved' and executed_at is None."""
    db = get_mongo_db()
    cursor = db.agent_actions.find({"status": "approved", "executed_at": None}).sort("created_at", 1)
    results = []
    for doc in cursor:
        doc_copy = dict(doc)
        if "_id" in doc_copy:
            doc_copy["_id"] = str(doc_copy["_id"])
        results.append(doc_copy)
    return results


def mark_executed(action_id: Any, result: Any) -> None:
    """Record execution completion for an approved action."""
    db = get_mongo_db()
    now = datetime.now(timezone.utc).isoformat()
    filter_query: dict[str, Any] = {"$or": [{"id": str(action_id)}, {"id": action_id}]}
    if isinstance(action_id, str) and ObjectId.is_valid(action_id):
        filter_query["$or"].append({"_id": ObjectId(action_id)})
    db.agent_actions.update_one(
        filter_query,
        {"$set": {"executed_at": now, "execution_result": result}},
    )


def mark_execution_failed(action_id: Any, error_msg: str) -> None:
    """Record execution failure for an action."""
    db = get_mongo_db()
    now = datetime.now(timezone.utc).isoformat()
    filter_query: dict[str, Any] = {"$or": [{"id": str(action_id)}, {"id": action_id}]}
    if isinstance(action_id, str) and ObjectId.is_valid(action_id):
        filter_query["$or"].append({"_id": ObjectId(action_id)})
    db.agent_actions.update_one(
        filter_query,
        {"$set": {"status": "failed", "executed_at": now, "execution_result": {"error": error_msg}}},
    )


def get_recent(limit: int = 50, module: Optional[str] = None, user_id: Optional[str] = None) -> list[dict]:
    db = get_mongo_db()
    query: dict[str, Any] = {}
    if module:
        query["module"] = module
    if user_id:
        query["user_id"] = user_id

    cursor = db.agent_actions.find(query).sort("created_at", -1).limit(limit)
    results = []
    for doc in cursor:
        doc_copy = dict(doc)
        if "_id" in doc_copy:
            doc_copy["_id"] = str(doc_copy["_id"])
        results.append(doc_copy)
    return results


if __name__ == "__main__":
    entry_id = log_action(
        ActionLogEntry(
            module="foundation",
            action="smoke_test",
            reasoning="Verifying logger writes and reads correctly on MongoDB.",
            confidence=1.0,
            status="auto_executed",
            metadata={"source": "logger.py __main__", "database": "MongoDB"},
        )
    )
    print(f"Logged action id={entry_id}")
    recent = get_recent(3)
    print("Recent actions:", recent)
