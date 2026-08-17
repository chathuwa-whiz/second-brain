import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { listUserResumes } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secretHeader =
    req.headers.get("x-webhook-secret") || req.headers.get("X-Webhook-Secret");
  const session = await getServerSession(authOptions);

  const envSecret =
    process.env.ORCHESTRATOR_WEBHOOK_SECRET ||
    process.env.WEBHOOK_SECRET ||
    "second-brain-secret";

  const isAuthorized =
    (secretHeader && secretHeader === envSecret) ||
    (session && (session.user as any)?.role === "admin");

  if (!isAuthorized) {
    return NextResponse.json(
      { error: "Unauthorized. Webhook secret or admin session required." },
      { status: 401 }
    );
  }

  try {
    const db = await getDb();
    const users = await db.collection("users").find({}).toArray();

    const userIds = users.map((u) => String(u.id || u._id));

    // Fetch all user profiles from system_settings
    const profileDocs = await db
      .collection("system_settings")
      .find({ key: "user_profile", user_id: { $in: userIds } })
      .toArray();

    const profileMap = new Map<string, any>();
    for (const doc of profileDocs) {
      if (doc.user_id) {
        profileMap.set(String(doc.user_id), doc.value);
      }
    }

    const activeUsers = await Promise.all(
      users.map(async (userDoc) => {
        const userId = String(userDoc.id || userDoc._id);
        const rawProfile = profileMap.get(userId) || {};

        // Skip user if explicitly disabled job discovery
        if (rawProfile.jobDiscoveryActive === false) {
          return null;
        }

        let userResumes: string[] = [];
        try {
          const resumesResult = await listUserResumes(userId);
          userResumes = (resumesResult.files || []).map((f) => f.name);
        } catch {
          userResumes = [];
        }

        return {
          id: userId,
          name: userDoc.name || userDoc.email.split("@")[0],
          email: userDoc.email,
          targetJobTitles: Array.isArray(rawProfile.targetJobTitles)
            ? rawProfile.targetJobTitles
            : [],
          skills: Array.isArray(rawProfile.skills) ? rawProfile.skills : [],
          locations: Array.isArray(rawProfile.locations)
            ? rawProfile.locations
            : ["Remote", "Worldwide"],
          remotePreference: rawProfile.remotePreference || "any",
          experienceLevel: rawProfile.experienceLevel || "mid",
          minSalary: rawProfile.minSalary || null,
          confidenceThreshold: Number(rawProfile.confidenceThreshold || 0.70),
          onboardingCompleted: Boolean(rawProfile.onboardingCompleted),
          resumes: userResumes,
        };
      })
    );

    const filteredUsers = activeUsers.filter(Boolean);

    return NextResponse.json({
      success: true,
      count: filteredUsers.length,
      users: filteredUsers,
    });
  } catch (err) {
    console.error("GET /api/users/active-profiles error:", err);
    return NextResponse.json(
      {
        error: "Failed to retrieve active user profiles",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
