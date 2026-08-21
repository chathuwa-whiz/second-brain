import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserByApiKey, getDb } from "@/lib/db";
import { normalizeJobUrl, normalizeString } from "@/lib/jobDedup";

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
  const session = await getServerSession(authOptions);

  if (!user && !isLegacyAuth && !session) {
    return NextResponse.json(
      {
        error: "Unauthorized: Missing valid API key, webhook secret, or session.",
      },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();
    const resolvedUserId =
      body.userId ||
      body.user_id ||
      (user ? user.id : (session?.user as any)?.id) ||
      "legacy_default_user";

    // Handle array or wrapped { jobs: [...] } or single item
    let rawJobs: any[] = [];
    if (Array.isArray(body)) {
      rawJobs = body;
    } else if (Array.isArray(body.jobs)) {
      rawJobs = body.jobs;
    } else if (body && typeof body === "object") {
      rawJobs = [body];
    }

    if (rawJobs.length === 0) {
      return NextResponse.json({
        success: true,
        newJobs: [],
        newCount: 0,
        seenCount: 0,
      });
    }

    const db = await getDb();

    // 1. Collect all URLs and (company + title) keys from the incoming batch
    const normalizedBatch = rawJobs.map((item, idx) => {
      const url = item.url || item.job_url || item.link || "";
      const cleanUrl = normalizeJobUrl(url);
      const title = item.title || item.job_title || item.role || "";
      const company = item.company || item.employer || "";
      const normTitle = normalizeString(title);
      const normCompany = normalizeString(company);

      return {
        original: item,
        index: idx,
        cleanUrl,
        normTitle,
        normCompany,
      };
    });

    const validUrls = normalizedBatch.map((b) => b.cleanUrl).filter(Boolean);

    // 2. Query existing records in agent_actions and job_matches for this user
    const [existingActions, existingMatches] = await Promise.all([
      db
        .collection("agent_actions")
        .find({
          user_id: resolvedUserId,
          module: "job_finding",
        })
        .project({ "metadata.job_url": 1, "metadata.job_title": 1, "metadata.company": 1, action: 1 })
        .toArray(),
      validUrls.length > 0
        ? db
            .collection("job_matches")
            .find({
              user_id: resolvedUserId,
              url: { $in: validUrls },
            })
            .project({ url: 1, title: 1, company: 1 })
            .toArray()
        : Promise.resolve([]),
    ]);

    // 3. Build lookup sets for existing items
    const seenUrls = new Set<string>();
    const seenCombos = new Set<string>();

    for (const act of existingActions) {
      const meta = act.metadata || {};
      const actUrl = normalizeJobUrl(meta.job_url);
      if (actUrl) seenUrls.add(actUrl);

      const title = meta.job_title || act.action || "";
      const company = meta.company || "";
      if (title && company) {
        seenCombos.add(`${normalizeString(company)}___${normalizeString(title)}`);
      }
    }

    for (const match of existingMatches) {
      const matchUrl = normalizeJobUrl(match.url);
      if (matchUrl) seenUrls.add(matchUrl);
    }

    // 4. Filter batch to only genuinely new jobs (and deduplicate within the batch itself)
    const batchSeenUrls = new Set<string>();
    const batchSeenCombos = new Set<string>();
    const newJobs: any[] = [];

    for (const item of normalizedBatch) {
      let isDuplicate = false;

      // Check by URL
      if (item.cleanUrl) {
        if (seenUrls.has(item.cleanUrl) || batchSeenUrls.has(item.cleanUrl)) {
          isDuplicate = true;
        }
      }

      // Check by Title + Company fallback
      if (!isDuplicate && item.normTitle && item.normCompany) {
        const comboKey = `${item.normCompany}___${item.normTitle}`;
        if (seenCombos.has(comboKey) || batchSeenCombos.has(comboKey)) {
          isDuplicate = true;
        }
      }

      if (!isDuplicate) {
        if (item.cleanUrl) batchSeenUrls.add(item.cleanUrl);
        if (item.normTitle && item.normCompany) {
          batchSeenCombos.add(`${item.normCompany}___${item.normTitle}`);
        }
        newJobs.push(item.original);
      }
    }

    return NextResponse.json({
      success: true,
      newJobs,
      newCount: newJobs.length,
      seenCount: rawJobs.length - newJobs.length,
      totalReceived: rawJobs.length,
      userId: resolvedUserId,
    });
  } catch (err) {
    console.error("POST /api/jobs/filter-new error:", err);
    return NextResponse.json(
      { error: "Failed to filter job matches", details: String(err) },
      { status: 500 }
    );
  }
}
