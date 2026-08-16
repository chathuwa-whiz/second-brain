"use client";

import { Card } from "@/components/ui";
import ApiKeysCard from "./ApiKeysCard";

export default function AdvancedDeveloperCard() {
  return (
    <Card className="p-4 sm:p-5">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 transition-colors hover:text-primary">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-primary">
              Developer tools &amp; API keys
            </span>
            <span className="rounded-md bg-primary/[0.06] px-1.5 py-0.5 text-3xs font-medium text-muted">
              Advanced
            </span>
          </div>
          <span className="shrink-0 text-2xs text-muted transition-transform group-open:rotate-180">
            ▼
          </span>
        </summary>

        <div className="mt-5 space-y-4 border-t border-hairline/10 pt-4">
          <p className="text-xs leading-relaxed text-muted">
            Job scanning already runs on its own in the background. These keys
            are only needed if you want to drive the workspace from your own
            automations or scripts.
          </p>
          <ApiKeysCard />
        </div>
      </details>
    </Card>
  );
}
