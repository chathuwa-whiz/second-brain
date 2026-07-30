import { Pool } from "pg";

// Reused across hot-reloads in dev, single pool in prod.
declare global {
  // eslint-disable-next-line no-var
  var _pgPool: Pool | undefined;
}

let _pool: Pool | null = null;

/*
  Lazy, so that importing this module doesn't require LOG_DATABASE_URL to be
  set. `next build` evaluates module scope while collecting page data, and a
  throw at import time makes the build fail on any machine without a database
  connection string - including CI. The error still surfaces clearly, just at
  the point something actually queries.
*/
export function getPool(): Pool {
  if (_pool) return _pool;
  if (global._pgPool) {
    _pool = global._pgPool;
    return _pool;
  }

  const connectionString = process.env.LOG_DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "LOG_DATABASE_URL is not set. Put your Postgres connection string " +
        "(e.g. a Neon connection string) in .env.local — never hardcode it " +
        "here or commit it. See .env.example."
    );
  }

  // Neon (and most managed Postgres) requires TLS. node-postgres doesn't
  // reliably honor `sslmode=require` embedded in the connection string, so
  // enable it explicitly for anything that isn't a local/dev database.
  const isLocal = /localhost|127\.0\.0\.1/.test(connectionString);

  _pool = new Pool({
    connectionString,
    ssl: isLocal ? undefined : { rejectUnauthorized: false },
  });

  if (process.env.NODE_ENV !== "production") {
    global._pgPool = _pool;
  }
  return _pool;
}

export type AgentAction = {
  id: number;
  created_at: string;
  module: string;
  action: string;
  reasoning: string;
  confidence: string;
  status: "pending" | "approved" | "rejected" | "auto_executed" | "failed";
  metadata: Record<string, unknown>;
  reviewed_at: string | null;
  reviewed_by: string | null;
  executed_at: string | null;
  execution_result: Record<string, unknown> | null;
};

/*
  Every page that reads the log goes through one of these, so a query change
  lands in one place. Each returns a safe fallback rather than throwing: the
  control panel should render and say "can't reach the log" rather than
  showing an error page, because a database blip shouldn't take down the
  approval queue's own error reporting.
*/

export async function fetchActions(opts: {
  status?: string;
  module?: string;
  limit?: number;
}): Promise<{ actions: AgentAction[]; error: string | null }> {
  const { status, module, limit = 100 } = opts;
  const where: string[] = [];
  const values: unknown[] = [];

  if (status) {
    values.push(status);
    where.push(`status = $${values.length}`);
  }
  if (module) {
    values.push(module);
    where.push(`module = $${values.length}`);
  }
  values.push(limit);

  const sql = `SELECT * FROM agent_actions
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY created_at DESC LIMIT $${values.length}`;

  try {
    const { rows } = await getPool().query(sql, values);
    return { actions: rows as AgentAction[], error: null };
  } catch (err) {
    console.error("fetchActions failed:", err);
    return {
      actions: [],
      error:
        err instanceof Error ? err.message : "Could not reach the action log.",
    };
  }
}

export type ActionStats = {
  total: number;
  pending: number;
  autoExecuted: number;
  approved: number;
  rejected: number;
  failed: number;
  last24h: number;
  byModule: { module: string; count: number }[];
};

const EMPTY_STATS: ActionStats = {
  total: 0,
  pending: 0,
  autoExecuted: 0,
  approved: 0,
  rejected: 0,
  failed: 0,
  last24h: 0,
  byModule: [],
};

export async function fetchStats(): Promise<{
  stats: ActionStats;
  error: string | null;
}> {
  try {
    const pool = getPool();
    const [totals, modules] = await Promise.all([
      pool.query(`SELECT
          count(*)::int AS total,
          count(*) FILTER (WHERE status = 'pending')::int AS pending,
          count(*) FILTER (WHERE status = 'auto_executed')::int AS auto_executed,
          count(*) FILTER (WHERE status = 'approved')::int AS approved,
          count(*) FILTER (WHERE status = 'rejected')::int AS rejected,
          count(*) FILTER (WHERE status = 'failed')::int AS failed,
          count(*) FILTER (WHERE created_at > now() - interval '24 hours')::int AS last_24h
        FROM agent_actions`),
      pool.query(
        `SELECT module, count(*)::int AS count FROM agent_actions
         GROUP BY module ORDER BY count DESC`
      ),
    ]);

    const r = totals.rows[0];
    return {
      stats: {
        total: r.total,
        pending: r.pending,
        autoExecuted: r.auto_executed,
        approved: r.approved,
        rejected: r.rejected,
        failed: r.failed,
        last24h: r.last_24h,
        byModule: modules.rows,
      },
      error: null,
    };
  } catch (err) {
    console.error("fetchStats failed:", err);
    return {
      stats: EMPTY_STATS,
      error:
        err instanceof Error ? err.message : "Could not reach the action log.",
    };
  }
}
