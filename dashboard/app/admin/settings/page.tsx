"use client";

import { useState, useEffect } from "react";
import AdminHeader from "@/components/admin/AdminHeader";
import { Card, SectionHeader, ErrorNote } from "@/components/ui";
import {
  IconSettings,
  IconDatabase,
  IconMail,
  IconServer,
  IconRefresh,
  IconCheck,
} from "@/components/icons";
import { withBasePath } from "@/lib/basePath";

type PlatformConfig = {
  auto_execute_confidence: number;
  registration_mode: "open" | "invite_only" | "closed";
  maintenance_mode: boolean;
  system_announcement: string;
  default_model: string;
  max_daily_actions_per_user: number;
  updated_at?: string;
  updated_by?: string;
};

export default function AdminSettingsPage() {
  const [config, setConfig] = useState<PlatformConfig>({
    auto_execute_confidence: 0.75,
    registration_mode: "open",
    maintenance_mode: false,
    system_announcement: "",
    default_model: "gemini-1.5-pro",
    max_daily_actions_per_user: 50,
  });

  const [collections, setCollections] = useState<Array<{ name: string; count: number }>>([]);
  const [systemMetrics, setSystemMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Email test tool
  const [testEmailTarget, setTestEmailTarget] = useState("");
  const [testingEmail, setTestingEmail] = useState(false);
  const [emailTestResult, setEmailTestResult] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [configRes, systemRes] = await Promise.all([
          fetch(withBasePath("/api/admin/config")),
          fetch(withBasePath("/api/admin/system")),
        ]);

        const configData = await configRes.json();
        const systemData = await systemRes.json();

        if (configData.config) setConfig(configData.config);
        if (systemData.collections) setCollections(systemData.collections);
        if (systemData.system) setSystemMetrics(systemData.system);
      } catch (err) {
        setError("Failed to load settings.");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  async function handleSaveConfig(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(withBasePath("/api/admin/config"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessMsg("Platform settings saved successfully.");
        if (data.config) setConfig(data.config);
        setTimeout(() => setSuccessMsg(null), 4000);
      } else {
        setError(data.error || "Failed to save configuration.");
      }
    } catch (err) {
      setError("An unexpected error occurred while saving.");
    } finally {
      setSaving(false);
    }
  }

  async function handleTestEmail() {
    setTestingEmail(true);
    setEmailTestResult(null);
    try {
      const res = await fetch(withBasePath("/api/admin/system"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "test_email",
          recipientEmail: testEmailTarget || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setEmailTestResult(`✓ ${data.message}`);
      } else {
        setEmailTestResult(`✕ ${data.error || "Email dispatch failed."}`);
      }
    } catch (err) {
      setEmailTestResult("✕ Failed to send test email.");
    } finally {
      setTestingEmail(false);
    }
  }

  return (
    <>
      <AdminHeader
        title="Platform Settings & System Maintenance"
        description="Global AI autonomy thresholds, database collection telemetry, runtime diagnostics, and system broadcast messages."
      />

      {successMsg && (
        <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs font-medium text-emerald-400">
          ✓ {successMsg}
        </div>
      )}

      {error && <ErrorNote message={error} />}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Section 1: Global Platform Policy */}
        <section className="lg:col-span-2">
          <SectionHeader
            eyebrow="Global AI Policy"
            title="Agent Confidence & Execution Rules"
            description="Controls how autonomous agents behave across all workspaces."
          />

          <Card className="p-6">
            <form onSubmit={handleSaveConfig} className="space-y-6">
              {/* Confidence Threshold */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-primary">
                    Auto-Execution Confidence Threshold
                  </label>
                  <span className="rounded-lg bg-accent/15 px-2.5 py-1 text-xs font-bold text-accent-ink">
                    {Math.round(config.auto_execute_confidence * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.50"
                  max="0.95"
                  step="0.05"
                  value={config.auto_execute_confidence}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      auto_execute_confidence: parseFloat(e.target.value),
                    })
                  }
                  className="w-full cursor-pointer accent-accent"
                />
                <p className="mt-1 text-2xs text-secondary">
                  Agent actions with confidence scores at or above this threshold will execute autonomously. Actions below will wait in the approval queue.
                </p>
              </div>

              {/* Grid: Registration Mode, Default Model, Max Daily Actions */}
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-2xs font-semibold uppercase tracking-wider text-muted mb-1">
                    Registration Policy
                  </label>
                  <select
                    value={config.registration_mode}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        registration_mode: e.target.value as any,
                      })
                    }
                    className="w-full rounded-xl border border-hairline/20 bg-base px-3 py-2 text-xs text-primary focus:border-accent focus:outline-none"
                  >
                    <option value="open">Open Registration</option>
                    <option value="invite_only">Invite Only</option>
                    <option value="closed">Closed / Admin Only</option>
                  </select>
                </div>

                <div>
                  <label className="block text-2xs font-semibold uppercase tracking-wider text-muted mb-1">
                    Orchestrator Model
                  </label>
                  <select
                    value={config.default_model}
                    onChange={(e) =>
                      setConfig({ ...config, default_model: e.target.value })
                    }
                    className="w-full rounded-xl border border-hairline/20 bg-base px-3 py-2 text-xs text-primary focus:border-accent focus:outline-none"
                  >
                    <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                    <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                    <option value="gpt-4o">GPT-4o</option>
                    <option value="claude-3-5-sonnet">Claude 3.5 Sonnet</option>
                  </select>
                </div>

                <div>
                  <label className="block text-2xs font-semibold uppercase tracking-wider text-muted mb-1">
                    Daily Actions Cap / User
                  </label>
                  <input
                    type="number"
                    min="10"
                    max="500"
                    value={config.max_daily_actions_per_user}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        max_daily_actions_per_user: parseInt(e.target.value) || 50,
                      })
                    }
                    className="w-full rounded-xl border border-hairline/20 bg-base px-3 py-2 text-xs text-primary focus:border-accent focus:outline-none"
                  />
                </div>
              </div>

              {/* Maintenance Mode & Announcement */}
              <div className="space-y-3 pt-4 border-t border-hairline/15">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-primary">System Maintenance Mode</p>
                    <p className="text-2xs text-secondary">
                      When enabled, non-admin users will see a maintenance notice.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.maintenance_mode}
                    onChange={(e) =>
                      setConfig({ ...config, maintenance_mode: e.target.checked })
                    }
                    className="h-4 w-4 rounded border-hairline/30 text-accent focus:ring-accent"
                  />
                </div>

                <div>
                  <label className="block text-2xs font-semibold uppercase tracking-wider text-muted mb-1">
                    Global System Announcement Banner (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Scheduled database maintenance at 02:00 UTC."
                    value={config.system_announcement}
                    onChange={(e) =>
                      setConfig({ ...config, system_announcement: e.target.value })
                    }
                    className="w-full rounded-xl border border-hairline/20 bg-base px-3 py-2 text-xs text-primary focus:border-accent focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-hairline/15">
                <span className="text-3xs text-muted">
                  {config.updated_at
                    ? `Last updated: ${new Date(config.updated_at).toLocaleString()}`
                    : ""}
                </span>
                <button
                  type="submit"
                  disabled={saving}
                  className="press rounded-xl bg-accent px-5 py-2 text-xs font-semibold text-white shadow-md shadow-accent/25 hover:bg-accent-hover disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save Platform Settings"}
                </button>
              </div>
            </form>
          </Card>
        </section>

        {/* Section 2: SMTP Diagnostic Test Tool */}
        <section>
          <SectionHeader
            eyebrow="Diagnostic Relay"
            title="SMTP Email Test Tool"
            description="Verify real-time delivery with your configured mail transport."
          />

          <Card className="p-5 space-y-4">
            <div>
              <label className="block text-2xs font-semibold uppercase tracking-wider text-muted mb-1">
                Recipient Email Address
              </label>
              <div className="flex gap-2">
                <input
                  type="email"
                  placeholder="Defaults to your admin email"
                  value={testEmailTarget}
                  onChange={(e) => setTestEmailTarget(e.target.value)}
                  className="flex-1 rounded-xl border border-hairline/20 bg-base px-3 py-2 text-xs text-primary focus:border-accent focus:outline-none"
                />
                <button
                  type="button"
                  disabled={testingEmail}
                  onClick={handleTestEmail}
                  className="press rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-white hover:bg-accent-hover disabled:opacity-50 shrink-0"
                >
                  {testingEmail ? "Sending..." : "Send Test"}
                </button>
              </div>
            </div>

            {emailTestResult && (
              <div className={`rounded-xl p-3 text-2xs font-medium ${
                emailTestResult.startsWith("✓")
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                  : "bg-rose-500/10 text-rose-400 border border-rose-500/30"
              }`}>
                {emailTestResult}
              </div>
            )}
          </Card>
        </section>

        {/* Section 3: Database & Node Runtime Telemetry */}
        <section>
          <SectionHeader
            eyebrow="Database & Node"
            title="Live Collection Counts"
            description="MongoDB document counts and process memory telemetry."
          />

          <Card className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {collections.map((col) => (
                <div
                  key={col.name}
                  className="rounded-xl border border-hairline/15 bg-base p-2.5"
                >
                  <p className="text-3xs font-mono text-muted truncate">{col.name}</p>
                  <p className="text-sm font-bold text-primary mt-0.5">{col.count}</p>
                </div>
              ))}
            </div>

            {systemMetrics && (
              <div className="rounded-xl bg-primary/[0.02] p-3 text-3xs text-secondary space-y-1">
                <div className="flex justify-between">
                  <span>Node.js Runtime:</span>
                  <span className="font-mono text-primary">{systemMetrics.nodeVersion}</span>
                </div>
                <div className="flex justify-between">
                  <span>Memory RSS / Heap:</span>
                  <span className="font-mono text-primary">
                    {systemMetrics.memoryUsageMb?.rss}MB / {systemMetrics.memoryUsageMb?.heapUsed}MB
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Process Uptime:</span>
                  <span className="font-mono text-primary">
                    {Math.round(systemMetrics.uptime / 60)} minutes
                  </span>
                </div>
              </div>
            )}
          </Card>
        </section>
      </div>
    </>
  );
}
