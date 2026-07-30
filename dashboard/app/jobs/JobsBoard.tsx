"use client";

import { useState } from "react";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorNote,
  type Tone,
} from "@/components/ui";
import { IconExternal } from "@/components/icons";
import { relativeTime } from "@/lib/format";
import type { JobApplication, JobMatch } from "@/lib/mongo";
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
  const tone = score >= 8.5 ? "text-ok" : score >= 7 ? "text-accent" : "text-warn";
  return (
    <div className="flex shrink-0 flex-col items-center">
      <span className={`tnum text-lg font-semibold leading-none ${tone}`}>
        {score.toFixed(0)}
      </span>
      <span className="text-2xs uppercase tracking-wide text-muted">fit</span>
    </div>
  );
}

function MatchRow({
  match,
  onSetStatus,
  busy,
}: {
  match: JobMatch;
  onSetStatus: (id: string, status: "applied" | "dismissed" | "new") => void;
  busy: boolean;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start gap-4">
        <ScorePip score={match.score} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold text-primary">
              {match.title}
            </p>
            {match.status !== "new" && (
              <Badge tone={match.status === "applied" ? "ok" : "neutral"}>
                {match.status === "applied" ? "Applied" : "Dismissed"}
              </Badge>
            )}
          </div>

          <p className="mt-0.5 truncate text-xs text-muted">
            {[
              match.company,
              match.remote ? "Remote" : match.location,
              match.source,
            ]
              .filter(Boolean)
              .join(" · ")}
            {match.found_at && ` · found ${relativeTime(match.found_at)}`}
          </p>

          {match.reason && (
            <p className="mt-2 text-sm leading-relaxed text-secondary">
              {match.reason}
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {match.url && (
              <a
                href={match.url}
                target="_blank"
                rel="noreferrer noopener"
                className="press inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-medium text-accent hover:bg-accent/10"
              >
                Open posting
                <IconExternal className="h-3.5 w-3.5" />
              </a>
            )}
            {match.status === "new" ? (
              <>
                <Button
                  size="sm"
                  variant="quiet"
                  disabled={busy}
                  onClick={() => onSetStatus(match.id, "applied")}
                >
                  Mark applied
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => onSetStatus(match.id, "dismissed")}
                >
                  Not interested
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => onSetStatus(match.id, "new")}
              >
                Move back to new
              </Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

export default function JobsBoard({
  initialMatches,
  applications,
  matchesError,
  applicationsError,
}: {
  initialMatches: JobMatch[];
  applications: JobApplication[];
  matchesError: string | null;
  applicationsError: string | null;
}) {
  const [matches, setMatches] = useState(initialMatches);
  const [tab, setTab] = useState<"new" | "all" | "applications">("new");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function setStatus(
    id: string,
    status: "applied" | "dismissed" | "new"
  ) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(withBasePath(`/api/jobs/${id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't update that match.");
      setMatches((prev) => prev.map((m) => (m.id === id ? data.match : m)));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Couldn't update that match."
      );
    } finally {
      setBusyId(null);
    }
  }

  const newMatches = matches.filter((m) => m.status === "new");
  const visible = tab === "new" ? newMatches : matches;

  const tabs = [
    { key: "new" as const, label: "New matches", count: newMatches.length },
    { key: "all" as const, label: "All matches", count: matches.length },
    {
      key: "applications" as const,
      label: "Applications",
      count: applications.length,
    },
  ];

  return (
    <div className="space-y-5">
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

      {error && <ErrorNote>{error}</ErrorNote>}
      {tab !== "applications" && matchesError && (
        <ErrorNote>Can&apos;t read job matches. {matchesError}</ErrorNote>
      )}
      {tab === "applications" && applicationsError && (
        <ErrorNote>Can&apos;t read applications. {applicationsError}</ErrorNote>
      )}

      {tab === "applications" ? (
        applications.length === 0 ? (
          <EmptyState
            title="No applications logged"
            body="Ask the agent to log an application once you've actually applied — matches stay separate until you do, so this list only ever reflects real applications."
          />
        ) : (
          <div className="space-y-3">
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
                      {a.resume_version && ` · ${a.resume_version} resume`}
                    </p>
                  </div>
                  {a.date_applied && (
                    <span className="ml-auto text-xs text-muted">
                      {relativeTime(a.date_applied)}
                    </span>
                  )}
                </div>
                {a.notes && (
                  <p className="mt-2.5 text-sm text-secondary">{a.notes}</p>
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
          </div>
        )
      ) : visible.length === 0 ? (
        <EmptyState
          title={tab === "new" ? "No new matches" : "No matches yet"}
          body="The daily search runs at 8am and posts anything scoring 7 or above. Nothing new since the last run."
        />
      ) : (
        <div className="space-y-3">
          {visible.map((m) => (
            <MatchRow
              key={m.id}
              match={m}
              onSetStatus={setStatus}
              busy={busyId === m.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
