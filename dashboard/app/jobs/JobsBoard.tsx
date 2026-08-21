"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorNote,
  type Tone,
} from "@/components/ui";
import {
  IconExternal,
  IconGrid,
  IconList,
  IconSearch,
  IconStar,
  IconX,
} from "@/components/icons";
import { relativeTime } from "@/lib/format";
import type { JobApplication, JobApplicationStatus, JobMatch } from "@/lib/mongo";
import type { AgentAction } from "@/lib/db";
import { withBasePath } from "@/lib/basePath";
import { normalizeJobUrl, normalizeString } from "@/lib/jobDedup";

const APP_STATUS_TONE: Record<string, Tone> = {
  applied: "accent",
  interview: "violet",
  offer: "ok",
  rejected: "danger",
  no_response: "neutral",
  withdrawn: "neutral",
};

const APP_STATUS_SELECT_STYLE: Record<string, string> = {
  applied: "bg-accent/10 text-accent-ink border-accent/25 focus:ring-accent/30",
  interview: "bg-violet/10 text-violet-ink border-violet/25 focus:ring-violet/30",
  offer: "bg-ok/10 text-ok-ink border-ok/25 focus:ring-ok/30",
  rejected: "bg-danger/10 text-danger-ink border-danger/25 focus:ring-danger/30",
  no_response: "bg-primary/[0.04] text-muted border-hairline/20 focus:ring-primary/20",
  withdrawn: "bg-primary/[0.04] text-muted border-hairline/20 focus:ring-primary/20",
};


const MATCH_STATUS_TONE: Record<string, Tone> = {
  new: "warn",
  applied: "ok",
  dismissed: "neutral",
};

export type UnifiedJobMatch = {
  id: string;
  actionId?: string | number;
  matchId?: string;
  title: string;
  company: string;
  url: string;
  location: string;
  remote: boolean | null;
  source: string;
  score: number | null;
  reason: string;
  status: "new" | "applied" | "dismissed";
  actionStatus?: "pending" | "approved" | "rejected" | "auto_executed" | "failed";
  found_at: string;
  suggested_resume?: string;
  closing_date?: string;
};

type ScoreFilter = "all" | "high" | "good" | "moderate" | "starred" | "deadline_soon";
type SortOption = "newest" | "score_desc" | "oldest" | "closing_soon";
type ViewMode = "grid" | "list";

function getDeadlineStatus(closingDateStr?: string | null): {
  label: string;
  tone: Tone;
  isExpired: boolean;
  isSoon: boolean;
} | null {
  if (!closingDateStr) return null;
  const parsed = new Date(closingDateStr);
  if (isNaN(parsed.getTime())) {
    return { label: `Closes: ${closingDateStr}`, tone: "neutral", isExpired: false, isSoon: false };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(parsed);
  target.setHours(0, 0, 0, 0);

  const diffDays = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { label: "Deadline Passed", tone: "danger", isExpired: true, isSoon: false };
  }
  if (diffDays === 0) {
    return { label: "Closes Today", tone: "warn", isExpired: false, isSoon: true };
  }
  if (diffDays <= 3) {
    return { label: `Closes in ${diffDays}d`, tone: "warn", isExpired: false, isSoon: true };
  }
  return { label: `Closes: ${closingDateStr}`, tone: "neutral", isExpired: false, isSoon: false };
}

function ScorePip({ score }: { score: number | null }) {
  if (score == null) return null;
  const tone = score >= 80 ? "text-ok-ink" : score >= 70 ? "text-accent-ink" : "text-warn-ink";
  return (
    <div className="flex shrink-0 flex-col items-center">
      <span className={`tnum text-base font-semibold leading-none sm:text-lg ${tone}`}>
        {score.toFixed(0)}%
      </span>
      <span className="text-2xs uppercase tracking-wide text-muted">fit</span>
    </div>
  );
}

function PendingApprovalRow({
  action,
  onDismiss,
  dismissing,
  viewMode = "grid",
  isStarred,
  onToggleStar,
  selectionMode,
  isSelected,
  onToggleSelect,
}: {
  action: AgentAction;
  onDismiss: (id: string | number) => void;
  dismissing: boolean;
  viewMode?: ViewMode;
  isStarred: boolean;
  onToggleStar: (id: string | number) => void;
  selectionMode: boolean;
  isSelected: boolean;
  onToggleSelect: (id: string | number) => void;
}) {
  const meta = (action.metadata || {}) as Record<string, any>;
  const score = meta.match_score || Math.round(Number(action.confidence) * 100);
  const deadline = getDeadlineStatus(meta.closing_date);

  if (viewMode === "grid") {
    return (
      <Card
        className={`flex flex-col justify-between p-3.5 sm:p-4 transition-all ${
          isSelected ? "ring-2 ring-accent/60 bg-accent/[0.03]" : ""
        } ${deadline?.isExpired ? "opacity-75" : ""}`}
      >
        <div>
          {/* Card Header: Checkbox + Score + Title + Star */}
          <div className="flex items-start gap-2.5">
            {selectionMode && (
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => onToggleSelect(action.id)}
                className="mt-1 h-4 w-4 rounded border-hairline/40 text-accent focus:ring-accent"
              />
            )}
            <ScorePip score={score} />
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-sm font-semibold tracking-tight text-primary">
                {meta.job_title || action.action.replace(/_/g, " ")}
              </p>
              <p className="mt-0.5 truncate text-xs text-muted">
                {meta.company || "TopJobs Employer"}
                {meta.location && ` · 📍 ${meta.location}`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onToggleStar(action.id)}
              aria-label={isStarred ? "Unstar job" : "Star job"}
              title={isStarred ? "Starred job" : "Star for later"}
              className={`press p-1 transition-colors ${
                isStarred ? "text-warn-ink" : "text-muted/40 hover:text-muted"
              }`}
            >
              <IconStar className="h-4 w-4" filled={isStarred} />
            </button>
          </div>

          {/* Badges / Meta row */}
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {deadline && (
              <Badge tone={deadline.tone}>{deadline.label}</Badge>
            )}
            {meta.suggested_resume && (
              <div className="inline-flex min-w-0 max-w-[170px] items-center gap-1 rounded-md bg-accent/10 px-2 py-0.5 text-2xs font-medium text-accent-ink">
                <span className="shrink-0">📄</span>
                <span className="truncate">{meta.suggested_resume}</span>
              </div>
            )}
            {action.created_at && (
              <span className="text-2xs text-muted">
                {relativeTime(action.created_at)}
              </span>
            )}
          </div>

          {/* Reasoning */}
          {action.reasoning && (
            <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-secondary" title={action.reasoning}>
              {action.reasoning}
            </p>
          )}
        </div>

        {/* Card Footer Actions */}
        <div className="mt-3.5 flex flex-wrap items-center gap-2 border-t pt-3">
          <Link
            href={`/jobs/approvals/${action.id}`}
            className="press flex-1 inline-flex min-h-[32px] items-center justify-center gap-1.5 rounded-lg bg-accent-solid px-3 py-1 text-xs font-medium text-white shadow-sm shadow-accent/25 hover:brightness-110"
          >
            Review & Apply
          </Link>

          <Button
            variant="reject"
            size="sm"
            disabled={dismissing}
            onClick={() => onDismiss(action.id)}
            className="min-h-[32px] px-2.5 text-xs font-medium"
            title="Dismiss job"
          >
            {dismissing ? "..." : "✕"}
          </Button>

          {meta.job_url && (
            <a
              href={meta.job_url}
              target="_blank"
              rel="noreferrer noopener"
              className="press inline-flex min-h-[32px] items-center justify-center gap-1 rounded-lg px-2 text-xs font-medium text-muted hover:text-primary"
              title="Open TopJobs Posting"
            >
              <IconExternal className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      </Card>
    );
  }

  // List View
  return (
    <Card
      className={`min-w-0 p-3 sm:p-4 ${
        isSelected ? "ring-2 ring-accent/60 bg-accent/[0.03]" : ""
      } ${deadline?.isExpired ? "opacity-75" : ""}`}
    >
      <div className="flex flex-col gap-2.5 min-w-0 sm:flex-row sm:items-start sm:gap-3.5">
        <div className="flex items-center justify-between gap-2 min-w-0 sm:flex-col sm:items-center sm:justify-start sm:gap-1.5">
          <div className="flex items-center gap-2">
            {selectionMode && (
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => onToggleSelect(action.id)}
                className="h-4 w-4 rounded border-hairline/40 text-accent focus:ring-accent"
              />
            )}
            <ScorePip score={score} />
          </div>
          <button
            type="button"
            onClick={() => onToggleStar(action.id)}
            aria-label={isStarred ? "Unstar job" : "Star job"}
            className={`press p-1 transition-colors ${
              isStarred ? "text-warn-ink" : "text-muted/40 hover:text-muted"
            }`}
          >
            <IconStar className="h-4 w-4" filled={isStarred} />
          </button>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="break-words text-sm font-semibold tracking-tight text-primary">
                  {meta.job_title || action.action.replace(/_/g, " ")}
                </p>
                {deadline && (
                  <Badge tone={deadline.tone}>{deadline.label}</Badge>
                )}
              </div>
              <p className="mt-0.5 truncate text-xs text-muted">
                {meta.company || "TopJobs Employer"}
                {meta.location && ` · 📍 ${meta.location}`}
                {action.created_at && ` · ${relativeTime(action.created_at)}`}
              </p>
            </div>

            {meta.suggested_resume && (
              <div className="hidden min-w-0 max-w-[220px] shrink-0 items-center gap-1 rounded-lg bg-accent/10 px-2.5 py-1 text-2xs font-medium text-accent-ink sm:flex">
                <span className="shrink-0">📄</span>
                <span className="truncate">{meta.suggested_resume}</span>
              </div>
            )}
          </div>

          {action.reasoning && (
            <p className="mt-1.5 break-words text-xs leading-relaxed text-secondary">
              {action.reasoning}
            </p>
          )}

          <div className="mt-2.5 flex flex-col gap-2 border-t pt-2 xs:flex-row xs:flex-wrap xs:items-center xs:gap-2.5">
            <Link
              href={`/jobs/approvals/${action.id}`}
              className="press inline-flex min-h-[32px] items-center justify-center gap-2 rounded-lg bg-accent-solid px-3.5 py-1 text-xs font-medium text-white shadow-sm shadow-accent/25 hover:brightness-110"
            >
              Review & Send Application
            </Link>

            <Button
              variant="reject"
              size="sm"
              disabled={dismissing}
              onClick={() => onDismiss(action.id)}
              className="min-h-[32px] text-xs font-medium"
            >
              {dismissing ? "Dismissing..." : "✕ Dismiss"}
            </Button>

            {meta.job_url && (
              <a
                href={meta.job_url}
                target="_blank"
                rel="noreferrer noopener"
                className="press inline-flex min-h-[32px] items-center justify-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium text-muted hover:text-primary xs:ml-auto"
              >
                TopJobs Posting
                <IconExternal className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

function ScoredMatchRow({
  match,
  onDismiss,
  dismissing,
  viewMode = "grid",
  isStarred,
  onToggleStar,
}: {
  match: UnifiedJobMatch;
  onDismiss: (match: UnifiedJobMatch) => void;
  dismissing: boolean;
  viewMode?: ViewMode;
  isStarred: boolean;
  onToggleStar: (id: string | number) => void;
}) {
  const normalizedScore = match.score != null ? (match.score <= 10 ? match.score * 10 : match.score) : null;
  const deadline = getDeadlineStatus(match.closing_date);

  if (viewMode === "grid") {
    return (
      <Card className={`flex flex-col justify-between p-3.5 sm:p-4 ${deadline?.isExpired ? "opacity-75" : ""}`}>
        <div>
          <div className="flex items-start gap-2.5">
            <ScorePip score={normalizedScore} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge tone={MATCH_STATUS_TONE[match.status] ?? "neutral"}>
                  {match.status === "applied" ? "Applied" : match.status === "dismissed" ? "Dismissed" : "New Match"}
                </Badge>
                {match.source && (
                  <span className="text-2xs font-semibold uppercase tracking-wider text-muted">
                    {match.source}
                  </span>
                )}
                {match.remote && (
                  <Badge tone="violet">Remote</Badge>
                )}
              </div>
              <p className="mt-1 line-clamp-2 text-sm font-semibold text-primary">
                {match.title}
              </p>
              <p className="mt-0.5 truncate text-xs text-muted">
                {match.company || "Employer"}
                {match.location && ` · 📍 ${match.location}`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onToggleStar(match.id)}
              aria-label={isStarred ? "Unstar job" : "Star job"}
              title={isStarred ? "Starred job" : "Star for later"}
              className={`press p-1 transition-colors ${
                isStarred ? "text-warn-ink" : "text-muted/40 hover:text-muted"
              }`}
            >
              <IconStar className="h-4 w-4" filled={isStarred} />
            </button>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {deadline && (
              <Badge tone={deadline.tone}>{deadline.label}</Badge>
            )}
            {match.suggested_resume && (
              <div className="inline-flex min-w-0 max-w-[170px] items-center gap-1 rounded-md bg-accent/10 px-2 py-0.5 text-2xs font-medium text-accent-ink">
                <span className="shrink-0">📄</span>
                <span className="truncate">{match.suggested_resume}</span>
              </div>
            )}
            {match.found_at && (
              <span className="text-2xs text-muted">
                Discovered {relativeTime(match.found_at)}
              </span>
            )}
          </div>

          {match.reason && (
            <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-secondary" title={match.reason}>
              {match.reason}
            </p>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-2.5">
          <div className="flex items-center gap-2">
            {match.actionId && (match.status === "new" || match.actionStatus === "pending") && (
              <Link
                href={`/jobs/approvals/${match.actionId}`}
                className="press inline-flex min-h-[30px] items-center justify-center gap-1.5 rounded-lg bg-accent-solid px-3 py-1 text-xs font-medium text-white shadow-sm shadow-accent/25 hover:brightness-110"
              >
                Review & Apply
              </Link>
            )}

            {match.url && (
              <a
                href={match.url}
                target="_blank"
                rel="noreferrer noopener"
                className="press inline-flex min-h-[30px] items-center gap-1.5 rounded-lg bg-primary/[0.04] px-2.5 py-1 text-xs font-medium text-accent-ink hover:bg-primary/[0.08]"
              >
                Open posting
                <IconExternal className="h-3 w-3" />
              </a>
            )}
          </div>

          {(match.status === "new" || match.actionStatus === "pending") && (
            <Button
              variant="quiet"
              size="sm"
              disabled={dismissing}
              onClick={() => onDismiss(match)}
              className="min-h-[30px] px-2.5 text-xs text-danger-ink hover:bg-danger/10"
            >
              {dismissing ? "..." : "✕ Dismiss"}
            </Button>
          )}
        </div>
      </Card>
    );
  }

  // List View
  return (
    <Card className={`min-w-0 p-3 sm:p-4 ${deadline?.isExpired ? "opacity-75" : ""}`}>
      <div className="flex flex-col gap-3 min-w-0 sm:flex-row sm:items-start sm:gap-3.5">
        <div className="flex items-center gap-2 sm:flex-col sm:items-center">
          <ScorePip score={normalizedScore} />
          <button
            type="button"
            onClick={() => onToggleStar(match.id)}
            aria-label={isStarred ? "Unstar job" : "Star job"}
            className={`press p-1 transition-colors ${
              isStarred ? "text-warn-ink" : "text-muted/40 hover:text-muted"
            }`}
          >
            <IconStar className="h-4 w-4" filled={isStarred} />
          </button>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={MATCH_STATUS_TONE[match.status] ?? "neutral"}>
                  {match.status === "applied" ? "Applied" : match.status === "dismissed" ? "Dismissed" : "New Match"}
                </Badge>
                {match.source && (
                  <span className="text-2xs font-semibold uppercase tracking-wider text-muted">
                    {match.source}
                  </span>
                )}
                {match.remote && (
                  <Badge tone="violet">Remote</Badge>
                )}
                {deadline && (
                  <Badge tone={deadline.tone}>{deadline.label}</Badge>
                )}
              </div>
              <p className="mt-1 break-words text-sm font-semibold text-primary sm:text-base">
                {match.title}
              </p>
              <p className="mt-0.5 truncate text-xs text-muted">
                {match.company || "Employer"}
                {match.location && ` · 📍 ${match.location}`}
                {match.found_at && ` · Discovered ${relativeTime(match.found_at)}`}
              </p>
            </div>

            {match.suggested_resume && (
              <div className="hidden min-w-0 max-w-[220px] shrink-0 items-center gap-1 rounded-lg bg-accent/10 px-2.5 py-1 text-2xs font-medium text-accent-ink sm:flex">
                <span className="shrink-0">📄</span>
                <span className="truncate">{match.suggested_resume}</span>
              </div>
            )}
          </div>

          {match.reason && (
            <p className="mt-2 break-words text-xs leading-relaxed text-secondary">
              {match.reason}
            </p>
          )}

          <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t pt-2">
            {match.actionId && (match.status === "new" || match.actionStatus === "pending") && (
              <Link
                href={`/jobs/approvals/${match.actionId}`}
                className="press inline-flex min-h-[30px] items-center justify-center gap-1.5 rounded-lg bg-accent-solid px-3.5 py-1 text-xs font-medium text-white shadow-sm shadow-accent/25 hover:brightness-110"
              >
                Review & Apply
              </Link>
            )}

            {match.url && (
              <a
                href={match.url}
                target="_blank"
                rel="noreferrer noopener"
                className="press inline-flex min-h-[30px] items-center gap-1.5 rounded-lg bg-primary/[0.04] px-3 py-1 text-xs font-medium text-accent-ink hover:bg-primary/[0.08]"
              >
                Open posting
                <IconExternal className="h-3 w-3" />
              </a>
            )}

            {(match.status === "new" || match.actionStatus === "pending") && (
              <Button
                variant="quiet"
                size="sm"
                disabled={dismissing}
                onClick={() => onDismiss(match)}
                className="min-h-[30px] text-xs text-danger-ink hover:bg-danger/10"
              >
                {dismissing ? "Dismissing..." : "✕ Dismiss"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

function ApplicationCard({
  app,
  onUpdateStatus,
  onSaveDetails,
  onDelete,
  viewMode = "grid",
}: {
  app: JobApplication;
  onUpdateStatus: (id: string, status: JobApplicationStatus) => Promise<void>;
  onSaveDetails: (
    id: string,
    details: { notes: string; interview_date: string | null; follow_up_date: string | null }
  ) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  viewMode?: ViewMode;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [notes, setNotes] = useState(app.notes || "");
  const [interviewDate, setInterviewDate] = useState(
    app.interview_date ? app.interview_date.slice(0, 10) : ""
  );
  const [followUpDate, setFollowUpDate] = useState(
    app.follow_up_date ? app.follow_up_date.slice(0, 10) : ""
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const status = (app.status || "applied") as JobApplicationStatus;

  async function handleStatusSelect(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value as JobApplicationStatus;
    setIsUpdatingStatus(true);
    try {
      await onUpdateStatus(app.id, val);
    } finally {
      setIsUpdatingStatus(false);
    }
  }

  async function handleSave() {
    setIsSaving(true);
    try {
      await onSaveDetails(app.id, {
        notes,
        interview_date: interviewDate || null,
        follow_up_date: followUpDate || null,
      });
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Remove application for ${app.role} at ${app.company}?`)) return;
    setIsDeleting(true);
    try {
      await onDelete(app.id);
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <Card className="flex flex-col justify-between p-3.5 sm:p-4">
      <div>
        <div className="flex items-center justify-between gap-2">
          <select
            value={status}
            disabled={isUpdatingStatus}
            onChange={handleStatusSelect}
            className={`cursor-pointer rounded-full border px-2.5 py-0.5 text-2xs font-semibold capitalize outline-none transition-colors ${
              APP_STATUS_SELECT_STYLE[status] || "bg-primary/[0.04] text-secondary border-hairline/20"
            }`}
            title="Change application status"
          >
            <option value="applied">Applied</option>
            <option value="interview">Interviewing</option>
            <option value="offer">Offer Received 🎉</option>
            <option value="rejected">Rejected</option>
            <option value="no_response">No Response</option>
            <option value="withdrawn">Withdrawn</option>
          </select>
          {app.date_applied && (
            <span className="shrink-0 text-2xs text-muted">
              {relativeTime(app.date_applied)}
            </span>
          )}
        </div>

        <p className="mt-2 text-sm font-semibold tracking-tight text-primary">
          {app.role}
        </p>
        <p className="mt-0.5 truncate text-xs text-muted">
          {app.company}
          {app.resume_version && ` · 📄 ${app.resume_version}`}
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {app.interview_date && (
            <div className="inline-flex items-center gap-1 rounded-md bg-violet/10 px-2 py-0.5 text-2xs font-medium text-violet-ink">
              <span>🗓 Interview:</span>
              <span>{app.interview_date.slice(0, 10)}</span>
            </div>
          )}
          {app.follow_up_date && (
            <div className="inline-flex items-center gap-1 rounded-md bg-warn/10 px-2 py-0.5 text-2xs font-medium text-warn-ink">
              <span>⏰ Follow-up:</span>
              <span>{app.follow_up_date.slice(0, 10)}</span>
            </div>
          )}
        </div>

        {!isEditing ? (
          app.notes ? (
            <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-secondary bg-primary/[0.02] p-2 rounded-lg border border-hairline/20">
              {app.notes}
            </p>
          ) : null
        ) : (
          <div className="mt-2.5 space-y-2 rounded-lg bg-primary/[0.03] p-2.5 border border-hairline/30">
            <div>
              <label className="block text-2xs font-medium text-muted mb-1">
                Interview / Follow-up Notes:
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Log interviewer names, questions, salary notes, next steps..."
                rows={2}
                className="field w-full text-xs p-2"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-2xs font-medium text-muted mb-1">
                  Interview Date:
                </label>
                <input
                  type="date"
                  value={interviewDate}
                  onChange={(e) => setInterviewDate(e.target.value)}
                  className="field h-7 w-full text-2xs px-2"
                />
              </div>
              <div>
                <label className="block text-2xs font-medium text-muted mb-1">
                  Next Follow-up:
                </label>
                <input
                  type="date"
                  value={followUpDate}
                  onChange={(e) => setFollowUpDate(e.target.value)}
                  className="field h-7 w-full text-2xs px-2"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="rounded px-2 py-0.5 text-2xs text-muted hover:text-primary"
              >
                Cancel
              </button>
              <Button
                size="sm"
                disabled={isSaving}
                onClick={handleSave}
                className="h-6 px-2.5 text-2xs"
              >
                {isSaving ? "Saving..." : "Save Notes"}
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 border-t pt-2.5">
        <div className="flex items-center gap-2">
          {app.job_url ? (
            <a
              href={app.job_url}
              target="_blank"
              rel="noreferrer noopener"
              className="press inline-flex items-center gap-1 text-xs font-medium text-accent-ink hover:underline"
            >
              Open posting
              <IconExternal className="h-3 w-3" />
            </a>
          ) : (
            <span className="text-2xs text-muted">Direct Email</span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setIsEditing((v) => !v)}
            className="press rounded-md px-2 py-1 text-2xs font-medium text-secondary hover:text-primary hover:bg-primary/[0.04]"
          >
            {isEditing ? "Close" : app.notes || app.interview_date ? "✏️ Edit Notes" : "➕ Add Notes"}
          </button>

          <Button
            variant="quiet"
            size="sm"
            disabled={isDeleting}
            onClick={handleDelete}
            className="h-6 px-1.5 text-2xs text-danger-ink hover:bg-danger/10"
            title="Delete application record"
          >
            {isDeleting ? "..." : "✕"}
          </Button>
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
  const [actions, setActions] = useState<AgentAction[]>(jobActions);
  const [matches, setMatches] = useState<JobMatch[]>(initialMatches);
  const [apps, setApps] = useState<JobApplication[]>(applications);

  const [searchQuery, setSearchQuery] = useState("");
  const [scoreFilter, setScoreFilter] = useState<ScoreFilter>("all");
  const [appStageFilter, setAppStageFilter] = useState<"all" | "applied" | "interview" | "offer" | "rejected_archived">("all");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");

  const [starredIds, setStarredIds] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());

  const [dismissingId, setDismissingId] = useState<string | number | null>(null);
  const [isBulkDismissing, setIsBulkDismissing] = useState(false);
  const [isDeduplicating, setIsDeduplicating] = useState(false);
  const [hideDuplicates, setHideDuplicates] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [opError, setOpError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("second_brain_starred_jobs");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setStarredIds(new Set(parsed.map(String)));
        }
      }
    } catch {
      /* ignore */
    }
  }, []);

  function toggleStar(id: string | number) {
    const strId = String(id);
    setStarredIds((prev) => {
      const next = new Set(prev);
      if (next.has(strId)) next.delete(strId);
      else next.add(strId);
      try {
        localStorage.setItem("second_brain_starred_jobs", JSON.stringify(Array.from(next)));
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  function toggleSelect(id: string | number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const pendingActions = useMemo(
    () => actions.filter((a) => a.status === "pending"),
    [actions]
  );
  const approvedActions = useMemo(
    () => actions.filter((a) => a.status === "approved" || a.status === "auto_executed"),
    [actions]
  );

  const lowScoreActions = useMemo(() => {
    return pendingActions.filter((a) => {
      const meta = (a.metadata || {}) as Record<string, any>;
      const score = meta.match_score ?? Math.round(Number(a.confidence) * 100);
      return score < 60;
    });
  }, [pendingActions]);

  const staleActions = useMemo(() => {
    const now = Date.now();
    return pendingActions.filter((a) => {
      if (!a.created_at) return false;
      const created = new Date(a.created_at).getTime();
      return !isNaN(created) && now - created > 14 * 86400000;
    });
  }, [pendingActions]);

  const appMetrics = useMemo(() => {
    const total = apps.length + approvedActions.length;
    const interviewing = apps.filter((a) => a.status === "interview").length;
    const offers = apps.filter((a) => a.status === "offer").length;
    const applied = apps.filter((a) => a.status === "applied" || !a.status).length + approvedActions.length;
    const rejected = apps.filter((a) => a.status === "rejected" || a.status === "no_response" || a.status === "withdrawn").length;
    const interviewRate = total > 0 ? Math.round(((interviewing + offers) / total) * 100) : 0;
    return { total, interviewing, offers, applied, rejected, interviewRate };
  }, [apps, approvedActions]);

  async function handleDismissAction(actionId: string | number) {
    setDismissingId(actionId);
    setOpError(null);
    try {
      const res = await fetch(withBasePath(`/api/actions/${actionId}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "rejected" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to dismiss job.");

      setActions((prev) =>
        prev.map((a) => (a.id === actionId ? { ...a, status: "rejected" } : a))
      );
      setStatusMessage("Job dismissed from pending queue.");
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err) {
      setOpError(err instanceof Error ? err.message : "Failed to dismiss job.");
    } finally {
      setDismissingId(null);
    }
  }

  async function handleBulkDismiss(idsToDismiss: (string | number)[], msg?: string) {
    if (idsToDismiss.length === 0) return;
    setIsBulkDismissing(true);
    setOpError(null);
    try {
      const res = await fetch(withBasePath(`/api/actions`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: idsToDismiss, status: "rejected" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to dismiss selected jobs.");

      const dismissedSet = new Set(idsToDismiss);
      setActions((prev) =>
        prev.map((a) => (dismissedSet.has(a.id) ? { ...a, status: "rejected" } : a))
      );
      setSelectedIds(new Set());
      setSelectionMode(false);
      setStatusMessage(msg || `Dismissed ${idsToDismiss.length} jobs.`);
      setTimeout(() => setStatusMessage(null), 3500);
    } catch (err) {
      setOpError(err instanceof Error ? err.message : "Bulk dismissal failed.");
    } finally {
      setIsBulkDismissing(false);
    }
  }

  async function handleCleanupDuplicates() {
    setIsDeduplicating(true);
    setOpError(null);
    try {
      const res = await fetch(withBasePath(`/api/jobs/cleanup-duplicates`), {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to clean duplicates.");

      if (Array.isArray(data.actions)) {
        setActions(data.actions);
      }
      setStatusMessage(data.message || "Deduplicated jobs successfully.");
      setTimeout(() => setStatusMessage(null), 3500);
    } catch (err) {
      setOpError(err instanceof Error ? err.message : "Failed to deduplicate jobs.");
    } finally {
      setIsDeduplicating(false);
    }
  }

  async function handleDismissUnifiedMatch(match: UnifiedJobMatch) {
    setDismissingId(match.id);
    setOpError(null);
    try {
      if (match.matchId) {
        const res = await fetch(withBasePath(`/api/jobs/${match.matchId}`), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "dismissed" }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to dismiss match.");

        setMatches((prev) =>
          prev.map((m) => (String(m.id) === String(match.matchId) ? { ...m, status: "dismissed" } : m))
        );
      }
      if (match.actionId) {
        const res = await fetch(withBasePath(`/api/actions/${match.actionId}`), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "rejected" }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to dismiss action.");

        setActions((prev) =>
          prev.map((a) => (a.id === match.actionId ? { ...a, status: "rejected" } : a))
        );
      }
      setStatusMessage("Job match marked as dismissed.");
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err) {
      setOpError(err instanceof Error ? err.message : "Failed to dismiss match.");
    } finally {
      setDismissingId(null);
    }
  }

  async function handleUpdateAppStatus(id: string, status: JobApplicationStatus) {
    setOpError(null);
    try {
      const res = await fetch(withBasePath(`/api/jobs/applications/${id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to update application status.");

      setApps((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status } : a))
      );
      setStatusMessage(`Updated status to ${status.replace(/_/g, " ")}.`);
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err) {
      setOpError(err instanceof Error ? err.message : "Failed to update status.");
      throw err;
    }
  }

  async function handleSaveAppDetails(
    id: string,
    details: { notes: string; interview_date: string | null; follow_up_date: string | null }
  ) {
    setOpError(null);
    try {
      const res = await fetch(withBasePath(`/api/jobs/applications/${id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(details),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save application notes.");

      setApps((prev) =>
        prev.map((a) =>
          a.id === id
            ? {
                ...a,
                notes: details.notes,
                interview_date: details.interview_date,
                follow_up_date: details.follow_up_date,
              }
            : a
        )
      );
      setStatusMessage("Application notes & dates saved.");
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err) {
      setOpError(err instanceof Error ? err.message : "Failed to save details.");
      throw err;
    }
  }

  async function handleDeleteApp(id: string) {
    setOpError(null);
    try {
      const res = await fetch(withBasePath(`/api/jobs/applications/${id}`), {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to delete application.");

      setApps((prev) => prev.filter((a) => a.id !== id));
      setStatusMessage("Application record deleted.");
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err) {
      setOpError(err instanceof Error ? err.message : "Failed to delete application.");
      throw err;
    }
  }

  const filteredPending = useMemo(() => {
    let list = [...pendingActions];
    const q = searchQuery.trim().toLowerCase();

    if (q) {
      list = list.filter((a) => {
        const meta = (a.metadata || {}) as Record<string, any>;
        const title = (meta.job_title || a.action || "").toLowerCase();
        const company = (meta.company || "").toLowerCase();
        const location = (meta.location || "").toLowerCase();
        const reason = (a.reasoning || "").toLowerCase();
        const resume = (meta.suggested_resume || "").toLowerCase();
        return (
          title.includes(q) ||
          company.includes(q) ||
          location.includes(q) ||
          reason.includes(q) ||
          resume.includes(q)
        );
      });
    }

    if (scoreFilter === "starred") {
      list = list.filter((a) => starredIds.has(String(a.id)));
    } else if (scoreFilter === "deadline_soon") {
      list = list.filter((a) => {
        const meta = (a.metadata || {}) as Record<string, any>;
        const deadline = getDeadlineStatus(meta.closing_date);
        return deadline?.isSoon || deadline?.isExpired;
      });
    } else if (scoreFilter !== "all") {
      list = list.filter((a) => {
        const meta = (a.metadata || {}) as Record<string, any>;
        const score = meta.match_score ?? Math.round(Number(a.confidence) * 100);
        if (scoreFilter === "high") return score >= 80;
        if (scoreFilter === "good") return score >= 70 && score < 80;
        if (scoreFilter === "moderate") return score < 70;
        return true;
      });
    }

    list.sort((a, b) => {
      const metaA = (a.metadata || {}) as Record<string, any>;
      const metaB = (b.metadata || {}) as Record<string, any>;
      const scoreA = metaA.match_score ?? Math.round(Number(a.confidence) * 100);
      const scoreB = metaB.match_score ?? Math.round(Number(b.confidence) * 100);

      if (sortBy === "score_desc") return scoreB - scoreA;
      if (sortBy === "oldest") return (a.created_at || "").localeCompare(b.created_at || "");
      if (sortBy === "closing_soon") {
        const dateA = metaA.closing_date ? new Date(metaA.closing_date).getTime() : Infinity;
        const dateB = metaB.closing_date ? new Date(metaB.closing_date).getTime() : Infinity;
        return dateA - dateB;
      }
      return (b.created_at || "").localeCompare(a.created_at || "");
    });

    if (hideDuplicates) {
      const seenKeys = new Set<string>();
      const deduped: typeof list = [];

      for (const a of list) {
        const meta = (a.metadata || {}) as Record<string, any>;
        const cleanUrl = normalizeJobUrl(meta.job_url || meta.url);
        const title = normalizeString(meta.job_title || a.action);
        const company = normalizeString(meta.company);

        let key = "";
        if (cleanUrl) {
          key = `url_${cleanUrl}`;
        } else if (title && company) {
          key = `meta_${company}___${title}`;
        } else {
          key = `id_${a.id}`;
        }

        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          deduped.push(a);
        }
      }
      list = deduped;
    }

    return list;
  }, [pendingActions, searchQuery, scoreFilter, sortBy, starredIds, hideDuplicates]);

  const filteredApplications = useMemo(() => {
    let list = [...apps];
    const q = searchQuery.trim().toLowerCase();

    if (q) {
      list = list.filter((a) => {
        const role = (a.role || "").toLowerCase();
        const company = (a.company || "").toLowerCase();
        const notes = (a.notes || "").toLowerCase();
        const resume = (a.resume_version || "").toLowerCase();
        return (
          role.includes(q) ||
          company.includes(q) ||
          notes.includes(q) ||
          resume.includes(q)
        );
      });
    }

    if (appStageFilter !== "all") {
      if (appStageFilter === "applied") {
        list = list.filter((a) => a.status === "applied" || !a.status);
      } else if (appStageFilter === "interview") {
        list = list.filter((a) => a.status === "interview");
      } else if (appStageFilter === "offer") {
        list = list.filter((a) => a.status === "offer");
      } else if (appStageFilter === "rejected_archived") {
        list = list.filter(
          (a) => a.status === "rejected" || a.status === "no_response" || a.status === "withdrawn"
        );
      }
    }

    list.sort((a, b) => (b.date_applied || "").localeCompare(a.date_applied || ""));
    return list;
  }, [apps, searchQuery, appStageFilter]);

  const filteredApprovedActions = useMemo(() => {
    if (appStageFilter !== "all" && appStageFilter !== "applied") {
      return [];
    }
    let list = [...approvedActions];
    const q = searchQuery.trim().toLowerCase();

    if (q) {
      list = list.filter((a) => {
        const meta = (a.metadata || {}) as Record<string, any>;
        const title = (meta.job_title || a.action || "").toLowerCase();
        const company = (meta.company || "").toLowerCase();
        const reason = (a.reasoning || "").toLowerCase();
        return title.includes(q) || company.includes(q) || reason.includes(q);
      });
    }

    list.sort((a, b) => (b.executed_at || b.created_at || "").localeCompare(a.executed_at || a.created_at || ""));
    return list;
  }, [approvedActions, searchQuery, appStageFilter]);

  const allMatches = useMemo<UnifiedJobMatch[]>(() => {
    const list: UnifiedJobMatch[] = [];
    const seenUrls = new Set<string>();
    const seenKeys = new Set<string>();

    for (const m of matches) {
      const normUrl = m.url ? m.url.trim().toLowerCase() : "";
      const normKey = `${(m.title || "").trim().toLowerCase()}|${(m.company || "").trim().toLowerCase()}`;
      if (normUrl) seenUrls.add(normUrl);
      if (normKey !== "|") seenKeys.add(normKey);

      const matchingAction = actions.find((a) => {
        const meta = (a.metadata || {}) as Record<string, any>;
        if (meta.job_match_id && String(meta.job_match_id) === String(m.id)) return true;
        const aUrl = (meta.job_url || meta.url || "").trim().toLowerCase();
        if (aUrl && normUrl && aUrl === normUrl) return true;
        const aKey = `${(meta.job_title || a.action || "").trim().toLowerCase()}|${(meta.company || "").trim().toLowerCase()}`;
        if (aKey !== "|" && aKey === normKey) return true;
        return false;
      });

      const actionMeta = (matchingAction?.metadata || {}) as Record<string, any>;

      list.push({
        id: String(m.id),
        matchId: String(m.id),
        actionId: matchingAction?.id,
        title: m.title || actionMeta.job_title || "Job Posting",
        company: m.company || actionMeta.company || "",
        url: m.url || actionMeta.job_url || actionMeta.url || "",
        location: m.location || actionMeta.location || "",
        remote: m.remote,
        source: m.source || actionMeta.source || "n8n",
        score: m.score != null ? (m.score <= 10 ? m.score * 10 : m.score) : (actionMeta.match_score ?? null),
        reason: m.reason || matchingAction?.reasoning || "",
        status: m.status || (matchingAction?.status === "approved" || matchingAction?.status === "auto_executed" ? "applied" : matchingAction?.status === "rejected" ? "dismissed" : "new"),
        actionStatus: matchingAction?.status,
        found_at: m.found_at || matchingAction?.created_at || "",
        suggested_resume: actionMeta.suggested_resume,
        closing_date: actionMeta.closing_date,
      });
    }

    for (const a of actions) {
      const meta = (a.metadata || {}) as Record<string, any>;
      const aUrl = (meta.job_url || meta.url || "").trim().toLowerCase();
      const aKey = `${(meta.job_title || a.action || "").trim().toLowerCase()}|${(meta.company || "").trim().toLowerCase()}`;

      if (aUrl && seenUrls.has(aUrl)) continue;
      if (aKey !== "|" && seenKeys.has(aKey)) continue;

      if (aUrl) seenUrls.add(aUrl);
      if (aKey !== "|") seenKeys.add(aKey);

      const rawScore = meta.match_score ?? (meta.score != null ? meta.score : (a.confidence ? Math.round(Number(a.confidence) * 100) : null));
      const score = rawScore != null ? (rawScore <= 10 ? rawScore * 10 : rawScore) : null;

      const matchStatus: "new" | "applied" | "dismissed" = (a.status === "approved" || a.status === "auto_executed")
        ? "applied"
        : a.status === "rejected"
        ? "dismissed"
        : "new";

      list.push({
        id: String(a.id),
        actionId: a.id,
        title: meta.job_title || a.action.replace(/^Apply to\s+/i, "").replace(/_/g, " "),
        company: meta.company || "",
        url: meta.job_url || meta.url || "",
        location: meta.location || "",
        remote: typeof meta.remote === "boolean" ? meta.remote : null,
        source: meta.source || "TopJobs",
        score,
        reason: a.reasoning || "",
        status: matchStatus,
        actionStatus: a.status,
        found_at: a.created_at || "",
        suggested_resume: meta.suggested_resume,
        closing_date: meta.closing_date,
      });
    }

    return list;
  }, [matches, actions]);

  const filteredMatches = useMemo(() => {
    let list = [...allMatches];
    const q = searchQuery.trim().toLowerCase();

    if (q) {
      list = list.filter((m) => {
        const title = (m.title || "").toLowerCase();
        const company = (m.company || "").toLowerCase();
        const location = (m.location || "").toLowerCase();
        const reason = (m.reason || "").toLowerCase();
        const source = (m.source || "").toLowerCase();
        const resume = (m.suggested_resume || "").toLowerCase();
        return (
          title.includes(q) ||
          company.includes(q) ||
          location.includes(q) ||
          reason.includes(q) ||
          source.includes(q) ||
          resume.includes(q)
        );
      });
    }

    if (scoreFilter === "starred") {
      list = list.filter((m) => starredIds.has(m.id));
    } else if (scoreFilter === "deadline_soon") {
      list = list.filter((m) => {
        const deadline = getDeadlineStatus(m.closing_date);
        return deadline?.isSoon || deadline?.isExpired;
      });
    } else if (scoreFilter !== "all") {
      list = list.filter((m) => {
        const score = m.score != null ? (m.score <= 10 ? m.score * 10 : m.score) : 0;
        if (scoreFilter === "high") return score >= 80;
        if (scoreFilter === "good") return score >= 70 && score < 80;
        if (scoreFilter === "moderate") return score < 70;
        return true;
      });
    }

    list.sort((a, b) => {
      const scoreA = a.score != null ? (a.score <= 10 ? a.score * 10 : a.score) : 0;
      const scoreB = b.score != null ? (b.score <= 10 ? b.score * 10 : b.score) : 0;

      if (sortBy === "score_desc") return scoreB - scoreA;
      if (sortBy === "oldest") return (a.found_at || "").localeCompare(b.found_at || "");
      if (sortBy === "closing_soon") {
        const dateA = a.closing_date ? new Date(a.closing_date).getTime() : Infinity;
        const dateB = b.closing_date ? new Date(b.closing_date).getTime() : Infinity;
        return dateA - dateB;
      }
      return (b.found_at || "").localeCompare(a.found_at || "");
    });

    if (hideDuplicates) {
      const seenKeys = new Set<string>();
      const deduped: typeof list = [];

      for (const m of list) {
        const cleanUrl = normalizeJobUrl(m.url);
        const title = normalizeString(m.title);
        const company = normalizeString(m.company);

        let key = "";
        if (cleanUrl) {
          key = `url_${cleanUrl}`;
        } else if (title && company) {
          key = `meta_${company}___${title}`;
        } else {
          key = `id_${m.id}`;
        }

        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          deduped.push(m);
        }
      }
      list = deduped;
    }

    return list;
  }, [allMatches, searchQuery, scoreFilter, sortBy, starredIds, hideDuplicates]);

  const tabs = [
    { key: "pending" as const, label: "Awaiting Approval", count: pendingActions.length },
    { key: "applications" as const, label: "Applications Sent", count: apps.length + approvedActions.length },
    { key: "matches" as const, label: "All Scored Matches", count: allMatches.length },
  ];

  const hasActiveFilters =
    searchQuery.trim().length > 0 ||
    scoreFilter !== "all" ||
    appStageFilter !== "all" ||
    sortBy !== "newest";

  function clearFilters() {
    setSearchQuery("");
    setScoreFilter("all");
    setAppStageFilter("all");
    setSortBy("newest");
  }

  function handleSelectAll() {
    setSelectedIds(new Set(filteredPending.map((a) => a.id)));
  }

  function handleDeselectAll() {
    setSelectedIds(new Set());
  }

  return (
    <div className="space-y-3.5 sm:space-y-4">
      <div className="no-scrollbar -mx-1 max-w-full overflow-x-auto px-1">
        <div className="inline-flex min-w-full gap-1 rounded-xl bg-primary/[0.04] p-1 sm:min-w-0">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => {
                setTab(t.key);
                setSelectionMode(false);
                setSelectedIds(new Set());
              }}
              aria-pressed={tab === t.key}
              className={`press flex-1 shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-center text-xs transition-colors sm:flex-initial sm:px-4 sm:py-2 ${
                tab === t.key
                  ? "bg-raised font-medium text-primary shadow-sm"
                  : "text-secondary hover:text-primary"
              }`}
            >
              {t.label}
              <span className="tnum ml-1.5 text-muted sm:ml-2">{t.count}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded-xl bg-primary/[0.02] p-2.5 ring-1 ring-inset ring-hairline/10 sm:p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2.5">
          <div className="relative flex-1">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5 text-muted">
              <IconSearch className="h-3.5 w-3.5" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title, company, skills, or location..."
              className="field h-8 w-full pl-8 pr-7 text-xs sm:h-9"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                aria-label="Clear search"
                className="press absolute inset-y-0 right-0 flex items-center pr-2.5 text-muted hover:text-primary"
              >
                <IconX className="h-3 w-3" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="field select-field h-8 min-w-[125px] text-2xs sm:h-9 sm:text-xs"
            >
              <option value="newest">Newest First</option>
              <option value="score_desc">Highest Fit</option>
              <option value="closing_soon">Closing Soon</option>
              <option value="oldest">Oldest First</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-1.5 pt-0.5">
          {tab !== "applications" ? (
            <div className="no-scrollbar -mx-0.5 flex max-w-full items-center gap-1 overflow-x-auto px-0.5 sm:gap-1.5">
              <span className="text-2xs font-semibold uppercase tracking-wider text-muted mr-0.5 shrink-0 hidden xs:inline">
                Fit:
              </span>
              {(
                [
                  { key: "all", label: "All Scores" },
                  { key: "high", label: "≥80% Top Fit" },
                  { key: "good", label: "70–79% Good" },
                  { key: "moderate", label: "<70% Moderate" },
                  { key: "starred", label: `⭐ Starred (${starredIds.size})` },
                  { key: "deadline_soon", label: "⏳ Closing Soon" },
                ] as const
              ).map((chip) => {
                const active = scoreFilter === chip.key;
                return (
                  <button
                    key={chip.key}
                    onClick={() => setScoreFilter(chip.key)}
                    aria-pressed={active}
                    className={`press shrink-0 whitespace-nowrap rounded-md px-2 py-0.5 text-2xs transition-colors sm:px-2.5 sm:py-1 ${
                      active
                        ? "bg-accent/12 font-medium text-accent-ink ring-1 ring-inset ring-accent/25"
                        : "text-secondary ring-1 ring-inset ring-hairline/10 hover:text-primary"
                    }`}
                  >
                    {chip.label}
                  </button>
                );
              })}

              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="press ml-auto shrink-0 text-2xs font-medium text-accent-ink hover:underline"
                >
                  Reset
                </button>
              )}
            </div>
          ) : (
            <div className="no-scrollbar -mx-0.5 flex max-w-full items-center gap-1 overflow-x-auto px-0.5 sm:gap-1.5">
              <span className="text-2xs font-semibold uppercase tracking-wider text-muted mr-0.5 shrink-0 hidden xs:inline">
                Stage:
              </span>
              {(
                [
                  { key: "all" as const, label: `All (${appMetrics.total})` },
                  { key: "applied" as const, label: `Applied (${appMetrics.applied})` },
                  { key: "interview" as const, label: `Interviewing (${appMetrics.interviewing})` },
                  { key: "offer" as const, label: `Offers (${appMetrics.offers})` },
                  { key: "rejected_archived" as const, label: `Closed (${appMetrics.rejected})` },
                ] as const
              ).map((chip) => {
                const active = appStageFilter === chip.key;
                return (
                  <button
                    key={chip.key}
                    onClick={() => setAppStageFilter(chip.key)}
                    aria-pressed={active}
                    className={`press shrink-0 whitespace-nowrap rounded-md px-2 py-0.5 text-2xs transition-colors sm:px-2.5 sm:py-1 ${
                      active
                        ? "bg-accent/12 font-medium text-accent-ink ring-1 ring-inset ring-accent/25"
                        : "text-secondary ring-1 ring-inset ring-hairline/10 hover:text-primary"
                    }`}
                  >
                    {chip.label}
                  </button>
                );
              })}

              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="press ml-auto shrink-0 text-2xs font-medium text-accent-ink hover:underline"
                >
                  Reset
                </button>
              )}
            </div>
          )}

          {tab === "pending" && (
            <div className="flex flex-wrap items-center gap-1.5 ml-auto">
              {lowScoreActions.length > 0 && (
                <button
                  type="button"
                  disabled={isBulkDismissing}
                  onClick={() =>
                    handleBulkDismiss(
                      lowScoreActions.map((a) => a.id),
                      `Dismissed ${lowScoreActions.length} low-fit (<60%) jobs.`
                    )
                  }
                  className="press inline-flex items-center gap-1 rounded-md bg-warn/10 px-2 py-0.5 text-2xs font-medium text-warn-ink ring-1 ring-inset ring-warn/25 hover:bg-warn/15"
                  title="Dismiss all pending jobs scoring below 60%"
                >
                  ⚡ Dismiss &lt;60% ({lowScoreActions.length})
                </button>
              )}

              {staleActions.length > 0 && (
                <button
                  type="button"
                  disabled={isBulkDismissing}
                  onClick={() =>
                    handleBulkDismiss(
                      staleActions.map((a) => a.id),
                      `Cleared ${staleActions.length} stale jobs older than 14 days.`
                    )
                  }
                  className="press inline-flex items-center gap-1 rounded-md bg-danger/10 px-2 py-0.5 text-2xs font-medium text-danger-ink ring-1 ring-inset ring-danger/25 hover:bg-danger/15"
                  title="Dismiss unreviewed jobs discovered over 14 days ago"
                >
                  🧹 Clear Stale &gt;14d ({staleActions.length})
                </button>
              )}

              {/* Toggle Switch: Show All vs Hide Duplicates (Default: Show All / Switch Off) */}
              <label
                className="press inline-flex cursor-pointer select-none items-center gap-1.5 rounded-md bg-primary/[0.04] px-2 py-0.5 text-2xs font-medium text-secondary ring-1 ring-inset ring-hairline/15 hover:bg-primary/[0.08] hover:text-primary"
                title={
                  hideDuplicates
                    ? "Currently hiding duplicate postings. Click to show all."
                    : "Currently showing all postings. Click to hide duplicates."
                }
              >
                <span>{hideDuplicates ? "Hide Duplicates (On)" : "Hide Duplicates"}</span>
                <input
                  type="checkbox"
                  checked={hideDuplicates}
                  onChange={(e) => setHideDuplicates(e.target.checked)}
                  className="sr-only"
                />
                <div
                  className={`relative inline-flex h-3.5 w-6 shrink-0 items-center rounded-full transition-colors ${
                    hideDuplicates ? "bg-accent-solid" : "bg-primary/[0.18]"
                  }`}
                >
                  <span
                    className={`inline-block h-2.5 w-2.5 transform rounded-full bg-white shadow-xs transition-transform ${
                      hideDuplicates ? "translate-x-3" : "translate-x-0.5"
                    }`}
                  />
                </div>
              </label>

              <button
                type="button"
                disabled={isDeduplicating}
                onClick={handleCleanupDuplicates}
                className="press inline-flex items-center gap-1 rounded-md bg-primary/[0.05] px-2 py-0.5 text-2xs font-medium text-secondary ring-1 ring-inset ring-hairline/15 hover:bg-primary/[0.08] hover:text-primary"
                title="Permanently find and merge duplicate job postings for this account in the database"
              >
                {isDeduplicating ? "Deduplicating..." : "✨ Deduplicate"}
              </button>
            </div>
          )}
        </div>
      </div>

      {selectionMode && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-accent-solid p-2.5 text-white shadow-md animate-slide-down">
          <div className="flex items-center gap-2 text-xs font-semibold">
            <span>Selected: {selectedIds.size} of {filteredPending.length}</span>
            <button
              type="button"
              onClick={selectedIds.size === filteredPending.length ? handleDeselectAll : handleSelectAll}
              className="text-2xs underline opacity-90 hover:opacity-100"
            >
              {selectedIds.size === filteredPending.length ? "Deselect all" : "Select all"}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="reject"
              size="sm"
              disabled={selectedIds.size === 0 || isBulkDismissing}
              onClick={() =>
                handleBulkDismiss(
                  Array.from(selectedIds),
                  `Dismissed ${selectedIds.size} selected jobs.`
                )
              }
              className="h-7 px-3 text-2xs"
            >
              {isBulkDismissing ? "Dismissing..." : `Dismiss Selected (${selectedIds.size})`}
            </Button>

            <button
              type="button"
              onClick={() => {
                setSelectionMode(false);
                setSelectedIds(new Set());
              }}
              className="rounded-md bg-white/20 px-2.5 py-1 text-2xs font-medium hover:bg-white/30"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {statusMessage && (
        <div className="rounded-xl bg-ok/10 px-3 py-2 text-xs font-medium text-ok-ink ring-1 ring-ok/20">
          {statusMessage}
        </div>
      )}

      {opError && <ErrorNote>{opError}</ErrorNote>}
      {actionsError && <ErrorNote>{actionsError}</ErrorNote>}
      {matchesError && <ErrorNote>{matchesError}</ErrorNote>}
      {applicationsError && <ErrorNote>{applicationsError}</ErrorNote>}

      {tab === "pending" && (
        pendingActions.length === 0 ? (
          <EmptyState
            title="No jobs waiting for approval"
            body="The autonomous matcher runs daily and flags vacancies scoring ≥ 70%. When new matching software roles are discovered, they appear here for your one-click approval."
          />
        ) : filteredPending.length === 0 ? (
          <EmptyState
            title="No jobs match your search filters"
            body="Try adjusting your search keywords or match score filter to see more results."
            action={
              <Button size="sm" onClick={clearFilters}>
                Clear search & filters
              </Button>
            }
          />
        ) : (
          <div className="space-y-2.5 sm:space-y-3">
            <div className="flex items-center justify-between px-1 text-2xs text-muted">
              <span>
                Showing <strong className="font-semibold text-primary">{filteredPending.length}</strong> of {pendingActions.length} pending {pendingActions.length === 1 ? "job" : "jobs"}
                {hideDuplicates && pendingActions.length > filteredPending.length && (
                  <span className="ml-1 font-medium text-accent-ink">
                    ({pendingActions.length - filteredPending.length} duplicates hidden)
                  </span>
                )}
              </span>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setSelectionMode((v) => !v);
                    setSelectedIds(new Set());
                  }}
                  className={`press rounded-md px-2 py-0.5 text-2xs font-medium transition-colors ${
                    selectionMode
                      ? "bg-accent/15 text-accent-ink ring-1 ring-accent/30"
                      : "text-secondary hover:text-primary ring-1 ring-hairline/10"
                  }`}
                >
                  {selectionMode ? "Exit Select" : "Select"}
                </button>

                <div className="flex items-center gap-0.5 rounded-lg bg-primary/[0.04] p-0.5 ring-1 ring-inset ring-hairline/10">
                  <button
                    type="button"
                    onClick={() => setViewMode("grid")}
                    aria-label="Grid view"
                    title="Grid view"
                    className={`press flex items-center gap-1 rounded-md px-2 py-0.5 text-2xs font-medium transition-colors ${
                      viewMode === "grid"
                        ? "bg-raised text-primary shadow-xs"
                        : "text-muted hover:text-primary"
                    }`}
                  >
                    <IconGrid className="h-3 w-3" />
                    <span className="hidden sm:inline">Grid</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("list")}
                    aria-label="List view"
                    title="List view"
                    className={`press flex items-center gap-1 rounded-md px-2 py-0.5 text-2xs font-medium transition-colors ${
                      viewMode === "list"
                        ? "bg-raised text-primary shadow-xs"
                        : "text-muted hover:text-primary"
                    }`}
                  >
                    <IconList className="h-3 w-3" />
                    <span className="hidden sm:inline">List</span>
                  </button>
                </div>
              </div>
            </div>

            <div
              className={
                viewMode === "grid"
                  ? "grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 items-start"
                  : "space-y-2.5 sm:space-y-3"
              }
            >
              {filteredPending.map((a) => (
                <PendingApprovalRow
                  key={a.id}
                  action={a}
                  onDismiss={handleDismissAction}
                  dismissing={dismissingId === a.id}
                  viewMode={viewMode}
                  isStarred={starredIds.has(String(a.id))}
                  onToggleStar={toggleStar}
                  selectionMode={selectionMode}
                  isSelected={selectedIds.has(a.id)}
                  onToggleSelect={toggleSelect}
                />
              ))}
            </div>
          </div>
        )
      )}

      {tab === "applications" && (
        apps.length === 0 && approvedActions.length === 0 ? (
          <EmptyState
            title="No applications sent yet"
            body="When you approve a job from the queue, Second Brain attaches your selected PDF resume and dispatches the application email through Google SMTP."
          />
        ) : filteredApplications.length === 0 && filteredApprovedActions.length === 0 ? (
          <EmptyState
            title="No applications match your filter"
            body="Try selecting a different stage filter or clearing your search."
            action={
              <Button size="sm" onClick={clearFilters}>
                Clear search & stage filters
              </Button>
            }
          />
        ) : (
          <div className="space-y-3 sm:space-y-3.5">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-2.5">
              <div className="rounded-xl bg-primary/[0.03] p-2.5 ring-1 ring-inset ring-hairline/10">
                <span className="text-2xs font-semibold uppercase tracking-wider text-muted">Sent</span>
                <p className="mt-0.5 text-lg font-bold text-primary">{appMetrics.total}</p>
              </div>
              <div className="rounded-xl bg-violet/10 p-2.5 ring-1 ring-inset ring-violet/20">
                <span className="text-2xs font-semibold uppercase tracking-wider text-violet-ink">Interviews</span>
                <p className="mt-0.5 text-lg font-bold text-violet-ink">{appMetrics.interviewing}</p>
              </div>
              <div className="rounded-xl bg-ok/10 p-2.5 ring-1 ring-inset ring-ok/20">
                <span className="text-2xs font-semibold uppercase tracking-wider text-ok-ink">Offers</span>
                <p className="mt-0.5 text-lg font-bold text-ok-ink">{appMetrics.offers}</p>
              </div>
              <div className="rounded-xl bg-accent/10 p-2.5 ring-1 ring-inset ring-accent/20">
                <span className="text-2xs font-semibold uppercase tracking-wider text-accent-ink">Response Rate</span>
                <p className="mt-0.5 text-lg font-bold text-accent-ink">{appMetrics.interviewRate}%</p>
              </div>
            </div>

            <div className="flex items-center justify-between px-1 text-2xs text-muted">
              <span>
                Showing <strong className="font-semibold text-primary">{filteredApplications.length + filteredApprovedActions.length}</strong> applications
              </span>

              <div className="flex items-center gap-0.5 rounded-lg bg-primary/[0.04] p-0.5 ring-1 ring-inset ring-hairline/10">
                <button
                  type="button"
                  onClick={() => setViewMode("grid")}
                  aria-label="Grid view"
                  title="Grid view"
                  className={`press flex items-center gap-1 rounded-md px-2 py-0.5 text-2xs font-medium transition-colors ${
                    viewMode === "grid"
                      ? "bg-raised text-primary shadow-xs"
                      : "text-muted hover:text-primary"
                  }`}
                >
                  <IconGrid className="h-3 w-3" />
                  <span className="hidden sm:inline">Grid</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  aria-label="List view"
                  title="List view"
                  className={`press flex items-center gap-1 rounded-md px-2 py-0.5 text-2xs font-medium transition-colors ${
                    viewMode === "list"
                      ? "bg-raised text-primary shadow-xs"
                      : "text-muted hover:text-primary"
                  }`}
                >
                  <IconList className="h-3 w-3" />
                  <span className="hidden sm:inline">List</span>
                </button>
              </div>
            </div>

            <div
              className={
                viewMode === "grid"
                  ? "grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 items-start"
                  : "space-y-2.5 sm:space-y-3"
              }
            >
              {filteredApplications.map((a) => (
                <ApplicationCard
                  key={a.id}
                  app={a}
                  onUpdateStatus={handleUpdateAppStatus}
                  onSaveDetails={handleSaveAppDetails}
                  onDelete={handleDeleteApp}
                  viewMode={viewMode}
                />
              ))}

              {filteredApprovedActions.map((action) => {
                const meta = (action.metadata || {}) as Record<string, any>;
                return (
                  <Card key={`act-${action.id}`} className="flex flex-col justify-between p-3.5 sm:p-4">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <Badge tone="ok">Approved & Sent</Badge>
                        {action.executed_at && (
                          <span className="shrink-0 text-2xs text-muted">
                            {relativeTime(action.executed_at)}
                          </span>
                        )}
                      </div>
                      <p className="mt-2 text-sm font-semibold text-primary">
                        {meta.job_title || action.action}
                      </p>
                      <p className="truncate text-xs text-muted">
                        {meta.company}
                        {meta.suggested_resume && ` · 📄 ${meta.suggested_resume}`}
                      </p>
                      {action.reasoning && (
                        <p className="mt-2 text-xs leading-relaxed text-secondary">{action.reasoning}</p>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        )
      )}

      {tab === "matches" && (
        allMatches.length === 0 ? (
          <EmptyState
            title="No matches recorded yet"
            body="Job matches discovered by n8n and scored by the AI Gateway will appear here."
          />
        ) : filteredMatches.length === 0 ? (
          <EmptyState
            title="No matches match your filters"
            body="Try adjusting your search query or fit score filter."
            action={
              <Button size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <div className="space-y-2.5 sm:space-y-3">
            <div className="flex items-center justify-between px-1 text-2xs text-muted">
              <span>
                Showing <strong className="font-semibold text-primary">{filteredMatches.length}</strong> of {allMatches.length} matches
                {hideDuplicates && allMatches.length > filteredMatches.length && (
                  <span className="ml-1 font-medium text-accent-ink">
                    ({allMatches.length - filteredMatches.length} duplicates hidden)
                  </span>
                )}
              </span>

              <div className="flex items-center gap-0.5 rounded-lg bg-primary/[0.04] p-0.5 ring-1 ring-inset ring-hairline/10">
                <button
                  type="button"
                  onClick={() => setViewMode("grid")}
                  aria-label="Grid view"
                  title="Grid view"
                  className={`press flex items-center gap-1 rounded-md px-2 py-0.5 text-2xs font-medium transition-colors ${
                    viewMode === "grid"
                      ? "bg-raised text-primary shadow-xs"
                      : "text-muted hover:text-primary"
                  }`}
                >
                  <IconGrid className="h-3 w-3" />
                  <span className="hidden sm:inline">Grid</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  aria-label="List view"
                  title="List view"
                  className={`press flex items-center gap-1 rounded-md px-2 py-0.5 text-2xs font-medium transition-colors ${
                    viewMode === "list"
                      ? "bg-raised text-primary shadow-xs"
                      : "text-muted hover:text-primary"
                  }`}
                >
                  <IconList className="h-3 w-3" />
                  <span className="hidden sm:inline">List</span>
                </button>
              </div>
            </div>

            <div
              className={
                viewMode === "grid"
                  ? "grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 items-start"
                  : "space-y-2.5 sm:space-y-3"
              }
            >
              {filteredMatches.map((m) => (
                <ScoredMatchRow
                  key={m.id}
                  match={m}
                  onDismiss={handleDismissUnifiedMatch}
                  dismissing={dismissingId === m.id}
                  viewMode={viewMode}
                  isStarred={starredIds.has(m.id)}
                  onToggleStar={toggleStar}
                />
              ))}
            </div>
          </div>
        )
      )}
    </div>
  );
}
