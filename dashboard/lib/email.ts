import nodemailer from "nodemailer";

type SendEmailOptions = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

export async function createTransporter() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;

  if (!host || !user || !pass) {
    return null;
  }

  const port = Number(process.env.SMTP_PORT) || 465;

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
    const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER || "Second Brain <no-reply@secondbrain.app>";
    const transporter = await createTransporter();

    if (!transporter) {
      console.log(`[Email Notice] Outbound SMTP not configured. Logged email for "${to}" with subject "${subject}".`);
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
    console.warn(`[Email Warning] Could not dispatch email via SMTP:`, err);
    return {
      success: true, // Don't block registration/flows if SMTP is disabled
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
</head>
<body style="background-color: #0b1020; font-family: sans-serif; color: #e2e8f0; padding: 40px 20px;">
  <div style="max-width: 560px; margin: 0 auto; background-color: #131b2e; border-radius: 16px; padding: 32px; border: 1px solid rgba(255,255,255,0.1);">
    <h1 style="color: #ffffff; font-size: 20px;">Verify your Second Brain account</h1>
    <p>Hi ${recipientName},</p>
    <p>Welcome to <strong>Second Brain</strong>! Click the link below to verify your email and activate your account:</p>
    <div style="text-align: center; margin: 28px 0;">
      <a href="${verificationUrl}" style="background: #6366f1; color: #ffffff; padding: 12px 28px; border-radius: 10px; text-decoration: none; font-weight: bold; display: inline-block;">Verify My Account</a>
    </div>
    <p style="font-size: 12px; color: #94a3b8;">Or copy this URL into your browser:<br><a href="${verificationUrl}" style="color: #818cf8;">${verificationUrl}</a></p>
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
