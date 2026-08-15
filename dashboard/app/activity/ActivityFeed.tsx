"use client";

import { useMemo, useState } from "react";
import ActionCard from "@/components/ActionCard";
import { EmptyState } from "@/components/ui";
import { moduleLabel } from "@/lib/modules";
import type { AgentAction } from "@/lib/db";

const STATUS_FILTERS = [
  { key: "all", label: "Everything" },
  { key: "pending", label: "Needs you" },
  { key: "auto_executed", label: "Ran on its own" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "failed", label: "Failed" },
] as const;

function Chip({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`press whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-medium ${
        active
          ? "bg-accent text-white shadow-sm shadow-accent/25"
          : "glass text-secondary hover:text-primary"
      }`}
    >
      {children}
    </button>
  );
}

export default function ActivityFeed({
  initial,
  threshold,
}: {
  initial: AgentAction[];
  threshold: number;
}) {
  const [status, setStatus] = useState<string>("all");
  const [module, setModule] = useState<string>("all");

  // Only offer module filters that actually appear in the data - an empty
  // filter that returns nothing is worse than no filter at all.
  const presentModules = useMemo(() => {
    const keys = Array.from(new Set(initial.map((a) => a.module)));
    return keys.sort((a, b) => moduleLabel(a).localeCompare(moduleLabel(b)));
  }, [initial]);

  const filtered = initial.filter(
    (a) =>
      (status === "all" || a.status === status) &&
      (module === "all" || a.module === module)
  );

  return (
    <div className="space-y-5">
      <div className="space-y-2.5 sm:space-y-3">
        <div className="no-scrollbar -mx-1 flex max-w-full gap-1.5 overflow-x-auto px-1 pb-1 sm:gap-2">
          {STATUS_FILTERS.map((f) => (
            <Chip
              key={f.key}
              active={status === f.key}
              onClick={() => setStatus(f.key)}
            >
              {f.label}
            </Chip>
          ))}
        </div>

        {presentModules.length > 1 && (
          <div className="no-scrollbar -mx-1 flex max-w-full gap-1.5 overflow-x-auto px-1 pb-1 sm:gap-2">
            <Chip active={module === "all"} onClick={() => setModule("all")}>
              All modules
            </Chip>
            {presentModules.map((m) => (
              <Chip
                key={m}
                active={module === m}
                onClick={() => setModule(m)}
              >
                {moduleLabel(m)}
              </Chip>
            ))}
          </div>
        )}
      </div>

      <p className="tnum text-xs text-muted">
        {filtered.length} of {initial.length} actions
      </p>

      {filtered.length === 0 ? (
        <EmptyState
          title="No actions match those filters"
          body="Clear a filter to widen the search, or run something through the orchestrator to fill this in."
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((a, i) => (
            <ActionCard
              key={a.id}
              action={a}
              threshold={threshold}
              index={i}
            />
          ))}
        </div>
      )}
    </div>
  );
}
