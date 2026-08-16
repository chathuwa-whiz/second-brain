import Stripe from "stripe";

/*
  Stripe SDK initialization with fallback detection.
  Handles Checkout sessions, Customer Portal, and Webhook verification.
*/

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (_stripe) return _stripe;

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error(
      "STRIPE_SECRET_KEY is not configured in your environment. Add it to .env.local or .env.production."
    );
  }

  _stripe = new Stripe(secretKey, {
    apiVersion: "2026-07-29.dahlia" as any,
    typescript: true,
  });

  return _stripe;
}

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export const STRIPE_CONFIG = {
  priceId: process.env.STRIPE_PRICE_ID || "price_1_dollar_monthly",
  trialDays: 7,
  monthlyPriceUsd: 1.0,
};
