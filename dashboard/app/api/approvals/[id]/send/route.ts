import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { fetchActionById, getDb } from "@/lib/db";
import { recordJobApplication } from "@/lib/mongo";
import { ObjectId } from "mongodb";

export async function POST(
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

  const userId = (session.user as any)?.id;

  try {
    const { action, error: fetchErr } = await fetchActionById(id, userId);
    if (!action) {
      return NextResponse.json(
        { error: fetchErr || "Action not found" },
        { status: 404 }
      );
    }

    const body = await req.json();
    const {
      mode = "email", // "email" | "manual" | "gmail"
      sender_email,
      recipient_email,
      subject,
      email_body,
      resume_filename,
      notes,
    } = body;

    const userSender = sender_email || session.user?.email || "candidate@secondbrain.app";
    const messageId = (mode === "email" || mode === "gmail" ? "gmail-" : "portal-") + Date.now();

    const executionDetails: Record<string, unknown> = {
      provider: mode === "manual" ? "website_portal" : "gmail_client",
      mode: mode === "manual" ? "website_portal" : "gmail_application",
      note:
        notes ||
        (mode === "manual"
          ? "Applied manually via company careers portal / website."
          : `Sent via Gmail application to ${recipient_email || "employer"}`),
      recipient_email: recipient_email || undefined,
      sender_email: userSender,
      resume_version: resume_filename || null,
      marked_at: new Date().toISOString(),
    };

    // 1. Update action metadata & status in MongoDB
    const meta: Record<string, any> = {
      ...((action.metadata as Record<string, any>) || {}),
      application_mode: mode,
      recipient_email: recipient_email || undefined,
      sender_email: userSender,
      email_subject: subject || undefined,
      email_body: email_body || undefined,
      suggested_resume: resume_filename,
    };

    const db = await getDb();
    const filter: any = {
      $or: [{ id: id }, { _id: id }].filter(Boolean),
    };
    if (ObjectId.isValid(id)) {
      filter.$or.push({ _id: new ObjectId(id) });
    }

    await db.collection("agent_actions").updateOne(filter, {
      $set: {
        status: "approved",
        reviewed_at: new Date().toISOString(),
        reviewed_by: session.user?.name || "operator",
        executed_at: new Date().toISOString(),
        execution_result: executionDetails,
        metadata: meta,
      },
    });

    // 2. Record application in job_applications collection
    try {
      await recordJobApplication({
        userId,
        company: String(meta.company || meta.extracted_company || "Target Employer"),
        role: String(meta.job_title || meta.extracted_job_title || "Software Engineer"),
        job_url: String(meta.job_url || ""),
        resume_version: resume_filename || "Default",
        notes:
          mode === "manual"
            ? notes || "Applied manually via company website/portal."
            : `Applied via Gmail. Recipient: ${recipient_email || "N/A"}`,
        status: "applied",
      });
    } catch (mongoErr) {
      console.warn("Could not log to MongoDB job_applications:", mongoErr);
    }

    const { action: updatedAction } = await fetchActionById(id, userId);

    return NextResponse.json({
      success: true,
      action: updatedAction,
      mode,
      messageId,
    });
  } catch (err) {
    console.error("POST /api/approvals/[id]/send error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to process approval" },
      { status: 500 }
    );
  }
}
