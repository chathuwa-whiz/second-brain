import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pool } from "@/lib/db";

// Minimal approve/reject endpoint for pending actions. This is the seed of
// the "approval queue" the full dashboard grows into during Phase 5 — kept
// here now since the trust_layer schema already supports it.
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { status } = await req.json();
  if (!["approved", "rejected"].includes(status)) {
    return NextResponse.json(
      { error: "status must be 'approved' or 'rejected'" },
      { status: 400 }
    );
  }

  try {
    const { rows } = await pool.query(
      `UPDATE agent_actions
       SET status = $1, reviewed_at = now(), reviewed_by = $2
       WHERE id = $3
       RETURNING *`,
      [status, session.user?.name ?? "dashboard", params.id]
    );
    if (rows.length === 0) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    return NextResponse.json({ action: rows[0] });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "database error" }, { status: 500 });
  }
}
