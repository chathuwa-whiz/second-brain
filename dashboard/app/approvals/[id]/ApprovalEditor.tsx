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
  isEmailConfigured = true,
}: {
  action: AgentAction;
  defaultSender: string;
  isEmailConfigured?: boolean;
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSuccessMsg(null);

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
        if (res.status === 504) {
          throw new Error("Mail Gateway Timeout (504): Mail server took too long to respond. Please verify your Gmail address and 16-character Google App Password in Settings > Outbound Email.");
        }
        throw new Error(`Server returned error (${res.status}): ${resText.slice(0, 120)}`);
      }

      if (!res.ok) {
        throw new Error(data.error || "Failed to process application");
      }

      setSuccessMsg(
        mode === "manual"
          ? "Application approved and recorded as applied via website/portal!"
          : "Application approved and email successfully dispatched!"
      );
      setTimeout(() => {
        router.push("/approvals");
      }, 1500);
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
        {/* Left Column: Job Details & AI Match Breakdown */}
        <div className="space-y-5 sm:space-y-6 lg:col-span-1">
          <Card className="p-4 sm:p-5">
            <h3 className="break-words text-base font-semibold text-primary">
              {meta.job_title || "Job Title"}
            </h3>
            <p className="mt-0.5 break-words text-sm font-medium text-secondary">
              {meta.company || "TopJobs Employer"}
            </p>

            <div className="mt-4 flex items-center justify-between gap-2 border-t pt-3">
              <span className="text-xs text-muted">Match Score</span>
              <div className="flex items-center gap-2">
                <ConfidenceMeter value={confidence} threshold={0.7} />
                <span className="tnum text-xs font-semibold text-primary">
                  {meta.match_score ? `${meta.match_score}%` : `${(confidence * 100).toFixed(0)}%`}
                </span>
              </div>
            </div>

            {meta.closing_date && (
              <p className="mt-2 text-xs text-muted">
                Deadline: <span className="font-medium text-secondary">{meta.closing_date}</span>
              </p>
            )}

            {meta.job_url && (
              <a
                href={meta.job_url}
                target="_blank"
                rel="noreferrer noopener"
                className="press mt-3 inline-flex items-center gap-1.5 rounded-xl bg-primary/[0.04] px-3 py-1.5 text-xs font-medium text-accent-ink hover:bg-primary/[0.08]"
              >
                Open TopJobs Posting
                <IconExternal className="h-3.5 w-3.5" />
              </a>
            )}

            {meta.match_reasons && Array.isArray(meta.match_reasons) && (
              <div className="mt-4 border-t pt-3">
                <p className="text-2xs font-semibold uppercase tracking-wider text-muted">
                  Why this role matched
                </p>
                <ul className="mt-2 space-y-1.5 text-xs text-secondary">
                  {meta.match_reasons.map((r: string, i: number) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="shrink-0 text-ok-ink">✓</span>
                      <span className="break-words">{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>

          {meta.poster_image_url && (
            <Card className="overflow-hidden p-3.5 sm:p-4">
              <p className="mb-2 text-2xs font-semibold uppercase tracking-wider text-muted">
                Job Poster Artwork
              </p>
              <div className="overflow-hidden rounded-xl bg-black/5">
                <img
                  src={meta.poster_image_url}
                  alt="Job Poster"
                  className="max-h-[360px] w-full object-contain sm:max-h-[460px]"
                />
              </div>
            </Card>
          )}
        </div>

        {/* Right Column: Application Customizer & Email / Website Action */}
        <div className="lg:col-span-2">
          <Card className="p-4 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-semibold text-primary">
                  Application Method & Review
                </h3>
                <p className="mt-0.5 text-xs text-muted">
                  Choose whether to dispatch an email application or record a direct website submission.
                </p>
              </div>

              {/* Mode Selector - same segmented control as the other boards */}
              <div className="flex w-full gap-1 rounded-xl bg-primary/[0.04] p-1 sm:w-auto">
                <button
                  type="button"
                  onClick={() => setMode("email")}
                  aria-pressed={mode === "email"}
                  className={`press flex-1 rounded-lg px-3 py-1.5 text-center text-xs transition-colors sm:flex-initial ${
                    mode === "email"
                      ? "bg-raised font-medium text-primary shadow-sm"
                      : "text-secondary hover:text-primary"
                  }`}
                >
                  Send email
                </button>
                <button
                  type="button"
                  onClick={() => setMode("manual")}
                  aria-pressed={mode === "manual"}
                  className={`press flex-1 rounded-lg px-3 py-1.5 text-center text-xs transition-colors sm:flex-initial ${
                    mode === "manual"
                      ? "bg-raised font-medium text-primary shadow-sm"
                      : "text-secondary hover:text-primary"
                  }`}
                >
                  Website / portal
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              {/* Resume Selector */}
              <div>
                <label className="block text-xs font-medium text-primary">
                  Resume version
                </label>
                <select
                  value={selectedResume}
                  onChange={(e) => setSelectedResume(e.target.value)}
                  className="field select-field mt-1.5"
                >
                  {resumes.map((r) => (
                    <option key={r} value={r}>
                      {r} {r === meta.suggested_resume ? "(AI Recommended)" : ""}
                    </option>
                  ))}
                </select>
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
                      <p className="text-sm font-medium text-primary">
                        Apply via Company Website / Careers Portal
                      </p>
                      <p className="mt-0.5 text-xs text-muted">
                        Use this option when the employer requires applying through their website or portal rather than email.
                      </p>
                    </div>
                    {meta.job_url && (
                      <a
                        href={meta.job_url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="press inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-accent-solid px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:brightness-110"
                      >
                        Open Portal
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
                      placeholder="e.g. Submitted on company careers portal with Resume.pdf"
                      className="field mt-1.5"
                    />
                  </div>
                </div>
              ) : (
                /* Email Dispatch Mode */
                <div className="space-y-4">
                  {!isEmailConfigured && (
                    <div className="rounded-xl bg-warn/10 p-3.5 ring-1 ring-inset ring-warn/25">
                      <div className="flex items-start gap-2.5">
                        <span className="text-sm">⚠️</span>
                        <div className="min-w-0 flex-1 text-xs">
                          <p className="font-semibold text-warn-ink">
                            Outgoing Email Account Not Configured
                          </p>
                          <p className="mt-0.5 text-secondary">
                            To send application emails directly from Second Brain, enter your Gmail address and 16-character Google App Password in{" "}
                            <Link href="/settings" className="font-medium text-accent-ink underline">
                              Settings &gt; Outbound Email Account
                            </Link>
                            , or switch above to <strong>Website / portal</strong> mode to apply directly on the employer&apos;s site.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="grid gap-3.5 sm:grid-cols-2 sm:gap-4">
                    <div>
                      <label className="block text-xs font-medium text-primary">
                        Sender Email
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
                        Recipient (Employer Email)
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
                    <label className="block text-xs font-medium text-primary">
                      Email Body (Cover Letter)
                    </label>
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

              <div className="flex flex-col gap-2.5 border-t pt-4 sm:flex-row sm:items-center sm:gap-3">
                <Button
                  type="submit"
                  variant="approve"
                  disabled={busy}
                  className="w-full px-6 py-2 text-xs sm:w-auto sm:text-sm"
                >
                  {busy
                    ? "Processing..."
                    : mode === "manual"
                    ? "Approve & Mark Applied"
                    : "Approve & Send Application"}
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
