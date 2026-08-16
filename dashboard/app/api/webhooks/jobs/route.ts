import { NextRequest, NextResponse } from "next/server";
import { getUserByApiKey, getDb as getSqlDb, isPgConfigured } from "@/lib/db";
import { getDb as getMongoDb } from "@/lib/mongo";
import oracledb from "oracledb";

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

  // Allow legacy secret if user not found via API key
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

    // 1. Upsert into MongoDB
    const mongoDb = await getMongoDb();
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
      updated_at: new Date(),
    };

    const existingMatch = await mongoDb.collection("job_matches").findOne({
      user_id: userId,
      url: cleanUrl,
    });

    let matchId = "";
    if (existingMatch) {
      matchId = String(existingMatch._id);
      await mongoDb.collection("job_matches").updateOne(
        { _id: existingMatch._id },
        { $set: matchDoc }
      );
    } else {
      const insertRes = await mongoDb.collection("job_matches").insertOne({
        ...matchDoc,
        found_at: new Date(),
        created_at: new Date(),
      });
      matchId = String(insertRes.insertedId);
    }

    // 2. Log high-confidence match into Trust Layer action log
    const confidence = numScore !== null ? Math.min(Math.max(numScore / 10, 0), 1) : 0.8;
    const actionStatus = confidence >= 0.75 ? "auto_executed" : "pending";

    let sqlConn: any;
    try {
      sqlConn = await getSqlDb();
      const metadata = {
        job_match_id: matchId,
        job_title: cleanTitle,
        company: cleanCompany,
        job_url: cleanUrl,
        location: cleanLocation,
        score: numScore,
        source: cleanSource,
      };

      if (isPgConfigured()) {
        await sqlConn.query(
          `INSERT INTO agent_actions (user_id, module, action, reasoning, confidence, status, metadata)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            userId,
            "job_finding",
            "match_job_posting",
            cleanReason || `Evaluated job posting "${cleanTitle}" at ${cleanCompany || "Company"}`,
            confidence,
            actionStatus,
            JSON.stringify(metadata),
          ]
        );
      } else {
        await sqlConn.execute(
          `INSERT INTO agent_actions (user_id, module, action, reasoning, confidence, status, metadata)
           VALUES (:userId, :module, :action, :reasoning, :confidence, :status, :metadata)`,
          {
            userId,
            module: "job_finding",
            action: "match_job_posting",
            reasoning: cleanReason || `Evaluated job posting "${cleanTitle}" at ${cleanCompany || "Company"}`,
            confidence: Number(confidence.toFixed(3)),
            status: actionStatus,
            metadata: JSON.stringify(metadata),
          }
        );
      }
    } catch (sqlErr) {
      console.warn("Could not log action in SQL database:", sqlErr);
    } finally {
      if (sqlConn) {
        if (typeof sqlConn.release === "function") sqlConn.release();
        else if (typeof sqlConn.close === "function") await sqlConn.close();
      }
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
