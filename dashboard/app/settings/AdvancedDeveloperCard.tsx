"use client";

import { Card } from "@/components/ui";
import ApiKeysCard from "./ApiKeysCard";

export default function AdvancedDeveloperCard() {
  return (
    <Card className="p-4 sm:p-5">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between font-medium text-secondary hover:text-primary transition-colors focus:outline-none">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-primary">
              🛠️ Developer Tools & Webhook API Keys
            </span>
            <span className="rounded-md bg-primary/[0.06] px-2 py-0.5 text-3xs font-medium text-muted">
              Advanced
            </span>
          </div>
          <span className="text-xs text-muted transition-transform group-open:rotate-180">
            ▼
          </span>
        </summary>

        <div className="mt-5 space-y-4 border-t border-hairline/10 pt-4">
          <p className="text-xs text-muted leading-relaxed">
            Standard automated scraping runs automatically in the background. If you are an engineer who wants to connect custom external n8n workflows, Python scrapers, or Chrome extensions, you can generate personal API keys below.
          </p>
          <ApiKeysCard />
        </div>
      </details>
    </Card>
  );
}
