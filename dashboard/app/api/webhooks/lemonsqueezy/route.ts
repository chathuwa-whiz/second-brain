import { NextRequest, NextResponse } from "next/server";
import { verifyLemonWebhook } from "@/lib/lemonsqueezy";
import { getDb } from "@/lib/db";

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;

  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-signature");

    if (webhookSecret && !verifyLemonWebhook(rawBody, signature, webhookSecret)) {
      console.warn("Lemon Squeezy invalid webhook signature rejected.");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const payload = JSON.parse(rawBody);
    const eventName = payload.meta?.event_name;
    const customData = payload.meta?.custom_data || {};
    const attributes = payload.data?.attributes || {};
    const subscriptionId = String(payload.data?.id || "");

    const userId = customData.user_id || customData.userId;
    const customerId = String(attributes.customer_id || "");
    const customerPortalUrl = attributes.urls?.customer_portal || null;
    const variantId = String(attributes.variant_id || "");
    const isYearly = variantId === process.env.LEMONSQUEEZY_YEARLY_VARIANT_ID;
    const planType = isYearly ? "yearly" : "monthly";

    const db = await getDb();

    switch (eventName) {
      case "subscription_created":
      case "subscription_resumed":
      case "subscription_unpaused": {
        const rawStatus = attributes.status || "active";
        const status = rawStatus === "active" || rawStatus === "on_trial" ? "active" : rawStatus;
        const currentPeriodEnd = attributes.renews_at || attributes.ends_at || null;

        const filter: Record<string, any> = userId
          ? { key: "user_profile", user_id: userId }
          : { key: "user_profile", "value.lemonSqueezyCustomerId": customerId };

        await db.collection("system_settings").updateOne(
          filter,
          {
            $set: {
              "value.subscriptionStatus": status,
              "value.planType": planType,
              "value.lemonSqueezyCustomerId": customerId,
              "value.lemonSqueezySubscriptionId": subscriptionId,
              "value.customerPortalUrl": customerPortalUrl,
              "value.currentPeriodEnd": currentPeriodEnd,
              "value.cancelAtPeriodEnd": Boolean(attributes.cancelled),
              "value.updatedAt": new Date().toISOString(),
            },
          },
          { upsert: true }
        );
        break;
      }

      case "subscription_updated": {
        const rawStatus = attributes.status || "active";
        const status = rawStatus === "active" || rawStatus === "on_trial" ? "active" : rawStatus;
        const currentPeriodEnd = attributes.renews_at || attributes.ends_at || null;

        const filter: Record<string, any> = userId
          ? { key: "user_profile", user_id: userId }
          : {
              $or: [
                { key: "user_profile", "value.lemonSqueezySubscriptionId": subscriptionId },
                { key: "user_profile", "value.lemonSqueezyCustomerId": customerId },
              ],
            };

        await db.collection("system_settings").updateOne(
          filter,
          {
            $set: {
              "value.subscriptionStatus": status,
              "value.customerPortalUrl": customerPortalUrl,
              "value.currentPeriodEnd": currentPeriodEnd,
              "value.cancelAtPeriodEnd": Boolean(attributes.cancelled),
              "value.updatedAt": new Date().toISOString(),
            },
          }
        );
        break;
      }

      case "subscription_cancelled":
      case "subscription_expired": {
        const filter: Record<string, any> = userId
          ? { key: "user_profile", user_id: userId }
          : {
              $or: [
                { key: "user_profile", "value.lemonSqueezySubscriptionId": subscriptionId },
                { key: "user_profile", "value.lemonSqueezyCustomerId": customerId },
              ],
            };

        await db.collection("system_settings").updateOne(
          filter,
          {
            $set: {
              "value.subscriptionStatus": eventName === "subscription_expired" ? "expired" : "canceled",
              "value.updatedAt": new Date().toISOString(),
            },
          }
        );
        break;
      }

      case "subscription_payment_success": {
        const filter: Record<string, any> = {
          $or: [
            { key: "user_profile", "value.lemonSqueezySubscriptionId": subscriptionId },
            { key: "user_profile", "value.lemonSqueezyCustomerId": customerId },
          ],
        };

        await db.collection("system_settings").updateOne(
          filter,
          {
            $set: {
              "value.subscriptionStatus": "active",
              "value.updatedAt": new Date().toISOString(),
            },
          }
        );
        break;
      }

      case "subscription_payment_failed": {
        const filter: Record<string, any> = {
          $or: [
            { key: "user_profile", "value.lemonSqueezySubscriptionId": subscriptionId },
            { key: "user_profile", "value.lemonSqueezyCustomerId": customerId },
          ],
        };

        await db.collection("system_settings").updateOne(
          filter,
          {
            $set: {
              "value.subscriptionStatus": "past_due",
              "value.updatedAt": new Date().toISOString(),
            },
          }
        );
        break;
      }

      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("Lemon Squeezy webhook error:", err);
    return NextResponse.json(
      { error: "Webhook event processing failed" },
      { status: 500 }
    );
  }
}
