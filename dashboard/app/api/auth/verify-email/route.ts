import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import {
  getVerificationToken,
  deleteVerificationToken,
  verifyUserEmail,
  getUserByEmail,
  getUserById,
  createVerificationToken,
} from "@/lib/db";
import { sendVerificationEmail } from "@/lib/email";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.json(
      { error: "Verification token is required." },
      { status: 400 }
    );
  }

  try {
    const record = await getVerificationToken(token);

    if (!record) {
      return NextResponse.json(
        {
          error:
            "Invalid or expired verification link. Please request a new verification email.",
        },
        { status: 400 }
      );
    }

    const expiresAt = new Date(record.expires_at).getTime();
    if (Date.now() > expiresAt) {
      await deleteVerificationToken(token);
      return NextResponse.json(
        {
          error:
            "This verification link has expired. Please request a new verification email.",
          expired: true,
        },
        { status: 400 }
      );
    }

    // Verify user
    await verifyUserEmail(record.user_id);
    await deleteVerificationToken(token);

    const user = await getUserById(record.user_id);

    return NextResponse.json({
      success: true,
      message: "Email verified successfully! You can now sign in.",
      email: user?.email,
    });
  } catch (err) {
    console.error("GET /api/auth/verify-email error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred during email verification." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  // Resend verification email
  try {
    const body = await req.json();
    const { email } = body;

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "Email is required." },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = await getUserByEmail(cleanEmail);

    if (!user) {
      // Don't leak whether email exists
      return NextResponse.json({
        success: true,
        message: "If that account exists and is unverified, a new link was sent.",
      });
    }

    if (user.email_verified) {
      return NextResponse.json({
        success: true,
        message: "This account is already verified. You can sign in directly.",
        alreadyVerified: true,
      });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await createVerificationToken({
      userId: user.id,
      token,
      tokenType: "email_verification",
      expiresAt,
    });

    await sendVerificationEmail({
      email: cleanEmail,
      name: user.name,
      token,
    });

    return NextResponse.json({
      success: true,
      message: "A fresh verification link has been sent to your email.",
    });
  } catch (err) {
    console.error("POST /api/auth/verify-email (resend) error:", err);
    return NextResponse.json(
      { error: "Failed to resend verification email." },
      { status: 500 }
    );
  }
}
