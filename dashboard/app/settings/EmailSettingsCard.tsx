"use client";

import { useEffect, useState } from "react";
import { Button, Card, ErrorNote } from "@/components/ui";
import { withBasePath } from "@/lib/basePath";

export default function EmailSettingsCard() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: "ok" | "err" } | null>(null);

  const [provider, setProvider] = useState<"resend" | "smtp">("resend");
  const [defaultSender, setDefaultSender] = useState("chathushkanavod11@gmail.com");
  const [resendApiKey, setResendApiKey] = useState("");
  const [smtpHost, setSmtpHost] = useState("smtp.resend.com");
  const [smtpPort, setSmtpPort] = useState(465);
  const [smtpUser, setSmtpUser] = useState("resend");
  const [smtpPassword, setSmtpPassword] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(withBasePath("/api/settings/email"));
        if (res.ok) {
          const data = await res.json();
          if (data.settings) {
            setProvider(data.settings.provider || "resend");
            setDefaultSender(data.settings.default_sender_email || "chathushkanavod11@gmail.com");
            setResendApiKey(data.settings.resend_api_key || "");
            setSmtpHost(data.settings.smtp_host || "smtp.resend.com");
            setSmtpPort(data.settings.smtp_port || 465);
            setSmtpUser(data.settings.smtp_user || "resend");
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
          provider,
          default_sender_email: defaultSender,
          resend_api_key: resendApiKey,
          smtp_host: smtpHost,
          smtp_port: Number(smtpPort),
          smtp_user: smtpUser,
          smtp_password: smtpPassword,
        }),
      });

      if (res.ok) {
        setMessage({ text: "Email & Resend settings saved successfully.", tone: "ok" });
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
      <Card className="p-6">
        <p className="text-xs text-muted">Loading email settings...</p>
      </Card>
    );
  }

  return (
    <Card className="p-6">
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

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted">
            Email Provider
          </label>
          <div className="mt-1.5 flex gap-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-primary">
              <input
                type="radio"
                name="provider"
                value="resend"
                checked={provider === "resend"}
                onChange={() => setProvider("resend")}
                className="text-accent focus:ring-accent"
              />
              Resend (Recommended API)
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-primary">
              <input
                type="radio"
                name="provider"
                value="smtp"
                checked={provider === "smtp"}
                onChange={() => setProvider("smtp")}
                className="text-accent focus:ring-accent"
              />
              Custom SMTP
            </label>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted">
            Default Sender Email
          </label>
          <input
            type="email"
            required
            value={defaultSender}
            onChange={(e) => setDefaultSender(e.target.value)}
            placeholder="chathushkanavod11@gmail.com"
            className="mt-1.5 w-full rounded-xl bg-primary/[0.04] px-3.5 py-2 text-sm text-primary ring-1 ring-inset ring-primary/10 placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
          />
          <p className="mt-1 text-2xs text-muted">
            The email address you want to appear as the sender of job applications.
          </p>
        </div>

        {provider === "resend" ? (
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted">
              Resend API Key
            </label>
            <input
              type="password"
              value={resendApiKey}
              onChange={(e) => setResendApiKey(e.target.value)}
              placeholder="re_xxxxxxxxxxxxxx"
              className="mt-1.5 w-full rounded-xl bg-primary/[0.04] px-3.5 py-2 text-sm text-primary ring-1 ring-inset ring-primary/10 placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <p className="mt-1 text-2xs text-muted">
              Get your API Key from resend.com to send emails with attachments directly.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted">
                SMTP Host
              </label>
              <input
                type="text"
                value={smtpHost}
                onChange={(e) => setSmtpHost(e.target.value)}
                placeholder="smtp.resend.com"
                className="mt-1.5 w-full rounded-xl bg-primary/[0.04] px-3.5 py-2 text-sm text-primary ring-1 ring-inset ring-primary/10 placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted">
                SMTP Port
              </label>
              <input
                type="number"
                value={smtpPort}
                onChange={(e) => setSmtpPort(Number(e.target.value))}
                placeholder="465"
                className="mt-1.5 w-full rounded-xl bg-primary/[0.04] px-3.5 py-2 text-sm text-primary ring-1 ring-inset ring-primary/10 placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted">
                SMTP User
              </label>
              <input
                type="text"
                value={smtpUser}
                onChange={(e) => setSmtpUser(e.target.value)}
                placeholder="resend"
                className="mt-1.5 w-full rounded-xl bg-primary/[0.04] px-3.5 py-2 text-sm text-primary ring-1 ring-inset ring-primary/10 placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted">
                SMTP Password / Key
              </label>
              <input
                type="password"
                value={smtpPassword}
                onChange={(e) => setSmtpPassword(e.target.value)}
                placeholder="••••••••••••"
                className="mt-1.5 w-full rounded-xl bg-primary/[0.04] px-3.5 py-2 text-sm text-primary ring-1 ring-inset ring-primary/10 placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
          </div>
        )}

        <div className="pt-2">
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? "Saving..." : "Save Email Settings"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
