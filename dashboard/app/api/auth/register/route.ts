import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import {
  getUserByEmail,
  createUser,
  createVerificationToken,
  updateUserPassword,
} from "@/lib/db";
import { sendVerificationEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, password } = body;

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json(
        { error: "A valid email address is required." },
        { status: 400 }
      );
    }

    if (!password || typeof password !== "string" || password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters long." },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = (name && typeof name === "string" ? name.trim() : "") || cleanEmail.split("@")[0];

    const existingUser = await getUserByEmail(cleanEmail);

    if (existingUser) {
      if (existingUser.email_verified) {
        return NextResponse.json(
          {
            error:
              "An account with this email already exists. Please sign in instead.",
          },
          { status: 400 }
        );
      }

      // Existing unverified user: update their password and re-issue a verification token
      const passwordHash = await bcrypt.hash(password, 12);
      await updateUserPassword(existingUser.id, passwordHash);

      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      await createVerificationToken({
        userId: existingUser.id,
        token,
        tokenType: "email_verification",
        expiresAt,
      });

      await sendVerificationEmail({
        email: cleanEmail,
        name: existingUser.name || cleanName,
        token,
      });

      return NextResponse.json({
        success: true,
        message:
          "Your account is pending verification. We have sent a fresh verification link to your email.",
        email: cleanEmail,
      });
    }

    // New user registration
    const passwordHash = await bcrypt.hash(password, 12);

    const newUser = await createUser({
      name: cleanName,
      email: cleanEmail,
      passwordHash,
      emailVerified: null,
      role: "user",
    });

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await createVerificationToken({
      userId: newUser.id,
      token,
      tokenType: "email_verification",
      expiresAt,
    });

    await sendVerificationEmail({
      email: cleanEmail,
      name: cleanName,
      token,
    });

    return NextResponse.json(
      {
        success: true,
        message:
          "Account created successfully! We sent a verification link to your email. Please verify to sign in.",
        email: cleanEmail,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("POST /api/auth/register error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "An unexpected error occurred while creating your account.",
      },
      { status: 500 }
    );
  }
}
