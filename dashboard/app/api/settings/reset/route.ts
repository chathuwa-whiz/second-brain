import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const userId = (session.user as any)?.id;
  const results: Record<string, unknown> = {};

  try {
    const db = await getDb();
    const filter = userId
      ? { $or: [{ user_id: userId }, { user_id: { $exists: false } }, { user_id: null }] }
      : {};

    const [resActions, resMatches, resApps] = await Promise.all([
      db.collection("agent_actions").deleteMany(filter),
      db.collection("job_matches").deleteMany(filter),
      db.collection("job_applications").deleteMany(filter),
    ]);

    results.agent_actions_deleted = resActions.deletedCount;
    results.job_matches_deleted = resMatches.deletedCount;
    results.job_applications_deleted = resApps.deletedCount;

    return NextResponse.json({
      success: true,
      message: "Your workspace queues and history have been reset.",
      details: results,
    });
  } catch (err) {
    console.error("POST /api/settings/reset error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Database reset failed" },
      { status: 500 }
    );
  }
}
