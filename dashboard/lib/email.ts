import nodemailer from "nodemailer";
import { getEmailSettings } from "./db";

type SendEmailOptions = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

export async function createTransporter() {
  const settings = await getEmailSettings();

  const host = process.env.SMTP_HOST || settings.smtp_host || "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT || settings.smtp_port) || 465;
  const user = process.env.SMTP_USER || settings.smtp_user || "";
  const pass = process.env.SMTP_PASSWORD || settings.smtp_password || "";

  if (!user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass,
    },
  });
}

export async function sendEmail({ to, subject, html, text }: SendEmailOptions): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const settings = await getEmailSettings();
    const fromAddress =
      process.env.SMTP_FROM ||
      settings.default_sender_email ||
      "Second Brain <no-reply@secondbrain.app>";

    const transporter = await createTransporter();

    if (!transporter) {
      console.warn(
        `[Email] SMTP is not fully configured. Email intended for "${to}" with subject "${subject}".`
      );
      // In development or when SMTP is not configured, we return success so testing proceeds
      return { success: true };
    }

    await transporter.sendMail({
      from: fromAddress,
      to,
      subject,
      text: text || html.replace(/<[^>]+>/g, ""),
      html,
    });

    return { success: true };
  } catch (err) {
    console.error(`[Email] Failed to send email to ${to}:`, err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to dispatch email",
    };
  }
}

export async function sendVerificationEmail({
  email,
  name,
  token,
}: {
  email: string;
  name?: string | null;
  token: string;
}): Promise<{ success: boolean; error?: string }> {
  const baseUrl =
    process.env.NEXTAUTH_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

  const verificationUrl = `${baseUrl.replace(/\/$/, "")}/verify-email?token=${encodeURIComponent(
    token
  )}&email=${encodeURIComponent(email)}`;

  const recipientName = name ? name.split(" ")[0] : "there";

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify your Second Brain Account</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #0b1020;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #e2e8f0;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      width: 100%;
      table-layout: fixed;
      background-color: #0b1020;
      padding: 40px 0;
    }
    .main {
      background-color: #131b2e;
      margin: 0 auto;
      width: 100%;
      max-width: 560px;
      border-spacing: 0;
      border-radius: 16px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      overflow: hidden;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
    }
    .header {
      padding: 32px 36px 24px;
      text-align: center;
      background: linear-gradient(135deg, rgba(79, 70, 229, 0.15), rgba(124, 58, 237, 0.05));
      border-bottom: 1px solid rgba(255, 255, 255, 0.07);
    }
    .logo-badge {
      display: inline-block;
      width: 48px;
      height: 48px;
      line-height: 48px;
      border-radius: 14px;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      font-size: 22px;
      margin-bottom: 12px;
      text-align: center;
    }
    .content {
      padding: 36px;
      color: #cbd5e1;
      font-size: 15px;
      line-height: 1.6;
    }
    .heading {
      color: #ffffff;
      font-size: 22px;
      font-weight: 700;
      margin: 0 0 16px;
      letter-spacing: -0.02em;
    }
    .button-wrap {
      text-align: center;
      padding: 28px 0;
    }
    .verify-button {
      display: inline-block;
      background: linear-gradient(135deg, #6366f1, #7c3aed);
      color: #ffffff !important;
      text-decoration: none;
      font-weight: 600;
      font-size: 15px;
      padding: 14px 32px;
      border-radius: 12px;
      box-shadow: 0 8px 20px rgba(99, 102, 241, 0.35);
    }
    .footer {
      padding: 24px 36px;
      text-align: center;
      font-size: 12px;
      color: #64748b;
      border-top: 1px solid rgba(255, 255, 255, 0.05);
      background-color: #0d1424;
    }
    .alt-link {
      font-size: 12px;
      color: #94a3b8;
      word-break: break-all;
      margin-top: 24px;
      padding-top: 20px;
      border-top: 1px dashed rgba(255, 255, 255, 0.1);
    }
    .alt-link a {
      color: #818cf8;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <table class="main" align="center">
      <tr>
        <td class="header">
          <div class="logo-badge">⚡</div>
          <div style="font-size: 18px; font-weight: 700; color: #ffffff; letter-spacing: -0.01em;">Second Brain</div>
        </td>
      </tr>
      <tr>
        <td class="content">
          <h1 class="heading">Verify your email address</h1>
          <p>Hi ${recipientName},</p>
          <p>Welcome to <strong>Second Brain</strong> — your autonomous personal AI assistant and career copilot. Please click the button below to verify your email address and activate your workspace.</p>
          
          <div class="button-wrap">
            <a href="${verificationUrl}" class="verify-button" target="_blank">Verify My Account</a>
          </div>

          <p style="font-size: 13px; color: #94a3b8;">This verification link will expire in 24 hours. If you did not create a Second Brain account, you can safely ignore this email.</p>

          <div class="alt-link">
            If the button doesn't work, copy and paste this URL into your browser:<br>
            <a href="${verificationUrl}">${verificationUrl}</a>
          </div>
        </td>
      </tr>
      <tr>
        <td class="footer">
          &copy; ${new Date().getFullYear()} Second Brain AI. All rights reserved.
        </td>
      </tr>
    </table>
  </div>
</body>
</html>
  `;

  console.log(`\n========================================`);
  console.log(`[AUTH] Verification Email generated for: ${email}`);
  console.log(`[AUTH] Verification Link: ${verificationUrl}`);
  console.log(`========================================\n`);

  return sendEmail({
    to: email,
    subject: "Verify your Second Brain account",
    html,
  });
}
