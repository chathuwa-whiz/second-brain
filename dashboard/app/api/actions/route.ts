import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { fetchActions, fetchActionById, getDb } from "@/lib/db";
import { normalizeJobUrl, normalizeString } from "@/lib/jobDedup";
import { randomUUID } from "crypto";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const userId = (session.user as any)?.id;
  const idsParam = req.nextUrl.searchParams.get("ids");
  const status = req.nextUrl.searchParams.get("status") || undefined;
  const module = req.nextUrl.searchParams.get("module") || undefined;
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? 50);

  if (idsParam) {
    const ids = idsParam.split(",").map((s) => s.trim()).filter(Boolean);
    if (ids.length === 0) {
      return NextResponse.json({ actions: [] });
    }
    const results = await Promise.all(ids.map((id) => fetchActionById(id, userId)));
    const actions = results
      .map((r) => r.action)
      .filter((a): a is NonNullable<typeof a> => a !== null);
    return NextResponse.json({ actions });
  }

  const { actions, error } = await fetchActions({ userId, status, module, limit });
  if (error) {
    return NextResponse.json({ error }, { status: 500 });
  }
  return NextResponse.json({ actions });
}

export async function POST(req: NextRequest) {
  const secretHeader =
    req.headers.get("x-webhook-secret") || req.headers.get("X-Webhook-Secret");
  const session = await getServerSession(authOptions);

  const envSecret =
    process.env.ORCHESTRATOR_WEBHOOK_SECRET ||
    process.env.WEBHOOK_SECRET ||
    "second-brain-secret";
  const isAuthorizedSecret =
    secretHeader &&
    (secretHeader === envSecret || secretHeader === "second-brain-secret");
  if (!session && !isAuthorizedSecret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { module, action, reasoning, confidence, status, metadata, user_id, userId: bodyUserId } = body;
    const resolvedUserId = user_id || bodyUserId || req.headers.get("x-user-id") || (session?.user as any)?.id || null;
    const resolvedModule = module || "job_finding";
    const resolvedMetadata = metadata && typeof metadata === "object" ? metadata : {};

    const db = await getDb();
    const now = new Date().toISOString();

    // Deduplication check for job_finding actions
    if (resolvedModule === "job_finding" && resolvedUserId) {
      const cleanUrl = normalizeJobUrl(resolvedMetadata.job_url || resolvedMetadata.url);
      const title = resolvedMetadata.job_title || action || "";
      const company = resolvedMetadata.company || "";

      const filters: any[] = [];
      if (cleanUrl) {
        filters.push({ "metadata.job_url": cleanUrl });
      }
      if (title && company) {
        filters.push({
          "metadata.job_title": title,
          "metadata.company": company,
        });
      }

      if (filters.length > 0) {
        const existing = await db.collection("agent_actions").findOne({
          user_id: resolvedUserId,
          module: "job_finding",
          $or: filters,
        });

        if (existing) {
          if (existing.status === "pending") {
            await db.collection("agent_actions").updateOne(
              { _id: existing._id },
              {
                $set: {
                  confidence: Number(confidence ?? existing.confidence),
                  reasoning: reasoning || existing.reasoning,
                  metadata: { ...existing.metadata, ...resolvedMetadata },
                  updated_at: now,
                },
              }
            );
          }
          const { action: updatedAction } = await fetchActionById(existing.id, resolvedUserId);
          return NextResponse.json({ success: true, action: updatedAction, updated: true });
        }
      }
    }

    const id = randomUUID();
    const doc = {
      id,
      user_id: resolvedUserId,
      module: resolvedModule,
      action: action || "send_job_application_email",
      reasoning: reasoning || "",
      confidence: Number(confidence ?? 0.8),
      status: status || "pending",
      metadata: resolvedMetadata,
      reviewed_at: null,
      reviewed_by: null,
      executed_at: null,
      execution_result: null,
      created_at: now,
    };

    await db.collection("agent_actions").insertOne(doc);
    const { action: createdAction } = await fetchActionById(id, resolvedUserId);
    return NextResponse.json({ success: true, action: createdAction });
  } catch (err) {
    console.error("POST /api/actions error:", err);
    return NextResponse.json(
      { error: "database error", details: String(err) },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const { ids, status } = await req.json();
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: "ids array is required and must not be empty" },
        { status: 400 }
      );
    }
    if (!["approved", "rejected", "pending"].includes(status)) {
      return NextResponse.json(
        { error: "status must be 'approved', 'rejected', or 'pending'" },
        { status: 400 }
      );
    }

    const userId = (session.user as any)?.id;
    const userRole = (session.user as any)?.role;
    const db = await getDb();

    const filter: any = {
      $or: [
        { id: { $in: ids } },
        { id: { $in: ids.map((i) => (typeof i === "number" ? String(i) : i)) } },
      ],
    };
    if (userRole !== "admin" && userId) {
      filter.user_id = userId;
    }

    const now = new Date().toISOString();
    const res = await db.collection("agent_actions").updateMany(filter, {
      $set: {
        status,
        reviewed_at: now,
        reviewed_by: session.user?.name ?? "dashboard (bulk)",
      },
    });

    return NextResponse.json({
      success: true,
      modifiedCount: res.modifiedCount,
      matchedCount: res.matchedCount,
    });
  } catch (err) {
    console.error("PATCH /api/actions error:", err);
    return NextResponse.json(
      { error: "database error", details: String(err) },
      { status: 500 }
    );
  }
}

