import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { fetchActionById, getDb } from "@/lib/db";
import { ObjectId } from "mongodb";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "invalid action id" }, { status: 400 });
  }

  const { status } = await req.json();
  if (!["approved", "rejected", "pending"].includes(status)) {
    return NextResponse.json(
      { error: "status must be 'approved', 'rejected', or 'pending'" },
      { status: 400 }
    );
  }

  try {
    const db = await getDb();
    const filter: any = {
      $or: [{ id: id }, { id: Number(id) ? Number(id) : null }, { _id: id }].filter(Boolean),
    };
    if (ObjectId.isValid(id)) {
      filter.$or.push({ _id: new ObjectId(id) });
    }

    const res = await db.collection("agent_actions").updateOne(filter, {
      $set: {
        status,
        reviewed_at: new Date().toISOString(),
        reviewed_by: session.user?.name ?? "dashboard",
      },
    });

    if (res.matchedCount === 0) {
      return NextResponse.json({ error: "Action not found" }, { status: 404 });
    }

    const { action: updatedAction } = await fetchActionById(id);
    return NextResponse.json({ action: updatedAction });
  } catch (err) {
    console.error("PATCH /api/actions/[id] error:", err);
    return NextResponse.json({ error: "database error" }, { status: 500 });
  }
}
