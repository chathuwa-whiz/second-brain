import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pool } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const status = req.nextUrl.searchParams.get("status");
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? 50);

  const query = status
    ? {
        text: "SELECT * FROM agent_actions WHERE status = $1 ORDER BY created_at DESC LIMIT $2",
        values: [status, limit],
      }
    : {
        text: "SELECT * FROM agent_actions ORDER BY created_at DESC LIMIT $1",
        values: [limit],
      };

  try {
    const { rows } = await pool.query(query);
    return NextResponse.json({ actions: rows });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "database error" }, { status: 500 });
  }
}
