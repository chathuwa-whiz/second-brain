"use client";

import { useMemo, useState } from "react";
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
  IconX,
} from "@/components/icons";
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

const MATCH_STATUS_TONE: Record<string, Tone> = {
  new: "warn",
  applied: "ok",
  dismissed: "neutral",
};

type ScoreFilter = "all" | "high" | "good" | "moderate";
type SortOption = "newest" | "score_desc" | "oldest";
type ViewMode = "grid" | "list";

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
}: {
  action: AgentAction;
  onDismiss: (id: string | number) => void;
  dismissing: boolean;
  viewMode?: ViewMode;
}) {
  const meta = (action.metadata || {}) as Record<string, any>;
  const score = meta.match_score || Math.round(Number(action.confidence) * 100);

  if (viewMode === "grid") {
    return (
      <Card className="flex flex-col justify-between p-3.5 sm:p-4 transition-all">
        <div>
          {/* Card Header: Score + Title + Resume */}
          <div className="flex items-start gap-3">
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
          </div>

          {/* Badges / Meta row */}
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {meta.suggested_resume && (
              <div className="inline-flex min-w-0 max-w-[180px] items-center gap-1 rounded-md bg-accent/10 px-2 py-0.5 text-2xs font-medium text-accent-ink">
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

          {meta.closing_date && (
            <p className="mt-2 text-2xs text-muted">
              Closes: <span className="font-medium text-secondary">{meta.closing_date}</span>
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
    <Card className="min-w-0 p-3 sm:p-4">
      <div className="flex flex-col gap-2.5 min-w-0 sm:flex-row sm:items-start sm:gap-3.5">
        <div className="flex items-center justify-between gap-2 min-w-0 sm:flex-col sm:items-center sm:justify-start sm:gap-1">
          <ScorePip score={score} />
          {meta.suggested_resume && (
            <div className="flex min-w-0 max-w-[200px] items-center gap-1 rounded-lg bg-accent/10 px-2 py-0.5 text-2xs font-medium text-accent-ink sm:hidden">
              <span className="shrink-0">📄</span>
              <span className="truncate">{meta.suggested_resume}</span>
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
            <div className="min-w-0 flex-1">
              <p className="break-words text-sm font-semibold tracking-tight text-primary">
                {meta.job_title || action.action.replace(/_/g, " ")}
              </p>
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

          {meta.closing_date && (
            <p className="mt-1.5 text-2xs text-muted">
              Closing date: <span className="font-medium text-secondary">{meta.closing_date}</span>
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
}: {
  match: JobMatch;
  onDismiss: (id: string) => void;
  dismissing: boolean;
  viewMode?: ViewMode;
}) {
  const normalizedScore = match.score != null ? (match.score <= 10 ? match.score * 10 : match.score) : null;

  if (viewMode === "grid") {
    return (
      <Card className="flex flex-col justify-between p-3.5 sm:p-4">
        <div>
          <div className="flex items-start gap-3">
            <ScorePip score={normalizedScore} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge tone={MATCH_STATUS_TONE[match.status] ?? "neutral"}>
                  {match.status}
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
          </div>

          {match.reason && (
            <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-secondary" title={match.reason}>
              {match.reason}
            </p>
          )}

          {match.found_at && (
            <p className="mt-2 text-2xs text-muted">
              Discovered {relativeTime(match.found_at)}
            </p>
          )}
        </div>

        <div className="mt-3 flex items-center justify-between gap-2 border-t pt-2.5">
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

          {match.status === "new" && (
            <Button
              variant="quiet"
              size="sm"
              disabled={dismissing}
              onClick={() => onDismiss(match.id)}
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
    <Card className="min-w-0 p-3 sm:p-4">
      <div className="flex flex-col gap-3 min-w-0 sm:flex-row sm:items-start sm:gap-3.5">
        <ScorePip score={normalizedScore} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={MATCH_STATUS_TONE[match.status] ?? "neutral"}>
                  {match.status}
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
              <p className="mt-1 break-words text-sm font-semibold text-primary sm:text-base">
                {match.title}
              </p>
              <p className="mt-0.5 truncate text-xs text-muted">
                {match.company || "Employer"}
                {match.location && ` · 📍 ${match.location}`}
                {match.found_at && ` · Discovered ${relativeTime(match.found_at)}`}
              </p>
            </div>
          </div>

          {match.reason && (
            <p className="mt-2 break-words text-xs leading-relaxed text-secondary">
              {match.reason}
            </p>
          )}

          <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t pt-2">
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

            {match.status === "new" && (
              <Button
                variant="quiet"
                size="sm"
                disabled={dismissing}
                onClick={() => onDismiss(match.id)}
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
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [dismissingId, setDismissingId] = useState<string | number | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [opError, setOpError] = useState<string | null>(null);

  const pendingActions = useMemo(
    () => actions.filter((a) => a.status === "pending"),
    [actions]
  );
  const approvedActions = useMemo(
    () => actions.filter((a) => a.status === "approved" || a.status === "auto_executed"),
    [actions]
  );

  // 1-Click Quick Dismiss for pending AgentAction
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

  // 1-Click Quick Dismiss for JobMatch in All Scored Matches
  async function handleDismissMatch(matchId: string) {
    setDismissingId(matchId);
    setOpError(null);
    try {
      const res = await fetch(withBasePath(`/api/jobs/${matchId}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "dismissed" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to dismiss match.");

      setMatches((prev) =>
        prev.map((m) => (m.id === matchId ? { ...m, status: "dismissed" } : m))
      );
      setStatusMessage("Job match marked as dismissed.");
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err) {
      setOpError(err instanceof Error ? err.message : "Failed to dismiss match.");
    } finally {
      setDismissingId(null);
    }
  }

  // Filter and Sort pending actions
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

    if (scoreFilter !== "all") {
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
      return (b.created_at || "").localeCompare(a.created_at || "");
    });

    return list;
  }, [pendingActions, searchQuery, scoreFilter, sortBy]);

  // Filter and Sort Applications Sent
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

    list.sort((a, b) => (b.date_applied || "").localeCompare(a.date_applied || ""));
    return list;
  }, [apps, searchQuery]);

  const filteredApprovedActions = useMemo(() => {
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
  }, [approvedActions, searchQuery]);

  // Filter and Sort All Scored Matches
  const filteredMatches = useMemo(() => {
    let list = [...matches];
    const q = searchQuery.trim().toLowerCase();

    if (q) {
      list = list.filter((m) => {
        const title = (m.title || "").toLowerCase();
        const company = (m.company || "").toLowerCase();
        const location = (m.location || "").toLowerCase();
        const reason = (m.reason || "").toLowerCase();
        const source = (m.source || "").toLowerCase();
        return (
          title.includes(q) ||
          company.includes(q) ||
          location.includes(q) ||
          reason.includes(q) ||
          source.includes(q)
        );
      });
    }

    if (scoreFilter !== "all") {
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
      return (b.found_at || "").localeCompare(a.found_at || "");
    });

    return list;
  }, [matches, searchQuery, scoreFilter, sortBy]);

  const tabs = [
    { key: "pending" as const, label: "Awaiting Approval", count: pendingActions.length },
    { key: "applications" as const, label: "Applications Sent", count: apps.length + approvedActions.length },
    { key: "matches" as const, label: "All Scored Matches", count: matches.length > 0 ? matches.length : actions.length },
  ];

  const hasActiveFilters = searchQuery.trim().length > 0 || scoreFilter !== "all" || sortBy !== "newest";

  function clearFilters() {
    setSearchQuery("");
    setScoreFilter("all");
    setSortBy("newest");
  }

  return (
    <div className="space-y-3.5 sm:space-y-4">
      {/* Top Tabs Bar */}
      <div className="no-scrollbar -mx-1 max-w-full overflow-x-auto px-1">
        <div className="inline-flex min-w-full gap-1 rounded-xl bg-primary/[0.04] p-1 sm:min-w-0">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
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

      {/* Compact Streamlined Search & Filter Bar */}
      <div className="flex flex-col gap-2 rounded-xl bg-primary/[0.02] p-2.5 ring-1 ring-inset ring-hairline/10 sm:p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2.5">
          {/* Search Input */}
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

          {/* Sort Selector */}
          <div className="flex items-center gap-1.5 shrink-0">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="field select-field h-8 min-w-[125px] text-2xs sm:h-9 sm:text-xs"
            >
              <option value="newest">Newest First</option>
              <option value="score_desc">Highest Fit</option>
              <option value="oldest">Oldest First</option>
            </select>
          </div>
        </div>

        {/* Score Filter Chips (applicable for Pending and Matches tabs) */}
        {tab !== "applications" && (
          <div className="no-scrollbar -mx-0.5 flex max-w-full items-center gap-1 overflow-x-auto px-0.5 pt-0.5 sm:gap-1.5">
            <span className="text-2xs font-semibold uppercase tracking-wider text-muted mr-0.5 shrink-0 hidden xs:inline">
              Fit:
            </span>
            {(
              [
                { key: "all", label: "All Scores" },
                { key: "high", label: "≥80% Top Fit" },
                { key: "good", label: "70–79% Good" },
                { key: "moderate", label: "<70% Moderate" },
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
        )}
      </div>

      {statusMessage && (
        <div className="rounded-xl bg-ok/10 px-3 py-2 text-xs font-medium text-ok-ink ring-1 ring-ok/20">
          {statusMessage}
        </div>
      )}

      {opError && <ErrorNote>{opError}</ErrorNote>}
      {actionsError && <ErrorNote>{actionsError}</ErrorNote>}
      {matchesError && <ErrorNote>{matchesError}</ErrorNote>}
      {applicationsError && <ErrorNote>{applicationsError}</ErrorNote>}

      {/* Tab 1: Pending Approvals */}
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
            {/* Results Counter & View Switcher Toolbar */}
            <div className="flex items-center justify-between px-1 text-2xs text-muted">
              <span>
                Showing <strong className="font-semibold text-primary">{filteredPending.length}</strong> of {pendingActions.length} pending {pendingActions.length === 1 ? "job" : "jobs"}
              </span>

              {/* View Switcher Toggle */}
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

            {/* Jobs Container (Grid or List) */}
            <div
              className={
                viewMode === "grid"
                  ? "grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3"
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
                />
              ))}
            </div>
          </div>
        )
      )}

      {/* Tab 2: Applications Sent */}
      {tab === "applications" && (
        apps.length === 0 && approvedActions.length === 0 ? (
          <EmptyState
            title="No applications sent yet"
            body="When you approve a job from the queue, Second Brain attaches your selected PDF resume and dispatches the application email through Google SMTP."
          />
        ) : filteredApplications.length === 0 && filteredApprovedActions.length === 0 ? (
          <EmptyState
            title="No applications match your search"
            body="Try searching for a different company or job title."
            action={
              <Button size="sm" onClick={clearFilters}>
                Clear search
              </Button>
            }
          />
        ) : (
          <div className="space-y-2.5 sm:space-y-3">
            {/* Results Counter & View Switcher */}
            <div className="flex items-center justify-between px-1 text-2xs text-muted">
              <span>
                Showing <strong className="font-semibold text-primary">{filteredApplications.length + filteredApprovedActions.length}</strong> sent applications
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
                  ? "grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3"
                  : "space-y-2.5 sm:space-y-3"
              }
            >
              {/* MongoDB logged applications */}
              {filteredApplications.map((a) => (
                <Card key={a.id} className="flex flex-col justify-between p-3 sm:p-4">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <Badge tone={APP_STATUS_TONE[a.status] ?? "neutral"}>
                        {a.status.replace(/_/g, " ")}
                      </Badge>
                      {a.date_applied && (
                        <span className="shrink-0 text-2xs text-muted">
                          {relativeTime(a.date_applied)}
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-sm font-semibold text-primary">
                      {a.role}
                    </p>
                    <p className="truncate text-xs text-muted">
                      {a.company}
                      {a.resume_version && ` · ${a.resume_version}`}
                    </p>
                    {a.notes && (
                      <p className="mt-2 text-xs leading-relaxed text-secondary">{a.notes}</p>
                    )}
                  </div>
                  {a.job_url && (
                    <div className="mt-3 border-t pt-2">
                      <a
                        href={a.job_url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="inline-flex items-center gap-1 text-xs font-medium text-accent-ink hover:underline"
                      >
                        Open posting
                        <IconExternal className="h-3 w-3" />
                      </a>
                    </div>
                  )}
                </Card>
              ))}

              {/* Approved actions not yet in MongoDB */}
              {filteredApprovedActions.map((action) => {
                const meta = (action.metadata || {}) as Record<string, any>;
                return (
                  <Card key={`act-${action.id}`} className="flex flex-col justify-between p-3 sm:p-4">
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
                        {meta.suggested_resume && ` · ${meta.suggested_resume}`}
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

      {/* Tab 3: All Scored Matches */}
      {tab === "matches" && (
        matches.length === 0 && actions.length === 0 ? (
          <EmptyState
            title="No matches recorded yet"
            body="Job matches discovered by n8n and scored by the AI Gateway will appear here."
          />
        ) : matches.length > 0 ? (
          filteredMatches.length === 0 ? (
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
              {/* Results Counter & View Switcher */}
              <div className="flex items-center justify-between px-1 text-2xs text-muted">
                <span>
                  Showing <strong className="font-semibold text-primary">{filteredMatches.length}</strong> of {matches.length} matches
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
                    ? "grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3"
                    : "space-y-2.5 sm:space-y-3"
                }
              >
                {filteredMatches.map((m) => (
                  <ScoredMatchRow
                    key={m.id}
                    match={m}
                    onDismiss={handleDismissMatch}
                    dismissing={dismissingId === m.id}
                    viewMode={viewMode}
                  />
                ))}
              </div>
            </div>
          )
        ) : (
          <div
            className={
              viewMode === "grid"
                ? "grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3"
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
              />
            ))}
          </div>
        )
      )}
    </div>
  );
}


