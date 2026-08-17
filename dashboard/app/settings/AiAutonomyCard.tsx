"use client";

import { useEffect, useState } from "react";
import { Card, Badge } from "@/components/ui";
import { IconCheck } from "@/components/icons";
import { withBasePath } from "@/lib/basePath";

export default function AiAutonomyCard() {
  const [autonomyMode, setAutonomyMode] = useState<"safe" | "auto">("safe");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(withBasePath("/api/user/profile"));
        if (res.ok) {
          const data = await res.json();
          const threshold = Number(data.profile?.confidenceThreshold ?? 0.50);
          setAutonomyMode(threshold >= 0.85 ? "auto" : "safe");
        }
      } catch (err) {
        console.error("Failed to load autonomy settings:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleSelectMode(mode: "safe" | "auto") {
    setAutonomyMode(mode);
    setSaving(true);
    const confidenceThreshold = mode === "auto" ? 0.85 : 0.50;
    try {
      await fetch(withBasePath("/api/user/profile"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confidenceThreshold }),
      });
    } catch (err) {
      console.error("Failed to update autonomy mode:", err);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Card className="p-5 animate-pulse space-y-3">
        <div className="h-5 w-48 rounded bg-primary/[0.06]" />
        <div className="h-4 w-72 rounded bg-primary/[0.04]" />
      </Card>
    );
  }

  return (
    <Card className="p-4 sm:p-6 space-y-5">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-primary sm:text-base">
            Application autonomy
          </h3>
          <Badge tone={autonomyMode === "safe" ? "ok" : "accent"}>
            {autonomyMode === "safe" ? "Safe mode" : "Auto-apply active"}
          </Badge>
        </div>
        <p className="text-xs leading-relaxed text-secondary">
          How much the agent does before checking with you.
        </p>
      </div>

      {/*
        These were <div onClick> - unreachable by keyboard and invisible to
        assistive tech. They're a two-way choice, so they're radios.
      */}
      <div role="radiogroup" aria-label="Application autonomy" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button
          type="button"
          role="radio"
          aria-checked={autonomyMode === "safe"}
          onClick={() => handleSelectMode("safe")}
          className={`press rounded-xl border p-4 text-left transition-colors ${
            autonomyMode === "safe"
              ? "border-ok/40 bg-ok/[0.06]"
              : "border-hairline/15 hover:bg-primary/[0.03]"
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-primary">Safe mode</span>
            <Badge tone="ok">Recommended</Badge>
          </div>
          <p className="pt-1.5 text-xs leading-relaxed text-secondary">
            The agent finds jobs, scores the fit and drafts the email, then
            waits in your <strong className="font-medium text-primary">Approvals</strong>{" "}
            queue for a one-tap review.
          </p>
        </button>

        <button
          type="button"
          role="radio"
          aria-checked={autonomyMode === "auto"}
          onClick={() => handleSelectMode("auto")}
          className={`press rounded-xl border p-4 text-left transition-colors ${
            autonomyMode === "auto"
              ? "border-accent/40 bg-accent/[0.06]"
              : "border-hairline/15 hover:bg-primary/[0.03]"
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-primary">Auto-apply</span>
          </div>
          <p className="pt-1.5 text-xs leading-relaxed text-secondary">
            Matches scoring 85% or higher are submitted and emailed on your
            behalf, with no stop for review.
          </p>
        </button>
      </div>

      <div className="flex items-start gap-2 pt-1 text-2xs leading-relaxed text-muted">
        <IconCheck className="mt-px h-3.5 w-3.5 shrink-0 text-accent-ink" />
        <span>
          {saving
            ? "Saving…"
            : "Changes take effect immediately and can be reverted at any time."}
        </span>
      </div>
    </Card>
  );
}
