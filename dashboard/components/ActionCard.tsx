"use client";

import { useState } from "react";
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
    <Card className="animate-rise p-5">
      {/* Staggered entrance: the feed assembles top-down instead of popping in
          all at once. Suppressed under prefers-reduced-motion by globals.css. */}
      <div style={{ animationDelay: `${Math.min(index, 8) * 35}ms` }}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <Badge tone={status.tone}>{status.label}</Badge>

          <div className="min-w-0">
            <p className="truncate text-sm font-semibold tracking-tight text-primary">
              {action.action.replace(/_/g, " ")}
            </p>
            <p className="text-xs text-muted">{moduleLabel(action.module)}</p>
          </div>

          <div className="ml-auto flex items-center gap-4">
            <ConfidenceMeter value={confidence} threshold={threshold} />
            <time
              className="hidden text-xs text-muted sm:block"
              dateTime={action.created_at}
              title={absoluteTime(action.created_at)}
            >
              {relativeTime(action.created_at)}
            </time>
          </div>
        </div>

        <p className="mt-3 text-sm leading-relaxed text-secondary">
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
          <pre className="tnum mt-3 max-h-56 overflow-auto rounded-xl bg-primary/[0.04] p-3 text-xs leading-relaxed text-secondary ring-1 ring-inset ring-hairline/10">
            {JSON.stringify(action.execution_result, null, 2)}
          </pre>
        )}

        {action.reviewed_by && action.status !== "pending" && (
          <p className="mt-3 text-xs text-muted">
            Reviewed by {action.reviewed_by}
            {action.reviewed_at && ` · ${relativeTime(action.reviewed_at)}`}
          </p>
        )}

        {action.status === "pending" && onReview && (
          <div className="mt-4 flex gap-2 border-t pt-4">
            <Button
              variant="approve"
              size="sm"
              disabled={busy}
              onClick={() => onReview(action.id, "approved")}
            >
              Approve
            </Button>
            <Button
              variant="reject"
              size="sm"
              disabled={busy}
              onClick={() => onReview(action.id, "rejected")}
            >
              Reject
            </Button>
            <span className="ml-auto self-center text-xs text-muted">
              Below the {threshold.toFixed(2)} auto-run threshold
            </span>
          </div>
        )}
      </div>
    </Card>
  );
}
