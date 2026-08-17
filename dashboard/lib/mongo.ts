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
      query.user_id = userId;
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
      query.user_id = userId;
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
    filter.user_id = userId;
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

// ---------------------------------------------------------------------------
// Tasks (Daily Tasks module)
// ---------------------------------------------------------------------------

export type Task = {
  id: string;
  user_id: string | null;
  title: string;
  description: string;
  priority: "low" | "medium" | "high";
  status: "open" | "done";
  due_date: string | null;
  recurrence: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
};

function formatTask(doc: any): Task {
  return {
    id: String(doc._id),
    user_id: doc.user_id ? String(doc.user_id) : null,
    title: doc.title ?? "",
    description: doc.description ?? "",
    priority: doc.priority ?? "medium",
    status: doc.status ?? "open",
    due_date: doc.due_date ?? null,
    recurrence: doc.recurrence ?? null,
    tags: Array.isArray(doc.tags) ? doc.tags : [],
    created_at: iso(doc.created_at),
    updated_at: iso(doc.updated_at),
  };
}

export async function fetchTasks(
  options: {
    status?: string;
    priority?: string;
    due?: "today" | "overdue" | "upcoming";
    limit?: number;
    userId?: string;
  } = {}
): Promise<{ tasks: Task[]; error: string | null }> {
  try {
    const db = await getDb();
    const query: Record<string, any> = {};

    if (options.status) query.status = options.status;
    if (options.priority) query.priority = options.priority;

    if (options.userId) {
      query.user_id = options.userId;
    }

    const today = new Date().toISOString().slice(0, 10);

    if (options.due === "today") {
      query.due_date = today;
    } else if (options.due === "overdue") {
      query.due_date = { $lt: today, $ne: null };
      query.status = "open";
    } else if (options.due === "upcoming") {
      const weekOut = new Date(Date.now() + 7 * 86400000)
        .toISOString()
        .slice(0, 10);
      query.due_date = { $gte: today, $lte: weekOut };
    }

    const sortField = options.due ? "due_date" : "created_at";
    const sortDir = options.due ? 1 : -1;
    const limit = options.limit ?? 200;

    const docs = await db
      .collection("tasks")
      .find(query)
      .sort({ [sortField]: sortDir })
      .limit(limit)
      .toArray();

    return { tasks: docs.map(formatTask), error: null };
  } catch (err) {
    console.error("fetchTasks failed:", err);
    return {
      tasks: [],
      error: err instanceof Error ? err.message : "Could not reach MongoDB.",
    };
  }
}

export async function createTask(task: {
  userId?: string;
  title: string;
  description?: string;
  priority?: string;
  due_date?: string | null;
  recurrence?: string | null;
  tags?: string[];
}): Promise<{ success: boolean; task?: Task; error?: string }> {
  try {
    const db = await getDb();
    const now = new Date();
    const doc = {
      user_id: task.userId || null,
      title: task.title.trim(),
      description: (task.description || "").trim(),
      priority: task.priority || "medium",
      status: "open",
      due_date: task.due_date || null,
      recurrence: task.recurrence || null,
      tags: Array.isArray(task.tags) ? task.tags : [],
      created_at: now,
      updated_at: now,
    };
    const res = await db.collection("tasks").insertOne(doc);
    return {
      success: true,
      task: formatTask({ ...doc, _id: res.insertedId }),
    };
  } catch (err) {
    console.error("createTask error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "MongoDB error",
    };
  }
}

export async function updateTask(
  id: string,
  updates: Partial<
    Pick<Task, "title" | "description" | "priority" | "status" | "due_date" | "recurrence" | "tags">
  >,
  userId?: string
): Promise<Task | null> {
  const db = await getDb();
  const filter: Record<string, any> = { _id: new ObjectId(id) };
  if (userId) {
    filter.user_id = userId;
  }

  const $set: Record<string, any> = { updated_at: new Date() };
  if (updates.title !== undefined) $set.title = updates.title.trim();
  if (updates.description !== undefined)
    $set.description = updates.description.trim();
  if (updates.priority !== undefined) $set.priority = updates.priority;
  if (updates.status !== undefined) $set.status = updates.status;
  if (updates.due_date !== undefined) $set.due_date = updates.due_date;
  if (updates.recurrence !== undefined) $set.recurrence = updates.recurrence;
  if (updates.tags !== undefined) $set.tags = updates.tags;

  const result = await db
    .collection("tasks")
    .findOneAndUpdate(filter, { $set }, { returnDocument: "after" });

  const d = result && "value" in result ? result.value : result;
  if (!d) return null;
  return formatTask(d);
}

export async function deleteTask(
  id: string,
  userId?: string
): Promise<boolean> {
  const db = await getDb();
  const filter: Record<string, any> = { _id: new ObjectId(id) };
  if (userId) {
    filter.user_id = userId;
  }

  const res = await db.collection("tasks").deleteOne(filter);
  return res.deletedCount > 0;
}

/** Calculate the next due date for a recurring task. */
function nextDueDate(current: string, recurrence: string): string {
  const d = new Date(current + "T00:00:00Z");

  switch (recurrence) {
    case "daily":
      d.setUTCDate(d.getUTCDate() + 1);
      break;
    case "weekdays": {
      d.setUTCDate(d.getUTCDate() + 1);
      const day = d.getUTCDay();
      if (day === 0) d.setUTCDate(d.getUTCDate() + 1); // Sunday → Monday
      if (day === 6) d.setUTCDate(d.getUTCDate() + 2); // Saturday → Monday
      break;
    }
    case "weekly":
      d.setUTCDate(d.getUTCDate() + 7);
      break;
    case "monthly":
      d.setUTCMonth(d.getUTCMonth() + 1);
      break;
    default:
      d.setUTCDate(d.getUTCDate() + 1);
  }

  return d.toISOString().slice(0, 10);
}

export async function completeTask(
  id: string,
  userId?: string
): Promise<{ task: Task | null; next?: Task; error?: string }> {
  try {
    const db = await getDb();
    const filter: Record<string, any> = { _id: new ObjectId(id) };
    if (userId) {
      filter.user_id = userId;
    }

    const result = await db
      .collection("tasks")
      .findOneAndUpdate(
        filter,
        { $set: { status: "done", updated_at: new Date() } },
        { returnDocument: "after" }
      );

    const d = result && "value" in result ? result.value : result;
    if (!d) return { task: null, error: "Task not found" };

    const completed = formatTask(d);
    let next: Task | undefined;

    // If recurring and has a due_date, spawn the next instance
    if (d.recurrence && d.due_date) {
      const now = new Date();
      const nextDoc = {
        user_id: d.user_id || null,
        title: d.title,
        description: d.description || "",
        priority: d.priority || "medium",
        status: "open",
        due_date: nextDueDate(d.due_date, d.recurrence),
        recurrence: d.recurrence,
        tags: Array.isArray(d.tags) ? d.tags : [],
        created_at: now,
        updated_at: now,
      };
      const ins = await db.collection("tasks").insertOne(nextDoc);
      next = formatTask({ ...nextDoc, _id: ins.insertedId });
    }

    return { task: completed, next };
  } catch (err) {
    console.error("completeTask error:", err);
    return {
      task: null,
      error: err instanceof Error ? err.message : "MongoDB error",
    };
  }
}
