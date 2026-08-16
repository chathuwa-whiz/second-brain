"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button, Card, Badge, ErrorNote } from "@/components/ui";
import { IconCheck } from "@/components/icons";
import { withBasePath } from "@/lib/basePath";
import { getSubscriptionInfo, type UserSubscriptionInfo } from "@/lib/subscription";

export default function BillingCard() {
  const searchParams = useSearchParams();
  const billingStatusParam = searchParams.get("billing");

  const [subInfo, setSubInfo] = useState<UserSubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (billingStatusParam === "success") {
      setNotice("Payment successful! Your Pro subscription is now active.");
    } else if (billingStatusParam === "canceled") {
      setNotice("Checkout was canceled. Your current trial or plan remains unchanged.");
    }
  }, [billingStatusParam]);

  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await fetch(withBasePath("/api/user/profile"));
        if (res.ok) {
          const data = await res.json();
          setSubInfo(getSubscriptionInfo(data.profile));
        } else {
          setSubInfo(getSubscriptionInfo(null));
        }
      } catch (err) {
        setSubInfo(getSubscriptionInfo(null));
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, []);

  async function handleUpgrade() {
    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch(withBasePath("/api/billing/checkout"), {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        throw new Error(data.error || "Failed to start Stripe checkout.");
      }
      window.location.href = data.url;
    } catch (err) {
      setActionLoading(false);
      setError(err instanceof Error ? err.message : "Checkout initialization failed.");
    }
  }

  async function handleManageBilling() {
    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch(withBasePath("/api/billing/portal"), {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        throw new Error(data.error || "Failed to open Stripe Billing portal.");
      }
      window.location.href = data.url;
    } catch (err) {
      setActionLoading(false);
      setError(err instanceof Error ? err.message : "Portal initialization failed.");
    }
  }

  if (loading) {
    return (
      <Card className="p-5 sm:p-6 animate-pulse">
        <div className="h-5 w-40 rounded bg-primary/[0.06] mb-3" />
        <div className="h-4 w-64 rounded bg-primary/[0.04]" />
      </Card>
    );
  }

  const info = subInfo || getSubscriptionInfo(null);
  const trialProgress = Math.max(0, Math.min(100, ((7 - info.daysRemaining) / 7) * 100));

  return (
    <Card className="p-4 sm:p-6 space-y-5">
      {notice && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3.5 text-xs text-emerald-400 flex items-center gap-2">
          <IconCheck className="h-4 w-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {error && <ErrorNote>{error}</ErrorNote>}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h3 className="text-base font-semibold text-primary">
              {info.isActiveSubscriber ? "Second Brain Pro" : "Free Trial Plan"}
            </h3>
            <Badge tone={info.isActiveSubscriber ? "ok" : info.isExpired ? "danger" : "accent"}>
              {info.isActiveSubscriber ? "Active Pro ($1/mo)" : info.isExpired ? "Trial Expired" : `${info.daysRemaining} days remaining`}
            </Badge>
          </div>
          <p className="text-xs text-secondary">
            {info.isActiveSubscriber
              ? "Unlimited job search matching, automatic email dispatches, and multi-tenant n8n scrapers."
              : "7 days of full autonomous features. Renews at just $1.00/month after your trial."}
          </p>
        </div>

        <div>
          {info.isActiveSubscriber ? (
            <Button
              variant="quiet"
              onClick={handleManageBilling}
              disabled={actionLoading}
              className="w-full sm:w-auto text-xs font-semibold"
            >
              {actionLoading ? "Opening Portal…" : "Manage Subscription"}
            </Button>
          ) : (
            <Button
              variant="primary"
              onClick={handleUpgrade}
              disabled={actionLoading}
              className="w-full sm:w-auto text-xs font-semibold shadow-md shadow-accent/20"
            >
              {actionLoading ? "Connecting to Stripe…" : "Upgrade to Pro — $1.00 / mo"}
            </Button>
          )}
        </div>
      </div>

      {/* Trial Countdown Gauge */}
      {info.isTrialing && (
        <div className="rounded-xl bg-primary/[0.03] p-4 border border-hairline/10 space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-secondary">7-Day Free Trial Progress</span>
            <span className="font-semibold text-primary">
              {7 - info.daysRemaining} of 7 days used
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-primary/[0.08] overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-accent to-violet transition-all duration-500"
              style={{ width: `${trialProgress}%` }}
            />
          </div>
          <p className="text-2xs text-muted">
            Your free trial includes full access to resume upload, AI job scoring, and n8n webhook keys.
          </p>
        </div>
      )}

      {/* Plan Feature Summary Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs border-t border-hairline/10">
        <div className="p-3 rounded-lg bg-primary/[0.02]">
          <p className="font-medium text-primary">AI Job Matcher</p>
          <p className="text-2xs text-muted mt-0.5">Scored leads ingested from n8n & scrapers</p>
        </div>
        <div className="p-3 rounded-lg bg-primary/[0.02]">
          <p className="font-medium text-primary">Cloudflare R2 Storage</p>
          <p className="text-2xs text-muted mt-0.5">Up to 5 targeted resumes per account</p>
        </div>
        <div className="p-3 rounded-lg bg-primary/[0.02]">
          <p className="font-medium text-primary">Autonomous Dispatch</p>
          <p className="text-2xs text-muted mt-0.5">Approval queues and Google SMTP delivery</p>
        </div>
      </div>
    </Card>
  );
}
