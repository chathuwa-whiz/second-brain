import { MongoClient, type Db, ObjectId } from "mongodb";

/*
  Read access to the same MongoDB database job-tracker-mcp writes to, so the
  Jobs page can show matches and applications without going through MCP.
  Supports multi-tenant scoping via userId.
*/

declare global {
  // eslint-disable-next-line no-var
  var _mongoClient: MongoClient | undefined;
}

let _db: Db | null = null;

export function mongoConfigured(): boolean {
  return Boolean(process.env.MONGO_URL);
}

export async function getDb(): Promise<Db> {
  if (_db) return _db;

  const url = process.env.MONGO_URL;
  if (!url) {
    throw new Error(
      "MONGO_URL is not set. Add it to dashboard/.env.local — use the same " +
        "connection string as mcp-servers/job-tracker-mcp/.env so both read " +
        "the same database. See .env.example."
    );
  }

  const client = global._mongoClient ?? new MongoClient(url);
  if (!global._mongoClient) {
    await client.connect();
    if (process.env.NODE_ENV !== "production") global._mongoClient = client;
  }

  _db = client.db(process.env.MONGO_DB ?? "second_brain");
  return _db;
}

export type JobMatch = {
  id: string;
  user_id?: string | null;
  title: string;
  company: string;
  url: string;
  location: string;
  remote: boolean | null;
  source: string;
  score: number | null;
  reason: string;
  status: "new" | "applied" | "dismissed";
  found_at: string;
};

export type JobApplication = {
  id: string;
  user_id?: string | null;
  company: string;
  role: string;
  job_url: string;
  resume_version: string;
  notes: string;
  status: string;
  date_applied: string;
};

function iso(v: unknown): string {
  return v instanceof Date ? v.toISOString() : String(v ?? "");
}

export async function fetchJobMatches(
  status?: string,
  limit = 100,
  userId?: string
): Promise<{ matches: JobMatch[]; error: string | null }> {
  try {
    const db = await getDb();
    const query: Record<string, any> = {};
    if (status) {
      query.status = status;
    }
    if (userId) {
      query.$or = [{ user_id: userId }, { user_id: { $exists: false } }, { user_id: null }];
    }

    const docs = await db
      .collection("job_matches")
      .find(query)
      .sort({ found_at: -1 })
      .limit(limit)
      .toArray();

    return {
      matches: docs.map((d) => ({
        id: String(d._id),
        user_id: d.user_id ? String(d.user_id) : null,
        title: d.title ?? "",
        company: d.company ?? "",
        url: d.url ?? "",
        location: d.location ?? "",
        remote: d.remote ?? null,
        source: d.source ?? "",
        score: typeof d.score === "number" ? d.score : null,
        reason: d.reason ?? "",
        status: d.status ?? "new",
        found_at: iso(d.found_at),
      })),
      error: null,
    };
  } catch (err) {
    console.error("fetchJobMatches failed:", err);
    return {
      matches: [],
      error: err instanceof Error ? err.message : "Could not reach MongoDB.",
    };
  }
}

export async function fetchApplications(
  limit = 100,
  userId?: string
): Promise<{ applications: JobApplication[]; error: string | null }> {
  try {
    const db = await getDb();
    const query: Record<string, any> = {};
    if (userId) {
      query.$or = [{ user_id: userId }, { user_id: { $exists: false } }, { user_id: null }];
    }

    const docs = await db
      .collection("job_applications")
      .find(query)
      .sort({ date_applied: -1 })
      .limit(limit)
      .toArray();

    return {
      applications: docs.map((d) => ({
        id: String(d._id),
        user_id: d.user_id ? String(d.user_id) : null,
        company: d.company ?? "",
        role: d.role ?? "",
        job_url: d.job_url ?? "",
        resume_version: d.resume_version ?? "",
        notes: d.notes ?? "",
        status: d.status ?? "applied",
        date_applied: iso(d.date_applied),
      })),
      error: null,
    };
  } catch (err) {
    console.error("fetchApplications failed:", err);
    return {
      applications: [],
      error: err instanceof Error ? err.message : "Could not reach MongoDB.",
    };
  }
}

export async function setMatchStatus(
  id: string,
  status: "new" | "applied" | "dismissed",
  userId?: string
): Promise<JobMatch | null> {
  const db = await getDb();
  const filter: Record<string, any> = { _id: new ObjectId(id) };
  if (userId) {
    filter.$or = [{ user_id: userId }, { user_id: { $exists: false } }, { user_id: null }];
  }

  const result = await db
    .collection("job_matches")
    .findOneAndUpdate(
      filter,
      { $set: { status, updated_at: new Date() } },
      { returnDocument: "after" }
    );

  const d = result && "value" in result ? result.value : result;
  if (!d) return null;
  return {
    id: String(d._id),
    user_id: d.user_id ? String(d.user_id) : null,
    title: d.title ?? "",
    company: d.company ?? "",
    url: d.url ?? "",
    location: d.location ?? "",
    remote: d.remote ?? null,
    source: d.source ?? "",
    score: typeof d.score === "number" ? d.score : null,
    reason: d.reason ?? "",
    status: d.status ?? "new",
    found_at: iso(d.found_at),
  };
}

export async function recordJobApplication(app: {
  userId?: string;
  company: string;
  role: string;
  job_url?: string;
  resume_version?: string;
  notes?: string;
  status?: string;
}): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const db = await getDb();
    const res = await db.collection("job_applications").insertOne({
      user_id: app.userId || null,
      company: app.company,
      role: app.role,
      job_url: app.job_url ?? "",
      resume_version: app.resume_version ?? "",
      notes: app.notes ?? "",
      status: app.status ?? "applied",
      date_applied: new Date(),
    });
    return { success: true, id: String(res.insertedId) };
  } catch (err) {
    console.error("recordJobApplication error:", err);
    return { success: false, error: err instanceof Error ? err.message : "MongoDB error" };
  }
}
