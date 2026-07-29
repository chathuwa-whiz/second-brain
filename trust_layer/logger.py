"""
Trust-layer logger. Every module and the orchestrator import this and call
`log_action(...)` right before (or instead of) actually executing something.

Design choice: logging happens synchronously and *before* side-effecting calls
where possible, so even a crash mid-action leaves a trace. For actions that
require human approval, log with status="pending" and update it later via
`update_status(...)` once a human approves/rejects from the dashboard.

Approval != execution: `update_status(id, "approved")` just records that a
human said yes. Actually calling the MCP tool happens separately, in
orchestrator/approval_executor.py, which polls `get_approved_unexecuted()`
and calls `mark_executed(...)` once done. Kept as two steps so approving
from the dashboard (a fast HTTP request) never blocks on a possibly-slow
tool call.
"""

import json
import os
from contextlib import contextmanager
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

# Loads trust_layer/.env if present — only relevant when running this file
# standalone (`python logger.py`, the smoke test below). When imported by
# the orchestrator, orchestrator/.env has already been loaded into the
# process environment before this import happens, so this is a no-op then;
# load_dotenv() never overwrites vars already set.
load_dotenv(Path(__file__).resolve().parent / ".env")

DATABASE_URL = os.environ.get("LOG_DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError(
        "LOG_DATABASE_URL is not set. Put your Postgres connection string "
        "(e.g. a Neon connection string) in a local .env file — never hardcode "
        "it here or commit it. See .env.example."
    )


@dataclass
class ActionLogEntry:
    module: str
    action: str
    reasoning: str
    confidence: float
    status: str = "auto_executed"  # pending | approved | rejected | auto_executed | failed
    metadata: dict[str, Any] = field(default_factory=dict)


@contextmanager
def _connect():
    conn = psycopg2.connect(DATABASE_URL)
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def log_action(entry: ActionLogEntry) -> int:
    """Insert a log row, return its id."""
    if not (0.0 <= entry.confidence <= 1.0):
        raise ValueError("confidence must be between 0 and 1")

    with _connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO agent_actions (module, action, reasoning, confidence, status, metadata)
                VALUES (%s, %s, %s, %s, %s, %s)
                RETURNING id
                """,
                (
                    entry.module,
                    entry.action,
                    entry.reasoning,
                    entry.confidence,
                    entry.status,
                    json.dumps(entry.metadata),
                ),
            )
            return cur.fetchone()[0]


def update_status(action_id: int, status: str, reviewed_by: Optional[str] = None) -> None:
    with _connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE agent_actions
                SET status = %s, reviewed_at = %s, reviewed_by = %s
                WHERE id = %s
                """,
                (status, datetime.now(timezone.utc), reviewed_by, action_id),
            )


def get_recent(limit: int = 50, module: Optional[str] = None) -> list[dict]:
    with _connect() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            if module:
                cur.execute(
                    "SELECT * FROM agent_actions WHERE module = %s ORDER BY created_at DESC LIMIT %s",
                    (module, limit),
                )
            else:
                cur.execute(
                    "SELECT * FROM agent_actions ORDER BY created_at DESC LIMIT %s",
                    (limit,),
                )
            return [dict(row) for row in cur.fetchall()]


def get_pending(limit: int = 50) -> list[dict]:
    with _connect() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                "SELECT * FROM agent_actions WHERE status = 'pending' ORDER BY created_at ASC LIMIT %s",
                (limit,),
            )
            return [dict(row) for row in cur.fetchall()]


def get_approved_unexecuted(limit: int = 50) -> list[dict]:
    """Actions a human has approved from the dashboard but that
    approval_executor.py hasn't actually run yet."""
    with _connect() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT * FROM agent_actions
                WHERE status = 'approved' AND executed_at IS NULL
                ORDER BY reviewed_at ASC
                LIMIT %s
                """,
                (limit,),
            )
            return [dict(row) for row in cur.fetchall()]


def mark_executed(action_id: int, result: dict) -> None:
    """Record that an approved action was actually run, with its result.
    Status stays 'approved' — executed_at is what distinguishes "approved,
    ran successfully" from "approved, still queued"."""
    with _connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE agent_actions
                SET executed_at = %s, execution_result = %s
                WHERE id = %s
                """,
                (datetime.now(timezone.utc), json.dumps(result), action_id),
            )


def mark_execution_failed(action_id: int, error: str) -> None:
    """An approved action was attempted but the tool call itself failed
    (as opposed to being rejected by a human). Flips status to 'failed' so
    it's visually distinct in the dashboard and stops being picked up by
    get_approved_unexecuted() (it's no longer status='approved')."""
    with _connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE agent_actions
                SET status = 'failed', executed_at = %s, execution_result = %s
                WHERE id = %s
                """,
                (datetime.now(timezone.utc), json.dumps({"error": error}), action_id),
            )


if __name__ == "__main__":
    # smoke test
    entry_id = log_action(
        ActionLogEntry(
            module="foundation",
            action="smoke_test",
            reasoning="Verifying logger writes and reads correctly during Phase 0 setup.",
            confidence=1.0,
            status="auto_executed",
            metadata={"source": "logger.py __main__"},
        )
    )
    print(f"Logged action id={entry_id}")
    print(get_recent(5))
