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
  planType: "monthly" | "yearly" | null;
  lemonSqueezySubscriptionId: string | null;
  customerPortalUrl: string | null;
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
      planType: null,
      lemonSqueezySubscriptionId: null,
      customerPortalUrl: null,
      planName: "7-Day Free Trial",
    };
  }

  const rawStatus = (profile.subscriptionStatus || "trialing") as SubscriptionStatus;
  const trialEndsAt = profile.trialEndsAt ? new Date(profile.trialEndsAt) : null;
  const planType = (profile.planType || "monthly") as "monthly" | "yearly";
  const now = new Date();

  // Calculate days remaining in trial
  let daysRemaining = 0;
  let isTrialExpired = false;

  if (trialEndsAt) {
    const diffMs = trialEndsAt.getTime() - now.getTime();
    daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    isTrialExpired = diffMs <= 0;
  }

  // Active Subscriber
  if (rawStatus === "active") {
    const isYearly = planType === "yearly";
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
      planType,
      lemonSqueezySubscriptionId: profile.lemonSqueezySubscriptionId || null,
      customerPortalUrl: profile.customerPortalUrl || null,
      planName: isYearly ? "Pro Annual ($19.00/yr)" : "Pro Monthly ($2.99/mo)",
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
      planType,
      lemonSqueezySubscriptionId: profile.lemonSqueezySubscriptionId || null,
      customerPortalUrl: profile.customerPortalUrl || null,
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
      planType: null,
      lemonSqueezySubscriptionId: profile.lemonSqueezySubscriptionId || null,
      customerPortalUrl: null,
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
    planType: null,
    lemonSqueezySubscriptionId: profile.lemonSqueezySubscriptionId || null,
    customerPortalUrl: null,
    planName: "Trial Expired",
  };
}
