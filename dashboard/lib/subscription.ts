/*
  Subscription & 7-Day Free Trial Gating Logic.
*/

export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "expired";

export type UserSubscriptionInfo = {
  status: SubscriptionStatus;
  isAccessGranted: boolean;
  isTrialing: boolean;
  isActiveSubscriber: boolean;
  isExpired: boolean;
  daysRemaining: number;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  planName: string;
};

export function getSubscriptionInfo(
  profile: Record<string, any> | null | undefined
): UserSubscriptionInfo {
  if (!profile) {
    // Default fallback: 7 days free trial starting now
    const now = Date.now();
    const trialEnd = new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString();
    return {
      status: "trialing",
      isAccessGranted: true,
      isTrialing: true,
      isActiveSubscriber: false,
      isExpired: false,
      daysRemaining: 7,
      trialEndsAt: trialEnd,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      planName: "7-Day Free Trial",
    };
  }

  const rawStatus = (profile.subscriptionStatus || "trialing") as SubscriptionStatus;
  const trialEndsAt = profile.trialEndsAt ? new Date(profile.trialEndsAt) : null;
  const currentPeriodEnd = profile.currentPeriodEnd
    ? new Date(profile.currentPeriodEnd)
    : null;
  const now = new Date();

  // Calculate days remaining in trial
  let daysRemaining = 0;
  let isTrialExpired = false;

  if (trialEndsAt) {
    const diffMs = trialEndsAt.getTime() - now.getTime();
    daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    isTrialExpired = diffMs <= 0;
  }

  // Active Stripe Subscriber
  if (rawStatus === "active") {
    return {
      status: "active",
      isAccessGranted: true,
      isTrialing: false,
      isActiveSubscriber: true,
      isExpired: false,
      daysRemaining: 0,
      trialEndsAt: profile.trialEndsAt || null,
      currentPeriodEnd: profile.currentPeriodEnd || null,
      cancelAtPeriodEnd: Boolean(profile.cancelAtPeriodEnd),
      stripeCustomerId: profile.stripeCustomerId || null,
      stripeSubscriptionId: profile.stripeSubscriptionId || null,
      planName: "Pro Plan ($1.00/mo)",
    };
  }

  // Past Due (Payment failed)
  if (rawStatus === "past_due") {
    return {
      status: "past_due",
      isAccessGranted: false,
      isTrialing: false,
      isActiveSubscriber: false,
      isExpired: true,
      daysRemaining: 0,
      trialEndsAt: profile.trialEndsAt || null,
      currentPeriodEnd: profile.currentPeriodEnd || null,
      cancelAtPeriodEnd: Boolean(profile.cancelAtPeriodEnd),
      stripeCustomerId: profile.stripeCustomerId || null,
      stripeSubscriptionId: profile.stripeSubscriptionId || null,
      planName: "Payment Past Due",
    };
  }

  // Trialing or Canceled
  if (!isTrialExpired && rawStatus !== "canceled") {
    return {
      status: "trialing",
      isAccessGranted: true,
      isTrialing: true,
      isActiveSubscriber: false,
      isExpired: false,
      daysRemaining,
      trialEndsAt: profile.trialEndsAt || null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      stripeCustomerId: profile.stripeCustomerId || null,
      stripeSubscriptionId: profile.stripeSubscriptionId || null,
      planName: `7-Day Free Trial (${daysRemaining}d left)`,
    };
  }

  // Expired
  return {
    status: "expired",
    isAccessGranted: false,
    isTrialing: false,
    isActiveSubscriber: false,
    isExpired: true,
    daysRemaining: 0,
    trialEndsAt: profile.trialEndsAt || null,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    stripeCustomerId: profile.stripeCustomerId || null,
    stripeSubscriptionId: profile.stripeSubscriptionId || null,
    planName: "Trial Expired",
  };
}
