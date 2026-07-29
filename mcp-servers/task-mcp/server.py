"""
task-mcp — the TEMPLATE MCP server.

This is deliberately the simplest useful module: task CRUD backed by MongoDB.
Every later module's MCP server (job-tracker-mcp, research-mcp, business-mcp)
should copy this file's shape:

  1. One Motor (async MongoDB) client, reused across calls.
  2. FastMCP instance with `@mcp.tool()` decorated functions.
  3. Every tool returns plain JSON-serializable dicts (never raw ObjectId/datetime).
  4. Every tool validates its own inputs and returns a clear error dict on failure
     instead of raising — the orchestrator logs whatever comes back, so a raised
     exception loses the "reasoning" story; a returned {"error": "..."} keeps it.

Run:
    pip install -r requirements.txt
    export MONGO_URL="mongodb+srv://user:pass@cluster.mongodb.net/?retryWrites=true&w=majority"
    python server.py
"""

import os
from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorClient
from mcp.server.fastmcp import FastMCP

MONGO_URL = os.environ.get("MONGO_URL")
if not MONGO_URL:
    raise RuntimeError(
        "MONGO_URL is not set. Put your MongoDB connection string "
        "(e.g. a MongoDB Atlas mongodb+srv:// string) in a local .env file — "
        "never hardcode it here or commit it. See ../../.env.example / README."
    )
DB_NAME = os.environ.get("MONGO_DB", "second_brain")

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]
tasks_collection = db["tasks"]

mcp = FastMCP("task-mcp")


def _serialize(doc: dict) -> dict:
    doc = dict(doc)
    doc["id"] = str(doc.pop("_id"))
    if isinstance(doc.get("created_at"), datetime):
        doc["created_at"] = doc["created_at"].isoformat()
    if isinstance(doc.get("updated_at"), datetime):
        doc["updated_at"] = doc["updated_at"].isoformat()
    return doc


@mcp.tool()
async def add_task(title: str, description: str = "", priority: str = "medium") -> dict:
    """Create a new task.

    Args:
        title: Short task title. Required.
        description: Optional longer description.
        priority: One of "low", "medium", "high". Defaults to "medium".
    """
    if not title or not title.strip():
        return {"error": "title is required and cannot be empty"}
    if priority not in ("low", "medium", "high"):
        return {"error": f"priority must be low/medium/high, got {priority!r}"}

    now = datetime.now(timezone.utc)
    doc = {
        "title": title.strip(),
        "description": description.strip(),
        "priority": priority,
        "status": "open",
        "created_at": now,
        "updated_at": now,
    }
    result = await tasks_collection.insert_one(doc)
    doc["_id"] = result.inserted_id
    return {"task": _serialize(doc)}


@mcp.tool()
async def get_tasks(status: Optional[str] = None, priority: Optional[str] = None, limit: int = 50) -> dict:
    """List tasks, optionally filtered by status and/or priority.

    Args:
        status: Filter by "open" or "done". Omit for all statuses.
        priority: Filter by "low"/"medium"/"high". Omit for all priorities.
        limit: Max number of tasks to return (default 50).
    """
    query = {}
    if status:
        query["status"] = status
    if priority:
        query["priority"] = priority

    cursor = tasks_collection.find(query).sort("created_at", -1).limit(limit)
    results = [_serialize(doc) async for doc in cursor]
    return {"tasks": results, "count": len(results)}


@mcp.tool()
async def update_task_status(task_id: str, status: str) -> dict:
    """Mark a task as open or done.

    Args:
        task_id: The task's id, as returned by add_task/get_tasks.
        status: "open" or "done".
    """
    if status not in ("open", "done"):
        return {"error": f"status must be open/done, got {status!r}"}
    try:
        oid = ObjectId(task_id)
    except Exception:
        return {"error": f"invalid task_id: {task_id!r}"}

    result = await tasks_collection.find_one_and_update(
        {"_id": oid},
        {"$set": {"status": status, "updated_at": datetime.now(timezone.utc)}},
        return_document=True,
    )
    if result is None:
        return {"error": f"no task found with id {task_id}"}
    return {"task": _serialize(result)}


@mcp.tool()
async def delete_task(task_id: str) -> dict:
    """Delete a task permanently.

    Args:
        task_id: The task's id, as returned by add_task/get_tasks.
    """
    try:
        oid = ObjectId(task_id)
    except Exception:
        return {"error": f"invalid task_id: {task_id!r}"}

    result = await tasks_collection.delete_one({"_id": oid})
    if result.deleted_count == 0:
        return {"error": f"no task found with id {task_id}"}
    return {"deleted": task_id}


if __name__ == "__main__":
    mcp.run(transport="stdio")
