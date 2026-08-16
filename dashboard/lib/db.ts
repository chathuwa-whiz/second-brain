import oracledb from "oracledb";

// Enable Thin mode, fetch CLOB as string, and JSON formatted objects
oracledb.fetchAsString = [oracledb.CLOB];
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
oracledb.autoCommit = true;

declare global {
  // eslint-disable-next-line no-var
  var _oraclePool: oracledb.Pool | undefined;
}

let _pool: oracledb.Pool | null = null;

export function oracleConfigured(): boolean {
  return Boolean(
    process.env.ORACLE_CONNECT_STRING ||
      process.env.ORACLE_USER ||
      process.env.ORACLE_PASSWORD
  );
}

export async function getOraclePool(): Promise<oracledb.Pool> {
  if (_pool) return _pool;
  if (global._oraclePool) {
    _pool = global._oraclePool;
    return _pool;
  }

  const user = process.env.ORACLE_USER || "ADMIN";
  const password = process.env.ORACLE_PASSWORD || "Chathushka@2002";
  const connectString =
    process.env.ORACLE_CONNECT_STRING ||
    "(description=(retry_count=20)(retry_delay=3)(address=(protocol=tcps)(port=1522)(host=adb.ap-singapore-1.oraclecloud.com))(connect_data=(service_name=g9cfbd628b0ef7a_secondbrain_high.adb.oraclecloud.com))(security=(ssl_server_dn_match=yes)))";

  _pool = await oracledb.createPool({
    user,
    password,
    connectString,
    poolMin: 1,
    poolMax: 5,
    poolIncrement: 1,
  });

  if (process.env.NODE_ENV !== "production") {
    global._oraclePool = _pool;
  }
  return _pool;
}

export async function getDb(): Promise<any> {
  const pool = await getOraclePool();
  return pool.getConnection();
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

function formatAction(row: any): AgentAction {
  let meta: Record<string, unknown> = {};
  try {
    meta =
      typeof row.METADATA === "string"
        ? JSON.parse(row.METADATA)
        : row.METADATA || {};
  } catch {
    meta = {};
  }

  let execRes: Record<string, unknown> | null = null;
  try {
    execRes =
      typeof row.EXECUTION_RESULT === "string"
        ? JSON.parse(row.EXECUTION_RESULT)
        : row.EXECUTION_RESULT || null;
  } catch {
    execRes = null;
  }

  return {
    id: row.ID,
    created_at: row.CREATED_AT || "",
    module: row.MODULE || "",
    action: row.ACTION || "",
    reasoning: row.REASONING || "",
    confidence: String(row.CONFIDENCE ?? 0),
    status: row.STATUS || "pending",
    metadata: meta,
    reviewed_at: row.REVIEWED_AT || null,
    reviewed_by: row.REVIEWED_BY || null,
    executed_at: row.EXECUTED_AT || null,
    execution_result: execRes,
  };
}

export async function fetchActions(opts: {
  status?: string;
  module?: string;
  limit?: number;
}): Promise<{ actions: AgentAction[]; error: string | null }> {
  const { status, module, limit = 100 } = opts;
  const where: string[] = [];
  const binds: Record<string, unknown> = {};

  if (status) {
    where.push("status = :status");
    binds.status = status;
  }
  if (module) {
    where.push("module = :module");
    binds.module = module;
  }

  const sql = `SELECT id, 
          TO_CHAR(created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as created_at,
          module, action, reasoning, confidence, status, metadata,
          TO_CHAR(reviewed_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as reviewed_at,
          reviewed_by,
          TO_CHAR(executed_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as executed_at,
          execution_result
   FROM agent_actions
   ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
   ORDER BY created_at DESC
   FETCH FIRST ${Number(limit)} ROWS ONLY`;

  let conn;
  try {
    conn = await getDb();
    const result: any = await conn.execute(sql, binds);
    const actions = (result.rows || []).map(formatAction);
    return { actions, error: null };
  } catch (err) {
    console.error("fetchActions failed on Oracle DB:", err);
    return {
      actions: [],
      error:
        err instanceof Error ? err.message : "Could not reach Oracle Database.",
    };
  } finally {
    if (conn) await conn.close();
  }
}

export async function fetchActionById(id: number): Promise<{
  action: AgentAction | null;
  error: string | null;
}> {
  let conn;
  try {
    conn = await getDb();
    const sql = `SELECT id, 
            TO_CHAR(created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as created_at,
            module, action, reasoning, confidence, status, metadata,
            TO_CHAR(reviewed_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as reviewed_at,
            reviewed_by,
            TO_CHAR(executed_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as executed_at,
            execution_result
     FROM agent_actions
     WHERE id = :id`;
    const result: any = await conn.execute(sql, { id });
    if (!result.rows || result.rows.length === 0) {
      return { action: null, error: "Action not found" };
    }
    return { action: formatAction(result.rows[0]), error: null };
  } catch (err) {
    console.error("fetchActionById failed on Oracle DB:", err);
    return {
      action: null,
      error: err instanceof Error ? err.message : "Database error",
    };
  } finally {
    if (conn) await conn.close();
  }
}

export async function updateActionMetadata(
  id: number,
  metadata: Record<string, unknown>,
  reasoning?: string
): Promise<{ action: AgentAction | null; error: string | null }> {
  let conn;
  try {
    conn = await getDb();
    const sql = reasoning
      ? `UPDATE agent_actions SET metadata = :metadata, reasoning = :reasoning WHERE id = :id`
      : `UPDATE agent_actions SET metadata = :metadata WHERE id = :id`;
    const binds = reasoning
      ? { metadata: JSON.stringify(metadata), reasoning, id }
      : { metadata: JSON.stringify(metadata), id };
    await conn.execute(sql, binds);
    return fetchActionById(id);
  } catch (err) {
    console.error("updateActionMetadata failed on Oracle DB:", err);
    return {
      action: null,
      error: err instanceof Error ? err.message : "Database error",
    };
  } finally {
    if (conn) await conn.close();
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
  let conn;
  try {
    conn = await getDb();
    const [totalsRes, modulesRes]: any = await Promise.all([
      conn.execute(`SELECT
          count(*) AS total,
          count(CASE WHEN status = 'pending' THEN 1 END) AS pending,
          count(CASE WHEN status = 'auto_executed' THEN 1 END) AS auto_executed,
          count(CASE WHEN status = 'approved' THEN 1 END) AS approved,
          count(CASE WHEN status = 'rejected' THEN 1 END) AS rejected,
          count(CASE WHEN status = 'failed' THEN 1 END) AS failed,
          count(CASE WHEN created_at > (CURRENT_TIMESTAMP - INTERVAL '1' DAY) THEN 1 END) AS last_24h
        FROM agent_actions`),
      conn.execute(
        `SELECT module, count(*) AS "count" FROM agent_actions
         GROUP BY module ORDER BY "count" DESC`
      ),
    ]);

    const r = totalsRes.rows[0];
    const moduleRows = (modulesRes.rows || []).map((m: any) => ({
      module: m.MODULE,
      count: Number(m.count || m.COUNT || 0),
    }));

    return {
      stats: {
        total: Number(r.TOTAL || 0),
        pending: Number(r.PENDING || 0),
        autoExecuted: Number(r.AUTO_EXECUTED || 0),
        approved: Number(r.APPROVED || 0),
        rejected: Number(r.REJECTED || 0),
        failed: Number(r.FAILED || 0),
        last24h: Number(r.LAST_24H || 0),
        byModule: moduleRows,
      },
      error: null,
    };
  } catch (err) {
    console.error("fetchStats failed on Oracle DB:", err);
    return {
      stats: EMPTY_STATS,
      error:
        err instanceof Error ? err.message : "Could not reach Oracle Database.",
    };
  } finally {
    if (conn) await conn.close();
  }
}

export type EmailSettings = {
  provider: "smtp";
  default_sender_email: string;
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_password?: string;
};

export const DEFAULT_EMAIL_SETTINGS: EmailSettings = {
  provider: "smtp",
  default_sender_email: "chathushkanavod11@gmail.com",
  smtp_host: "smtp.gmail.com",
  smtp_port: 465,
  smtp_user: "chathushkanavod11@gmail.com",
  smtp_password: "",
};

export async function getEmailSettings(): Promise<EmailSettings> {
  let conn;
  try {
    conn = await getDb();
    const result: any = await conn.execute(
      `SELECT value FROM system_settings WHERE key = 'email_settings'`
    );
    if (!result.rows || result.rows.length === 0) return DEFAULT_EMAIL_SETTINGS;
    const raw = result.rows[0].VALUE;
    const val = typeof raw === "string" ? JSON.parse(raw) : raw;
    return { ...DEFAULT_EMAIL_SETTINGS, ...val };
  } catch (err) {
    console.error("getEmailSettings error from Oracle DB:", err);
    return DEFAULT_EMAIL_SETTINGS;
  } finally {
    if (conn) await conn.close();
  }
}

export async function saveEmailSettings(
  settings: Partial<EmailSettings>
): Promise<EmailSettings> {
  const current = await getEmailSettings();
  const updated = { ...current, ...settings };
  let conn;
  try {
    conn = await getDb();
    await conn.execute(
      `MERGE INTO system_settings s
       USING (SELECT 'email_settings' AS k FROM dual) src
       ON (s.key = src.k)
       WHEN MATCHED THEN
         UPDATE SET s.value = :val, s.updated_at = CURRENT_TIMESTAMP
       WHEN NOT MATCHED THEN
         INSERT (key, value, updated_at) VALUES ('email_settings', :val, CURRENT_TIMESTAMP)`,
      { val: JSON.stringify(updated) }
    );
    return updated;
  } catch (err) {
    console.error("saveEmailSettings error on Oracle DB:", err);
    throw err;
  } finally {
    if (conn) await conn.close();
  }
}
