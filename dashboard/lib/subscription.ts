/*
  Subscription & Community Access Logic.
  All features are 100% Free for all users.
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
  planType: "monthly" | "yearly" | "community";
  lemonSqueezySubscriptionId: string | null;
  customerPortalUrl: string | null;
  planName: string;
};

export function getSubscriptionInfo(
  _profile?: Record<string, any> | null
): UserSubscriptionInfo {
  // 100% Free Full Access for all users
  return {
    status: "active",
    isAccessGranted: true,
    isTrialing: false,
    isActiveSubscriber: true,
    isExpired: false,
    daysRemaining: 365,
    trialEndsAt: null,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    planType: "community",
    lemonSqueezySubscriptionId: null,
    customerPortalUrl: null,
    planName: "Community Free Edition",
  };
}
