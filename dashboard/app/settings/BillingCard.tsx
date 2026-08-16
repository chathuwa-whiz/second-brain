"use client";

import { Card, Badge } from "@/components/ui";
import { IconCheck } from "@/components/icons";

export default function BillingCard() {
  return (
    <Card className="p-4 sm:p-6 space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-primary sm:text-base">
              Free edition
            </h3>
            <Badge tone="ok">Unlimited</Badge>
          </div>
          <p className="text-xs leading-relaxed text-secondary">
            Every feature is included at no cost — job scanning, match scoring,
            resume storage and autonomous sending.
          </p>
        </div>

        <span className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg bg-ok/10 px-2.5 py-1.5 text-xs font-medium text-ok-ink ring-1 ring-inset ring-ok/20">
          <IconCheck className="h-4 w-4" />
          Active
        </span>
      </div>

      {/* What's included */}
      <dl className="grid grid-cols-1 gap-x-5 gap-y-3 border-t border-hairline/10 pt-4 text-xs sm:grid-cols-3">
        <div>
          <dt className="font-medium text-primary">Job matching</dt>
          <dd className="mt-0.5 text-2xs leading-relaxed text-muted">
            Unlimited scored leads
          </dd>
        </div>
        <div>
          <dt className="font-medium text-primary">Resume library</dt>
          <dd className="mt-0.5 text-2xs leading-relaxed text-muted">
            Up to 5 tailored versions
          </dd>
        </div>
        <div>
          <dt className="font-medium text-primary">Sending</dt>
          <dd className="mt-0.5 text-2xs leading-relaxed text-muted">
            Applications go out from your own inbox
          </dd>
        </div>
      </dl>
    </Card>
  );
}
