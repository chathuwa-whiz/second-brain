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
from datetime import datetime, timezone, timedelta
from calendar import monthrange
from pathlib import Path
from typing import Optional, List

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorClient
from mcp.server.fastmcp import FastMCP
from dotenv import load_dotenv

# Loads task-mcp/.env if present. When launched by the orchestrator as a
# subprocess, MONGO_URL etc. are already passed through explicitly, so this
# is a no-op then — it only matters when running this file standalone (e.g.
# via the MCP inspector). load_dotenv() never overwrites vars already set.
load_dotenv(Path(__file__).resolve().parent / ".env")

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
async def add_task(
    title: str, 
    description: str = "", 
    priority: str = "medium",
    user_id: Optional[str] = None,
    due_date: Optional[str] = None,
    recurrence: Optional[str] = None,
    tags: Optional[list[str]] = None
) -> dict:
    """Create a new task.

    Args:
        title: Short task title. Required.
        description: Optional longer description.
        priority: One of "low", "medium", "high". Defaults to "medium".
        user_id: Optional user identifier for multi-tenant scoping.
        due_date: Optional due date in YYYY-MM-DD format.
        recurrence: Optional "daily", "weekdays", "weekly", "monthly".
        tags: Optional list of string tags.
    """
    if not title or not title.strip():
        return {"error": "title is required and cannot be empty"}
    if priority not in ("low", "medium", "high"):
        return {"error": f"priority must be low/medium/high, got {priority!r}"}
    
    if due_date:
        try:
            datetime.strptime(due_date, "%Y-%m-%d")
        except ValueError:
            return {"error": "due_date must be in YYYY-MM-DD format"}
            
    if recurrence and recurrence not in ("daily", "weekdays", "weekly", "monthly"):
        return {"error": f"recurrence must be daily, weekdays, weekly, or monthly, got {recurrence!r}"}

    now = datetime.now(timezone.utc)
    doc = {
        "title": title.strip(),
        "description": description.strip(),
        "priority": priority,
        "status": "open",
        "created_at": now,
        "updated_at": now,
        "user_id": user_id,
        "due_date": due_date,
        "recurrence": recurrence,
        "tags": tags or [],
    }
    result = await tasks_collection.insert_one(doc)
    doc["_id"] = result.inserted_id
    return {"task": _serialize(doc)}


@mcp.tool()
async def get_tasks(
    status: Optional[str] = None, 
    priority: Optional[str] = None, 
    user_id: Optional[str] = None,
    due: Optional[str] = None,
    limit: int = 50
) -> dict:
    """List tasks, optionally filtered by status, priority, user_id, or due.

    Args:
        status: Filter by "open" or "done". Omit for all statuses.
        priority: Filter by "low"/"medium"/"high". Omit for all priorities.
        user_id: Filter by user_id. Includes tasks with matching user_id or no user_id.
        due: Filter by "today", "overdue", "upcoming" (next 7 days).
        limit: Max number of tasks to return (default 50).
    """
    query = {}
    if status:
        query["status"] = status
    if priority:
        query["priority"] = priority
        
    if user_id:
        query["$or"] = [{"user_id": user_id}, {"user_id": None}, {"user_id": {"$exists": False}}]
        
    if due:
        today_dt = datetime.now(timezone.utc)
        today_str = today_dt.strftime("%Y-%m-%d")
        if due == "today":
            query["due_date"] = today_str
        elif due == "overdue":
            query["due_date"] = {"$lt": today_str}
        elif due == "upcoming":
            next_week = (today_dt + timedelta(days=7)).strftime("%Y-%m-%d")
            query["due_date"] = {"$gte": today_str, "$lte": next_week}
        else:
            return {"error": f"due must be today, overdue, or upcoming, got {due!r}"}

    sort_criteria = [("created_at", -1)]
    if due:
        sort_criteria = [("due_date", 1)]

    cursor = tasks_collection.find(query).sort(sort_criteria).limit(limit)
    results = [_serialize(doc) async for doc in cursor]
    return {"tasks": results, "count": len(results)}


@mcp.tool()
async def update_task(
    task_id: str,
    title: Optional[str] = None,
    description: Optional[str] = None,
    priority: Optional[str] = None,
    due_date: Optional[str] = None,
    tags: Optional[list[str]] = None,
    recurrence: Optional[str] = None,
    user_id: Optional[str] = None
) -> dict:
    """Update task fields.
    
    Args:
        task_id: The task's id.
        title: Optional new title.
        description: Optional new description.
        priority: Optional new priority (low/medium/high).
        due_date: Optional new due date (YYYY-MM-DD).
        tags: Optional new list of tags.
        recurrence: Optional new recurrence (daily/weekdays/weekly/monthly).
        user_id: Optional user_id scoping.
    """
    try:
        oid = ObjectId(task_id)
    except Exception:
        return {"error": f"invalid task_id: {task_id!r}"}
        
    query = {"_id": oid}
    if user_id:
        query["$or"] = [{"user_id": user_id}, {"user_id": None}, {"user_id": {"$exists": False}}]
        
    update_fields = {}
    if title is not None:
        if not title.strip():
             return {"error": "title cannot be empty"}
        update_fields["title"] = title.strip()
    if description is not None:
        update_fields["description"] = description.strip()
    if priority is not None:
        if priority not in ("low", "medium", "high"):
            return {"error": f"priority must be low/medium/high, got {priority!r}"}
        update_fields["priority"] = priority
    if due_date is not None:
        try:
            datetime.strptime(due_date, "%Y-%m-%d")
        except ValueError:
            return {"error": "due_date must be in YYYY-MM-DD format"}
        update_fields["due_date"] = due_date
    if tags is not None:
        update_fields["tags"] = tags
    if recurrence is not None:
        if recurrence not in ("daily", "weekdays", "weekly", "monthly"):
            return {"error": f"recurrence must be daily, weekdays, weekly, or monthly, got {recurrence!r}"}
        update_fields["recurrence"] = recurrence
        
    if not update_fields:
        return {"error": "no fields provided to update"}
        
    update_fields["updated_at"] = datetime.now(timezone.utc)
    
    result = await tasks_collection.find_one_and_update(
        query,
        {"$set": update_fields},
        return_document=True
    )
    
    if result is None:
        return {"error": f"no task found with id {task_id} or permission denied"}
        
    return {"task": _serialize(result)}


@mcp.tool()
async def complete_task(task_id: str, user_id: Optional[str] = None) -> dict:
    """Mark a task as done and spawn the next task if recurring.
    
    Args:
        task_id: The task's id.
        user_id: Optional user_id scoping.
    """
    try:
        oid = ObjectId(task_id)
    except Exception:
        return {"error": f"invalid task_id: {task_id!r}"}
    
    query = {"_id": oid}
    if user_id:
        query["$or"] = [{"user_id": user_id}, {"user_id": None}, {"user_id": {"$exists": False}}]
        
    task = await tasks_collection.find_one(query)
    if not task:
        return {"error": f"no task found with id {task_id}"}
        
    now = datetime.now(timezone.utc)
    update_result = await tasks_collection.find_one_and_update(
        {"_id": oid},
        {"$set": {"status": "done", "updated_at": now}},
        return_document=True
    )
    
    if update_result is None:
        return {"error": f"no task found with id {task_id} or permission denied"}
    
    res = {"task": _serialize(update_result)}
    
    if task.get("recurrence") and task.get("due_date"):
        try:
            curr_date = datetime.strptime(task["due_date"], "%Y-%m-%d")
            recurrence = task["recurrence"]
            
            if recurrence == "daily":
                next_date = curr_date + timedelta(days=1)
            elif recurrence == "weekdays":
                next_date = curr_date + timedelta(days=1)
                while next_date.weekday() > 4: # 5=Sat, 6=Sun
                    next_date += timedelta(days=1)
            elif recurrence == "weekly":
                next_date = curr_date + timedelta(days=7)
            elif recurrence == "monthly":
                month = curr_date.month
                year = curr_date.year
                
                if month == 12:
                    month = 1
                    year += 1
                else:
                    month += 1
                    
                last_day = monthrange(year, month)[1]
                day = min(curr_date.day, last_day)
                next_date = curr_date.replace(year=year, month=month, day=day)
                
            next_date_str = next_date.strftime("%Y-%m-%d")
            
            new_task = {
                "title": task["title"],
                "description": task.get("description", ""),
                "priority": task.get("priority", "medium"),
                "status": "open",
                "created_at": now,
                "updated_at": now,
                "user_id": task.get("user_id"),
                "due_date": next_date_str,
                "recurrence": recurrence,
                "tags": task.get("tags", [])
            }
            
            insert_result = await tasks_collection.insert_one(new_task)
            new_task["_id"] = insert_result.inserted_id
            res["new_task"] = _serialize(new_task)
            
        except Exception:
            pass

    return res


@mcp.tool()
async def update_task_status(task_id: str, status: str, user_id: Optional[str] = None) -> dict:
    """Mark a task as open or done.

    Args:
        task_id: The task's id, as returned by add_task/get_tasks.
        status: "open" or "done".
        user_id: Optional user_id scoping.
    """
    if status not in ("open", "done"):
        return {"error": f"status must be open/done, got {status!r}"}
    try:
        oid = ObjectId(task_id)
    except Exception:
        return {"error": f"invalid task_id: {task_id!r}"}

    query = {"_id": oid}
    if user_id:
        query["$or"] = [{"user_id": user_id}, {"user_id": None}, {"user_id": {"$exists": False}}]

    result = await tasks_collection.find_one_and_update(
        query,
        {"$set": {"status": status, "updated_at": datetime.now(timezone.utc)}},
        return_document=True,
    )
    if result is None:
        return {"error": f"no task found with id {task_id} or permission denied"}
    return {"task": _serialize(result)}


@mcp.tool()
async def delete_task(task_id: str, user_id: Optional[str] = None) -> dict:
    """Delete a task permanently.

    Args:
        task_id: The task's id, as returned by add_task/get_tasks.
        user_id: Optional user_id scoping.
    """
    try:
        oid = ObjectId(task_id)
    except Exception:
        return {"error": f"invalid task_id: {task_id!r}"}

    query = {"_id": oid}
    if user_id:
        query["$or"] = [{"user_id": user_id}, {"user_id": None}, {"user_id": {"$exists": False}}]

    result = await tasks_collection.delete_one(query)
    if result.deleted_count == 0:
        return {"error": f"no task found with id {task_id} or permission denied"}
    return {"deleted": task_id}


if __name__ == "__main__":
    mcp.run(transport="stdio")
