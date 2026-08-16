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
      return NextResponse.json({ onboardingCompleted: false, profile: null });
    }

    return NextResponse.json({
      onboardingCompleted: Boolean(doc.value.onboardingCompleted),
      profile: doc.value,
    });
  } catch (err) {
    console.error("GET /api/user/onboarding error:", err);
    return NextResponse.json({ onboardingCompleted: false, profile: null });
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

    const trialDays = 7;
    const trialEndsAt = new Date(
      Date.now() + trialDays * 24 * 60 * 60 * 1000
    ).toISOString();

    const profileData = {
      targetJobTitles: Array.isArray(body.targetJobTitles) ? body.targetJobTitles : [],
      locations: Array.isArray(body.locations) ? body.locations : ["Remote", "Worldwide"],
      remotePreference: body.remotePreference || "remote_only",
      minSalary: body.minSalary ? Number(body.minSalary) : null,
      experienceLevel: body.experienceLevel || "mid",
      skills: Array.isArray(body.skills) ? body.skills : [],
      confidenceThreshold: Number(body.confidenceThreshold || 0.75),
      notificationFrequency: body.notificationFrequency || "instant",
      onboardingCompleted: true,
      trialEndsAt: body.trialEndsAt || trialEndsAt,
      subscriptionStatus: "trialing",
      updatedAt: new Date().toISOString(),
    };

    const db = await getDb();
    await db.collection("system_settings").updateOne(
      { key: "user_profile", user_id: userId },
      {
        $set: {
          key: "user_profile",
          user_id: userId,
          value: profileData,
          updated_at: new Date().toISOString(),
        },
      },
      { upsert: true }
    );

    return NextResponse.json({
      success: true,
      message: "Onboarding completed successfully!",
      profile: profileData,
    });
  } catch (err) {
    console.error("POST /api/user/onboarding error:", err);
    return NextResponse.json(
      { error: "Failed to complete onboarding", details: String(err) },
      { status: 500 }
    );
  }
}
