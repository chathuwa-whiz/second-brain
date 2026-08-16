import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const userId = (session.user as any)?.id;
  try {
    const db = await getDb();
    const doc = await db.collection("system_settings").findOne({
      key: "user_profile",
      user_id: userId,
    });

    if (!doc || !doc.value) {
      return NextResponse.json({ profile: null });
    }

    return NextResponse.json({ profile: doc.value });
  } catch (err) {
    console.error("GET /api/user/profile error:", err);
    return NextResponse.json({ profile: null });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const userId = (session.user as any)?.id;
  try {
    const body = await req.json();
    const db = await getDb();

    const existingDoc = await db.collection("system_settings").findOne({
      key: "user_profile",
      user_id: userId,
    });

    const existingProfile = (existingDoc && existingDoc.value) || {};
    const updatedProfile = {
      ...existingProfile,
      ...body,
      updatedAt: new Date().toISOString(),
    };

    await db.collection("system_settings").updateOne(
      { key: "user_profile", user_id: userId },
      {
        $set: {
          key: "user_profile",
          user_id: userId,
          value: updatedProfile,
          updated_at: new Date().toISOString(),
        },
      },
      { upsert: true }
    );

    return NextResponse.json({
      success: true,
      profile: updatedProfile,
    });
  } catch (err) {
    console.error("POST /api/user/profile error:", err);
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 }
    );
  }
}
