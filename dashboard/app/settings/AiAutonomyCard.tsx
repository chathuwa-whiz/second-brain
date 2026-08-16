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
          const threshold = Number(data.profile?.confidenceThreshold ?? 0.75);
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
    const confidenceThreshold = mode === "auto" ? 0.85 : 0.75;
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
        <div className="flex items-center gap-2.5">
          <h3 className="text-base font-semibold text-primary">
            Application Autonomy
          </h3>
          <Badge tone={autonomyMode === "safe" ? "ok" : "accent"}>
            {autonomyMode === "safe" ? "Safe Mode" : "Auto-Apply Active"}
          </Badge>
        </div>
        <p className="text-xs text-secondary">
          Choose how much control you want when the AI prepares job applications.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {/* Option 1: Safe Mode */}
        <div
          onClick={() => handleSelectMode("safe")}
          className={`press cursor-pointer rounded-xl p-4 border transition-all ${
            autonomyMode === "safe"
              ? "border-emerald-500/40 bg-emerald-500/[0.06] ring-1 ring-emerald-500/30"
              : "border-hairline/15 bg-primary/[0.02] hover:bg-primary/[0.04]"
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-primary">
                  🛡️ Safe Mode
                </span>
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-3xs font-bold uppercase tracking-wider text-emerald-400">
                  Recommended
                </span>
              </div>
              <p className="text-xs text-secondary leading-relaxed pt-1">
                The AI finds jobs, scores match fit, and drafts custom emails, then waits in your <strong>Approvals</strong> queue for your 1-click review.
              </p>
            </div>
          </div>
        </div>

        {/* Option 2: Autonomous Mode */}
        <div
          onClick={() => handleSelectMode("auto")}
          className={`press cursor-pointer rounded-xl p-4 border transition-all ${
            autonomyMode === "auto"
              ? "border-accent bg-accent/[0.06] ring-1 ring-accent/30"
              : "border-hairline/15 bg-primary/[0.02] hover:bg-primary/[0.04]"
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-primary">
                  ⚡ Auto-Apply Mode
                </span>
              </div>
              <p className="text-xs text-secondary leading-relaxed pt-1">
                High-confidence job matches (85%+ score) are automatically submitted and emailed on your behalf without manual intervention.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 text-2xs text-muted pt-1">
        <IconCheck className="h-3.5 w-3.5 text-accent shrink-0" />
        <span>
          {saving
            ? "Saving preference…"
            : "You can change your autonomy mode at any time with immediate effect."}
        </span>
      </div>
    </Card>
  );
}
