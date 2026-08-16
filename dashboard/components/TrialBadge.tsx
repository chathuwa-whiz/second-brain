"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { withBasePath } from "@/lib/basePath";
import { getSubscriptionInfo, type UserSubscriptionInfo } from "@/lib/subscription";

export default function TrialBadge() {
  const [subInfo, setSubInfo] = useState<UserSubscriptionInfo | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(withBasePath("/api/user/profile"));
        if (res.ok) {
          const data = await res.json();
          setSubInfo(getSubscriptionInfo(data.profile));
        }
      } catch {
        // silent fallback
      }
    }
    load();
  }, []);

  if (!subInfo) return null;

  if (subInfo.isActiveSubscriber) {
    return (
      <Link
        href="/settings"
        className="press inline-flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-2 py-0.5 text-3xs font-semibold text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
        title="Pro Member Subscription Active"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
        <span>Pro Member</span>
      </Link>
    );
  }

  if (subInfo.isExpired) {
    return (
      <Link
        href="/settings"
        className="press inline-flex items-center gap-1.5 rounded-md bg-danger/10 px-2 py-0.5 text-3xs font-semibold text-danger border border-danger/20 hover:bg-danger/20 transition-colors"
        title="Trial Expired — Click to Upgrade"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-danger animate-pulse" />
        <span>Trial Expired</span>
      </Link>
    );
  }

  return (
    <Link
      href="/settings"
      className="press inline-flex items-center gap-1.5 rounded-md bg-accent/10 px-2 py-0.5 text-3xs font-semibold text-accent border border-accent/20 hover:bg-accent/20 transition-colors"
      title={`${subInfo.daysRemaining} days left in your free trial`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-accent" />
      <span>Trial: {subInfo.daysRemaining}d left</span>
    </Link>
  );
}
