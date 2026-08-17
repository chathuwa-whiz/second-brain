"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Badge, Button, Card, ConfidenceMeter, ErrorNote } from "@/components/ui";
import { IconExternal } from "@/components/icons";
import { withBasePath } from "@/lib/basePath";
import type { AgentAction } from "@/lib/db";

export default function ApprovalEditor({
  action,
  defaultSender,
}: {
  action: AgentAction;
  defaultSender: string;
}) {
  const router = useRouter();
  const meta = (action.metadata || {}) as Record<string, any>;

  const [resumes, setResumes] = useState<string[]>([]);
  const [selectedResume, setSelectedResume] = useState<string>(
    meta.suggested_resume || ""
  );
  const [mode, setMode] = useState<"email" | "manual">(
    meta.recipient_email || meta.how_to_apply_email ? "email" : "manual"
  );
  const [senderEmail, setSenderEmail] = useState<string>(
    meta.sender_email || defaultSender || ""
  );
  const [recipientEmail, setRecipientEmail] = useState<string>(
    meta.recipient_email || meta.how_to_apply_email || ""
  );
  const [subject, setSubject] = useState<string>(
    meta.email_subject || (meta.job_title ? `Application for ${meta.job_title}` : "Job Application")
  );
  const [emailBody, setEmailBody] = useState<string>(
    meta.email_body || ""
  );
  const [manualNotes, setManualNotes] = useState<string>(
    "Applied directly via employer website / careers portal."
  );

  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    async function loadResumes() {
      try {
        const res = await fetch(withBasePath("/api/resumes"));
        if (res.ok) {
          const data = await res.json();
          if (data.files && data.files.length > 0) {
            setResumes(data.files.map((f: { name: string }) => f.name));
          }
        }
      } catch (err) {
        console.warn("Could not load resumes:", err);
      }
    }
    loadResumes();
  }, []);

  function handleCopyCoverLetter() {
    if (!emailBody) return;
    navigator.clipboard.writeText(emailBody);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSuccessMsg(null);

    // Automatically open Gmail compose or Website portal in a new tab upon clicking Approve
    if (mode === "email") {
      const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(
        recipientEmail
      )}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(emailBody)}`;
      window.open(gmailUrl, "_blank", "noopener,noreferrer");
    } else if (mode === "manual" && meta.job_url) {
      window.open(meta.job_url, "_blank", "noopener,noreferrer");
    }

    try {
      const res = await fetch(withBasePath(`/api/approvals/${action.id}/send`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          sender_email: senderEmail,
          recipient_email: recipientEmail,
          subject,
          email_body: emailBody,
          resume_filename: selectedResume,
          notes: manualNotes,
        }),
      });

      const resText = await res.text();
      let data: any = {};
      try {
        data = JSON.parse(resText);
      } catch {
        throw new Error(`Server returned error (${res.status}): ${resText.slice(0, 120)}`);
      }

      if (!res.ok) {
        throw new Error(data.error || "Failed to process application");
      }

      setSuccessMsg(
        mode === "manual"
          ? "Application recorded! Opened employer careers portal."
          : "Application recorded! Opened pre-filled email in Gmail."
      );
      setTimeout(() => {
        router.push("/approvals");
      }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process approval");
    } finally {
      setBusy(false);
    }
  }

  async function handleReject() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(withBasePath(`/api/actions/${action.id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "rejected" }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to reject action");
      }
      router.push("/approvals");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reject action");
    } finally {
      setBusy(false);
    }
  }

  const confidence = Number(action.confidence);
  const posterUrl =
    meta.poster_image_url ||
    meta.posterImageUrl ||
    meta.poster_url ||
    meta.image_url ||
    meta.imageUrl ||
    meta.poster ||
    null;

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <Link
          href="/approvals"
          className="press inline-flex items-center text-xs font-medium text-muted hover:text-primary"
        >
          ← Back to Approvals Queue
        </Link>
        <Badge tone={action.status === "pending" ? "warn" : "ok"}>
          {action.status === "pending" ? "Awaiting Approval" : action.status}
        </Badge>
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}
      {successMsg && (
        <div className="rounded-2xl bg-ok/10 p-4 text-xs font-medium text-ok-ink ring-1 ring-ok/25 sm:text-sm">
          {successMsg}
        </div>
      )}

      <div className="grid gap-5 sm:gap-6 lg:grid-cols-3">
        {/* Left Column: Job & Match Details */}
        <div className="space-y-5 lg:col-span-1">
          {/* Job Overview Card */}
          <Card className="p-4 sm:p-5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">
              Job Position
            </h3>
            <p className="mt-2 text-base font-bold text-primary">
              {meta.job_title || meta.extracted_job_title || "Target Role"}
            </p>
            <p className="text-sm font-medium text-secondary">
              {meta.company || meta.extracted_company || "Target Company"}
            </p>
            {meta.location && (
              <p className="mt-1 text-xs text-muted">📍 {meta.location}</p>
            )}

            {meta.job_url && (
              <a
                href={meta.job_url}
                target="_blank"
                rel="noreferrer noopener"
                className="press mt-3.5 inline-flex items-center gap-1 text-xs font-medium text-accent-ink hover:underline"
              >
                View Original Job Posting
                <IconExternal className="h-3 w-3" />
              </a>
            )}
          </Card>

          {/* Job Advertisement Poster Card (if available) */}
          {posterUrl && (
            <Card className="overflow-hidden p-4 sm:p-5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">
                  Advertisement Poster
                </h3>
                <a
                  href={posterUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="press inline-flex items-center gap-1 text-2xs font-medium text-accent-ink hover:underline"
                >
                  Open Original
                  <IconExternal className="h-2.5 w-2.5" />
                </a>
              </div>
              <div className="relative mt-3 overflow-hidden rounded-xl border border-primary/10 bg-primary/[0.02]">
                <img
                  src={posterUrl}
                  alt={meta.job_title ? `${meta.job_title} Poster` : "Job Advertisement Poster"}
                  className="max-h-80 w-full object-contain transition-transform duration-200 hover:scale-[1.02]"
                  loading="lazy"
                />
              </div>
            </Card>
          )}

          {/* AI Match Quality & Scoring */}
          <Card className="p-4 sm:p-5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">
              AI Match Analysis
            </h3>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs font-medium text-secondary">Match Confidence</span>
              <span className="font-mono text-sm font-bold text-primary">
                {Math.round(confidence * 100)}%
              </span>
            </div>
            <div className="mt-2">
              <ConfidenceMeter value={confidence} />
            </div>

            {meta.match_score && (
              <div className="mt-3.5 border-t pt-3 text-xs">
                <div className="flex justify-between text-muted">
                  <span>Relevance Score:</span>
                  <span className="font-mono font-semibold text-primary">
                    {meta.match_score}/100
                  </span>
                </div>
              </div>
            )}

            {meta.fit_reason && (
              <div className="mt-3 rounded-xl bg-primary/[0.03] p-3 text-xs leading-relaxed text-secondary ring-1 ring-inset ring-primary/10">
                <p className="font-semibold text-primary">Why this is a strong match:</p>
                <p className="mt-1">{meta.fit_reason}</p>
              </div>
            )}
          </Card>
        </div>

        {/* Right Column: Application Customizer & Action */}
        <div className="lg:col-span-2">
          <Card className="p-4 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-semibold text-primary">
                  Application Method & Review
                </h3>
                <p className="mt-0.5 text-xs text-muted">
                  Choose whether to apply via Gmail or submit on the company&apos;s website.
                </p>
              </div>

              {/* Mode Selector */}
              <div className="flex w-full gap-1 rounded-xl bg-primary/[0.04] p-1 sm:w-auto">
                <button
                  type="button"
                  onClick={() => setMode("email")}
                  aria-pressed={mode === "email"}
                  className={`press flex-1 rounded-lg px-3.5 py-1.5 text-center text-xs transition-colors sm:flex-initial ${
                    mode === "email"
                      ? "bg-raised font-medium text-primary shadow-sm"
                      : "text-secondary hover:text-primary"
                  }`}
                >
                  ✉️ Email / Gmail
                </button>
                <button
                  type="button"
                  onClick={() => setMode("manual")}
                  aria-pressed={mode === "manual"}
                  className={`press flex-1 rounded-lg px-3.5 py-1.5 text-center text-xs transition-colors sm:flex-initial ${
                    mode === "manual"
                      ? "bg-raised font-medium text-primary shadow-sm"
                      : "text-secondary hover:text-primary"
                  }`}
                >
                  🌐 Website / Portal
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              {/* Resume Selector */}
              <div>
                <label className="block text-xs font-medium text-primary">
                  Target Resume Version
                </label>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <select
                    value={selectedResume}
                    onChange={(e) => setSelectedResume(e.target.value)}
                    className="field select-field flex-1"
                  >
                    {resumes.map((r) => (
                      <option key={r} value={r}>
                        {r} {r === meta.suggested_resume ? "(AI Recommended)" : ""}
                      </option>
                    ))}
                  </select>

                  {selectedResume && (
                    <a
                      href={withBasePath(`/api/resumes/${encodeURIComponent(selectedResume)}`)}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="press inline-flex items-center gap-1.5 rounded-xl border border-primary/15 bg-raised px-3.5 py-2 text-xs font-semibold text-primary shadow-xs hover:bg-primary/[0.04]"
                    >
                      Download Resume 📥
                    </a>
                  )}
                </div>

                {meta.suggested_resume_reason && (
                  <p className="mt-1 break-words text-2xs text-accent-ink">
                    💡 AI recommendation: {meta.suggested_resume_reason}
                  </p>
                )}
              </div>

              {mode === "manual" ? (
                /* Manual Website Apply Mode */
                <div className="space-y-3.5 rounded-xl bg-primary/[0.02] p-3.5 ring-1 ring-inset ring-primary/10 sm:space-y-4 sm:p-4">
                  <div className="flex flex-col justify-between gap-2.5 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-primary">
                        Apply via Company Careers Portal
                      </p>
                      <p className="mt-0.5 text-xs text-muted">
                        Clicking Approve will open the company&apos;s application portal in a new tab, ready for you to attach your downloaded resume.
                      </p>
                    </div>
                    {meta.job_url && (
                      <a
                        href={meta.job_url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="press inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-accent-solid px-4 py-2 text-xs font-semibold text-white shadow-sm hover:brightness-110"
                      >
                        Open Portal ↗
                        <IconExternal className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-primary">
                      Application Notes
                    </label>
                    <input
                      type="text"
                      value={manualNotes}
                      onChange={(e) => setManualNotes(e.target.value)}
                      placeholder="e.g. Submitted on company careers portal with selected Resume"
                      className="field mt-1.5"
                    />
                  </div>
                </div>
              ) : (
                /* Email Mode */
                <div className="space-y-4">
                  <div className="grid gap-3.5 sm:grid-cols-2 sm:gap-4">
                    <div>
                      <label className="block text-xs font-medium text-primary">
                        Your Contact Email
                      </label>
                      <input
                        type="email"
                        required
                        value={senderEmail}
                        onChange={(e) => setSenderEmail(e.target.value)}
                        className="field mt-1.5"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-primary">
                        Employer Recipient Email
                      </label>
                      <input
                        type="email"
                        required
                        value={recipientEmail}
                        onChange={(e) => setRecipientEmail(e.target.value)}
                        placeholder="careers@company.com"
                        className="field mt-1.5"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-primary">
                      Email Subject
                    </label>
                    <input
                      type="text"
                      required
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="field mt-1.5"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-medium text-primary">
                        Email Body (Cover Letter)
                      </label>
                      <button
                        type="button"
                        onClick={handleCopyCoverLetter}
                        className="text-2xs font-semibold text-accent-ink hover:underline"
                      >
                        {copied ? "Copied to clipboard! ✓" : "Copy cover letter"}
                      </button>
                    </div>
                    <textarea
                      rows={9}
                      required
                      value={emailBody}
                      onChange={(e) => setEmailBody(e.target.value)}
                      className="field mt-1.5 leading-relaxed"
                    />
                  </div>
                </div>
              )}

              {/* Approval Actions */}
              <div className="flex flex-col gap-2.5 border-t pt-4 sm:flex-row sm:items-center sm:gap-3">
                <Button
                  type="submit"
                  variant="approve"
                  disabled={busy}
                  className="w-full px-6 py-2 text-xs sm:w-auto sm:text-sm"
                >
                  {busy
                    ? "Opening & Recording..."
                    : mode === "manual"
                    ? "Approve & Mark as Applied"
                    : "Approve & Mark as Sent"}
                </Button>

                <Button
                  type="button"
                  variant="reject"
                  disabled={busy}
                  onClick={handleReject}
                  className="w-full text-xs sm:w-auto"
                >
                  Reject & Dismiss
                </Button>
              </div>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
