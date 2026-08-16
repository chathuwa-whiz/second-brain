import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getStripe, isStripeConfigured, STRIPE_CONFIG } from "@/lib/stripe";
import { getDb } from "@/lib/db";
import { withBasePath } from "@/lib/basePath";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as any)?.id;
  const userEmail = session.user.email;

  if (!userEmail || !userId) {
    return NextResponse.json({ error: "Missing user session data" }, { status: 400 });
  }

  if (!isStripeConfigured()) {
    return NextResponse.json(
      {
        error:
          "Stripe is not yet configured on this server. Please add STRIPE_SECRET_KEY to your environment.",
      },
      { status: 503 }
    );
  }

  try {
    const stripe = getStripe();
    const db = await getDb();

    // Check if user already has a stripeCustomerId in their profile
    const profileDoc = await db.collection("system_settings").findOne({
      key: "user_profile",
      user_id: userId,
    });

    const stripeCustomerId = profileDoc?.value?.stripeCustomerId;

    const origin =
      req.headers.get("origin") ||
      req.headers.get("referer") ||
      process.env.NEXTAUTH_URL ||
      "http://localhost:3000";

    const cleanOrigin = origin.replace(/\/$/, "");
    const successUrl = `${cleanOrigin}${withBasePath("/settings?billing=success")}`;
    const cancelUrl = `${cleanOrigin}${withBasePath("/settings?billing=canceled")}`;

    // Create Checkout Session
    const checkoutParams: any = {
      payment_method_types: ["card"],
      mode: "subscription",
      client_reference_id: userId,
      metadata: {
        userId,
      },
      subscription_data: {
        metadata: {
          userId,
        },
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
    };

    if (stripeCustomerId) {
      checkoutParams.customer = stripeCustomerId;
    } else {
      checkoutParams.customer_email = userEmail;
    }

    // Use Price ID or custom recurring price_data if no Price ID is supplied
    if (process.env.STRIPE_PRICE_ID) {
      checkoutParams.line_items = [
        {
          price: process.env.STRIPE_PRICE_ID,
          quantity: 1,
        },
      ];
    } else {
      // Inline $1.00 USD monthly recurring price definition
      checkoutParams.line_items = [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "Second Brain Pro Subscription",
              description: "Autonomous Career & AI Copilot with unlimited job lead matching.",
            },
            unit_amount: 100, // $1.00 in cents
            recurring: {
              interval: "month",
            },
          },
          quantity: 1,
        },
      ];
    }

    const checkoutSession = await stripe.checkout.sessions.create(checkoutParams);

    return NextResponse.json({
      success: true,
      url: checkoutSession.url,
    });
  } catch (err) {
    console.error("POST /api/billing/checkout error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to initiate Stripe Checkout session.",
      },
      { status: 500 }
    );
  }
}
