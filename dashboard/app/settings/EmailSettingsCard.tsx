"use client";

import { useEffect, useState } from "react";
import { Button, Card } from "@/components/ui";
import { withBasePath } from "@/lib/basePath";

export default function EmailSettingsCard() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: "ok" | "err" } | null>(null);

  const [defaultSender, setDefaultSender] = useState("");
  const [smtpHost, setSmtpHost] = useState("smtp.gmail.com");
  const [smtpPort, setSmtpPort] = useState(465);
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPassword, setSmtpPassword] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(withBasePath("/api/settings/email"));
        if (res.ok) {
          const data = await res.json();
          if (data.settings) {
            setDefaultSender(data.settings.default_sender_email || "");
            setSmtpHost(data.settings.smtp_host || "smtp.gmail.com");
            setSmtpPort(data.settings.smtp_port || 465);
            setSmtpUser(data.settings.smtp_user || "");
            setSmtpPassword(data.settings.smtp_password || "");
          }
        }
      } catch (err) {
        console.error("Failed to load email settings:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch(withBasePath("/api/settings/email"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "smtp",
          default_sender_email: defaultSender,
          smtp_host: smtpHost,
          smtp_port: Number(smtpPort),
          smtp_user: smtpUser || defaultSender,
          smtp_password: smtpPassword,
        }),
      });

      if (res.ok) {
        setMessage({ text: "Email dispatch settings saved successfully.", tone: "ok" });
      } else {
        const data = await res.json();
        throw new Error(data.error || "Failed to save settings");
      }
    } catch (err) {
      setMessage({
        text: err instanceof Error ? err.message : "Failed to save settings.",
        tone: "err",
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Card className="p-4 sm:p-6">
        <p className="text-xs text-muted">Loading email settings...</p>
      </Card>
    );
  }

  return (
    <Card className="p-4 sm:p-6">
      <form onSubmit={handleSave} className="space-y-4">
        {message && (
          <div
            className={`rounded-xl p-3 text-xs font-medium ${
              message.tone === "ok"
                ? "bg-ok/10 text-ok ring-1 ring-ok/20"
                : "bg-danger/10 text-danger ring-1 ring-danger/20"
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="rounded-xl bg-accent/10 p-3.5 ring-1 ring-inset ring-accent/20">
          <div className="flex items-start gap-2.5">
            <span className="text-sm">📬</span>
            <div className="text-xs text-secondary leading-relaxed">
              <p className="font-semibold text-primary">Gmail Sent Box Sync</p>
              <p className="mt-0.5">
                When you approve an application, the AI sends it directly through your Gmail account so it appears in your official <strong>Sent</strong> folder.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-primary">
              Your Gmail Address
            </label>
            <input
              type="email"
              required
              value={defaultSender}
              onChange={(e) => {
                setDefaultSender(e.target.value);
                if (!smtpUser) setSmtpUser(e.target.value);
              }}
              placeholder="you@gmail.com"
              className="field mt-1.5"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-primary">
              Google App Password (16 Letters)
            </label>
            <input
              type="password"
              value={smtpPassword}
              onChange={(e) => setSmtpPassword(e.target.value)}
              placeholder="••••••••••••••••"
              className="field mt-1.5"
            />
          </div>
        </div>

        {/* 1-Minute Gmail Guide Accordion */}
        <details className="rounded-xl bg-primary/[0.02] p-3 border border-hairline/10 text-xs">
          <summary className="cursor-pointer font-medium text-accent hover:underline focus:outline-none">
            💡 How to get a Google App Password in 60 seconds
          </summary>
          <ol className="list-decimal list-inside mt-2.5 space-y-1.5 text-muted leading-relaxed">
            <li>Go to your <a href="https://myaccount.google.com/security" target="_blank" rel="noreferrer" className="text-primary underline">Google Account Security</a> settings.</li>
            <li>Make sure <strong>2-Step Verification</strong> is ON.</li>
            <li>Search for <strong>&quot;App Passwords&quot;</strong> in the search bar.</li>
            <li>Type &quot;Second Brain&quot; and click <strong>Create</strong>.</li>
            <li>Copy the 16-character password generated by Google and paste it above!</li>
          </ol>
        </details>

        <div className="pt-2">
          <Button type="submit" variant="primary" disabled={saving} className="w-full xs:w-auto">
            {saving ? "Saving..." : "Save Email Settings"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
