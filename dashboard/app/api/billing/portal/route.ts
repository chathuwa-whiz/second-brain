import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as any)?.id;
  if (!userId) {
    return NextResponse.json({ error: "Missing user session data" }, { status: 400 });
  }

  try {
    const db = await getDb();
    const profileDoc = await db.collection("system_settings").findOne({
      key: "user_profile",
      user_id: userId,
    });

    const portalUrl = profileDoc?.value?.customerPortalUrl;
    if (!portalUrl) {
      return NextResponse.json(
        {
          error:
            "No active Lemon Squeezy billing portal link found. Please subscribe to a Pro plan first.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      url: portalUrl,
    });
  } catch (err) {
    console.error("POST /api/billing/portal error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to open Customer Portal.",
      },
      { status: 500 }
    );
  }
}
