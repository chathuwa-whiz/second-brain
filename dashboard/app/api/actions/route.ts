import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { fetchActions, fetchActionById, getDb } from "@/lib/db";
import oracledb from "oracledb";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

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
    const results = await Promise.all(ids.map((id) => fetchActionById(id)));
    const actions = results
      .map((r) => r.action)
      .filter((a): a is NonNullable<typeof a> => a !== null);
    return NextResponse.json({ actions });
  }

  const { actions, error } = await fetchActions({ status, module, limit });
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

  let conn;
  try {
    const body = await req.json();
    const { module, action, reasoning, confidence, status, metadata } = body;

    conn = await getDb();

    // Deduplication check for job matches / applications
    const jobUrl = metadata?.job_url || null;
    const company = metadata?.company || null;
    const jobTitle = metadata?.job_title || null;

    if (jobUrl || (company && jobTitle)) {
      const checkSql = `
        SELECT id FROM agent_actions
        WHERE (
          (:job_url IS NOT NULL AND JSON_VALUE(metadata, '$.job_url') = :job_url)
          OR
          (:company IS NOT NULL AND :job_title IS NOT NULL AND
           LOWER(JSON_VALUE(metadata, '$.company')) = LOWER(:company) AND
           LOWER(JSON_VALUE(metadata, '$.job_title')) = LOWER(:job_title))
        )
        FETCH FIRST 1 ROWS ONLY
      `;

      const existing: any = await conn.execute(checkSql, {
        job_url: jobUrl,
        company: company,
        job_title: jobTitle,
      });

      if (existing.rows && existing.rows.length > 0) {
        const existingId = existing.rows[0].ID;
        const { action: existingAction } = await fetchActionById(existingId);
        return NextResponse.json({
          success: true,
          duplicated: true,
          message: "Job application approval already exists. Skipping duplicate.",
          action: existingAction,
        });
      }
    }

    const insertRes: any = await conn.execute(
      `INSERT INTO agent_actions (module, action, reasoning, confidence, status, metadata)
       VALUES (:module, :action, :reasoning, :confidence, :status, :metadata)
       RETURNING id INTO :out_id`,
      {
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
    const { action: createdAction } = await fetchActionById(insertedId);

    return NextResponse.json({ success: true, action: createdAction });
  } catch (err) {
    console.error("POST /api/actions error on Oracle DB:", err);
    return NextResponse.json(
      { error: "database error", details: String(err) },
      { status: 500 }
    );
  } finally {
    if (conn) await conn.close();
  }
}
