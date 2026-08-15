import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { fetchActionById, getDb } from "@/lib/db";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const actionId = Number(id);
  if (!Number.isInteger(actionId)) {
    return NextResponse.json({ error: "invalid action id" }, { status: 400 });
  }

  const { status } = await req.json();
  if (!["approved", "rejected", "pending"].includes(status)) {
    return NextResponse.json(
      { error: "status must be 'approved', 'rejected', or 'pending'" },
      { status: 400 }
    );
  }

  let conn;
  try {
    conn = await getDb();
    await conn.execute(
      `UPDATE agent_actions
       SET status = :status,
           reviewed_at = CURRENT_TIMESTAMP,
           reviewed_by = :reviewed_by
       WHERE id = :id`,
      {
        status,
        reviewed_by: session.user?.name ?? "dashboard",
        id: actionId,
      }
    );

    const { action, error } = await fetchActionById(actionId);
    if (!action) {
      return NextResponse.json({ error: error || "not found" }, { status: 404 });
    }
    return NextResponse.json({ action });
  } catch (err) {
    console.error("PATCH /api/actions/[id] error on Oracle DB:", err);
    return NextResponse.json({ error: "database error" }, { status: 500 });
  } finally {
    if (conn) await conn.close();
  }
}
