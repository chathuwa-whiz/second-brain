import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { fetchActions, fetchActionById, getDb } from "@/lib/db";
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
  const secretHeader = req.headers.get("x-webhook-secret");
  const session = await getServerSession(authOptions);

  const envSecret =
    process.env.ORCHESTRATOR_WEBHOOK_SECRET ||
    process.env.WEBHOOK_SECRET ||
    "second-brain-secret";
  if (!session && (!secretHeader || secretHeader !== envSecret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const userId = (session?.user as any)?.id || null;

  try {
    const body = await req.json();
    const { module, action, reasoning, confidence, status, metadata } = body;

    const db = await getDb();
    const id = randomUUID();
    const now = new Date().toISOString();

    const doc = {
      id,
      user_id: userId,
      module: module || "job_finding",
      action: action || "send_job_application_email",
      reasoning: reasoning || "",
      confidence: Number(confidence ?? 0.8),
      status: status || "pending",
      metadata: metadata && typeof metadata === "object" ? metadata : {},
      reviewed_at: null,
      reviewed_by: null,
      executed_at: null,
      execution_result: null,
      created_at: now,
    };

    await db.collection("agent_actions").insertOne(doc);
    const { action: createdAction } = await fetchActionById(id, userId);
    return NextResponse.json({ success: true, action: createdAction });
  } catch (err) {
    console.error("POST /api/actions error:", err);
    return NextResponse.json(
      { error: "database error", details: String(err) },
      { status: 500 }
    );
  }
}
