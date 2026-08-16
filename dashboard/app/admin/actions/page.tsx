"use client";

import { useState, useEffect, useCallback } from "react";
import AdminHeader from "@/components/admin/AdminHeader";
import { Card, Badge, EmptyState, ErrorNote } from "@/components/ui";
import {
  IconAudit,
  IconSearch,
  IconRefresh,
  IconCheck,
  IconX,
  IconTrash,
  IconActivity,
} from "@/components/icons";
import { withBasePath } from "@/lib/basePath";
import { formatTimeAgo } from "@/lib/format";

type ActionItem = {
  id: string | number;
  user_id: string | null;
  userEmail?: string;
  module: string;
  action: string;
  reasoning: string;
  confidence: string;
  status: "pending" | "approved" | "rejected" | "auto_executed" | "failed";
  metadata: Record<string, unknown>;
  reviewed_at: string | null;
  reviewed_by: string | null;
  executed_at: string | null;
  execution_result: Record<string, unknown> | null;
  created_at: string;
};

export default function AdminActionsPage() {
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Selection for bulk actions
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkProcessing, setBulkProcessing] = useState(false);

  // Inspection Drawer
  const [activeAction, setActiveAction] = useState<ActionItem | null>(null);

  // Pruning
  const [pruneModalOpen, setPruneModalOpen] = useState(false);
  const [pruneDays, setPruneDays] = useState("30");
  const [pruning, setPruning] = useState(false);

  const [notification, setNotification] = useState<string | null>(null);

  const loadActions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (moduleFilter !== "all") params.set("module", moduleFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);
      params.set("limit", "100");

      const res = await fetch(withBasePath(`/api/admin/actions?${params.toString()}`));
      const data = await res.json();

      if (!res.ok || data.error) {
        setError(data.error || "Failed to fetch actions");
      } else {
        setActions(data.actions || []);
        setTotal(data.total || 0);
      }
    } catch (err) {
      setError("Failed to load agent actions.");
    } finally {
      setLoading(false);
    }
  }, [search, moduleFilter, statusFilter]);

  useEffect(() => {
    loadActions();
  }, [loadActions]);

  // Handle single action status change
  async function handleUpdateStatus(id: string | number, status: string) {
    try {
      const res = await fetch(withBasePath("/api/admin/actions"), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionId: id, status }),
      });
      const data = await res.json();
      if (res.ok) {
        setNotification(`Action marked as ${status}`);
        loadActions();
        if (activeAction && activeAction.id === id) {
          setActiveAction({ ...activeAction, status: status as any });
        }
        setTimeout(() => setNotification(null), 3000);
      } else {
        alert(data.error || "Failed to update action");
      }
    } catch (err) {
      alert("Failed to update status");
    }
  }

  // Handle bulk action status change
  async function handleBulkStatus(status: string) {
    if (selectedIds.length === 0) return;
    setBulkProcessing(true);
    try {
      const res = await fetch(withBasePath("/api/admin/actions"), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionIds: selectedIds, status }),
      });
      if (res.ok) {
        setNotification(`Updated ${selectedIds.length} actions to ${status}`);
        setSelectedIds([]);
        loadActions();
        setTimeout(() => setNotification(null), 3000);
      }
    } catch (err) {
      alert("Bulk update failed.");
    } finally {
      setBulkProcessing(false);
    }
  }

  // Handle single delete
  async function handleDeleteAction(id: string | number) {
    if (!window.confirm("Delete this action log record?")) return;
    try {
      const res = await fetch(withBasePath(`/api/admin/actions?id=${id}`), {
        method: "DELETE",
      });
      if (res.ok) {
        setNotification("Action log deleted.");
        loadActions();
        if (activeAction && activeAction.id === id) {
          setActiveAction(null);
        }
        setTimeout(() => setNotification(null), 3000);
      }
    } catch (err) {
      alert("Failed to delete action");
    }
  }

  // Handle Pruning
  async function handlePrune() {
    setPruning(true);
    try {
      const res = await fetch(
        withBasePath(`/api/admin/actions?pruneDays=${pruneDays}`),
        { method: "DELETE" }
      );
      const data = await res.json();
      if (res.ok) {
        setNotification(data.message || "Pruned old action logs.");
        setPruneModalOpen(false);
        loadActions();
        setTimeout(() => setNotification(null), 4000);
      } else {
        alert(data.error || "Prune failed.");
      }
    } catch (err) {
      alert("Failed to prune old logs.");
    } finally {
      setPruning(false);
    }
  }

  function toggleSelectAll() {
    if (selectedIds.length === actions.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(actions.map((a) => String(a.id)));
    }
  }

  function toggleSelectOne(id: string) {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((i) => i !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  }

  return (
    <>
      <AdminHeader
        title="Global Agent Audit Logs"
        description="Comprehensive audit trail of all agent reasoning chains, tool invocations, confidence scores, and status overrides."
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPruneModalOpen(true)}
              className="press inline-flex items-center gap-1.5 rounded-xl border border-hairline/20 bg-raised px-3 py-2 text-xs font-semibold text-secondary hover:bg-primary/[0.05] hover:text-primary transition-colors"
            >
              <IconTrash className="h-3.5 w-3.5" />
              Prune Logs
            </button>
            <button
              onClick={() => loadActions()}
              className="press inline-flex items-center gap-1.5 rounded-xl border border-hairline/20 bg-raised px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/[0.05] transition-colors"
            >
              <IconRefresh className="h-3.5 w-3.5" />
              Refresh
            </button>
          </div>
        }
      />

      {notification && (
        <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs font-medium text-emerald-400">
          ✓ {notification}
        </div>
      )}

      {error && <ErrorNote message={error} />}

      {/* Filter and Bulk Bar */}
      <Card className="mb-6 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative flex-1">
            <IconSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              type="text"
              placeholder="Search action reasoning, title, or module..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-hairline/20 bg-base pl-9 pr-4 py-2 text-xs text-primary placeholder-muted focus:border-accent focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={moduleFilter}
              onChange={(e) => setModuleFilter(e.target.value)}
              className="rounded-xl border border-hairline/20 bg-base px-3 py-2 text-xs text-primary focus:border-accent focus:outline-none"
            >
              <option value="all">All Modules</option>
              <option value="job_finding">Job Finding</option>
              <option value="tasks">Tasks</option>
              <option value="research">Research</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-hairline/20 bg-base px-3 py-2 text-xs text-primary focus:border-accent focus:outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="auto_executed">Auto Executed</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="failed">Failed</option>
            </select>

            {selectedIds.length > 0 && (
              <div className="flex items-center gap-1.5 border-l border-hairline/20 pl-2">
                <button
                  disabled={bulkProcessing}
                  onClick={() => handleBulkStatus("approved")}
                  className="press rounded-lg bg-emerald-500/15 px-2.5 py-1.5 text-2xs font-semibold text-emerald-500 hover:bg-emerald-500/25"
                >
                  Approve ({selectedIds.length})
                </button>
                <button
                  disabled={bulkProcessing}
                  onClick={() => handleBulkStatus("rejected")}
                  className="press rounded-lg bg-rose-500/15 px-2.5 py-1.5 text-2xs font-semibold text-rose-500 hover:bg-rose-500/25"
                >
                  Reject ({selectedIds.length})
                </button>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Audit Log Table */}
      <Card className="divide-y divide-hairline/15 p-0">
        <div className="hidden grid-cols-12 gap-3 px-4 py-3 bg-primary/[0.02] text-3xs font-semibold uppercase tracking-wider text-muted lg:grid">
          <div className="col-span-1 flex items-center">
            <input
              type="checkbox"
              checked={actions.length > 0 && selectedIds.length === actions.length}
              onChange={toggleSelectAll}
              className="rounded border-hairline/30 text-accent focus:ring-accent"
            />
          </div>
          <div className="col-span-3">Module & Action</div>
          <div className="col-span-4">Reasoning & Telemetry</div>
          <div className="col-span-2">User / Target</div>
          <div className="col-span-2 text-right">Status & Controls</div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-xs text-muted">
            Loading audit logs...
          </div>
        ) : actions.length === 0 ? (
          <div className="p-12">
            <EmptyState
              title="No logs found"
              message="No agent actions match your current filter settings."
            />
          </div>
        ) : (
          actions.map((act) => {
            const strId = String(act.id);
            const isSelected = selectedIds.includes(strId);
            const conf = Math.round(Number(act.confidence || 0) * 100);

            let statusBadgeTone: "ok" | "warn" | "neutral" | "danger" = "neutral";
            if (act.status === "auto_executed" || act.status === "approved") {
              statusBadgeTone = "ok";
            } else if (act.status === "pending") {
              statusBadgeTone = "warn";
            } else if (act.status === "rejected" || act.status === "failed") {
              statusBadgeTone = "danger";
            }

            return (
              <div
                key={strId}
                className="flex flex-col gap-3 p-4 hover:bg-primary/[0.02] transition-colors lg:grid lg:grid-cols-12 lg:items-center lg:gap-3"
              >
                {/* Col 0: Checkbox */}
                <div className="hidden lg:col-span-1 lg:flex lg:items-center">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelectOne(strId)}
                    className="rounded border-hairline/30 text-accent focus:ring-accent"
                  />
                </div>

                {/* Col 1: Module & Action */}
                <div className="min-w-0 lg:col-span-3">
                  <div className="flex items-center gap-1.5">
                    <span className="rounded bg-accent/15 px-1.5 py-0.5 text-3xs font-semibold uppercase tracking-wider text-accent-ink">
                      {act.module.replace(/_/g, " ")}
                    </span>
                    <span className="text-3xs text-muted">
                      {formatTimeAgo(act.created_at)}
                    </span>
                  </div>
                  <p className="truncate text-xs font-semibold text-primary mt-1">
                    {act.action.replace(/_/g, " ")}
                  </p>
                </div>

                {/* Col 2: Reasoning */}
                <div className="min-w-0 lg:col-span-4">
                  <p className="line-clamp-2 text-2xs text-secondary leading-relaxed">
                    {act.reasoning || "No reasoning summary logged."}
                  </p>
                  <div className="flex items-center gap-2 mt-1 text-3xs text-muted">
                    <span>Confidence: <strong className="text-primary">{conf}%</strong></span>
                    {act.reviewed_by && <span>• Reviewed: {act.reviewed_by}</span>}
                  </div>
                </div>

                {/* Col 3: User */}
                <div className="min-w-0 lg:col-span-2 text-2xs text-secondary truncate">
                  <p className="truncate font-medium text-primary">
                    {act.userEmail || "System"}
                  </p>
                  <p className="text-3xs text-muted truncate">
                    ID: {act.user_id ? String(act.user_id).slice(-8) : "N/A"}
                  </p>
                </div>

                {/* Col 4: Status & Controls */}
                <div className="flex items-center justify-between gap-2 lg:col-span-2 lg:justify-end">
                  <Badge tone={statusBadgeTone}>
                    {act.status.replace(/_/g, " ")}
                  </Badge>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setActiveAction(act)}
                      className="press rounded-lg border border-hairline/20 bg-raised px-2 py-1 text-3xs font-semibold text-primary hover:bg-primary/[0.05]"
                    >
                      Inspect
                    </button>

                    {act.status === "pending" && (
                      <>
                        <button
                          onClick={() => handleUpdateStatus(act.id, "approved")}
                          title="Approve action"
                          className="press rounded-lg p-1 text-emerald-500 hover:bg-emerald-500/15"
                        >
                          <IconCheck className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(act.id, "rejected")}
                          title="Reject action"
                          className="press rounded-lg p-1 text-rose-500 hover:bg-rose-500/15"
                        >
                          <IconX className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}

                    <button
                      onClick={() => handleDeleteAction(act.id)}
                      title="Delete action log"
                      className="press rounded-lg p-1 text-danger hover:bg-danger/10"
                    >
                      <IconTrash className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </Card>

      {/* ---------------- Action Inspector Drawer ---------------- */}
      {activeAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-hairline/20 bg-raised p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-hairline/15 pb-4 mb-4">
              <div>
                <span className="rounded bg-accent/15 px-2 py-0.5 text-3xs font-bold uppercase text-accent-ink">
                  {activeAction.module}
                </span>
                <h3 className="text-base font-bold text-primary mt-1">
                  {activeAction.action}
                </h3>
              </div>
              <button
                onClick={() => setActiveAction(null)}
                className="text-muted hover:text-primary"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <p className="text-3xs font-semibold uppercase tracking-wider text-muted mb-1">
                  Reasoning Analysis
                </p>
                <div className="rounded-xl border border-hairline/15 bg-base p-3.5 text-secondary leading-relaxed">
                  {activeAction.reasoning}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-hairline/15 bg-base p-3">
                  <p className="text-3xs text-muted">Status</p>
                  <p className="text-xs font-semibold text-primary capitalize mt-0.5">
                    {activeAction.status}
                  </p>
                </div>
                <div className="rounded-xl border border-hairline/15 bg-base p-3">
                  <p className="text-3xs text-muted">Confidence</p>
                  <p className="text-xs font-semibold text-primary mt-0.5">
                    {Math.round(Number(activeAction.confidence || 0) * 100)}%
                  </p>
                </div>
                <div className="rounded-xl border border-hairline/15 bg-base p-3">
                  <p className="text-3xs text-muted">Created</p>
                  <p className="text-xs font-semibold text-primary mt-0.5">
                    {new Date(activeAction.created_at).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Metadata JSON */}
              {activeAction.metadata && Object.keys(activeAction.metadata).length > 0 && (
                <div>
                  <p className="text-3xs font-semibold uppercase tracking-wider text-muted mb-1">
                    Input Parameters & Metadata
                  </p>
                  <pre className="max-h-48 overflow-y-auto rounded-xl border border-hairline/15 bg-base p-3 font-mono text-3xs text-primary leading-tight">
                    {JSON.stringify(activeAction.metadata, null, 2)}
                  </pre>
                </div>
              )}

              {/* Execution Result JSON */}
              {activeAction.execution_result && (
                <div>
                  <p className="text-3xs font-semibold uppercase tracking-wider text-muted mb-1">
                    Execution Output
                  </p>
                  <pre className="max-h-48 overflow-y-auto rounded-xl border border-hairline/15 bg-base p-3 font-mono text-3xs text-primary leading-tight">
                    {JSON.stringify(activeAction.execution_result, null, 2)}
                  </pre>
                </div>
              )}

              <div className="flex items-center justify-between pt-4 border-t border-hairline/15">
                <div className="flex items-center gap-2">
                  {activeAction.status === "pending" && (
                    <>
                      <button
                        onClick={() => handleUpdateStatus(activeAction.id, "approved")}
                        className="press rounded-xl bg-emerald-500 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-600"
                      >
                        Approve Action
                      </button>
                      <button
                        onClick={() => handleUpdateStatus(activeAction.id, "rejected")}
                        className="press rounded-xl bg-rose-500 px-3.5 py-2 text-xs font-semibold text-white hover:bg-rose-600"
                      >
                        Reject Action
                      </button>
                    </>
                  )}
                </div>

                <button
                  onClick={() => setActiveAction(null)}
                  className="press rounded-xl border border-hairline/20 bg-raised px-4 py-2 text-xs font-semibold text-primary hover:bg-primary/[0.05]"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- Prune Modal ---------------- */}
      {pruneModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-hairline/20 bg-raised p-6 shadow-2xl">
            <h3 className="text-base font-bold text-primary mb-2">Prune Old Action Logs</h3>
            <p className="text-2xs text-secondary mb-4 leading-relaxed">
              Permanently delete executed and historical action logs older than a specific duration to maintain low database latency.
            </p>

            <div className="mb-4">
              <label className="block text-2xs font-semibold uppercase tracking-wider text-muted mb-1">
                Age Threshold
              </label>
              <select
                value={pruneDays}
                onChange={(e) => setPruneDays(e.target.value)}
                className="w-full rounded-xl border border-hairline/20 bg-base px-3 py-2 text-xs text-primary focus:border-accent focus:outline-none"
              >
                <option value="7">Older than 7 days</option>
                <option value="30">Older than 30 days</option>
                <option value="60">Older than 60 days</option>
                <option value="90">Older than 90 days</option>
                <option value="180">Older than 180 days</option>
              </select>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setPruneModalOpen(false)}
                className="press rounded-xl px-4 py-2 text-xs font-semibold text-secondary hover:bg-primary/[0.05]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={pruning}
                onClick={handlePrune}
                className="press rounded-xl bg-danger px-4 py-2 text-xs font-semibold text-white shadow-md shadow-danger/25 hover:bg-danger-hover disabled:opacity-50"
              >
                {pruning ? "Pruning..." : "Prune Now"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
