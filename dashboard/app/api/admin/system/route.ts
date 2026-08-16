import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { adminGetCollectionStats, getEmailSettings } from "@/lib/db";
import nodemailer from "nodemailer";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any)?.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized. Admin role required." }, { status: 403 });
    }

    const collections = await adminGetCollectionStats();
    const emailSettings = await getEmailSettings();

    const nodeVersion = process.version;
    const uptime = process.uptime();
    const memory = process.memoryUsage();

    return NextResponse.json({
      success: true,
      system: {
        nodeVersion,
        uptime,
        memoryUsageMb: {
          rss: Math.round(memory.rss / 1024 / 1024),
          heapTotal: Math.round(memory.heapTotal / 1024 / 1024),
          heapUsed: Math.round(memory.heapUsed / 1024 / 1024),
        },
        emailTransportConfigured: emailSettings.configured,
        emailSender: emailSettings.fromEmail || "None",
      },
      collections,
    });
  } catch (err) {
    console.error("GET /api/admin/system error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load system diagnostics" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any)?.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized. Admin role required." }, { status: 403 });
    }

    const body = await req.json();
    const { action, recipientEmail } = body;

    if (action === "test_email") {
      const emailSettings = await getEmailSettings();
      const target = recipientEmail || (session as any)?.user?.email;

      if (!emailSettings.configured || !emailSettings.smtpHost) {
        return NextResponse.json(
          { error: "SMTP host or credentials not configured. Please configure them in Settings." },
          { status: 400 }
        );
      }

      const transporter = nodemailer.createTransport({
        host: emailSettings.smtpHost,
        port: emailSettings.smtpPort || 465,
        secure: (emailSettings.smtpPort || 465) === 465,
        auth: {
          user: emailSettings.smtpUser,
          pass: emailSettings.smtpPassword,
        },
      });

      await transporter.sendMail({
        from: `"${emailSettings.senderName || 'Second Brain Admin'}" <${emailSettings.fromEmail || emailSettings.smtpUser}>`,
        to: target,
        subject: "Second Brain Admin — SMTP Diagnostic Test",
        text: `This is a live test email sent from your Second Brain Admin Console at ${new Date().toISOString()}.\n\nYour outgoing email system is operational!`,
      });

      return NextResponse.json({
        success: true,
        message: `Diagnostic email successfully dispatched to ${target}`,
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    console.error("POST /api/admin/system error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "System diagnostic test failed" },
      { status: 500 }
    );
  }
}
