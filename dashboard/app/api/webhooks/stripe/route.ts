import { NextRequest, NextResponse } from "next/server";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { getDb } from "@/lib/db";
import Stripe from "stripe";

export async function POST(req: NextRequest) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const sig = req.headers.get("stripe-signature");

  let event: Stripe.Event;

  try {
    const rawBody = await req.text();
    const stripe = getStripe();

    if (webhookSecret && sig) {
      event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
    } else {
      // In development or when webhook secret is omitted, parse payload directly
      event = JSON.parse(rawBody) as Stripe.Event;
    }
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", err);
    return NextResponse.json(
      { error: `Webhook Error: ${err instanceof Error ? err.message : "Invalid signature"}` },
      { status: 400 }
    );
  }

  const db = await getDb();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId =
          session.client_reference_id ||
          session.metadata?.userId;

        const customerId =
          typeof session.customer === "string"
            ? session.customer
            : session.customer?.id;

        const subscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id;

        if (userId) {
          await db.collection("system_settings").updateOne(
            { key: "user_profile", user_id: userId },
            {
              $set: {
                "value.subscriptionStatus": "active",
                "value.stripeCustomerId": customerId || null,
                "value.stripeSubscriptionId": subscriptionId || null,
                "value.updatedAt": new Date().toISOString(),
              },
            },
            { upsert: true }
          );
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId =
          typeof subscription.customer === "string"
            ? subscription.customer
            : subscription.customer?.id;

        const userId = subscription.metadata?.userId;

        const statusMap: Record<string, string> = {
          active: "active",
          trialing: "trialing",
          past_due: "past_due",
          canceled: "canceled",
          unpaid: "past_due",
          incomplete: "past_due",
          incomplete_expired: "expired",
        };

        const subObj = subscription as any;
        const mappedStatus = statusMap[subObj.status] || "active";
        const currentPeriodEnd = subObj.current_period_end
          ? new Date(subObj.current_period_end * 1000).toISOString()
          : null;

        const filter: Record<string, any> = userId
          ? { key: "user_profile", user_id: userId }
          : { key: "user_profile", "value.stripeCustomerId": customerId };

        await db.collection("system_settings").updateOne(
          filter,
          {
            $set: {
              "value.subscriptionStatus": mappedStatus,
              "value.stripeSubscriptionId": subObj.id,
              "value.currentPeriodEnd": currentPeriodEnd,
              "value.cancelAtPeriodEnd": Boolean(subObj.cancel_at_period_end),
              "value.updatedAt": new Date().toISOString(),
            },
          }
        );
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId =
          typeof subscription.customer === "string"
            ? subscription.customer
            : subscription.customer?.id;

        const userId = subscription.metadata?.userId;

        const filter: Record<string, any> = userId
          ? { key: "user_profile", user_id: userId }
          : { key: "user_profile", "value.stripeCustomerId": customerId };

        await db.collection("system_settings").updateOne(
          filter,
          {
            $set: {
              "value.subscriptionStatus": "canceled",
              "value.updatedAt": new Date().toISOString(),
            },
          }
        );
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId =
          typeof invoice.customer === "string"
            ? invoice.customer
            : invoice.customer?.id;

        if (customerId) {
          await db.collection("system_settings").updateOne(
            { key: "user_profile", "value.stripeCustomerId": customerId },
            {
              $set: {
                "value.subscriptionStatus": "active",
                "value.updatedAt": new Date().toISOString(),
              },
            }
          );
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId =
          typeof invoice.customer === "string"
            ? invoice.customer
            : invoice.customer?.id;

        if (customerId) {
          await db.collection("system_settings").updateOne(
            { key: "user_profile", "value.stripeCustomerId": customerId },
            {
              $set: {
                "value.subscriptionStatus": "past_due",
                "value.updatedAt": new Date().toISOString(),
              },
            }
          );
        }
        break;
      }

      default:
        // Ignore unhandled event types
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("Stripe webhook processing error:", err);
    return NextResponse.json(
      { error: "Webhook event processing failed" },
      { status: 500 }
    );
  }
}
