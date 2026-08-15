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
      mode = "email", // "email" | "manual"
      sender_email,
      recipient_email,
      subject,
      email_body,
      resume_filename,
      notes,
    } = body;

    const emailSettings = await getEmailSettings();
    const userSender = sender_email || emailSettings.default_sender_email || "chathushkanavod11@gmail.com";

    let messageId = "";
    let executionDetails: Record<string, unknown> = {};

    if (mode === "manual") {
      // 1. Manual Application (Website / Portal apply without email)
      messageId = "manual-" + Date.now();
      executionDetails = {
        provider: "manual",
        mode: "website_portal",
        note: notes || "Applied manually via company careers portal / website.",
        resume_version: resume_filename || null,
        marked_at: new Date().toISOString(),
      };
    } else {
      // 2. Email Application via Resend / SMTP
      if (!recipient_email || !subject || !email_body) {
        return NextResponse.json(
          { error: "recipient_email, subject, and email_body are required for email dispatch" },
          { status: 400 }
        );
      }

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

      if (emailSettings.provider === "resend" && emailSettings.resend_api_key) {
        // Resend Sandbox / Custom Domain resolution:
        // Free @gmail.com / @yahoo.com addresses cannot be spoofed directly in the `from` field on Resend.
        // If sender is gmail/public, we send from onboarding@resend.dev with reply_to set to candidate's email.
        const isFreeEmail = /@(gmail|yahoo|outlook|hotmail|icloud)\.com/i.test(userSender);
        const fromHeader = isFreeEmail
          ? `Chathushka Navod <onboarding@resend.dev>`
          : userSender.includes("<")
          ? userSender
          : `Chathushka Navod <${userSender}>`;

        const resendPayload: Record<string, unknown> = {
          from: fromHeader,
          to: [recipient_email],
          reply_to: userSender,
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
          from: fromHeader,
          reply_to: userSender,
          resume_attached: resume_filename || null,
        };
      } else {
        messageId = "simulated-" + Date.now();
        executionDetails = {
          provider: "simulated",
          notice: "No Resend API key configured in Settings. Action marked approved and application recorded.",
          messageId,
          sent_to: recipient_email,
          from: userSender,
          resume_attached: resume_filename || null,
        };
      }
    }

    // 3. Mark action as approved & executed in Oracle Database
    const meta: Record<string, any> = {
      ...((action.metadata as Record<string, any>) || {}),
      application_mode: mode,
      recipient_email: mode === "email" ? recipient_email : undefined,
      sender_email: userSender,
      email_subject: mode === "email" ? subject : undefined,
      email_body: mode === "email" ? email_body : undefined,
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

    // 4. Record application in MongoDB
    try {
      await recordJobApplication({
        company: String(meta.company || meta.extracted_company || "TopJobs Employer"),
        role: String(meta.job_title || meta.extracted_job_title || "Software Engineer"),
        job_url: String(meta.job_url || ""),
        resume_version: resume_filename || "Default",
        notes: mode === "manual"
          ? (notes || "Applied manually via company website/portal.")
          : `Applied via Second Brain Approvals. Message ID: ${messageId}`,
        status: "applied",
      });
    } catch (mongoErr) {
      console.warn("Could not log to MongoDB job_applications:", mongoErr);
    }

    const { action: updatedAction } = await fetchActionById(actionId);

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
