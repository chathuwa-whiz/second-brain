import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { fetchActionById, getEmailSettings, getDb } from "@/lib/db";
import { recordJobApplication } from "@/lib/mongo";
import { getUserResumeBuffer } from "@/lib/storage";
import path from "path";
import nodemailer from "nodemailer";
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
      mode = "email", // "email" | "manual"
      sender_email,
      recipient_email,
      subject,
      email_body,
      resume_filename,
      notes,
    } = body;

    const emailSettings = await getEmailSettings(userId);
    const userSender =
      sender_email || emailSettings.fromEmail || session.user?.email || "user@secondbrain.app";

    let messageId = "";
    let executionDetails: Record<string, unknown> = {};

    if (mode === "manual") {
      // 1. Manual Application
      messageId = "manual-" + Date.now();
      executionDetails = {
        provider: "manual",
        mode: "website_portal",
        note: notes || "Applied manually via company careers portal / website.",
        resume_version: resume_filename || null,
        marked_at: new Date().toISOString(),
      };
    } else {
      // 2. Email Application via SMTP
      if (!recipient_email || !subject || !email_body) {
        return NextResponse.json(
          {
            error:
              "recipient_email, subject, and email_body are required for email dispatch",
          },
          { status: 400 }
        );
      }

      const rawHost = emailSettings.smtpHost || "smtp.gmail.com";
      const smtpHost = rawHost.trim();
      const userFromSetting = emailSettings.smtpUser || emailSettings.fromEmail || emailSettings.default_sender_email || userSender;
      const smtpUser = userFromSetting.includes("@") ? userFromSetting.trim() : (session.user?.email || userSender).trim();
      const smtpPass = (emailSettings.smtpPassword || "").replace(/\s+/g, "").trim();

      if (!smtpPass || !smtpUser) {
        return NextResponse.json(
          {
            error:
              "Outbound email is not configured. Please go to Settings > Outbound Email Account and enter your Gmail address and 16-character Google App Password before sending emails.",
          },
          { status: 400 }
        );
      }

      let attachmentBuffer: Buffer | null = null;
      if (resume_filename) {
        try {
          attachmentBuffer = await getUserResumeBuffer(userId, resume_filename);
        } catch (err) {
          console.warn(`Could not read resume file ${resume_filename}:`, err);
        }
      }

      const fromHeader = emailSettings.senderName
        ? `${emailSettings.senderName} <${smtpUser}>`
        : smtpUser;

      const mailOptions: nodemailer.SendMailOptions = {
        from: fromHeader,
        to: recipient_email,
        replyTo: emailSettings.replyTo || smtpUser,
        subject: subject,
        text: email_body,
      };

      if (attachmentBuffer && resume_filename) {
        mailOptions.attachments = [
          {
            filename: path.basename(resume_filename),
            content: attachmentBuffer,
            contentType: "application/pdf",
          },
        ];
      }

      // Dual-port dispatch: Try configured port / 465, with automatic fallback to 587
      const primaryPort = Number(emailSettings.smtpPort) || 465;
      const fallbackPort = primaryPort === 465 ? 587 : 465;

      let info: any = null;
      let lastErr: any = null;

      // 1. Try Primary Port
      try {
        const primaryTransporter = nodemailer.createTransport({
          host: smtpHost,
          port: primaryPort,
          secure: primaryPort === 465,
          auth: { user: smtpUser, pass: smtpPass },
          connectionTimeout: 8000,
          greetingTimeout: 8000,
          socketTimeout: 12000,
        });
        info = await primaryTransporter.sendMail(mailOptions);
      } catch (err1: any) {
        lastErr = err1;
        console.warn(`SMTP dispatch failed on port ${primaryPort}, trying fallback port ${fallbackPort}:`, err1.message);

        // 2. Try Fallback Port
        try {
          const fallbackTransporter = nodemailer.createTransport({
            host: smtpHost,
            port: fallbackPort,
            secure: fallbackPort === 465,
            auth: { user: smtpUser, pass: smtpPass },
            connectionTimeout: 8000,
            greetingTimeout: 8000,
            socketTimeout: 12000,
          });
          info = await fallbackTransporter.sendMail(mailOptions);
        } catch (err2: any) {
          lastErr = err2;
          console.error(`SMTP fallback dispatch also failed on port ${fallbackPort}:`, err2);
        }
      }

      if (!info) {
        const msg = lastErr?.message || "Connection timed out connecting to mail server";
        return NextResponse.json(
          {
            error: `Email delivery failed: ${msg}. Please check your Gmail address and 16-character Google App Password in Settings > Outbound Email Account.`,
          },
          { status: 400 }
        );
      }

      messageId = info.messageId || "smtp-" + Date.now();
      executionDetails = {
        provider: "smtp",
        messageId,
        sent_to: recipient_email,
        from: fromHeader,
        response: info.response,
        resume_attached: resume_filename || null,
      };
    }

    // 3. Update action in MongoDB
    const meta: Record<string, any> = {
      ...((action.metadata as Record<string, any>) || {}),
      application_mode: mode,
      recipient_email: mode === "email" ? recipient_email : undefined,
      sender_email: userSender,
      email_subject: mode === "email" ? subject : undefined,
      email_body: mode === "email" ? email_body : undefined,
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

    // 4. Record application in MongoDB
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
            : `Applied via Second Brain Approvals. Message ID: ${messageId}`,
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
