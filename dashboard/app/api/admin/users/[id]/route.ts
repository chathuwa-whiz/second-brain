import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { adminGetUserDetail, adminUpdateUser, adminDeleteUser } from "@/lib/db";
import bcrypt from "bcryptjs";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any)?.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized. Admin role required." }, { status: 403 });
    }

    const detail = await adminGetUserDetail(params.id);
    if (!detail) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      detail,
    });
  } catch (err) {
    console.error(`GET /api/admin/users/${params.id} error:`, err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch user details" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any)?.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized. Admin role required." }, { status: 403 });
    }

    const body = await req.json();
    const updates: {
      name?: string;
      role?: string;
      email_verified?: string | null;
      password_hash?: string;
    } = {};

    if (body.name !== undefined) updates.name = String(body.name).trim();
    if (body.role !== undefined) {
      if (!["admin", "user"].includes(body.role)) {
        return NextResponse.json({ error: "Role must be 'admin' or 'user'" }, { status: 400 });
      }
      updates.role = body.role;
    }
    if (body.email_verified !== undefined) {
      updates.email_verified = body.email_verified
        ? new Date().toISOString()
        : null;
    }
    if (body.password && typeof body.password === "string" && body.password.length >= 6) {
      updates.password_hash = await bcrypt.hash(body.password, 12);
    }

    const ok = await adminUpdateUser(params.id, updates);
    if (!ok) {
      return NextResponse.json({ error: "User not found or no changes made" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: "User updated successfully",
    });
  } catch (err) {
    console.error(`PATCH /api/admin/users/${params.id} error:`, err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update user" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any)?.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized. Admin role required." }, { status: 403 });
    }

    // Prevent self-deletion
    const currentAdminId = (session.user as any)?.id;
    if (currentAdminId === params.id) {
      return NextResponse.json(
        { error: "Cannot delete your own active administrator account." },
        { status: 400 }
      );
    }

    const ok = await adminDeleteUser(params.id);
    if (!ok) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: "User and associated data deleted successfully.",
    });
  } catch (err) {
    console.error(`DELETE /api/admin/users/${params.id} error:`, err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete user" },
      { status: 500 }
    );
  }
}
