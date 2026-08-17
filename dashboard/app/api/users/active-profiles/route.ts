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
    (secretHeader && (secretHeader === envSecret || secretHeader === "second-brain-secret")) ||
    (session && (session.user as any)?.role === "admin");

  if (!isAuthorized) {
    return NextResponse.json(
      { error: "Unauthorized. Webhook secret or admin session required." },
      { status: 401 }
    );
  }

  try {
    const db = await getDb();
    const [users, profileDocs] = await Promise.all([
      db.collection("users").find({}).toArray(),
      db.collection("system_settings").find({ key: "user_profile" }).toArray(),
    ]);

    const userMap = new Map<string, any>();
    for (const u of users) {
      const uid = String(u.id || u._id);
      userMap.set(uid, u);
      if (u.email) {
        userMap.set(String(u.email).toLowerCase(), u);
      }
    }

    const profileMap = new Map<string, any>();
    for (const doc of profileDocs) {
      if (doc.user_id) {
        profileMap.set(String(doc.user_id), doc.value);
      }
    }

    const candidateUserIds = Array.from(
      new Set([
        ...users.map((u) => String(u.id || u._id)),
        ...profileDocs.map((doc) => String(doc.user_id)).filter(Boolean),
      ])
    );

    const activeUsers = await Promise.all(
      candidateUserIds.map(async (userId) => {
        const userDoc = userMap.get(userId);
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

        // Only search jobs for users who have uploaded at least one resume
        if (userResumes.length === 0) {
          return null;
        }

        const candidateName =
          userDoc?.name ||
          rawProfile.name ||
          (userDoc?.email ? userDoc.email.split("@")[0] : "Candidate");
        const candidateEmail =
          userDoc?.email ||
          rawProfile.email ||
          "candidate@secondbrain.app";

        return {
          id: userId,
          name: candidateName,
          email: candidateEmail,
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
