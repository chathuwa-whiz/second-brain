import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { adminListAllApiKeys, adminDeleteApiKey } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any)?.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized. Admin role required." }, { status: 403 });
    }

    const keys = await adminListAllApiKeys();
    return NextResponse.json({
      success: true,
      keys,
      total: keys.length,
    });
  } catch (err) {
    console.error("GET /api/admin/api-keys error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to list API keys" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any)?.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized. Admin role required." }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const keyId = searchParams.get("id");

    if (!keyId) {
      return NextResponse.json({ error: "Key ID is required" }, { status: 400 });
    }

    const ok = await adminDeleteApiKey(keyId);
    if (!ok) {
      return NextResponse.json({ error: "API key not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: "API key revoked successfully",
    });
  } catch (err) {
    console.error("DELETE /api/admin/api-keys error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete API key" },
      { status: 500 }
    );
  }
}
