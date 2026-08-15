import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { fetchActionById, getEmailSettings, getDb } from "@/lib/db";
import { recordJobApplication } from "@/lib/mongo";
import { readFile } from "fs/promises";
import path from "path";

const RESUME_DIR = process.env.RESUME_DIR || "D:\\second-brain\\mcp-servers\\job-tracker-mcp\\resumes";

export async function POST(
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

  try {
    const { action, error } = await fetchActionById(actionId);
    if (!action) {
      return NextResponse.json({ error: error || "Action not found" }, { status: 404 });
    }

    const body = await req.json();
    const {
      sender_email,
      recipient_email,
      subject,
      email_body,
      resume_filename,
    } = body;

    if (!recipient_email || !subject || !email_body) {
      return NextResponse.json(
        { error: "recipient_email, subject, and email_body are required" },
        { status: 400 }
      );
    }

    const emailSettings = await getEmailSettings();
    const fromAddress = sender_email || emailSettings.default_sender_email || "chathushkanavod11@gmail.com";

    // Read resume attachment if specified
    let attachmentBuffer: Buffer | null = null;
    if (resume_filename) {
      try {
        const cleanName = path.basename(resume_filename);
        const resumePath = path.join(RESUME_DIR, cleanName);
        attachmentBuffer = await readFile(resumePath);
      } catch (err) {
        console.warn(`Could not read resume file ${resume_filename}:`, err);
      }
    }

    let messageId = "";
    let executionDetails: Record<string, unknown> = {};

    // 1. Send via Resend API
    if (emailSettings.provider === "resend" && emailSettings.resend_api_key) {
      const resendPayload: Record<string, unknown> = {
        from: fromAddress.includes("<") ? fromAddress : `Chathushka Navod <${fromAddress}>`,
        to: [recipient_email],
        subject: subject,
        text: email_body,
      };

      if (attachmentBuffer && resume_filename) {
        resendPayload.attachments = [
          {
            filename: path.basename(resume_filename),
            content: attachmentBuffer.toString("base64"),
          },
        ];
      }

      const resendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${emailSettings.resend_api_key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(resendPayload),
      });

      const resendData = await resendRes.json();
      if (!resendRes.ok) {
        throw new Error(resendData.message || resendData.error || "Resend API error");
      }
      messageId = resendData.id || "resend-" + Date.now();
      executionDetails = {
        provider: "resend",
        messageId,
        sent_to: recipient_email,
        from: fromAddress,
        resume_attached: resume_filename || null,
      };
    } else {
      messageId = "simulated-" + Date.now();
      executionDetails = {
        provider: "simulated",
        notice: "No Resend API key configured in Settings. Action marked approved and application recorded.",
        messageId,
        sent_to: recipient_email,
        from: fromAddress,
        resume_attached: resume_filename || null,
      };
    }

    // 2. Mark action as approved & executed in Oracle Database
    const meta: Record<string, any> = {
      ...((action.metadata as Record<string, any>) || {}),
      recipient_email,
      sender_email: fromAddress,
      email_subject: subject,
      email_body,
      suggested_resume: resume_filename,
    };

    let conn;
    try {
      conn = await getDb();
      await conn.execute(
        `UPDATE agent_actions
         SET status = 'approved',
             reviewed_at = CURRENT_TIMESTAMP,
             reviewed_by = :reviewed_by,
             executed_at = CURRENT_TIMESTAMP,
             execution_result = :execution_result,
             metadata = :metadata
         WHERE id = :id`,
        {
          reviewed_by: session.user?.name || "operator",
          execution_result: JSON.stringify(executionDetails),
          metadata: JSON.stringify(meta),
          id: actionId,
        }
      );
    } finally {
      if (conn) await conn.close();
    }

    // 3. Record application in MongoDB
    try {
      await recordJobApplication({
        company: String(meta.company || meta.extracted_company || "TopJobs Employer"),
        role: String(meta.job_title || meta.extracted_job_title || "Software Engineer"),
        job_url: String(meta.job_url || ""),
        resume_version: resume_filename || "Default",
        notes: `Applied via Second Brain Approvals. Message ID: ${messageId}`,
        status: "applied",
      });
    } catch (mongoErr) {
      console.warn("Could not log to MongoDB job_applications:", mongoErr);
    }

    const { action: updatedAction } = await fetchActionById(actionId);

    return NextResponse.json({
      success: true,
      action: updatedAction,
      messageId,
    });
  } catch (err) {
    console.error("POST /api/approvals/[id]/send error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to send email" },
      { status: 500 }
    );
  }
}
