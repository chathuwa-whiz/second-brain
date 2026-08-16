import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { adminListUsers, createUser, getUserByEmail } from "@/lib/db";
import bcrypt from "bcryptjs";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any)?.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized. Admin role required." }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || undefined;
    const role = searchParams.get("role") || undefined;
    const verifiedParam = searchParams.get("isVerified");
    const isVerified =
      verifiedParam === "true" ? true : verifiedParam === "false" ? false : undefined;
    const limit = Number(searchParams.get("limit")) || 50;
    const offset = Number(searchParams.get("offset")) || 0;

    const data = await adminListUsers({
      search,
      role,
      isVerified,
      limit,
      offset,
    });

    return NextResponse.json({
      success: true,
      users: data.users,
      total: data.total,
    });
  } catch (err) {
    console.error("GET /api/admin/users error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to list users" },
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
    const { name, email, password, role = "user", isVerified = true } = body;

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json({ error: "Valid email address is required" }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const existing = await getUserByEmail(cleanEmail);
    if (existing) {
      return NextResponse.json(
        { error: "A user with this email address already exists." },
        { status: 400 }
      );
    }

    let passwordHash: string | null = null;
    if (password && typeof password === "string" && password.length >= 6) {
      passwordHash = await bcrypt.hash(password, 12);
    } else {
      // Default generated temporary password if not provided
      passwordHash = await bcrypt.hash("SecondBrain#2026", 12);
    }

    const newUser = await createUser({
      name: name?.trim() || cleanEmail.split("@")[0],
      email: cleanEmail,
      passwordHash,
      role: role === "admin" ? "admin" : "user",
      emailVerified: isVerified ? new Date() : null,
    });

    return NextResponse.json({
      success: true,
      user: newUser,
    });
  } catch (err) {
    console.error("POST /api/admin/users error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create user" },
      { status: 500 }
    );
  }
}
