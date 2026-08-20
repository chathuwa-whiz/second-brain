import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { updateJobApplication, deleteJobApplication } from "@/lib/mongo";

const VALID_STATUSES = [
  "applied",
  "interview",
  "offer",
  "rejected",
  "no_response",
  "withdrawn",
] as const;

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const userId = (session.user as any)?.id;
  const userRole = (session.user as any)?.role;
  const scopedUserId = userRole === "admin" ? undefined : userId;

  try {
    const body = await req.json();
    const { status, notes, interview_date, follow_up_date } = body;

    if (status !== undefined && !VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: `status must be one of: ${VALID_STATUSES.join(", ")}` },
        { status: 400 }
      );
    }

    const application = await updateJobApplication(
      params.id,
      { status, notes, interview_date, follow_up_date },
      scopedUserId
    );

    if (!application) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, application });
  } catch (err) {
    console.error("PATCH /api/jobs/applications/[id] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "database error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const userId = (session.user as any)?.id;
  const userRole = (session.user as any)?.role;
  const scopedUserId = userRole === "admin" ? undefined : userId;

  try {
    const success = await deleteJobApplication(params.id, scopedUserId);
    if (!success) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/jobs/applications/[id] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "database error" },
      { status: 500 }
    );
  }
}
