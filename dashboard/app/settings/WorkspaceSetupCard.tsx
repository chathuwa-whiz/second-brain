"use client";

import Link from "next/link";
import { Card } from "@/components/ui";
import { IconResumes, IconJobs, IconSettings } from "@/components/icons";

export default function WorkspaceSetupCard() {
  return (
    <Card className="p-4 sm:p-6 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-primary">
              Guided Workspace Setup
            </h3>
            <span className="rounded-lg bg-accent/15 px-2 py-0.5 text-2xs font-bold text-accent">
              3 Steps
            </span>
          </div>
          <p className="text-xs text-secondary leading-relaxed">
            Re-run the interactive setup wizard to manage candidate resumes, update career targets, or retune your AI trust layer.
          </p>
        </div>

        <Link
          href="/onboarding"
          className="press inline-flex min-h-[38px] items-center justify-center rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-white shadow-sm hover:opacity-95 transition-opacity shrink-0"
        >
          Launch Setup Wizard →
        </Link>
      </div>

      {/* 3 Step Pills */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
        <div className="flex items-center gap-2.5 rounded-xl bg-primary/[0.03] p-3 border border-hairline/10">
          <div className="grid h-7 w-7 place-items-center rounded-lg bg-accent/10 text-accent shrink-0">
            <IconResumes className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-primary">1. Resumes</p>
            <p className="text-2xs text-muted truncate">Multi-tenant Cloudflare R2</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 rounded-xl bg-primary/[0.03] p-3 border border-hairline/10">
          <div className="grid h-7 w-7 place-items-center rounded-lg bg-violet/10 text-violet shrink-0">
            <IconJobs className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-primary">2. Career Targets</p>
            <p className="text-2xs text-muted truncate">Roles, locations & salary</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 rounded-xl bg-primary/[0.03] p-3 border border-hairline/10">
          <div className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-500/10 text-emerald-400 shrink-0">
            <IconSettings className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-primary">3. Trust Layer</p>
            <p className="text-2xs text-muted truncate">Autonomy & alerts</p>
          </div>
        </div>
      </div>
    </Card>
  );
}
