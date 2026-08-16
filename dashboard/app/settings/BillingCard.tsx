"use client";

import { Card, Badge } from "@/components/ui";
import { IconCheck } from "@/components/icons";

export default function BillingCard() {
  return (
    <Card className="p-4 sm:p-6 space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h3 className="text-base font-semibold text-primary">
              Community Free Edition
            </h3>
            <Badge tone="ok">
              100% Free & Unlimited
            </Badge>
          </div>
          <p className="text-xs text-secondary">
            Your workspace has full access to all autonomous career features, AI scoring, resume storage, and n8n webhooks at no cost.
          </p>
        </div>

        <div className="shrink-0">
          <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
            <IconCheck className="h-4 w-4" />
            <span>Active & Unrestricted</span>
          </span>
        </div>
      </div>

      {/* Feature Guarantee Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs border-t border-hairline/10">
        <div className="p-3 rounded-xl bg-primary/[0.03] border border-hairline/10">
          <p className="font-semibold text-primary">AI Job Matcher</p>
          <p className="text-2xs text-muted mt-1">Unlimited scored leads ingested from n8n & scrapers</p>
        </div>
        <div className="p-3 rounded-xl bg-primary/[0.03] border border-hairline/10">
          <p className="font-semibold text-primary">Cloudflare R2 Storage</p>
          <p className="text-2xs text-muted mt-1">Up to 5 targeted resumes per account with zero egress fees</p>
        </div>
        <div className="p-3 rounded-xl bg-primary/[0.03] border border-hairline/10">
          <p className="font-semibold text-primary">Autonomous Dispatch</p>
          <p className="text-2xs text-muted mt-1">Approval queues and personal Google SMTP email delivery</p>
        </div>
      </div>
    </Card>
  );
}
