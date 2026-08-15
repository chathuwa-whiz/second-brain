"""
Trust-layer logger. Every module and the orchestrator import this and call
`log_action(...)` right before (or instead of) actually executing something.
Supports Oracle Autonomous AI Database 23ai (Thin mode) and PostgreSQL.
"""

import json
import os
from contextlib import contextmanager
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

try:
    import oracledb
    oracledb.fetchAsString = [oracledb.CLOB]
    oracledb.autoCommit = True
except ImportError:
    oracledb = None

try:
    import psycopg2
    import psycopg2.extras
except ImportError:
    psycopg2 = None

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / ".env")

ORACLE_USER = os.environ.get("ORACLE_USER", "ADMIN")
ORACLE_PASSWORD = os.environ.get("ORACLE_PASSWORD", "Chathushka@2002")
ORACLE_CONNECT_STRING = os.environ.get(
    "ORACLE_CONNECT_STRING",
    "(description=(retry_count=20)(retry_delay=3)(address=(protocol=tcps)(port=1522)(host=adb.ap-singapore-1.oraclecloud.com))(connect_data=(service_name=g9cfbd628b0ef7a_secondbrain_high.adb.oraclecloud.com))(security=(ssl_server_dn_match=yes)))",
)

DATABASE_URL = os.environ.get("LOG_DATABASE_URL")


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
    if oracledb and (ORACLE_CONNECT_STRING or not DATABASE_URL):
        conn = oracledb.connect(
            user=ORACLE_USER,
            password=ORACLE_PASSWORD,
            dsn=ORACLE_CONNECT_STRING,
        )
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()
    elif psycopg2 and DATABASE_URL:
        conn = psycopg2.connect(DATABASE_URL)
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()
    else:
        raise RuntimeError("No Oracle or PostgreSQL database configuration found.")


def log_action(entry: ActionLogEntry) -> int:
    """Insert a log row, return its id."""
    if not (0.0 <= entry.confidence <= 1.0):
        raise ValueError("confidence must be between 0 and 1")

    with _connect() as conn:
        with conn.cursor() as cur:
            if hasattr(cur, "var"):  # Oracle cursor
                out_id = cur.var(oracledb.NUMBER)
                cur.execute(
                    """
                    INSERT INTO agent_actions (module, action, reasoning, confidence, status, metadata)
                    VALUES (:module, :action, :reasoning, :confidence, :status, :metadata)
                    RETURNING id INTO :out_id
                    """,
                    {
                        "module": entry.module,
                        "action": entry.action,
                        "reasoning": entry.reasoning,
                        "confidence": float(entry.confidence),
                        "status": entry.status,
                        "metadata": json.dumps(entry.metadata),
                        "out_id": out_id,
                    },
                )
                return int(out_id.getvalue()[0])
            else:
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
            now_utc = datetime.now(timezone.utc)
            if hasattr(cur, "var"):
                cur.execute(
                    """
                    UPDATE agent_actions
                    SET status = :status, reviewed_at = :reviewed_at, reviewed_by = :reviewed_by
                    WHERE id = :id
                    """,
                    {
                        "status": status,
                        "reviewed_at": now_utc,
                        "reviewed_by": reviewed_by,
                        "id": action_id,
                    },
                )
            else:
                cur.execute(
                    """
                    UPDATE agent_actions
                    SET status = %s, reviewed_at = %s, reviewed_by = %s
                    WHERE id = %s
                    """,
                    (status, now_utc, reviewed_by, action_id),
                )


def get_recent(limit: int = 50, module: Optional[str] = None) -> list[dict]:
    with _connect() as conn:
        with conn.cursor() as cur:
            if hasattr(cur, "var"):
                if module:
                    cur.execute(
                        """
                        SELECT id, created_at, module, action, reasoning, confidence, status, metadata,
                               reviewed_at, reviewed_by, executed_at, execution_result
                        FROM agent_actions WHERE module = :module
                        ORDER BY created_at DESC FETCH FIRST :limit ROWS ONLY
                        """,
                        {"module": module, "limit": limit},
                    )
                else:
                    cur.execute(
                        """
                        SELECT id, created_at, module, action, reasoning, confidence, status, metadata,
                               reviewed_at, reviewed_by, executed_at, execution_result
                        FROM agent_actions
                        ORDER BY created_at DESC FETCH FIRST :limit ROWS ONLY
                        """,
                        {"limit": limit},
                    )
                rows = cur.fetchall()
                result = []
                for r in rows:
                    row_dict = r if isinstance(r, dict) else {
                        "id": r[0], "created_at": r[1], "module": r[2], "action": r[3],
                        "reasoning": r[4], "confidence": r[5], "status": r[6],
                        "metadata": json.loads(r[7]) if isinstance(r[7], str) else r[7],
                        "reviewed_at": r[8], "reviewed_by": r[9], "executed_at": r[10],
                        "execution_result": json.loads(r[11]) if isinstance(r[11], str) else r[11]
                    }
                    result.append(row_dict)
                return result
            else:
                with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as pcur:
                    if module:
                        pcur.execute(
                            "SELECT * FROM agent_actions WHERE module = %s ORDER BY created_at DESC LIMIT %s",
                            (module, limit),
                        )
                    else:
                        pcur.execute(
                            "SELECT * FROM agent_actions ORDER BY created_at DESC LIMIT %s",
                            (limit,),
                        )
                    return [dict(row) for row in pcur.fetchall()]


if __name__ == "__main__":
    entry_id = log_action(
        ActionLogEntry(
            module="foundation",
            action="smoke_test",
            reasoning="Verifying logger writes and reads correctly on Oracle Autonomous AI Database.",
            confidence=1.0,
            status="auto_executed",
            metadata={"source": "logger.py __main__", "database": "Oracle 23ai"},
        )
    )
    print(f"Logged action id={entry_id}")
    recent = get_recent(3)
    print("Recent actions:", recent)
