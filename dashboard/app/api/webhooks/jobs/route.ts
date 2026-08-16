import { NextRequest, NextResponse } from "next/server";
import { getUserByApiKey, getDb } from "@/lib/db";
import { randomUUID } from "crypto";

function extractApiKey(req: NextRequest): string | null {
  const queryKey = req.nextUrl.searchParams.get("api_key") || req.nextUrl.searchParams.get("key");
  if (queryKey) return queryKey.trim();

  const headerKey = req.headers.get("x-api-key");
  if (headerKey) return headerKey.trim();

  const authHeader = req.headers.get("authorization");
  if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
    return authHeader.slice(7).trim();
  }

  return null;
}

export async function POST(req: NextRequest) {
  const apiKey = extractApiKey(req);
  const secretHeader = req.headers.get("x-webhook-secret");
  const envSecret =
    process.env.WEBHOOK_SECRET ||
    process.env.JOB_TRACKER_WEBHOOK_SECRET ||
    "second-brain-secret";

  let user = null;
  if (apiKey) {
    user = await getUserByApiKey(apiKey);
  }

  const isLegacyAuth = !user && secretHeader && secretHeader === envSecret;

  if (!user && !isLegacyAuth) {
    return NextResponse.json(
      {
        error: "Unauthorized: Invalid or missing API key. Pass ?api_key=sb_live_... or header x-api-key.",
      },
      { status: 401 }
    );
  }

  const userId = user ? user.id : "legacy_default_user";

  try {
    const body = await req.json();
    const {
      title,
      company = "",
      url,
      location = "",
      remote = null,
      source = "n8n",
      score = null,
      reason = "",
      salary = null,
    } = body;

    if (!title || typeof title !== "string" || !title.trim()) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }
    if (!url || typeof url !== "string" || !url.trim()) {
      return NextResponse.json({ error: "url is required" }, { status: 400 });
    }

    const cleanTitle = title.trim();
    const cleanUrl = url.trim();
    const cleanCompany = typeof company === "string" ? company.trim() : "";
    const cleanLocation = typeof location === "string" ? location.trim() : "";
    const cleanSource = typeof source === "string" ? source.trim() : "n8n";
    const numScore = typeof score === "number" ? score : score ? parseFloat(score) : null;
    const cleanReason = typeof reason === "string" ? reason.trim() : "";

    const db = await getDb();
    const now = new Date();

    // 1. Upsert into MongoDB job_matches
    const matchDoc = {
      user_id: userId,
      title: cleanTitle,
      company: cleanCompany,
      url: cleanUrl,
      location: cleanLocation,
      remote: typeof remote === "boolean" ? remote : null,
      source: cleanSource,
      score: numScore,
      reason: cleanReason,
      salary: salary || null,
      status: "new",
      updated_at: now,
    };

    const existingMatch = await db.collection("job_matches").findOne({
      user_id: userId,
      url: cleanUrl,
    });

    let matchId = "";
    if (existingMatch) {
      matchId = String(existingMatch._id);
      await db.collection("job_matches").updateOne(
        { _id: existingMatch._id },
        { $set: matchDoc }
      );
    } else {
      const insertRes = await db.collection("job_matches").insertOne({
        ...matchDoc,
        found_at: now,
        created_at: now,
      });
      matchId = String(insertRes.insertedId);
    }

    // 2. Log high-confidence match into Trust Layer agent_actions (MongoDB)
    const confidence = numScore !== null ? Math.min(Math.max(numScore / 10, 0), 1) : 0.8;
    const actionStatus = confidence >= 0.75 ? "auto_executed" : "pending";

    try {
      const actionId = randomUUID();
      const metadata = {
        job_match_id: matchId,
        job_title: cleanTitle,
        company: cleanCompany,
        job_url: cleanUrl,
        location: cleanLocation,
        score: numScore,
        source: cleanSource,
      };

      await db.collection("agent_actions").insertOne({
        id: actionId,
        user_id: userId,
        module: "job_finding",
        action: "match_job_posting",
        reasoning:
          cleanReason ||
          `Evaluated job posting "${cleanTitle}" at ${cleanCompany || "Company"}`,
        confidence: Number(confidence.toFixed(3)),
        status: actionStatus,
        metadata,
        reviewed_at: null,
        reviewed_by: null,
        executed_at: actionStatus === "auto_executed" ? now.toISOString() : null,
        execution_result: null,
        created_at: now.toISOString(),
      });
    } catch (actErr) {
      console.warn("Could not log action to MongoDB agent_actions:", actErr);
    }

    return NextResponse.json({
      success: true,
      match: {
        id: matchId,
        user_id: userId,
        title: cleanTitle,
        company: cleanCompany,
        url: cleanUrl,
        score: numScore,
        status: "new",
      },
      message: `Job lead processed for ${user?.email || "user"}.`,
    });
  } catch (err) {
    console.error("POST /api/webhooks/jobs error:", err);
    return NextResponse.json(
      { error: "Failed to process job match webhook", details: String(err) },
      { status: 500 }
    );
  }
}
