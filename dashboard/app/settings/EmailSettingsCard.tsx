"use client";

import { useEffect, useState } from "react";
import { Button, Card } from "@/components/ui";
import { withBasePath } from "@/lib/basePath";

export default function EmailSettingsCard() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: "ok" | "err" } | null>(null);

  const [defaultSender, setDefaultSender] = useState("chathushkanavod11@gmail.com");
  const [smtpHost, setSmtpHost] = useState("smtp.gmail.com");
  const [smtpPort, setSmtpPort] = useState(465);
  const [smtpUser, setSmtpUser] = useState("chathushkanavod11@gmail.com");
  const [smtpPassword, setSmtpPassword] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(withBasePath("/api/settings/email"));
        if (res.ok) {
          const data = await res.json();
          if (data.settings) {
            setDefaultSender(data.settings.default_sender_email || "chathushkanavod11@gmail.com");
            setSmtpHost(data.settings.smtp_host || "smtp.gmail.com");
            setSmtpPort(data.settings.smtp_port || 465);
            setSmtpUser(data.settings.smtp_user || "chathushkanavod11@gmail.com");
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
          smtp_user: smtpUser,
          smtp_password: smtpPassword,
        }),
      });

      if (res.ok) {
        setMessage({ text: "Google SMTP settings saved successfully.", tone: "ok" });
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
        <p className="text-xs text-muted">Loading Google SMTP settings...</p>
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
                Every application email dispatched by Second Brain uses your Google SMTP server directly. Sent emails will automatically appear in your official Gmail <strong>Sent</strong> mailbox.
              </p>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted">
            Sender Email Address
          </label>
          <input
            type="email"
            required
            value={defaultSender}
            onChange={(e) => setDefaultSender(e.target.value)}
            placeholder="chathushkanavod11@gmail.com"
            className="mt-1.5 w-full rounded-xl bg-primary/[0.04] px-3.5 py-2 text-xs text-primary ring-1 ring-inset ring-primary/10 placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent sm:text-sm"
          />
          <p className="mt-1 text-2xs text-muted">
            The Google account email displayed on outgoing job applications.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted">
              SMTP Host
            </label>
            <input
              type="text"
              required
              value={smtpHost}
              onChange={(e) => setSmtpHost(e.target.value)}
              placeholder="smtp.gmail.com"
              className="mt-1.5 w-full rounded-xl bg-primary/[0.04] px-3.5 py-2 text-xs text-primary ring-1 ring-inset ring-primary/10 placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent sm:text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted">
              SMTP Port
            </label>
            <input
              type="number"
              required
              value={smtpPort}
              onChange={(e) => setSmtpPort(Number(e.target.value))}
              placeholder="465"
              className="mt-1.5 w-full rounded-xl bg-primary/[0.04] px-3.5 py-2 text-xs text-primary ring-1 ring-inset ring-primary/10 placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent sm:text-sm"
            />
            <p className="mt-1 text-2xs text-muted">
              Default is 465 (SSL) or 587 (TLS).
            </p>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted">
              Google Account Username
            </label>
            <input
              type="text"
              required
              value={smtpUser}
              onChange={(e) => setSmtpUser(e.target.value)}
              placeholder="chathushkanavod11@gmail.com"
              className="mt-1.5 w-full rounded-xl bg-primary/[0.04] px-3.5 py-2 text-xs text-primary ring-1 ring-inset ring-primary/10 placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent sm:text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted">
              Google App Password
            </label>
            <input
              type="password"
              value={smtpPassword}
              onChange={(e) => setSmtpPassword(e.target.value)}
              placeholder="••••••••••••••••"
              className="mt-1.5 w-full rounded-xl bg-primary/[0.04] px-3.5 py-2 text-xs text-primary ring-1 ring-inset ring-primary/10 placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent sm:text-sm"
            />
            <p className="mt-1 text-2xs text-muted">
              16-character App Password from Google Security settings.
            </p>
          </div>
        </div>

        <div className="pt-2">
          <Button type="submit" variant="primary" disabled={saving} className="w-full xs:w-auto">
            {saving ? "Saving..." : "Save Google SMTP Settings"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
