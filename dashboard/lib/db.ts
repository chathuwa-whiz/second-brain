import { MongoClient, type Db, ObjectId } from "mongodb";
import { randomUUID, randomBytes, createHash } from "crypto";

/*
  100% MongoDB Unified Database Adapter for Second Brain.
  Handles Multi-Tenant Auth, Users, Verification Tokens, API Keys,
  Agent Actions (Trust Layer), System Settings, and Email Configurations.
*/

declare global {
  // eslint-disable-next-line no-var
  var _mongoDbInstance: Db | undefined;
}

let _db: Db | null = null;

export function isPgConfigured(): boolean {
  return false;
}

export function oracleConfigured(): boolean {
  return false;
}

export function mongoConfigured(): boolean {
  return Boolean(process.env.MONGO_URL);
}

export async function getDb(): Promise<Db> {
  if (_db) return _db;
  if (global._mongoDbInstance) {
    _db = global._mongoDbInstance;
    return _db;
  }

  const url = process.env.MONGO_URL;
  if (!url) {
    throw new Error(
      "MONGO_URL is not set. Add it to your .env file. See .env.example."
    );
  }

  const client = new MongoClient(url);
  await client.connect();
  _db = client.db(process.env.MONGO_DB ?? "second_brain");

  if (process.env.NODE_ENV !== "production") {
    global._mongoDbInstance = _db;
  }

  return _db;
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

export type ApiKey = {
  id: string;
  user_id: string;
  name: string;
  key_preview: string;
  last_used_at: string | null;
  created_at: string;
};

export type AgentAction = {
  id: number | string;
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

export type EmailSettings = {
  configured: boolean;
  source: "default_alias" | "custom_smtp" | "resend_api";
  fromEmail?: string;
  default_sender_email?: string;
  senderName?: string;
  smtpHost?: string;
  smtp_host?: string;
  smtpPort?: number;
  smtp_port?: number;
  smtpUser?: string;
  smtp_user?: string;
  smtpPassword?: string;
  smtp_password?: string;
  replyTo?: string;
  updatedAt?: string;
};

function iso(val: any): string {
  if (val instanceof Date) return val.toISOString();
  if (typeof val === "string") return val;
  return new Date().toISOString();
}

function formatUser(doc: any): User {
  return {
    id: String(doc.id || doc._id),
    name: doc.name ?? null,
    email: String(doc.email).toLowerCase(),
    password_hash: doc.password_hash ?? null,
    email_verified: doc.email_verified ? iso(doc.email_verified) : null,
    image: doc.image ?? null,
    role: doc.role ?? "user",
    created_at: iso(doc.created_at),
    updated_at: iso(doc.updated_at),
  };
}

function formatAction(doc: any): AgentAction {
  return {
    id: String(doc.id || doc._id),
    user_id: doc.user_id ? String(doc.user_id) : null,
    created_at: iso(doc.created_at || doc.found_at),
    module: String(doc.module || "job_finding"),
    action: String(doc.action || "match_job_posting"),
    reasoning: String(doc.reasoning || doc.reason || ""),
    confidence: String(doc.confidence ?? "0.80"),
    status: (doc.status as any) || "pending",
    metadata: doc.metadata && typeof doc.metadata === "object" ? doc.metadata : {},
    reviewed_at: doc.reviewed_at ? iso(doc.reviewed_at) : null,
    reviewed_by: doc.reviewed_by ? String(doc.reviewed_by) : null,
    executed_at: doc.executed_at ? iso(doc.executed_at) : null,
    execution_result:
      doc.execution_result && typeof doc.execution_result === "object"
        ? doc.execution_result
        : null,
  };
}

// ---------------------------------------------------------------------------
// User CRUD & Authentication
// ---------------------------------------------------------------------------

export async function getUserByEmail(email: string): Promise<User | null> {
  if (!email) return null;
  const db = await getDb();
  const doc = await db.collection("users").findOne({
    email: email.trim().toLowerCase(),
  });
  if (!doc) return null;
  return formatUser(doc);
}

export async function getUserById(id: string): Promise<User | null> {
  if (!id) return null;
  const db = await getDb();
  const filter: any = {
    $or: [{ id: id }],
  };
  if (ObjectId.isValid(id)) {
    filter.$or.push({ _id: new ObjectId(id) });
  }

  const doc = await db.collection("users").findOne(filter);
  if (!doc) return null;
  return formatUser(doc);
}

export async function createUser(data: {
  name?: string | null;
  email: string;
  password?: string | null;
  passwordHash?: string | null;
  image?: string | null;
  emailVerified?: Date | null;
  role?: string;
}): Promise<User> {
  const db = await getDb();
  const id = randomUUID();
  const now = new Date();

  const doc = {
    id,
    name: data.name || null,
    email: data.email.trim().toLowerCase(),
    password_hash: data.passwordHash || data.password || null,
    email_verified: data.emailVerified ? data.emailVerified.toISOString() : now.toISOString(),
    image: data.image || null,
    role: data.role || "user",
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  };

  await db.collection("users").insertOne(doc);
  return formatUser(doc);
}

export async function updateUserPassword(
  userId: string,
  passwordHash: string
): Promise<boolean> {
  const db = await getDb();
  const filter: any = { $or: [{ id: userId }] };
  if (ObjectId.isValid(userId)) filter.$or.push({ _id: new ObjectId(userId) });

  const res = await db.collection("users").updateOne(filter, {
    $set: {
      password_hash: passwordHash,
      updated_at: new Date().toISOString(),
    },
  });
  return res.matchedCount > 0;
}

export async function verifyUserEmail(userId: string): Promise<boolean> {
  const db = await getDb();
  const filter: any = { $or: [{ id: userId }] };
  if (ObjectId.isValid(userId)) filter.$or.push({ _id: new ObjectId(userId) });

  const res = await db.collection("users").updateOne(filter, {
    $set: {
      email_verified: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  });
  return res.matchedCount > 0;
}

// ---------------------------------------------------------------------------
// Verification Tokens
// ---------------------------------------------------------------------------

export async function createVerificationToken(data: {
  userId: string;
  token: string;
  expiresAt: Date;
  tokenType?: string;
}): Promise<VerificationToken> {
  const db = await getDb();
  const id = randomUUID();
  const tokenType = data.tokenType || "email_verification";
  const now = new Date();

  // Delete existing tokens of same type for user
  await db.collection("verification_tokens").deleteMany({
    user_id: data.userId,
    token_type: tokenType,
  });

  const doc = {
    id,
    user_id: data.userId,
    token: data.token,
    token_type: tokenType,
    expires_at: data.expiresAt.toISOString(),
    created_at: now.toISOString(),
  };

  await db.collection("verification_tokens").insertOne(doc);
  return {
    id,
    user_id: data.userId,
    token: data.token,
    token_type: tokenType,
    expires_at: data.expiresAt.toISOString(),
    created_at: now.toISOString(),
  };
}

export async function getVerificationToken(
  token: string
): Promise<VerificationToken | null> {
  if (!token) return null;
  const db = await getDb();
  const doc = await db.collection("verification_tokens").findOne({ token });
  if (!doc) return null;
  return {
    id: String(doc.id || doc._id),
    user_id: String(doc.user_id),
    token: String(doc.token),
    token_type: String(doc.token_type),
    expires_at: iso(doc.expires_at),
    created_at: iso(doc.created_at),
  };
}

export async function deleteVerificationToken(token: string): Promise<boolean> {
  const db = await getDb();
  const res = await db.collection("verification_tokens").deleteMany({ token });
  return res.deletedCount > 0;
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
    user = await createUser({
      name: data.name,
      email: data.email,
      image: data.image,
      emailVerified: new Date(),
    });
  } else if (!user.email_verified) {
    await verifyUserEmail(user.id);
    user.email_verified = new Date().toISOString();
  }

  const db = await getDb();
  await db.collection("accounts").updateOne(
    {
      provider: data.provider,
      provider_account_id: data.providerAccountId,
    },
    {
      $set: {
        user_id: user.id,
        type: "oauth",
        access_token: data.accessToken || null,
        refresh_token: data.refreshToken || null,
        expires_at: data.expiresAt || null,
        id_token: data.idToken || null,
        scope: data.scope || null,
        updated_at: new Date().toISOString(),
      },
      $setOnInsert: {
        id: randomUUID(),
        provider: data.provider,
        provider_account_id: data.providerAccountId,
        created_at: new Date().toISOString(),
      },
    },
    { upsert: true }
  );

  return user;
}

// ---------------------------------------------------------------------------
// API Key Management (For n8n, scrapers, and external automations)
// ---------------------------------------------------------------------------

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export async function createApiKey(
  userId: string,
  name: string
): Promise<{ id: string; key: string; preview: string; name: string }> {
  const db = await getDb();
  const id = randomUUID();
  const rawSecret = randomBytes(20).toString("hex");
  const fullKey = `sb_live_${rawSecret}`;
  const keyHash = hashApiKey(fullKey);
  const keyPreview = `sb_live_...${fullKey.slice(-4)}`;
  const cleanName = name.trim() || "Default API Key";
  const now = new Date().toISOString();

  await db.collection("api_keys").insertOne({
    id,
    user_id: userId,
    name: cleanName,
    key_hash: keyHash,
    key_preview: keyPreview,
    last_used_at: null,
    created_at: now,
  });

  return {
    id,
    key: fullKey,
    preview: keyPreview,
    name: cleanName,
  };
}

export async function listApiKeys(userId: string): Promise<ApiKey[]> {
  const db = await getDb();
  const docs = await db
    .collection("api_keys")
    .find({ user_id: userId })
    .sort({ created_at: -1 })
    .toArray();

  return docs.map((doc) => ({
    id: String(doc.id || doc._id),
    user_id: String(doc.user_id),
    name: String(doc.name),
    key_preview: String(doc.key_preview),
    last_used_at: doc.last_used_at ? iso(doc.last_used_at) : null,
    created_at: iso(doc.created_at),
  }));
}

export async function deleteApiKey(
  userId: string,
  keyId: string
): Promise<boolean> {
  const db = await getDb();
  const filter: any = {
    user_id: userId,
    $or: [{ id: keyId }],
  };
  if (ObjectId.isValid(keyId)) {
    filter.$or.push({ _id: new ObjectId(keyId) });
  }

  const res = await db.collection("api_keys").deleteOne(filter);
  return res.deletedCount > 0;
}

export async function getUserByApiKey(apiKey: string): Promise<User | null> {
  if (!apiKey || typeof apiKey !== "string") return null;
  const keyHash = hashApiKey(apiKey.trim());
  const db = await getDb();

  const keyDoc = await db.collection("api_keys").findOne({ key_hash: keyHash });
  if (!keyDoc) return null;

  // Update last_used_at asynchronously
  db.collection("api_keys")
    .updateOne(
      { _id: keyDoc._id },
      { $set: { last_used_at: new Date().toISOString() } }
    )
    .catch(() => {});

  return getUserById(String(keyDoc.user_id));
}

// ---------------------------------------------------------------------------
// Agent Actions & Trust Layer (MongoDB)
// ---------------------------------------------------------------------------

export async function fetchActions(options: {
  status?: string;
  module?: string;
  limit?: number;
  offset?: number;
  userId?: string;
} = {}): Promise<{ actions: AgentAction[]; total: number; error: string | null }> {
  try {
    const db = await getDb();
    const query: Record<string, any> = {};

    if (options.status) {
      query.status = options.status;
    }
    if (options.module) {
      query.module = options.module;
    }
    if (options.userId) {
      query.$or = [
        { user_id: options.userId },
        { user_id: { $exists: false } },
        { user_id: null },
      ];
    }

    const limit = options.limit ?? 50;
    const offset = options.offset ?? 0;

    const [total, docs] = await Promise.all([
      db.collection("agent_actions").countDocuments(query),
      db
        .collection("agent_actions")
        .find(query)
        .sort({ created_at: -1, _id: -1 })
        .skip(offset)
        .limit(limit)
        .toArray(),
    ]);

    return {
      actions: docs.map(formatAction),
      total,
      error: null,
    };
  } catch (err) {
    console.error("fetchActions error:", err);
    return {
      actions: [],
      total: 0,
      error: err instanceof Error ? err.message : "MongoDB error",
    };
  }
}

export async function fetchActionById(
  id: number | string,
  userId?: string
): Promise<{ action: AgentAction | null; error: string | null }> {
  try {
    const db = await getDb();
    const strId = String(id);
    const filter: any = {
      $or: [{ id: id }, { id: strId }],
    };
    if (typeof id === "string" && ObjectId.isValid(id)) {
      filter.$or.push({ _id: new ObjectId(id) });
    }
    if (userId) {
      filter.user_id = userId;
    }

    const doc = await db.collection("agent_actions").findOne(filter);
    if (!doc) return { action: null, error: "Action not found" };
    return { action: formatAction(doc), error: null };
  } catch (err) {
    console.error("fetchActionById error:", err);
    return {
      action: null,
      error: err instanceof Error ? err.message : "MongoDB error",
    };
  }
}

export async function fetchStats(
  userId?: string
): Promise<{
  stats: {
    pending: number;
    autoExecuted: number;
    last24h: number;
    total: number;
    byModule: Array<{ module: string; count: number }>;
  };
  error: string | null;
}> {
  try {
    const db = await getDb();
    const query: Record<string, any> = {};
    if (userId) {
      query.$or = [
        { user_id: userId },
        { user_id: { $exists: false } },
        { user_id: null },
      ];
    }

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [total, pending, autoExecuted, last24hDocs, byModuleAgg] =
      await Promise.all([
        db.collection("agent_actions").countDocuments(query),
        db
          .collection("agent_actions")
          .countDocuments({ ...query, status: "pending" }),
        db
          .collection("agent_actions")
          .countDocuments({ ...query, status: "auto_executed" }),
        db.collection("agent_actions").countDocuments({
          ...query,
          $or: [
            { created_at: { $gte: twentyFourHoursAgo.toISOString() } },
            { created_at: { $gte: twentyFourHoursAgo } },
          ],
        }),
        db
          .collection("agent_actions")
          .aggregate([
            { $match: query },
            { $group: { _id: "$module", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
          ])
          .toArray(),
      ]);

    const byModule = byModuleAgg.map((row) => ({
      module: String(row._id || "general"),
      count: Number(row.count),
    }));

    return {
      stats: {
        pending,
        autoExecuted,
        last24h: last24hDocs,
        total,
        byModule,
      },
      error: null,
    };
  } catch (err) {
    console.error("fetchStats error:", err);
    return {
      stats: {
        pending: 0,
        autoExecuted: 0,
        last24h: 0,
        total: 0,
        byModule: [],
      },
      error: err instanceof Error ? err.message : "MongoDB error",
    };
  }
}

// ---------------------------------------------------------------------------
// System Settings (MongoDB)
// ---------------------------------------------------------------------------

export async function getEmailSettings(userId?: string): Promise<EmailSettings> {
  try {
    const db = await getDb();
    const query: Record<string, any> = { key: "email_settings" };
    if (userId) {
      query.user_id = userId;
    }

    const doc = await db.collection("system_settings").findOne(query);
    if (doc && doc.value) {
      const from = doc.value.fromEmail || doc.value.default_sender_email;
      return {
        configured: Boolean(doc.value.configured),
        source: doc.value.source ?? "default_alias",
        fromEmail: from,
        default_sender_email: from,
        senderName: doc.value.senderName,
        smtpHost: doc.value.smtpHost || doc.value.smtp_host,
        smtp_host: doc.value.smtpHost || doc.value.smtp_host,
        smtpPort: doc.value.smtpPort ? Number(doc.value.smtpPort) : undefined,
        smtp_port: doc.value.smtpPort ? Number(doc.value.smtpPort) : undefined,
        smtpUser: doc.value.smtpUser || doc.value.smtp_user,
        smtp_user: doc.value.smtpUser || doc.value.smtp_user,
        smtpPassword: doc.value.smtpPassword || doc.value.smtp_password,
        smtp_password: doc.value.smtpPassword || doc.value.smtp_password,
        replyTo: doc.value.replyTo,
        updatedAt: iso(doc.updated_at),
      };
    }
  } catch (err) {
    console.warn("getEmailSettings error:", err);
  }

  // Fallback to environment variables
  const envConfigured = Boolean(
    process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD
  );
  const fromEmail = process.env.SMTP_FROM || process.env.SMTP_USER;
  const smtpPort = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 465;

  return {
    configured: envConfigured,
    source: "custom_smtp",
    fromEmail,
    default_sender_email: fromEmail,
    smtpHost: process.env.SMTP_HOST,
    smtp_host: process.env.SMTP_HOST,
    smtpPort,
    smtp_port: smtpPort,
    smtpUser: process.env.SMTP_USER,
    smtp_user: process.env.SMTP_USER,
    smtpPassword: process.env.SMTP_PASSWORD,
    smtp_password: process.env.SMTP_PASSWORD,
  };
}

export async function saveEmailSettings(
  arg1: string | EmailSettings | undefined,
  arg2?: EmailSettings
): Promise<EmailSettings> {
  let userId: string | undefined;
  let settings: EmailSettings;

  if (typeof arg1 === "object" && arg1 !== null) {
    settings = arg1;
    userId = undefined;
  } else {
    userId = arg1;
    settings = arg2 || ({} as EmailSettings);
  }

  const db = await getDb();
  const query: Record<string, any> = {
    key: "email_settings",
    user_id: userId || "default_system_user",
  };

  const toSave: EmailSettings = {
    ...settings,
    updatedAt: new Date().toISOString(),
  };

  await db.collection("system_settings").updateOne(
    query,
    {
      $set: {
        key: "email_settings",
        user_id: userId || "default_system_user",
        value: toSave,
        updated_at: new Date().toISOString(),
      },
    },
    { upsert: true }
  );

  return toSave;
}

// ---------------------------------------------------------------------------
// Admin Side Operations & Platform Control
// ---------------------------------------------------------------------------

export type PlatformConfig = {
  auto_execute_confidence: number;
  registration_mode: "open" | "invite_only" | "closed";
  maintenance_mode: boolean;
  system_announcement: string;
  default_model: string;
  max_daily_actions_per_user: number;
  updated_at?: string;
  updated_by?: string;
};

export async function adminGetPlatformStats() {
  const db = await getDb();
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    adminUsers,
    verifiedUsers,
    newUsers24h,
    totalActions,
    pendingActions,
    autoExecutedActions,
    approvedActions,
    rejectedActions,
    failedActions,
    actions24h,
    totalJobMatches,
    totalApiKeys,
    totalResumes,
    byModuleAgg,
  ] = await Promise.all([
    db.collection("users").countDocuments({}),
    db.collection("users").countDocuments({ role: "admin" }),
    db.collection("users").countDocuments({ email_verified: { $ne: null } }),
    db.collection("users").countDocuments({
      $or: [
        { created_at: { $gte: twentyFourHoursAgo.toISOString() } },
        { created_at: { $gte: twentyFourHoursAgo } },
      ],
    }),
    db.collection("agent_actions").countDocuments({}),
    db.collection("agent_actions").countDocuments({ status: "pending" }),
    db.collection("agent_actions").countDocuments({ status: "auto_executed" }),
    db.collection("agent_actions").countDocuments({ status: "approved" }),
    db.collection("agent_actions").countDocuments({ status: "rejected" }),
    db.collection("agent_actions").countDocuments({ status: "failed" }),
    db.collection("agent_actions").countDocuments({
      $or: [
        { created_at: { $gte: twentyFourHoursAgo.toISOString() } },
        { created_at: { $gte: twentyFourHoursAgo } },
      ],
    }),
    db.collection("job_matches").countDocuments({}).catch(() => 0),
    db.collection("api_keys").countDocuments({}).catch(() => 0),
    db.collection("resumes").countDocuments({}).catch(() => 0),
    db.collection("agent_actions")
      .aggregate([
        { $group: { _id: "$module", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ])
      .toArray()
      .catch(() => []),
  ]);

  const byModule = (byModuleAgg || []).map((row) => ({
    module: String(row._id || "general"),
    count: Number(row.count),
  }));

  return {
    users: {
      total: totalUsers,
      admins: adminUsers,
      regular: Math.max(0, totalUsers - adminUsers),
      verified: verifiedUsers,
      new24h: newUsers24h,
    },
    actions: {
      total: totalActions,
      pending: pendingActions,
      autoExecuted: autoExecutedActions,
      approved: approvedActions,
      rejected: rejectedActions,
      failed: failedActions,
      last24h: actions24h,
      byModule,
    },
    ecosystem: {
      jobMatches: totalJobMatches,
      apiKeys: totalApiKeys,
      resumes: totalResumes,
    },
  };
}

export type AdminUserRow = User & {
  actionCount: number;
  apiKeyCount: number;
  hasCustomProfile: boolean;
};

export async function adminListUsers(options: {
  search?: string;
  role?: string;
  isVerified?: boolean;
  limit?: number;
  offset?: number;
} = {}): Promise<{ users: AdminUserRow[]; total: number }> {
  const db = await getDb();
  const query: Record<string, any> = {};

  if (options.role) {
    query.role = options.role;
  }
  if (options.isVerified !== undefined) {
    query.email_verified = options.isVerified ? { $ne: null } : null;
  }
  if (options.search) {
    const s = options.search.trim();
    query.$or = [
      { email: { $regex: s, $options: "i" } },
      { name: { $regex: s, $options: "i" } },
      { id: { $regex: s, $options: "i" } },
    ];
  }

  const limit = options.limit ?? 50;
  const offset = options.offset ?? 0;

  const [total, userDocs] = await Promise.all([
    db.collection("users").countDocuments(query),
    db
      .collection("users")
      .find(query)
      .sort({ created_at: -1, _id: -1 })
      .skip(offset)
      .limit(limit)
      .toArray(),
  ]);

  const userIds = userDocs.map((u) => String(u.id || u._id));

  // Batch query user metadata
  const [actionCounts, keyCounts, profileDocs] = await Promise.all([
    db
      .collection("agent_actions")
      .aggregate([
        { $match: { user_id: { $in: userIds } } },
        { $group: { _id: "$user_id", count: { $sum: 1 } } },
      ])
      .toArray()
      .catch(() => []),
    db
      .collection("api_keys")
      .aggregate([
        { $match: { user_id: { $in: userIds } } },
        { $group: { _id: "$user_id", count: { $sum: 1 } } },
      ])
      .toArray()
      .catch(() => []),
    db
      .collection("system_settings")
      .find({ key: "user_profile", user_id: { $in: userIds } })
      .toArray()
      .catch(() => []),
  ]);

  const actionMap = new Map<string, number>();
  for (const a of actionCounts) {
    if (a._id) actionMap.set(String(a._id), Number(a.count));
  }

  const keyMap = new Map<string, number>();
  for (const k of keyCounts) {
    if (k._id) keyMap.set(String(k._id), Number(k.count));
  }

  const profileSet = new Set<string>();
  for (const p of profileDocs) {
    if (p.user_id) profileSet.add(String(p.user_id));
  }

  const users: AdminUserRow[] = userDocs.map((doc) => {
    const u = formatUser(doc);
    return {
      ...u,
      actionCount: actionMap.get(u.id) || 0,
      apiKeyCount: keyMap.get(u.id) || 0,
      hasCustomProfile: profileSet.has(u.id),
    };
  });

  return { users, total };
}

export async function adminGetUserDetail(userId: string) {
  const db = await getDb();
  const user = await getUserById(userId);
  if (!user) return null;

  const [profileDoc, emailDoc, keys, recentActions, jobMatchesCount, resumesCount] =
    await Promise.all([
      db.collection("system_settings").findOne({ key: "user_profile", user_id: userId }),
      db.collection("system_settings").findOne({ key: "email_settings", user_id: userId }),
      db.collection("api_keys").find({ user_id: userId }).toArray(),
      db
        .collection("agent_actions")
        .find({ user_id: userId })
        .sort({ created_at: -1 })
        .limit(10)
        .toArray(),
      db.collection("job_matches").countDocuments({ user_id: userId }).catch(() => 0),
      db.collection("resumes").countDocuments({ user_id: userId }).catch(() => 0),
    ]);

  return {
    user,
    profile: profileDoc?.value || null,
    emailSettings: emailDoc?.value || null,
    apiKeys: keys.map((k) => ({
      id: String(k.id || k._id),
      name: String(k.name),
      preview: String(k.key_preview),
      lastUsedAt: k.last_used_at ? iso(k.last_used_at) : null,
      createdAt: iso(k.created_at),
    })),
    recentActions: recentActions.map(formatAction),
    stats: {
      jobMatchesCount,
      resumesCount,
      totalActions: recentActions.length,
    },
  };
}

export async function adminUpdateUser(
  userId: string,
  updates: {
    name?: string;
    role?: string;
    email_verified?: string | null;
    password_hash?: string;
  }
): Promise<boolean> {
  const db = await getDb();
  const filter: any = { $or: [{ id: userId }] };
  if (ObjectId.isValid(userId)) filter.$or.push({ _id: new ObjectId(userId) });

  const setFields: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };

  if (updates.name !== undefined) setFields.name = updates.name;
  if (updates.role !== undefined) setFields.role = updates.role;
  if (updates.email_verified !== undefined) setFields.email_verified = updates.email_verified;
  if (updates.password_hash !== undefined) setFields.password_hash = updates.password_hash;

  const res = await db.collection("users").updateOne(filter, { $set: setFields });
  return res.matchedCount > 0;
}

export async function adminDeleteUser(userId: string): Promise<boolean> {
  const db = await getDb();
  const filter: any = { $or: [{ id: userId }] };
  if (ObjectId.isValid(userId)) filter.$or.push({ _id: new ObjectId(userId) });

  // Delete user record
  const res = await db.collection("users").deleteOne(filter);

  // Clean up user-associated collections asynchronously
  const userFilter = { user_id: userId };
  Promise.all([
    db.collection("system_settings").deleteMany(userFilter),
    db.collection("api_keys").deleteMany(userFilter),
    db.collection("verification_tokens").deleteMany(userFilter),
    db.collection("accounts").deleteMany(userFilter),
    db.collection("agent_actions").deleteMany(userFilter),
    db.collection("job_matches").deleteMany(userFilter),
    db.collection("job_applications").deleteMany(userFilter),
    db.collection("resumes").deleteMany(userFilter),
  ]).catch((err) => console.error("Error cascading admin user delete:", err));

  return res.deletedCount > 0;
}

export async function adminListAllActions(options: {
  status?: string;
  module?: string;
  userId?: string;
  search?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<{ actions: (AgentAction & { userEmail?: string })[]; total: number }> {
  const db = await getDb();
  const query: Record<string, any> = {};

  if (options.status) query.status = options.status;
  if (options.module) query.module = options.module;
  if (options.userId) query.user_id = options.userId;

  if (options.search) {
    const s = options.search.trim();
    query.$or = [
      { action: { $regex: s, $options: "i" } },
      { reasoning: { $regex: s, $options: "i" } },
      { module: { $regex: s, $options: "i" } },
    ];
  }

  const limit = options.limit ?? 50;
  const offset = options.offset ?? 0;

  const [total, docs] = await Promise.all([
    db.collection("agent_actions").countDocuments(query),
    db
      .collection("agent_actions")
      .find(query)
      .sort({ created_at: -1, _id: -1 })
      .skip(offset)
      .limit(limit)
      .toArray(),
  ]);

  // Lookup user emails for actions
  const userIds = Array.from(
    new Set(docs.map((d) => d.user_id).filter(Boolean).map(String))
  );

  let userEmailMap = new Map<string, string>();
  if (userIds.length > 0) {
    const users = await db
      .collection("users")
      .find({ id: { $in: userIds } })
      .project({ id: 1, email: 1 })
      .toArray();
    for (const u of users) {
      if (u.id && u.email) userEmailMap.set(String(u.id), String(u.email));
    }
  }

  const actions = docs.map((d) => {
    const formatted = formatAction(d);
    return {
      ...formatted,
      userEmail: formatted.user_id ? userEmailMap.get(formatted.user_id) : undefined,
    };
  });

  return { actions, total };
}

export async function adminListAllApiKeys() {
  const db = await getDb();
  const keys = await db
    .collection("api_keys")
    .find({})
    .sort({ created_at: -1 })
    .limit(100)
    .toArray();

  const userIds = Array.from(new Set(keys.map((k) => String(k.user_id)).filter(Boolean)));
  const users = await db
    .collection("users")
    .find({ id: { $in: userIds } })
    .project({ id: 1, email: 1, name: 1 })
    .toArray();

  const userMap = new Map<string, { email: string; name: string | null }>();
  for (const u of users) {
    userMap.set(String(u.id), {
      email: String(u.email),
      name: u.name ? String(u.name) : null,
    });
  }

  return keys.map((k) => {
    const u = userMap.get(String(k.user_id));
    return {
      id: String(k.id || k._id),
      userId: String(k.user_id),
      userEmail: u?.email || "Unknown User",
      userName: u?.name || null,
      name: String(k.name || "API Key"),
      keyPreview: String(k.key_preview),
      lastUsedAt: k.last_used_at ? iso(k.last_used_at) : null,
      createdAt: iso(k.created_at),
    };
  });
}

export async function adminDeleteApiKey(keyId: string): Promise<boolean> {
  const db = await getDb();
  const filter: any = { $or: [{ id: keyId }] };
  if (ObjectId.isValid(keyId)) filter.$or.push({ _id: new ObjectId(keyId) });

  const res = await db.collection("api_keys").deleteOne(filter);
  return res.deletedCount > 0;
}

export async function adminGetPlatformConfig(): Promise<PlatformConfig> {
  const defaultThreshold = Number(
    process.env.NEXT_PUBLIC_AUTO_EXECUTE_CONFIDENCE_THRESHOLD ?? "0.75"
  );
  try {
    const db = await getDb();
    const doc = await db
      .collection("system_settings")
      .findOne({ key: "admin_platform_config" });

    if (doc && doc.value) {
      return {
        auto_execute_confidence:
          doc.value.auto_execute_confidence ?? defaultThreshold,
        registration_mode: doc.value.registration_mode ?? "open",
        maintenance_mode: Boolean(doc.value.maintenance_mode),
        system_announcement: doc.value.system_announcement ?? "",
        default_model: doc.value.default_model ?? "gemini-1.5-pro",
        max_daily_actions_per_user: doc.value.max_daily_actions_per_user ?? 50,
        updated_at: doc.updated_at ? iso(doc.updated_at) : undefined,
        updated_by: doc.value.updated_by,
      };
    }
  } catch (err) {
    console.warn("adminGetPlatformConfig error:", err);
  }

  return {
    auto_execute_confidence: defaultThreshold,
    registration_mode: "open",
    maintenance_mode: false,
    system_announcement: "",
    default_model: "gemini-1.5-pro",
    max_daily_actions_per_user: 50,
  };
}

export async function adminSavePlatformConfig(
  config: Partial<PlatformConfig>,
  updatedBy?: string
): Promise<PlatformConfig> {
  const db = await getDb();
  const current = await adminGetPlatformConfig();
  const merged: PlatformConfig = {
    ...current,
    ...config,
    updated_at: new Date().toISOString(),
    updated_by: updatedBy || "admin",
  };

  await db.collection("system_settings").updateOne(
    { key: "admin_platform_config" },
    {
      $set: {
        key: "admin_platform_config",
        value: merged,
        updated_at: new Date().toISOString(),
      },
    },
    { upsert: true }
  );

  return merged;
}

export async function adminPruneOldActions(
  olderThanDays: number,
  status?: string
): Promise<{ deletedCount: number }> {
  const db = await getDb();
  const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
  const query: Record<string, any> = {
    $or: [
      { created_at: { $lte: cutoffDate.toISOString() } },
      { created_at: { $lte: cutoffDate } },
    ],
  };
  if (status) {
    query.status = status;
  }

  const res = await db.collection("agent_actions").deleteMany(query);
  return { deletedCount: res.deletedCount || 0 };
}

export async function adminGetCollectionStats() {
  const db = await getDb();
  const collections = [
    "users",
    "agent_actions",
    "job_matches",
    "job_applications",
    "resumes",
    "api_keys",
    "system_settings",
    "accounts",
    "verification_tokens",
  ];

  const results = await Promise.all(
    collections.map(async (name) => {
      try {
        const count = await db.collection(name).countDocuments({});
        return { name, count, error: null };
      } catch (err) {
        return { name, count: 0, error: (err as Error).message };
      }
    })
  );

  return results;
}

