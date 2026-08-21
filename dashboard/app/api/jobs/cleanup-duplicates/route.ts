import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { deduplicateUserJobActions, fetchActions } from "@/lib/db";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const userId = (session.user as any)?.id;
  const userRole = (session.user as any)?.role;
  const scopedUserId = userRole === "admin" ? undefined : userId;

  try {
    const { removedCount, preservedCount, error } = await deduplicateUserJobActions(scopedUserId);
    if (error) {
      return NextResponse.json({ error }, { status: 500 });
    }

    // Return the updated fresh list of actions
    const { actions } = await fetchActions({ module: "job_finding", limit: 150, userId: scopedUserId });

    return NextResponse.json({
      success: true,
      removedCount,
      preservedCount,
      actions,
      message:
        removedCount > 0
          ? `Successfully removed ${removedCount} duplicate job ${removedCount === 1 ? "entry" : "entries"}.`
          : "No duplicate jobs found.",
    });
  } catch (err) {
    console.error("POST /api/jobs/cleanup-duplicates error:", err);
    return NextResponse.json(
      { error: "Failed to cleanup duplicates", details: String(err) },
      { status: 500 }
    );
  }
}
