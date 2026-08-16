import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { getDb } from "@/lib/db";
import { withBasePath } from "@/lib/basePath";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as any)?.id;
  if (!userId) {
    return NextResponse.json({ error: "Missing user session data" }, { status: 400 });
  }

  if (!isStripeConfigured()) {
    return NextResponse.json(
      {
        error:
          "Stripe is not configured on this server.",
      },
      { status: 503 }
    );
  }

  try {
    const db = await getDb();
    const profileDoc = await db.collection("system_settings").findOne({
      key: "user_profile",
      user_id: userId,
    });

    const stripeCustomerId = profileDoc?.value?.stripeCustomerId;
    if (!stripeCustomerId) {
      return NextResponse.json(
        {
          error:
            "No active Stripe billing account found. Please upgrade to a Pro subscription first.",
        },
        { status: 400 }
      );
    }

    const stripe = getStripe();
    const origin =
      req.headers.get("origin") ||
      req.headers.get("referer") ||
      process.env.NEXTAUTH_URL ||
      "http://localhost:3000";

    const returnUrl = `${origin.replace(/\/$/, "")}${withBasePath("/settings")}`;

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: returnUrl,
    });

    return NextResponse.json({
      success: true,
      url: portalSession.url,
    });
  } catch (err) {
    console.error("POST /api/billing/portal error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to open Stripe Customer Portal.",
      },
      { status: 500 }
    );
  }
}
