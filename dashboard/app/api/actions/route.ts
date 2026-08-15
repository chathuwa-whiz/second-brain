import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getPool } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const idsParam = req.nextUrl.searchParams.get("ids");
  const status = req.nextUrl.searchParams.get("status");
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? 50);

  let query;
  if (idsParam) {
    // Used by the approval queue's post-approve polling: fetch just the
    // specific rows it's waiting on for execution results, not the whole list.
    const ids = idsParam
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isInteger(n));
    if (ids.length === 0) {
      return NextResponse.json({ actions: [] });
    }
    query = {
      text: "SELECT * FROM agent_actions WHERE id = ANY($1::bigint[])",
      values: [ids],
    };
  } else if (status) {
    query = {
      text: "SELECT * FROM agent_actions WHERE status = $1 ORDER BY created_at DESC LIMIT $2",
      values: [status, limit],
    };
  } else {
    query = {
      text: "SELECT * FROM agent_actions ORDER BY created_at DESC LIMIT $1",
      values: [limit],
    };
  }

  try {
    const { rows } = await getPool().query(query);
    return NextResponse.json({ actions: rows });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "database error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const secretHeader = req.headers.get("x-webhook-secret");
  const session = await getServerSession(authOptions);

  const envSecret = process.env.ORCHESTRATOR_WEBHOOK_SECRET || process.env.WEBHOOK_SECRET || "second-brain-secret";
  if (!session && (!secretHeader || secretHeader !== envSecret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { module, action, reasoning, confidence, status, metadata } = body;

    const { rows } = await getPool().query(
      `INSERT INTO agent_actions (module, action, reasoning, confidence, status, metadata)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)
       RETURNING *`,
      [
        module || "job_finding",
        action || "send_job_application_email",
        reasoning || "",
        confidence ?? 0.8,
        status || "pending",
        JSON.stringify(metadata || {}),
      ]
    );

    return NextResponse.json({ success: true, action: rows[0] });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "database error", details: String(err) }, { status: 500 });
  }
}

