"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge, Button, Card, ConfidenceMeter, type Tone } from "./ui";
import { moduleLabel } from "@/lib/modules";
import { absoluteTime, relativeTime } from "@/lib/format";
import type { AgentAction } from "@/lib/db";

/*
  Status words are written from the operator's side of the screen, not the
  schema's. The database says "auto_executed"; the person reading it wants to
  know the agent "ran it on its own".
*/
const STATUS: Record<
  AgentAction["status"],
  { label: string; tone: Tone }
> = {
  pending: { label: "Needs you", tone: "warn" },
  approved: { label: "Approved", tone: "ok" },
  auto_executed: { label: "Ran on its own", tone: "accent" },
  rejected: { label: "Rejected", tone: "danger" },
  failed: { label: "Failed", tone: "danger" },
};

export default function ActionCard({
  action,
  threshold,
  onReview,
  busy = false,
  index = 0,
}: {
  action: AgentAction;
  threshold: number;
  onReview?: (id: number, status: "approved" | "rejected") => void;
  busy?: boolean;
  index?: number;
}) {
  const [showResult, setShowResult] = useState(false);
  const status = STATUS[action.status] ?? STATUS.pending;
  const confidence = Number(action.confidence);

  return (
    <Card className="animate-rise p-4 sm:p-5">
      {/* Staggered entrance: the feed assembles top-down instead of popping in
          all at once. Suppressed under prefers-reduced-motion by globals.css. */}
      <div style={{ animationDelay: `${Math.min(index, 8) * 35}ms` }}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <Badge tone={status.tone}>{status.label}</Badge>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold tracking-tight text-primary">
                {action.action.replace(/_/g, " ")}
              </p>
              <p className="truncate text-xs text-muted">{moduleLabel(action.module)}</p>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 sm:ml-auto sm:justify-end sm:gap-4">
            <ConfidenceMeter value={confidence} threshold={threshold} />
            <time
              className="shrink-0 text-2xs text-muted sm:text-xs"
              dateTime={action.created_at}
              title={absoluteTime(action.created_at)}
            >
              {relativeTime(action.created_at)}
            </time>
          </div>
        </div>

        <p className="mt-2.5 text-xs leading-relaxed text-secondary sm:mt-3 sm:text-sm">
          {action.reasoning}
        </p>

        {/* Execution state is its own line, because "approved" and "actually
            ran" are different facts and conflating them hides a real failure
            mode: approved-but-the-executor-is-down. */}
        {(action.status === "approved" || action.status === "auto_executed") && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            {action.executed_at ? (
              <span className="inline-flex items-center gap-1.5 text-ok">
                <span className="h-1.5 w-1.5 rounded-full bg-ok" />
                Ran {relativeTime(action.executed_at)}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-warn">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-warn" />
                Waiting for the executor to pick it up
              </span>
            )}
            {action.execution_result != null && (
              <button
                onClick={() => setShowResult((v) => !v)}
                className="text-accent hover:underline"
              >
                {showResult ? "Hide result" : "Show result"}
              </button>
            )}
          </div>
        )}

        {showResult && action.execution_result != null && (
          <pre className="tnum mt-3 max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-primary/[0.04] p-3 text-2xs leading-relaxed text-secondary ring-1 ring-inset ring-hairline/10 sm:text-xs">
            {JSON.stringify(action.execution_result, null, 2)}
          </pre>
        )}

        {action.action === "send_job_application_email" && action.metadata && (
          <div className="mt-3 rounded-xl bg-primary/[0.03] p-3.5 ring-1 ring-inset ring-primary/10">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="break-words font-semibold text-primary">
                {String(action.metadata.company || "")} · {String(action.metadata.job_title || "")}
              </span>
              {action.metadata.suggested_resume ? (
                <Badge tone="accent">{String(action.metadata.suggested_resume)}</Badge>
              ) : null}
            </div>
            {action.metadata.recipient_email ? (
              <p className="mt-1 break-all text-2xs text-muted">
                To: <span className="font-medium text-secondary">{String(action.metadata.recipient_email)}</span>
              </p>
            ) : null}
            {action.metadata.email_subject ? (
              <p className="mt-1 truncate text-xs text-secondary">
                Subject: {String(action.metadata.email_subject)}
              </p>
            ) : null}
          </div>
        )}

        {action.reviewed_by && action.status !== "pending" && (
          <p className="mt-3 text-xs text-muted">
            Reviewed by {action.reviewed_by}
            {action.reviewed_at && ` · ${relativeTime(action.reviewed_at)}`}
          </p>
        )}

        {action.status === "pending" && (
          <div className="mt-4 flex flex-col gap-2.5 border-t pt-3.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2 sm:pt-4">
            {action.action === "send_job_application_email" ? (
              <Link
                href={`/approvals/${action.id}`}
                className="press inline-flex min-h-[38px] items-center justify-center gap-2 rounded-xl bg-accent px-4 py-1.5 text-xs font-medium text-white shadow-sm shadow-accent/25 hover:bg-accent-deep"
              >
                Review & Edit Application
              </Link>
            ) : onReview ? (
              <div className="flex items-center gap-2">
                <Button
                  variant="approve"
                  size="sm"
                  disabled={busy}
                  onClick={() => onReview(action.id, "approved")}
                  className="flex-1 sm:flex-initial"
                >
                  Approve
                </Button>
                <Button
                  variant="reject"
                  size="sm"
                  disabled={busy}
                  onClick={() => onReview(action.id, "rejected")}
                  className="flex-1 sm:flex-initial"
                >
                  Reject
                </Button>
              </div>
            ) : null}

            <span className="text-2xs text-muted sm:ml-auto sm:text-xs">
              Below the {threshold.toFixed(2)} auto-run threshold
            </span>
          </div>
        )}
      </div>
    </Card>
  );
}

