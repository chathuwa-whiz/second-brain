import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { fetchActions, fetchActionById, getDb, isPgConfigured } from "@/lib/db";
import oracledb from "oracledb";

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
    const ids = idsParam
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isInteger(n));
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

  let conn: any;
  try {
    const body = await req.json();
    const { module, action, reasoning, confidence, status, metadata } = body;

    conn = await getDb();

    if (isPgConfigured()) {
      const res = await conn.query(
        `INSERT INTO agent_actions (user_id, module, action, reasoning, confidence, status, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [
          userId,
          module || "job_finding",
          action || "send_job_application_email",
          reasoning || "",
          Number(confidence ?? 0.8),
          status || "pending",
          JSON.stringify(metadata || {}),
        ]
      );
      const insertedId = res.rows[0].id;
      const { action: createdAction } = await fetchActionById(insertedId, userId);
      return NextResponse.json({ success: true, action: createdAction });
    } else {
      const insertRes: any = await conn.execute(
        `INSERT INTO agent_actions (user_id, module, action, reasoning, confidence, status, metadata)
         VALUES (:userId, :module, :action, :reasoning, :confidence, :status, :metadata)
         RETURNING id INTO :out_id`,
        {
          userId,
          module: module || "job_finding",
          action: action || "send_job_application_email",
          reasoning: reasoning || "",
          confidence: Number(confidence ?? 0.8),
          status: status || "pending",
          metadata: JSON.stringify(metadata || {}),
          out_id: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT },
        }
      );

      const insertedId = insertRes.outBinds.out_id[0];
      const { action: createdAction } = await fetchActionById(insertedId, userId);
      return NextResponse.json({ success: true, action: createdAction });
    }
  } catch (err) {
    console.error("POST /api/actions error:", err);
    return NextResponse.json(
      { error: "database error", details: String(err) },
      { status: 500 }
    );
  } finally {
    if (conn) {
      if (typeof conn.release === "function") conn.release();
      else if (typeof conn.close === "function") await conn.close();
    }
  }
}
