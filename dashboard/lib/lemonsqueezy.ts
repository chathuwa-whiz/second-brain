import crypto from "crypto";

/*
  Lemon Squeezy API & Merchant of Record Helper for Second Brain.
  Supports Google Pay, Apple Pay, PayPal, and Card checkouts with
  automated webhook verification and customer portal integration.
*/

export const LEMON_CONFIG = {
  storeId: process.env.LEMONSQUEEZY_STORE_ID || "",
  monthlyVariantId: process.env.LEMONSQUEEZY_MONTHLY_VARIANT_ID || "",
  yearlyVariantId: process.env.LEMONSQUEEZY_YEARLY_VARIANT_ID || "",
  monthlyPriceUsd: 2.99,
  yearlyPriceUsd: 19.0,
  trialDays: 7,
};

export function isLemonConfigured(): boolean {
  return Boolean(
    process.env.LEMONSQUEEZY_API_KEY && process.env.LEMONSQUEEZY_STORE_ID
  );
}

export type CheckoutOptions = {
  variantId?: string;
  planType: "monthly" | "yearly";
  userEmail: string;
  userName?: string;
  userId: string;
  redirectUrl: string;
};

export async function createLemonCheckout(
  options: CheckoutOptions
): Promise<string> {
  const apiKey = process.env.LEMONSQUEEZY_API_KEY;
  const storeId = process.env.LEMONSQUEEZY_STORE_ID;

  if (!apiKey || !storeId) {
    throw new Error(
      "LEMONSQUEEZY_API_KEY or LEMONSQUEEZY_STORE_ID is not configured in your environment."
    );
  }

  // Determine variant ID (from options or env vars)
  const variantId =
    options.variantId ||
    (options.planType === "yearly"
      ? process.env.LEMONSQUEEZY_YEARLY_VARIANT_ID
      : process.env.LEMONSQUEEZY_MONTHLY_VARIANT_ID);

  if (!variantId) {
    throw new Error(
      `Variant ID for ${options.planType} plan is not configured. Please set LEMONSQUEEZY_${options.planType.toUpperCase()}_VARIANT_ID in .env.`
    );
  }

  const payload = {
    data: {
      type: "checkouts",
      attributes: {
        checkout_data: {
          email: options.userEmail,
          name: options.userName || undefined,
          custom: {
            user_id: options.userId,
            plan_type: options.planType,
          },
        },
        product_options: {
          redirect_url: options.redirectUrl,
        },
      },
      relationships: {
        store: {
          data: {
            type: "stores",
            id: String(storeId),
          },
        },
        variant: {
          data: {
            type: "variants",
            id: String(variantId),
          },
        },
      },
    },
  };

  const response = await fetch("https://api.lemonsqueezy.com/v1/checkouts", {
    method: "POST",
    headers: {
      Accept: "application/vnd.api+json",
      "Content-Type": "application/vnd.api+json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  const resJson = await response.json();

  if (!response.ok || !resJson.data?.attributes?.url) {
    const errorDetails =
      resJson.errors?.[0]?.detail || resJson.message || "Failed to create Lemon Squeezy checkout";
    throw new Error(errorDetails);
  }

  return resJson.data.attributes.url;
}

export function verifyLemonWebhook(
  rawBody: string,
  signatureHeader: string | null,
  secret: string
): boolean {
  if (!signatureHeader || !secret) return false;

  const hmac = crypto.createHmac("sha256", secret);
  const digest = Buffer.from(hmac.update(rawBody).digest("hex"), "utf8");
  const signature = Buffer.from(signatureHeader, "utf8");

  if (digest.length !== signature.length) return false;
  return crypto.timingSafeEqual(digest, signature);
}
