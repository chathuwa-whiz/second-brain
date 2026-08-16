import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { adminGetPlatformStats, adminGetCollectionStats } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any)?.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized. Admin role required." }, { status: 403 });
    }

    const [stats, collections] = await Promise.all([
      adminGetPlatformStats(),
      adminGetCollectionStats(),
    ]);

    return NextResponse.json({
      success: true,
      stats,
      collections,
    });
  } catch (err) {
    console.error("GET /api/admin/stats error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load platform stats" },
      { status: 500 }
    );
  }
}
