import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { adminGetCollectionStats } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any)?.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized. Admin role required." }, { status: 403 });
    }

    const collections = await adminGetCollectionStats();

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
        applicationDispatchMode: "gmail_web_and_portal",
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
    return NextResponse.json({ success: true, received: body.action || "ok" });
  } catch (err) {
    console.error("POST /api/admin/system error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "System diagnostic test failed" },
      { status: 500 }
    );
  }
}
