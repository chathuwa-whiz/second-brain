"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ActionCard from "@/components/ActionCard";
import { Button, EmptyState, ErrorNote } from "@/components/ui";
import { IconSearch, IconX } from "@/components/icons";
import type { AgentAction } from "@/lib/db";
import { withBasePath } from "@/lib/basePath";

export default function ApprovalQueue({
  initial,
  threshold,
}: {
  initial: AgentAction[];
  threshold: number;
}) {
  const [actions, setActions] = useState(initial);
  const [searchQuery, setSearchQuery] = useState("");
  const [busyId, setBusyId] = useState<string | number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Rows approved from here are handed to approval_executor.py, which polls
  // MongoDB every few seconds. We poll those specific rows back for their
  // execution result rather than re-fetching the whole queue on a timer.
  const awaiting = useRef<Set<string | number>>(new Set());

  async function review(id: string | number, status: "approved" | "rejected") {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(withBasePath(`/api/actions/${id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't save that decision.");

      setActions((prev) => prev.map((a) => (a.id === id ? data.action : a)));
      if (status === "approved") awaiting.current.add(id);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Couldn't save that decision."
      );
    } finally {
      setBusyId(null);
    }
  }

  useEffect(() => {
    if (awaiting.current.size === 0) return;
    let ticks = 0;

    const interval = setInterval(async () => {
      ticks += 1;
      const ids = Array.from(awaiting.current);
      if (ids.length === 0 || ticks > 8) {
        clearInterval(interval);
        return;
      }
      try {
        const res = await fetch(withBasePath(`/api/actions?ids=${ids.join(",")}`));
        if (!res.ok) return;
        const { actions: updated } = await res.json();
        setActions((prev) =>
          prev.map((a) => updated.find((u: AgentAction) => u.id === a.id) ?? a)
        );
        for (const a of updated as AgentAction[]) {
          if (a.executed_at) awaiting.current.delete(a.id);
        }
      } catch {
        /* transient - the next tick retries */
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [actions]);

  const pending = actions.filter((a) => a.status === "pending");
  const settled = actions.filter((a) => a.status !== "pending");

  const filteredPending = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return pending;
    return pending.filter((a) => {
      const meta = (a.metadata || {}) as Record<string, any>;
      const actionName = (a.action || "").toLowerCase();
      const reasoning = (a.reasoning || "").toLowerCase();
      const title = (meta.job_title || "").toLowerCase();
      const company = (meta.company || "").toLowerCase();
      const recipient = (meta.recipient_email || "").toLowerCase();
      return (
        actionName.includes(q) ||
        reasoning.includes(q) ||
        title.includes(q) ||
        company.includes(q) ||
        recipient.includes(q)
      );
    });
  }, [pending, searchQuery]);

  const filteredSettled = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return settled;
    return settled.filter((a) => {
      const meta = (a.metadata || {}) as Record<string, any>;
      const actionName = (a.action || "").toLowerCase();
      const reasoning = (a.reasoning || "").toLowerCase();
      const title = (meta.job_title || "").toLowerCase();
      const company = (meta.company || "").toLowerCase();
      return (
        actionName.includes(q) ||
        reasoning.includes(q) ||
        title.includes(q) ||
        company.includes(q)
      );
    });
  }, [settled, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Search Input if there are actions */}
      {(pending.length > 0 || settled.length > 0) && (
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted">
            <IconSearch className="h-4 w-4" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search approvals by role, company, action, or reasoning..."
            className="field w-full pl-9 pr-8 text-xs sm:text-sm"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              aria-label="Clear search"
              className="press absolute inset-y-0 right-0 flex items-center pr-3 text-muted hover:text-primary"
            >
              <IconX className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      {error && <ErrorNote>{error}</ErrorNote>}

      {pending.length === 0 ? (
        <EmptyState
          title="Nothing needs you right now"
          body="Actions land here when the planner isn't confident enough to run them itself, or when the action is destructive enough that it always asks first."
        />
      ) : filteredPending.length === 0 ? (
        <EmptyState
          title="No pending actions match your search"
          body="Try searching with different keywords."
          action={
            <Button size="sm" onClick={() => setSearchQuery("")}>
              Clear search
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {filteredPending.map((a, i) => (
            <ActionCard
              key={a.id}
              action={a}
              threshold={threshold}
              onReview={review}
              busy={busyId === a.id}
              index={i}
            />
          ))}
        </div>
      )}

      {filteredSettled.length > 0 && (
        <section>
          <p className="mb-3 text-2xs font-semibold uppercase tracking-wider text-muted">
            Just decided
          </p>
          <div className="space-y-3">
            {filteredSettled.map((a, i) => (
              <ActionCard
                key={a.id}
                action={a}
                threshold={threshold}
                index={i}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

