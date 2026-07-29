"use client";

import { useState } from "react";

type AgentAction = {
  id: number;
  created_at: string;
  module: string;
  action: string;
  reasoning: string;
  confidence: string;
  status: "pending" | "approved" | "rejected" | "auto_executed" | "failed";
  metadata: Record<string, unknown>;
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
    }
  }

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
