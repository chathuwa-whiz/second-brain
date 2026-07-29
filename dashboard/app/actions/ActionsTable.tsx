"use client";

import { useEffect, useRef, useState } from "react";

type AgentAction = {
  id: number;
  created_at: string;
  module: string;
  action: string;
  reasoning: string;
  confidence: string;
  status: "pending" | "approved" | "rejected" | "auto_executed" | "failed";
  metadata: Record<string, unknown>;
  executed_at: string | null;
  execution_result: Record<string, unknown> | null;
};

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  approved: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  rejected: "bg-red-500/15 text-red-300 border-red-500/30",
  auto_executed: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  failed: "bg-slate-500/15 text-slate-300 border-slate-500/30",
};

export default function ActionsTable({
  initialActions,
}: {
  initialActions: AgentAction[];
}) {
  const [actions, setActions] = useState(initialActions);
  const [pendingId, setPendingId] = useState<number | null>(null);
  // Actions that were just approved and are waiting on approval_executor.py
  // to pick them up (polls every ~5s) — used to auto-refresh just those
  // rows a few times rather than re-fetching the whole list on a timer.
  const awaitingExecution = useRef<Set<number>>(new Set());

  async function review(id: number, status: "approved" | "rejected") {
    setPendingId(id);
    const res = await fetch(`/api/actions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setPendingId(null);
    if (res.ok) {
      const { action } = await res.json();
      setActions((prev) => prev.map((a) => (a.id === id ? action : a)));
      if (status === "approved") {
        awaitingExecution.current.add(id);
      }
    }
  }

  // Poll for a few seconds after approving, to pick up execution results
  // from approval_executor.py without a manual page refresh. Stops polling
  // a given row once it has an executed_at, or after ~30s either way.
  useEffect(() => {
    if (awaitingExecution.current.size === 0) return;

    let ticks = 0;
    const interval = setInterval(async () => {
      ticks += 1;
      const ids = Array.from(awaitingExecution.current);
      if (ids.length === 0 || ticks > 6) {
        clearInterval(interval);
        return;
      }
      const res = await fetch(`/api/actions?ids=${ids.join(",")}`);
      if (!res.ok) return;
      const { actions: updated } = await res.json();
      setActions((prev) =>
        prev.map((a) => updated.find((u: AgentAction) => u.id === a.id) ?? a)
      );
      for (const a of updated as AgentAction[]) {
        if (a.executed_at) awaitingExecution.current.delete(a.id);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [actions]);

  if (actions.length === 0) {
    return (
      <p className="rounded-lg border border-slate-800 bg-slate-900 p-6 text-slate-400">
        No actions logged yet. Run a request through the orchestrator to see
        it show up here.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {actions.map((a) => (
        <div
          key={a.id}
          className="rounded-lg border border-slate-800 bg-slate-900 p-4"
        >
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[a.status]}`}
            >
              {a.status}
            </span>
            {a.status === "approved" && !a.executed_at && (
              <span className="rounded-full border border-slate-700 bg-slate-800 px-2 py-0.5 text-xs text-slate-400">
                queued for execution…
              </span>
            )}
            {a.status === "approved" && a.executed_at && (
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-300">
                executed {new Date(a.executed_at).toLocaleTimeString()}
              </span>
            )}
            <span className="text-sm font-medium text-slate-200">
              {a.module} / {a.action}
            </span>
            <span className="text-xs text-slate-500">
              confidence {Number(a.confidence).toFixed(2)}
            </span>
            <span className="ml-auto text-xs text-slate-500">
              {new Date(a.created_at).toLocaleString()}
            </span>
          </div>

          <p className="text-sm text-slate-300">{a.reasoning}</p>

          {a.execution_result != null && (
            <pre className="mt-2 max-h-40 overflow-auto rounded bg-slate-950 p-2 text-xs text-slate-400">
              {JSON.stringify(a.execution_result, null, 2)}
            </pre>
          )}

          {a.status === "pending" && (
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => review(a.id, "approved")}
                disabled={pendingId === a.id}
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                Approve
              </button>
              <button
                onClick={() => review(a.id, "rejected")}
                disabled={pendingId === a.id}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
              >
                Reject
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
