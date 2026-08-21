import { NextRequest, NextResponse } from "next/server";
import { getUserByApiKey, getDb } from "@/lib/db";
import { normalizeJobUrl, normalizeString } from "@/lib/jobDedup";
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
    const cleanUrl = normalizeJobUrl(url);
    const rawUrl = url.trim();
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
      url: cleanUrl || rawUrl,
      location: cleanLocation,
      remote: typeof remote === "boolean" ? remote : null,
      source: cleanSource,
      score: numScore,
      reason: cleanReason,
      salary: salary || null,
      status: "new",
      updated_at: now,
    };

    const matchUrlFilter = cleanUrl ? { $in: [cleanUrl, rawUrl] } : rawUrl;
    const existingMatch = await db.collection("job_matches").findOne({
      user_id: userId,
      url: matchUrlFilter,
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

    // 2. Smart Upsert into Trust Layer agent_actions (MongoDB)
    const confidence = numScore !== null ? Math.min(Math.max(numScore / 10, 0), 1) : 0.8;
    const actionStatus = confidence >= 0.75 ? "auto_executed" : "pending";

    try {
      const metadata: Record<string, any> = {
        job_match_id: matchId,
        job_title: cleanTitle,
        company: cleanCompany,
        job_url: cleanUrl || rawUrl,
        location: cleanLocation,
        score: numScore,
        match_score: numScore !== null ? (numScore <= 10 ? Math.round(numScore * 10) : Math.round(numScore)) : 80,
        source: cleanSource,
      };
      if (body.suggested_resume) metadata.suggested_resume = body.suggested_resume;
      if (body.closing_date) metadata.closing_date = body.closing_date;

      // Check if an existing action already exists for this user and job
      const actionFilters: any[] = [];
      if (cleanUrl) {
        actionFilters.push({ "metadata.job_url": cleanUrl });
        actionFilters.push({ "metadata.job_url": rawUrl });
      }
      if (cleanTitle && cleanCompany) {
        actionFilters.push({
          "metadata.job_title": cleanTitle,
          "metadata.company": cleanCompany,
        });
      }

      const existingAction = actionFilters.length > 0
        ? await db.collection("agent_actions").findOne({
            user_id: userId,
            module: "job_finding",
            $or: actionFilters,
          })
        : null;

      if (existingAction) {
        // If existing action is still pending, update with latest/highest score and details
        if (existingAction.status === "pending") {
          const prevScore = existingAction.metadata?.match_score ?? Math.round(Number(existingAction.confidence) * 100);
          const newScore = metadata.match_score;
          const bestScore = Math.max(prevScore, newScore);
          const bestConfidence = Number((bestScore / 100).toFixed(3));

          await db.collection("agent_actions").updateOne(
            { _id: existingAction._id },
            {
              $set: {
                confidence: bestConfidence,
                reasoning: cleanReason || existingAction.reasoning,
                metadata: {
                  ...existingAction.metadata,
                  ...metadata,
                  match_score: bestScore,
                },
                updated_at: now.toISOString(),
              },
            }
          );
        }
        // If already reviewed/executed (approved/rejected/auto_executed), preserve state and do not create duplicate
      } else {
        const actionId = randomUUID();
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
      }
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
