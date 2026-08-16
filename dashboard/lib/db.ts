import oracledb from "oracledb";
import { Pool as PgPool } from "pg";
import { randomUUID } from "crypto";

// Enable Thin mode, fetch CLOB as string, and JSON formatted objects
oracledb.fetchAsString = [oracledb.CLOB];
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
oracledb.autoCommit = true;

declare global {
  // eslint-disable-next-line no-var
  var _oraclePool: oracledb.Pool | undefined;
  // eslint-disable-next-line no-var
  var _pgPool: PgPool | undefined;
}

let _oraclePoolInstance: oracledb.Pool | null = null;
let _pgPoolInstance: PgPool | null = null;

export function isPgConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL || process.env.POSTGRES_URL);
}

export function oracleConfigured(): boolean {
  return Boolean(
    process.env.ORACLE_CONNECT_STRING ||
      process.env.ORACLE_USER ||
      process.env.ORACLE_PASSWORD
  );
}

export async function getOraclePool(): Promise<oracledb.Pool> {
  if (_oraclePoolInstance) return _oraclePoolInstance;
  if (global._oraclePool) {
    _oraclePoolInstance = global._oraclePool;
    return _oraclePoolInstance;
  }

  const user = process.env.ORACLE_USER || "ADMIN";
  const password = process.env.ORACLE_PASSWORD || "Chathushka@2002";
  const connectString =
    process.env.ORACLE_CONNECT_STRING ||
    "(description=(retry_count=20)(retry_delay=3)(address=(protocol=tcps)(port=1522)(host=adb.ap-singapore-1.oraclecloud.com))(connect_data=(service_name=g9cfbd628b0ef7a_secondbrain_high.adb.oraclecloud.com))(security=(ssl_server_dn_match=yes)))";

  _oraclePoolInstance = await oracledb.createPool({
    user,
    password,
    connectString,
    poolMin: 1,
    poolMax: 5,
    poolIncrement: 1,
  });

  if (process.env.NODE_ENV !== "production") {
    global._oraclePool = _oraclePoolInstance;
  }
  return _oraclePoolInstance;
}

export function getPgPool(): PgPool {
  if (_pgPoolInstance) return _pgPoolInstance;
  if (global._pgPool) {
    _pgPoolInstance = global._pgPool;
    return _pgPoolInstance;
  }

  const connectionString =
    process.env.DATABASE_URL || process.env.POSTGRES_URL;
  _pgPoolInstance = new PgPool({
    connectionString,
    ssl:
      process.env.NODE_ENV === "production"
        ? { rejectUnauthorized: false }
        : undefined,
  });

  if (process.env.NODE_ENV !== "production") {
    global._pgPool = _pgPoolInstance;
  }
  return _pgPoolInstance;
}

export async function getDb(): Promise<any> {
  if (isPgConfigured()) {
    const pool = getPgPool();
    return pool.connect();
  }
  const pool = await getOraclePool();
  return pool.getConnection();
}

// ---------------------------------------------------------------------------
// Type Definitions
// ---------------------------------------------------------------------------

export type User = {
  id: string;
  name: string | null;
  email: string;
  password_hash: string | null;
  email_verified: string | null;
  image: string | null;
  role: string;
  created_at: string;
  updated_at: string;
};

export type VerificationToken = {
  id: string;
  user_id: string;
  token: string;
  token_type: string;
  expires_at: string;
  created_at: string;
};

export type AgentAction = {
  id: number;
  user_id: string | null;
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
        : typeof row.metadata === "string"
        ? JSON.parse(row.metadata)
        : row.METADATA || row.metadata || {};
  } catch {
    meta = {};
  }

  let execRes: Record<string, unknown> | null = null;
  try {
    execRes =
      typeof row.EXECUTION_RESULT === "string"
        ? JSON.parse(row.EXECUTION_RESULT)
        : typeof row.execution_result === "string"
        ? JSON.parse(row.execution_result)
        : row.EXECUTION_RESULT || row.execution_result || null;
  } catch {
    execRes = null;
  }

  return {
    id: Number(row.ID ?? row.id),
    user_id: row.USER_ID ?? row.user_id ?? null,
    created_at: row.CREATED_AT || row.created_at || "",
    module: row.MODULE || row.module || "",
    action: row.ACTION || row.action || "",
    reasoning: row.REASONING || row.reasoning || "",
    confidence: String(row.CONFIDENCE ?? row.confidence ?? 0),
    status: row.STATUS || row.status || "pending",
    metadata: meta,
    reviewed_at: row.REVIEWED_AT || row.reviewed_at || null,
    reviewed_by: row.REVIEWED_BY || row.reviewed_by || null,
    executed_at: row.EXECUTED_AT || row.executed_at || null,
    execution_result: execRes,
  };
}

function formatUser(row: any): User {
  return {
    id: String(row.ID || row.id),
    name: row.NAME || row.name || null,
    email: String(row.EMAIL || row.email || "").toLowerCase(),
    password_hash: row.PASSWORD_HASH || row.password_hash || null,
    email_verified: row.EMAIL_VERIFIED || row.email_verified || null,
    image: row.IMAGE || row.image || null,
    role: row.ROLE || row.role || "user",
    created_at: row.CREATED_AT || row.created_at || "",
    updated_at: row.UPDATED_AT || row.updated_at || "",
  };
}

// ---------------------------------------------------------------------------
// User & Auth Database Operations
// ---------------------------------------------------------------------------

export async function getUserByEmail(email: string): Promise<User | null> {
  const cleanEmail = email.trim().toLowerCase();
  let conn: any;
  try {
    conn = await getDb();
    if (isPgConfigured()) {
      const res = await conn.query("SELECT * FROM users WHERE LOWER(email) = $1", [cleanEmail]);
      if (!res.rows || res.rows.length === 0) return null;
      return formatUser(res.rows[0]);
    } else {
      const res = await conn.execute(
        `SELECT id, name, email, password_hash, 
                TO_CHAR(email_verified, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as email_verified,
                image, role,
                TO_CHAR(created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as created_at,
                TO_CHAR(updated_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as updated_at
         FROM users WHERE LOWER(email) = :email`,
        { email: cleanEmail }
      );
      if (!res.rows || res.rows.length === 0) return null;
      return formatUser(res.rows[0]);
    }
  } catch (err) {
    console.error("getUserByEmail error:", err);
    return null;
  } finally {
    if (conn) {
      if (typeof conn.release === "function") conn.release();
      else if (typeof conn.close === "function") await conn.close();
    }
  }
}

export async function getUserById(id: string): Promise<User | null> {
  let conn: any;
  try {
    conn = await getDb();
    if (isPgConfigured()) {
      const res = await conn.query("SELECT * FROM users WHERE id = $1", [id]);
      if (!res.rows || res.rows.length === 0) return null;
      return formatUser(res.rows[0]);
    } else {
      const res = await conn.execute(
        `SELECT id, name, email, password_hash, 
                TO_CHAR(email_verified, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as email_verified,
                image, role,
                TO_CHAR(created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as created_at,
                TO_CHAR(updated_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as updated_at
         FROM users WHERE id = :id`,
        { id }
      );
      if (!res.rows || res.rows.length === 0) return null;
      return formatUser(res.rows[0]);
    }
  } catch (err) {
    console.error("getUserById error:", err);
    return null;
  } finally {
    if (conn) {
      if (typeof conn.release === "function") conn.release();
      else if (typeof conn.close === "function") await conn.close();
    }
  }
}

export async function createUser(data: {
  id?: string;
  name?: string | null;
  email: string;
  passwordHash?: string | null;
  image?: string | null;
  emailVerified?: Date | null;
  role?: string;
}): Promise<User> {
  const id = data.id || randomUUID();
  const email = data.email.trim().toLowerCase();
  const name = data.name || null;
  const passwordHash = data.passwordHash || null;
  const image = data.image || null;
  const role = data.role || "user";
  const emailVerified = data.emailVerified ? new Date(data.emailVerified) : null;

  let conn: any;
  try {
    conn = await getDb();
    if (isPgConfigured()) {
      const res = await conn.query(
        `INSERT INTO users (id, name, email, password_hash, email_verified, image, role)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [id, name, email, passwordHash, emailVerified, image, role]
      );
      return formatUser(res.rows[0]);
    } else {
      await conn.execute(
        `INSERT INTO users (id, name, email, password_hash, email_verified, image, role)
         VALUES (:id, :name, :email, :passwordHash, :emailVerified, :image, :role)`,
        {
          id,
          name,
          email,
          passwordHash,
          emailVerified,
          image,
          role,
        }
      );
      const created = await getUserById(id);
      if (!created) throw new Error("Failed to retrieve created user");
      return created;
    }
  } finally {
    if (conn) {
      if (typeof conn.release === "function") conn.release();
      else if (typeof conn.close === "function") await conn.close();
    }
  }
}

export async function updateUserPassword(
  userId: string,
  newPasswordHash: string
): Promise<boolean> {
  let conn: any;
  try {
    conn = await getDb();
    if (isPgConfigured()) {
      await conn.query(
        `UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2`,
        [newPasswordHash, userId]
      );
    } else {
      await conn.execute(
        `UPDATE users SET password_hash = :newPasswordHash, updated_at = CURRENT_TIMESTAMP WHERE id = :userId`,
        { newPasswordHash, userId }
      );
    }
    return true;
  } catch (err) {
    console.error("updateUserPassword error:", err);
    return false;
  } finally {
    if (conn) {
      if (typeof conn.release === "function") conn.release();
      else if (typeof conn.close === "function") await conn.close();
    }
  }
}

export async function verifyUserEmail(userId: string): Promise<boolean> {
  let conn: any;
  try {
    conn = await getDb();
    if (isPgConfigured()) {
      await conn.query(
        `UPDATE users SET email_verified = now(), updated_at = now() WHERE id = $1`,
        [userId]
      );
    } else {
      await conn.execute(
        `UPDATE users SET email_verified = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = :userId`,
        { userId }
      );
    }
    return true;
  } catch (err) {
    console.error("verifyUserEmail error:", err);
    return false;
  } finally {
    if (conn) {
      if (typeof conn.release === "function") conn.release();
      else if (typeof conn.close === "function") await conn.close();
    }
  }
}

// ---------------------------------------------------------------------------
// Verification Tokens
// ---------------------------------------------------------------------------

export async function createVerificationToken(data: {
  userId: string;
  token: string;
  tokenType?: string;
  expiresAt: Date;
}): Promise<VerificationToken> {
  const id = randomUUID();
  const tokenType = data.tokenType || "email_verification";
  let conn: any;
  try {
    conn = await getDb();
    if (isPgConfigured()) {
      // Remove any existing tokens for this user and type
      await conn.query(
        `DELETE FROM verification_tokens WHERE user_id = $1 AND token_type = $2`,
        [data.userId, tokenType]
      );
      const res = await conn.query(
        `INSERT INTO verification_tokens (id, user_id, token, token_type, expires_at)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [id, data.userId, data.token, tokenType, data.expiresAt]
      );
      const row = res.rows[0];
      return {
        id: row.id,
        user_id: row.user_id,
        token: row.token,
        token_type: row.token_type,
        expires_at: row.expires_at,
        created_at: row.created_at,
      };
    } else {
      await conn.execute(
        `DELETE FROM verification_tokens WHERE user_id = :userId AND token_type = :tokenType`,
        { userId: data.userId, tokenType }
      );
      await conn.execute(
        `INSERT INTO verification_tokens (id, user_id, token, token_type, expires_at)
         VALUES (:id, :userId, :token, :tokenType, :expiresAt)`,
        {
          id,
          userId: data.userId,
          token: data.token,
          tokenType,
          expiresAt: data.expiresAt,
        }
      );
      return {
        id,
        user_id: data.userId,
        token: data.token,
        token_type: tokenType,
        expires_at: data.expiresAt.toISOString(),
        created_at: new Date().toISOString(),
      };
    }
  } finally {
    if (conn) {
      if (typeof conn.release === "function") conn.release();
      else if (typeof conn.close === "function") await conn.close();
    }
  }
}

export async function getVerificationToken(
  token: string
): Promise<VerificationToken | null> {
  let conn: any;
  try {
    conn = await getDb();
    if (isPgConfigured()) {
      const res = await conn.query(
        `SELECT * FROM verification_tokens WHERE token = $1`,
        [token]
      );
      if (!res.rows || res.rows.length === 0) return null;
      const row = res.rows[0];
      return {
        id: row.id,
        user_id: row.user_id,
        token: row.token,
        token_type: row.token_type,
        expires_at: row.expires_at,
        created_at: row.created_at,
      };
    } else {
      const res = await conn.execute(
        `SELECT id, user_id, token, token_type,
                TO_CHAR(expires_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as expires_at,
                TO_CHAR(created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as created_at
         FROM verification_tokens WHERE token = :token`,
        { token }
      );
      if (!res.rows || res.rows.length === 0) return null;
      const row = res.rows[0];
      return {
        id: String(row.ID || row.id),
        user_id: String(row.USER_ID || row.user_id),
        token: String(row.TOKEN || row.token),
        token_type: String(row.TOKEN_TYPE || row.token_type),
        expires_at: row.EXPIRES_AT || row.expires_at,
        created_at: row.CREATED_AT || row.created_at,
      };
    }
  } catch (err) {
    console.error("getVerificationToken error:", err);
    return null;
  } finally {
    if (conn) {
      if (typeof conn.release === "function") conn.release();
      else if (typeof conn.close === "function") await conn.close();
    }
  }
}

export async function deleteVerificationToken(token: string): Promise<boolean> {
  let conn: any;
  try {
    conn = await getDb();
    if (isPgConfigured()) {
      await conn.query(`DELETE FROM verification_tokens WHERE token = $1`, [
        token,
      ]);
    } else {
      await conn.execute(
        `DELETE FROM verification_tokens WHERE token = :token`,
        { token }
      );
    }
    return true;
  } catch (err) {
    console.error("deleteVerificationToken error:", err);
    return false;
  } finally {
    if (conn) {
      if (typeof conn.release === "function") conn.release();
      else if (typeof conn.close === "function") await conn.close();
    }
  }
}

// ---------------------------------------------------------------------------
// OAuth Account Linking
// ---------------------------------------------------------------------------

export async function getOrCreateOAuthUser(data: {
  name?: string | null;
  email: string;
  image?: string | null;
  provider: string;
  providerAccountId: string;
  accessToken?: string | null;
  refreshToken?: string | null;
  expiresAt?: number | null;
  idToken?: string | null;
  scope?: string | null;
}): Promise<User> {
  let user = await getUserByEmail(data.email);

  if (!user) {
    // Automatically verify email for trusted OAuth providers (Google)
    user = await createUser({
      name: data.name,
      email: data.email,
      image: data.image,
      emailVerified: new Date(),
    });
  } else if (!user.email_verified) {
    // If existing unverified email account signs in with Google, verify it
    await verifyUserEmail(user.id);
    user.email_verified = new Date().toISOString();
  }

  // Link account if not linked
  const accountId = randomUUID();
  let conn: any;
  try {
    conn = await getDb();
    if (isPgConfigured()) {
      await conn.query(
        `INSERT INTO accounts (id, user_id, type, provider, provider_account_id, access_token, refresh_token, expires_at, id_token, scope)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (provider, provider_account_id) DO UPDATE 
         SET access_token = EXCLUDED.access_token, refresh_token = EXCLUDED.refresh_token, expires_at = EXCLUDED.expires_at`,
        [
          accountId,
          user.id,
          "oauth",
          data.provider,
          data.providerAccountId,
          data.accessToken || null,
          data.refreshToken || null,
          data.expiresAt || null,
          data.idToken || null,
          data.scope || null,
        ]
      );
    } else {
      await conn.execute(
        `MERGE INTO accounts a
         USING (SELECT :provider AS p, :providerAccountId AS paid FROM dual) src
         ON (a.provider = src.p AND a.provider_account_id = src.paid)
         WHEN MATCHED THEN
           UPDATE SET access_token = :accessToken, refresh_token = :refreshToken, expires_at = :expiresAt
         WHEN NOT MATCHED THEN
           INSERT (id, user_id, type, provider, provider_account_id, access_token, refresh_token, expires_at, id_token, scope)
           VALUES (:id, :userId, 'oauth', :provider, :providerAccountId, :accessToken, :refreshToken, :expiresAt, :idToken, :scope)`,
        {
          id: accountId,
          userId: user.id,
          provider: data.provider,
          providerAccountId: data.providerAccountId,
          accessToken: data.accessToken || null,
          refreshToken: data.refreshToken || null,
          expiresAt: data.expiresAt || null,
          idToken: data.idToken || null,
          scope: data.scope || null,
        }
      );
    }
  } catch (err) {
    console.error("Link OAuth account error:", err);
  } finally {
    if (conn) {
      if (typeof conn.release === "function") conn.release();
      else if (typeof conn.close === "function") await conn.close();
    }
  }

  return user;
}

// ---------------------------------------------------------------------------
// Multi-Tenant Agent Actions
// ---------------------------------------------------------------------------

export async function fetchActions(opts: {
  userId?: string;
  status?: string;
  module?: string;
  limit?: number;
}): Promise<{ actions: AgentAction[]; error: string | null }> {
  const { userId, status, module, limit = 100 } = opts;
  const where: string[] = [];
  const binds: Record<string, unknown> = {};

  if (userId) {
    where.push(isPgConfigured() ? `(user_id = $${where.length + 1} OR user_id IS NULL)` : `(user_id = :userId OR user_id IS NULL)`);
    binds.userId = userId;
  }
  if (status) {
    where.push(isPgConfigured() ? `status = $${where.length + 1}` : `status = :status`);
    binds.status = status;
  }
  if (module) {
    where.push(isPgConfigured() ? `module = $${where.length + 1}` : `module = :module`);
    binds.module = module;
  }

  let conn: any;
  try {
    conn = await getDb();
    if (isPgConfigured()) {
      const sql = `SELECT id, 
              TO_CHAR(created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as created_at,
              user_id, module, action, reasoning, confidence, status, metadata,
              TO_CHAR(reviewed_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as reviewed_at,
              reviewed_by,
              TO_CHAR(executed_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as executed_at,
              execution_result
       FROM agent_actions
       ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
       ORDER BY created_at DESC
       LIMIT ${Number(limit)}`;
      const values = Object.values(binds);
      const result = await conn.query(sql, values);
      const actions = (result.rows || []).map(formatAction);
      return { actions, error: null };
    } else {
      const sql = `SELECT id, 
              TO_CHAR(created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as created_at,
              user_id, module, action, reasoning, confidence, status, metadata,
              TO_CHAR(reviewed_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as reviewed_at,
              reviewed_by,
              TO_CHAR(executed_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as executed_at,
              execution_result
       FROM agent_actions
       ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
       ORDER BY created_at DESC
       FETCH FIRST ${Number(limit)} ROWS ONLY`;
      const result: any = await conn.execute(sql, binds);
      const actions = (result.rows || []).map(formatAction);
      return { actions, error: null };
    }
  } catch (err) {
    console.error("fetchActions failed:", err);
    return {
      actions: [],
      error: err instanceof Error ? err.message : "Database query failed.",
    };
  } finally {
    if (conn) {
      if (typeof conn.release === "function") conn.release();
      else if (typeof conn.close === "function") await conn.close();
    }
  }
}

export async function fetchActionById(
  id: number,
  userId?: string
): Promise<{
  action: AgentAction | null;
  error: string | null;
}> {
  let conn: any;
  try {
    conn = await getDb();
    if (isPgConfigured()) {
      const sql = `SELECT id, 
              TO_CHAR(created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as created_at,
              user_id, module, action, reasoning, confidence, status, metadata,
              TO_CHAR(reviewed_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as reviewed_at,
              reviewed_by,
              TO_CHAR(executed_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as executed_at,
              execution_result
       FROM agent_actions
       WHERE id = $1 ${userId ? `AND (user_id = $2 OR user_id IS NULL)` : ""}`;
      const params = userId ? [id, userId] : [id];
      const result = await conn.query(sql, params);
      if (!result.rows || result.rows.length === 0) {
        return { action: null, error: "Action not found" };
      }
      return { action: formatAction(result.rows[0]), error: null };
    } else {
      const sql = `SELECT id, 
              TO_CHAR(created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as created_at,
              user_id, module, action, reasoning, confidence, status, metadata,
              TO_CHAR(reviewed_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as reviewed_at,
              reviewed_by,
              TO_CHAR(executed_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as executed_at,
              execution_result
       FROM agent_actions
       WHERE id = :id ${userId ? `AND (user_id = :userId OR user_id IS NULL)` : ""}`;
      const binds = userId ? { id, userId } : { id };
      const result: any = await conn.execute(sql, binds);
      if (!result.rows || result.rows.length === 0) {
        return { action: null, error: "Action not found" };
      }
      return { action: formatAction(result.rows[0]), error: null };
    }
  } catch (err) {
    console.error("fetchActionById failed:", err);
    return {
      action: null,
      error: err instanceof Error ? err.message : "Database error",
    };
  } finally {
    if (conn) {
      if (typeof conn.release === "function") conn.release();
      else if (typeof conn.close === "function") await conn.close();
    }
  }
}

export async function updateActionMetadata(
  id: number,
  metadata: Record<string, unknown>,
  reasoning?: string,
  userId?: string
): Promise<{ action: AgentAction | null; error: string | null }> {
  let conn: any;
  try {
    conn = await getDb();
    if (isPgConfigured()) {
      const sql = reasoning
        ? `UPDATE agent_actions SET metadata = $1, reasoning = $2 WHERE id = $3 ${
            userId ? "AND (user_id = $4 OR user_id IS NULL)" : ""
          }`
        : `UPDATE agent_actions SET metadata = $1 WHERE id = $2 ${
            userId ? "AND (user_id = $3 OR user_id IS NULL)" : ""
          }`;
      const params = reasoning
        ? userId
          ? [JSON.stringify(metadata), reasoning, id, userId]
          : [JSON.stringify(metadata), reasoning, id]
        : userId
        ? [JSON.stringify(metadata), id, userId]
        : [JSON.stringify(metadata), id];
      await conn.query(sql, params);
    } else {
      const sql = reasoning
        ? `UPDATE agent_actions SET metadata = :metadata, reasoning = :reasoning WHERE id = :id ${
            userId ? "AND (user_id = :userId OR user_id IS NULL)" : ""
          }`
        : `UPDATE agent_actions SET metadata = :metadata WHERE id = :id ${
            userId ? "AND (user_id = :userId OR user_id IS NULL)" : ""
          }`;
      const binds: any = reasoning
        ? { metadata: JSON.stringify(metadata), reasoning, id }
        : { metadata: JSON.stringify(metadata), id };
      if (userId) binds.userId = userId;
      await conn.execute(sql, binds);
    }
    return fetchActionById(id, userId);
  } catch (err) {
    console.error("updateActionMetadata failed:", err);
    return {
      action: null,
      error: err instanceof Error ? err.message : "Database error",
    };
  } finally {
    if (conn) {
      if (typeof conn.release === "function") conn.release();
      else if (typeof conn.close === "function") await conn.close();
    }
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

export async function fetchStats(userId?: string): Promise<{
  stats: ActionStats;
  error: string | null;
}> {
  let conn: any;
  try {
    conn = await getDb();
    if (isPgConfigured()) {
      const whereClause = userId ? `WHERE (user_id = $1 OR user_id IS NULL)` : "";
      const params = userId ? [userId] : [];

      const [totalsRes, modulesRes] = await Promise.all([
        conn.query(
          `SELECT
            count(*) AS total,
            count(CASE WHEN status = 'pending' THEN 1 END) AS pending,
            count(CASE WHEN status = 'auto_executed' THEN 1 END) AS auto_executed,
            count(CASE WHEN status = 'approved' THEN 1 END) AS approved,
            count(CASE WHEN status = 'rejected' THEN 1 END) AS rejected,
            count(CASE WHEN status = 'failed' THEN 1 END) AS failed,
            count(CASE WHEN created_at > (now() - INTERVAL '1 day') THEN 1 END) AS last_24h
          FROM agent_actions ${whereClause}`,
          params
        ),
        conn.query(
          `SELECT module, count(*) AS count FROM agent_actions
           ${whereClause} GROUP BY module ORDER BY count DESC`,
          params
        ),
      ]);

      const r = totalsRes.rows[0] || {};
      const moduleRows = (modulesRes.rows || []).map((m: any) => ({
        module: m.module,
        count: Number(m.count || 0),
      }));

      return {
        stats: {
          total: Number(r.total || 0),
          pending: Number(r.pending || 0),
          autoExecuted: Number(r.auto_executed || 0),
          approved: Number(r.approved || 0),
          rejected: Number(r.rejected || 0),
          failed: Number(r.failed || 0),
          last24h: Number(r.last_24h || 0),
          byModule: moduleRows,
        },
        error: null,
      };
    } else {
      const whereClause = userId ? `WHERE (user_id = :userId OR user_id IS NULL)` : "";
      const binds = userId ? { userId } : {};

      const [totalsRes, modulesRes]: any = await Promise.all([
        conn.execute(
          `SELECT
            count(*) AS total,
            count(CASE WHEN status = 'pending' THEN 1 END) AS pending,
            count(CASE WHEN status = 'auto_executed' THEN 1 END) AS auto_executed,
            count(CASE WHEN status = 'approved' THEN 1 END) AS approved,
            count(CASE WHEN status = 'rejected' THEN 1 END) AS rejected,
            count(CASE WHEN status = 'failed' THEN 1 END) AS failed,
            count(CASE WHEN created_at > (CURRENT_TIMESTAMP - INTERVAL '1' DAY) THEN 1 END) AS last_24h
          FROM agent_actions ${whereClause}`,
          binds
        ),
        conn.execute(
          `SELECT module, count(*) AS "count" FROM agent_actions
           ${whereClause} GROUP BY module ORDER BY "count" DESC`,
          binds
        ),
      ]);

      const r = totalsRes.rows[0] || {};
      const moduleRows = (modulesRes.rows || []).map((m: any) => ({
        module: m.MODULE || m.module,
        count: Number(m.count || m.COUNT || 0),
      }));

      return {
        stats: {
          total: Number(r.TOTAL || r.total || 0),
          pending: Number(r.PENDING || r.pending || 0),
          autoExecuted: Number(r.AUTO_EXECUTED || r.auto_executed || 0),
          approved: Number(r.APPROVED || r.approved || 0),
          rejected: Number(r.REJECTED || r.rejected || 0),
          failed: Number(r.FAILED || r.failed || 0),
          last24h: Number(r.LAST_24H || r.last_24h || 0),
          byModule: moduleRows,
        },
        error: null,
      };
    }
  } catch (err) {
    console.error("fetchStats failed:", err);
    return {
      stats: EMPTY_STATS,
      error: err instanceof Error ? err.message : "Database query failed.",
    };
  } finally {
    if (conn) {
      if (typeof conn.release === "function") conn.release();
      else if (typeof conn.close === "function") await conn.close();
    }
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
  default_sender_email: process.env.SMTP_FROM || "notifications@secondbrain.app",
  smtp_host: process.env.SMTP_HOST || "smtp.gmail.com",
  smtp_port: Number(process.env.SMTP_PORT) || 465,
  smtp_user: process.env.SMTP_USER || "",
  smtp_password: process.env.SMTP_PASSWORD || "",
};

export async function getEmailSettings(userId?: string): Promise<EmailSettings> {
  let conn: any;
  try {
    conn = await getDb();
    if (isPgConfigured()) {
      const res = await conn.query(
        `SELECT value FROM system_settings WHERE key = 'email_settings' ${
          userId ? "AND (user_id = $1 OR user_id IS NULL) ORDER BY user_id NULLS LAST LIMIT 1" : "LIMIT 1"
        }`,
        userId ? [userId] : []
      );
      if (!res.rows || res.rows.length === 0) return DEFAULT_EMAIL_SETTINGS;
      const val = typeof res.rows[0].value === "string" ? JSON.parse(res.rows[0].value) : res.rows[0].value;
      return { ...DEFAULT_EMAIL_SETTINGS, ...val };
    } else {
      const res: any = await conn.execute(
        `SELECT value FROM system_settings WHERE key = 'email_settings' ${
          userId ? "AND (user_id = :userId OR user_id IS NULL)" : ""
        }`,
        userId ? { userId } : {}
      );
      if (!res.rows || res.rows.length === 0) return DEFAULT_EMAIL_SETTINGS;
      const raw = res.rows[0].VALUE || res.rows[0].value;
      const val = typeof raw === "string" ? JSON.parse(raw) : raw;
      return { ...DEFAULT_EMAIL_SETTINGS, ...val };
    }
  } catch (err) {
    console.error("getEmailSettings error:", err);
    return DEFAULT_EMAIL_SETTINGS;
  } finally {
    if (conn) {
      if (typeof conn.release === "function") conn.release();
      else if (typeof conn.close === "function") await conn.close();
    }
  }
}

export async function saveEmailSettings(
  settings: Partial<EmailSettings>,
  userId?: string
): Promise<EmailSettings> {
  const current = await getEmailSettings(userId);
  const updated = { ...current, ...settings };
  let conn: any;
  try {
    conn = await getDb();
    if (isPgConfigured()) {
      await conn.query(
        `INSERT INTO system_settings (key, user_id, value, updated_at)
         VALUES ('email_settings', $1, $2, now())
         ON CONFLICT (key, user_id) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
        [userId || null, JSON.stringify(updated)]
      );
    } else {
      await conn.execute(
        `MERGE INTO system_settings s
         USING (SELECT 'email_settings' AS k, :userId AS u FROM dual) src
         ON (s.key = src.k AND (s.user_id = src.u OR (s.user_id IS NULL AND src.u IS NULL)))
         WHEN MATCHED THEN
           UPDATE SET s.value = :val, s.updated_at = CURRENT_TIMESTAMP
         WHEN NOT MATCHED THEN
           INSERT (key, user_id, value, updated_at) VALUES ('email_settings', :userId, :val, CURRENT_TIMESTAMP)`,
        { val: JSON.stringify(updated), userId: userId || null }
      );
    }
    return updated;
  } catch (err) {
    console.error("saveEmailSettings error:", err);
    throw err;
  } finally {
    if (conn) {
      if (typeof conn.release === "function") conn.release();
      else if (typeof conn.close === "function") await conn.close();
    }
  }
}
