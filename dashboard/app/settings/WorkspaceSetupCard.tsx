"use client";

import Link from "next/link";
import { Card } from "@/components/ui";
import { IconResumes, IconJobs, IconSettings } from "@/components/icons";

export default function WorkspaceSetupCard() {
  return (
    <Card className="space-y-4 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-primary sm:text-base">
            Guided setup
          </h3>
          <p className="text-xs leading-relaxed text-secondary">
            Re-run the three-step wizard to change resumes, career targets or
            how much the agent does on its own.
          </p>
        </div>

        <Link
          href="/onboarding"
          className="press inline-flex min-h-[38px] shrink-0 items-center justify-center rounded-xl bg-accent px-4 text-xs font-medium text-white shadow-sm shadow-accent/25 transition-colors hover:bg-accent-deep"
        >
          Open wizard
        </Link>
      </div>

      <ol className="grid grid-cols-1 gap-x-5 gap-y-3 border-t border-hairline/10 pt-4 sm:grid-cols-3">
        {[
          { Icon: IconResumes, n: 1, label: "Resumes", hint: "Up to five versions" },
          { Icon: IconJobs, n: 2, label: "Targets", hint: "Roles, places, salary" },
          { Icon: IconSettings, n: 3, label: "Autonomy", hint: "When it acts alone" },
        ].map(({ Icon, n, label, hint }) => (
          <li key={n} className="flex items-center gap-2.5">
            <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-accent/10 text-accent">
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-primary">
                {n}. {label}
              </p>
              <p className="truncate text-2xs text-muted">{hint}</p>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}
