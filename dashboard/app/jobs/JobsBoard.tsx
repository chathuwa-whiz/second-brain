"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Badge,
  Button,
  Card,
  ConfidenceMeter,
  EmptyState,
  ErrorNote,
  type Tone,
} from "@/components/ui";
import { IconExternal } from "@/components/icons";
import { relativeTime } from "@/lib/format";
import type { JobApplication, JobMatch } from "@/lib/mongo";
import type { AgentAction } from "@/lib/db";
import { withBasePath } from "@/lib/basePath";

const APP_STATUS_TONE: Record<string, Tone> = {
  applied: "accent",
  interview: "violet",
  offer: "ok",
  rejected: "danger",
  no_response: "neutral",
  withdrawn: "neutral",
};

function ScorePip({ score }: { score: number | null }) {
  if (score == null) return null;
  const tone = score >= 80 ? "text-ok" : score >= 70 ? "text-accent" : "text-warn";
  return (
    <div className="flex shrink-0 flex-col items-center">
      <span className={`tnum text-lg font-semibold leading-none ${tone}`}>
        {score.toFixed(0)}%
      </span>
      <span className="text-2xs uppercase tracking-wide text-muted">fit</span>
    </div>
  );
}

function PendingApprovalRow({ action }: { action: AgentAction }) {
  const meta = (action.metadata || {}) as Record<string, any>;
  const score = meta.match_score || Math.round(Number(action.confidence) * 100);

  return (
    <Card className="p-5">
      <div className="flex items-start gap-4">
        <ScorePip score={score} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="truncate text-base font-semibold text-primary">
                {meta.job_title || action.action.replace(/_/g, " ")}
              </p>
              <p className="text-xs text-muted">
                {meta.company || "TopJobs Employer"}
                {action.created_at && ` · discovered ${relativeTime(action.created_at)}`}
              </p>
            </div>

            {meta.suggested_resume && (
              <Badge tone="accent">{meta.suggested_resume}</Badge>
            )}
          </div>

          {action.reasoning && (
            <p className="mt-2 text-sm leading-relaxed text-secondary">
              {action.reasoning}
            </p>
          )}

          {meta.closing_date && (
            <p className="mt-2 text-2xs text-muted">
              Closing date: <span className="font-medium text-secondary">{meta.closing_date}</span>
            </p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-3 border-t pt-3">
            <Link
              href={`/approvals/${action.id}`}
              className="press inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-1.5 text-xs font-medium text-white shadow-sm shadow-accent/25 hover:bg-accent-deep"
            >
              Review & Send Application
            </Link>

            {meta.job_url && (
              <a
                href={meta.job_url}
                target="_blank"
                rel="noreferrer noopener"
                className="press inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-medium text-muted hover:text-primary"
              >
                TopJobs Posting
                <IconExternal className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

export default function JobsBoard({
  jobActions = [],
  initialMatches = [],
  applications = [],
  matchesError,
  applicationsError,
  actionsError,
}: {
  jobActions?: AgentAction[];
  initialMatches?: JobMatch[];
  applications?: JobApplication[];
  matchesError?: string | null;
  applicationsError?: string | null;
  actionsError?: string | null;
}) {
  const [tab, setTab] = useState<"pending" | "applications" | "matches">("pending");

  const pendingActions = jobActions.filter((a) => a.status === "pending");
  const approvedActions = jobActions.filter((a) => a.status === "approved" || a.status === "auto_executed");

  const tabs = [
    { key: "pending" as const, label: "Awaiting Approval", count: pendingActions.length },
    { key: "applications" as const, label: "Applications Sent", count: applications.length + approvedActions.length },
    { key: "matches" as const, label: "All Scored Matches", count: jobActions.length + initialMatches.length },
  ];

  return (
    <div className="space-y-6">
      {/* Top Stats & Tabs */}
      <div className="glass inline-flex rounded-2xl p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            aria-pressed={tab === t.key}
            className={`press rounded-xl px-4 py-2 text-sm font-medium ${
              tab === t.key
                ? "bg-accent text-white shadow-sm shadow-accent/25"
                : "text-secondary hover:text-primary"
            }`}
          >
            {t.label}
            <span className="tnum ml-2 opacity-70">{t.count}</span>
          </button>
        ))}
      </div>

      {actionsError && <ErrorNote>{actionsError}</ErrorNote>}
      {matchesError && <ErrorNote>{matchesError}</ErrorNote>}
      {applicationsError && <ErrorNote>{applicationsError}</ErrorNote>}

      {/* Tab 1: Pending Approvals */}
      {tab === "pending" && (
        pendingActions.length === 0 ? (
          <EmptyState
            title="No jobs waiting for approval"
            body="The autonomous 7:00 AM matcher runs daily and flags vacancies scoring ≥ 70%. When new matching software roles are discovered, they appear here for your one-click approval."
          />
        ) : (
          <div className="space-y-3">
            {pendingActions.map((a) => (
              <PendingApprovalRow key={a.id} action={a} />
            ))}
          </div>
        )
      )}

      {/* Tab 2: Applications Sent */}
      {tab === "applications" && (
        applications.length === 0 && approvedActions.length === 0 ? (
          <EmptyState
            title="No applications sent yet"
            body="When you approve a job from the queue, Second Brain attaches your selected PDF resume and dispatches the application email through Resend."
          />
        ) : (
          <div className="space-y-3">
            {/* MongoDB logged applications */}
            {applications.map((a) => (
              <Card key={a.id} className="p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <Badge tone={APP_STATUS_TONE[a.status] ?? "neutral"}>
                    {a.status.replace(/_/g, " ")}
                  </Badge>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-primary">
                      {a.role}
                    </p>
                    <p className="truncate text-xs text-muted">
                      {a.company}
                      {a.resume_version && ` · ${a.resume_version}`}
                    </p>
                  </div>
                  {a.date_applied && (
                    <span className="ml-auto text-xs text-muted">
                      {relativeTime(a.date_applied)}
                    </span>
                  )}
                </div>
                {a.notes && (
                  <p className="mt-2.5 text-xs text-secondary">{a.notes}</p>
                )}
                {a.job_url && (
                  <a
                    href={a.job_url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:underline"
                  >
                    Open posting
                    <IconExternal className="h-3.5 w-3.5" />
                  </a>
                )}
              </Card>
            ))}

            {/* Approved Postgres actions not yet in MongoDB */}
            {approvedActions.map((action) => {
              const meta = (action.metadata || {}) as Record<string, any>;
              return (
                <Card key={`act-${action.id}`} className="p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <Badge tone="ok">Approved & Sent</Badge>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-primary">
                        {meta.job_title || action.action}
                      </p>
                      <p className="truncate text-xs text-muted">
                        {meta.company}
                        {meta.suggested_resume && ` · ${meta.suggested_resume}`}
                      </p>
                    </div>
                    {action.executed_at && (
                      <span className="ml-auto text-xs text-muted">
                        {relativeTime(action.executed_at)}
                      </span>
                    )}
                  </div>
                  {action.reasoning && (
                    <p className="mt-2 text-xs text-secondary">{action.reasoning}</p>
                  )}
                </Card>
              );
            })}
          </div>
        )
      )}

      {/* Tab 3: All Scored Matches */}
      {tab === "matches" && (
        jobActions.length === 0 && initialMatches.length === 0 ? (
          <EmptyState
            title="No matches recorded yet"
            body="Job matches discovered by n8n and scored by the AI Gateway will appear here."
          />
        ) : (
          <div className="space-y-3">
            {jobActions.map((a) => (
              <PendingApprovalRow key={a.id} action={a} />
            ))}
          </div>
        )
      )}
    </div>
  );
}
