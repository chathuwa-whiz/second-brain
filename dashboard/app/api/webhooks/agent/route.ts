import { NextRequest, NextResponse } from "next/server";
import { getUserByApiKey } from "@/lib/db";

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
    process.env.ORCHESTRATOR_WEBHOOK_SECRET ||
    process.env.WEBHOOK_SECRET ||
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
    const { request: userRequest } = body;

    if (!userRequest || typeof userRequest !== "string" || !userRequest.trim()) {
      return NextResponse.json(
        { error: "request must not be empty" },
        { status: 400 }
      );
    }

    // Proxy or dispatch to orchestrator webhook if configured
    const orchestratorUrl =
      process.env.ORCHESTRATOR_URL || "http://127.0.0.1:8092/webhook/request";

    try {
      const orchestratorRes = await fetch(orchestratorUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-webhook-secret": envSecret,
          "x-user-id": userId,
        },
        body: JSON.stringify({ request: userRequest }),
      });

      if (orchestratorRes.ok) {
        const result = await orchestratorRes.json();
        return NextResponse.json({ success: true, result, userId });
      }
    } catch {
      // Orchestrator subprocess may be offline in dev
    }

    return NextResponse.json({
      success: true,
      message: `Request received for ${user?.email || "user"}.`,
      request: userRequest,
      userId,
    });
  } catch (err) {
    console.error("POST /api/webhooks/agent error:", err);
    return NextResponse.json(
      { error: "Failed to process agent webhook", details: String(err) },
      { status: 500 }
    );
  }
}
