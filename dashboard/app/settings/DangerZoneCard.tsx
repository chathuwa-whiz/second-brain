"use client";

import { useState } from "react";
import { Button, Card, ErrorNote } from "@/components/ui";
import { withBasePath } from "@/lib/basePath";

export default function DangerZoneCard() {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleFullReset() {
    setBusy(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(withBasePath("/api/settings/reset"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to reset databases");
      }

      setSuccess("Full database reset completed successfully! All queues and history have been cleared.");
      setConfirmOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="border-danger/30 p-5 ring-1 ring-danger/20">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-danger">
            Full Database & State Reset
          </h4>
          <p className="mt-1 text-xs text-muted">
            Truncate all action logs, approvals, job matches, and application history back to clean state.
          </p>
        </div>

        {!confirmOpen ? (
          <Button
            type="button"
            variant="reject"
            onClick={() => setConfirmOpen(true)}
            className="text-xs font-semibold"
          >
            Reset All Databases
          </Button>
        ) : (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="reject"
              disabled={busy}
              onClick={handleFullReset}
              className="bg-danger text-xs font-semibold text-white hover:bg-danger/90"
            >
              {busy ? "Resetting..." : "Yes, Confirm Full Reset"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => setConfirmOpen(false)}
              className="text-xs"
            >
              Cancel
            </Button>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-3">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}

      {success && (
        <div className="mt-3 rounded-xl bg-ok/10 p-3 text-xs font-medium text-ok ring-1 ring-ok/25">
          {success}
        </div>
      )}
    </Card>
  );
}
