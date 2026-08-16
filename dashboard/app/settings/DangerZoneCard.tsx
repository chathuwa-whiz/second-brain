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
    <Card className="border-danger/30 p-4 ring-1 ring-danger/20 sm:p-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-semibold text-danger-ink">
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
            className="w-full shrink-0 text-xs font-semibold sm:w-auto"
          >
            Reset All Databases
          </Button>
        ) : (
          <div className="flex w-full flex-col gap-2 shrink-0 xs:w-auto xs:flex-row xs:items-center">
            <Button
              type="button"
              variant="reject"
              disabled={busy}
              onClick={handleFullReset}
              className="w-full bg-danger text-xs font-semibold text-white hover:bg-danger/90 xs:w-auto"
            >
              {busy ? "Resetting..." : "Yes, Confirm Full Reset"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => setConfirmOpen(false)}
              className="w-full text-xs xs:w-auto"
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
        <div className="mt-3 rounded-xl bg-ok/10 p-3 text-xs font-medium text-ok-ink ring-1 ring-ok/25">
          {success}
        </div>
      )}
    </Card>
  );
}
