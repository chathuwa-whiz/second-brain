import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { adminGetPlatformConfig, adminSavePlatformConfig } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any)?.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized. Admin role required." }, { status: 403 });
    }

    const config = await adminGetPlatformConfig();
    return NextResponse.json({
      success: true,
      config,
    });
  } catch (err) {
    console.error("GET /api/admin/config error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load platform config" },
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
    const adminEmail = (session as any)?.user?.email || "admin";

    const saved = await adminSavePlatformConfig(body, adminEmail);
    return NextResponse.json({
      success: true,
      config: saved,
      message: "Platform configuration updated successfully.",
    });
  } catch (err) {
    console.error("POST /api/admin/config error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to save platform config" },
      { status: 500 }
    );
  }
}
