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

  const [resumes, setResumes] = useState<string[]>([
    "CHATHUSHKA_W.pdf",
    "CHATHUSHKA_M.pdf",
    "CHATHUSHKA NAVOD RESUME.pdf",
    "Chathushka_Navod_Resume_SoftwareEngineer.pdf",
  ]);
  const [selectedResume, setSelectedResume] = useState<string>(
    meta.suggested_resume || "Chathushka_Navod_Resume_SoftwareEngineer.pdf"
  );
  const [mode, setMode] = useState<"email" | "manual">(
    meta.recipient_email || meta.how_to_apply_email ? "email" : "manual"
  );
  const [senderEmail, setSenderEmail] = useState<string>(
    meta.sender_email || defaultSender || "chathushkanavod11@gmail.com"
  );
  const [recipientEmail, setRecipientEmail] = useState<string>(
    meta.recipient_email || meta.how_to_apply_email || ""
  );
  const [subject, setSubject] = useState<string>(
    meta.email_subject || `Application for ${meta.job_title || "Role"} - Chathushka Navod`
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

      const data = await res.json();
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href="/approvals"
          className="text-xs font-medium text-muted hover:text-primary"
        >
          ← Back to Approvals Queue
        </Link>
        <Badge tone={action.status === "pending" ? "warn" : "ok"}>
          {action.status === "pending" ? "Awaiting Approval" : action.status}
        </Badge>
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}
      {successMsg && (
        <div className="rounded-2xl bg-ok/10 p-4 text-sm font-medium text-ok ring-1 ring-ok/25">
          {successMsg}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column: Job Details & AI Match Breakdown */}
        <div className="space-y-6 lg:col-span-1">
          <Card className="p-5">
            <h3 className="text-base font-semibold text-primary">
              {meta.job_title || "Job Title"}
            </h3>
            <p className="text-sm font-medium text-secondary">
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
                rel="noreferrer"
                className="press mt-3 inline-flex items-center gap-1.5 rounded-xl bg-primary/[0.04] px-3 py-1.5 text-xs font-medium text-accent hover:bg-primary/[0.08]"
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
                      <span className="text-ok">✓</span> {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>

          {meta.poster_image_url && (
            <Card className="overflow-hidden p-4">
              <p className="mb-2 text-2xs font-semibold uppercase tracking-wider text-muted">
                Job Poster Artwork
              </p>
              <div className="overflow-hidden rounded-xl bg-black/5">
                <img
                  src={meta.poster_image_url}
                  alt="Job Poster"
                  className="w-full object-contain"
                />
              </div>
            </Card>
          )}
        </div>

        {/* Right Column: Application Customizer & Email / Website Action */}
        <div className="lg:col-span-2">
          <Card className="p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-primary">
                  Application Method & Review
                </h3>
                <p className="text-xs text-muted">
                  Choose whether to dispatch an email application or record a direct website submission.
                </p>
              </div>

              {/* Mode Selector */}
              <div className="glass inline-flex rounded-xl p-0.5">
                <button
                  type="button"
                  onClick={() => setMode("email")}
                  className={`press rounded-lg px-3 py-1 text-xs font-medium ${
                    mode === "email"
                      ? "bg-accent text-white shadow-sm"
                      : "text-secondary hover:text-primary"
                  }`}
                >
                  Send Email
                </button>
                <button
                  type="button"
                  onClick={() => setMode("manual")}
                  className={`press rounded-lg px-3 py-1 text-xs font-medium ${
                    mode === "manual"
                      ? "bg-accent text-white shadow-sm"
                      : "text-secondary hover:text-primary"
                  }`}
                >
                  Website / Portal
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              {/* Resume Selector */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted">
                  Resume Version
                </label>
                <select
                  value={selectedResume}
                  onChange={(e) => setSelectedResume(e.target.value)}
                  className="mt-1.5 w-full rounded-xl bg-chrome px-3.5 py-2.5 text-sm text-primary ring-1 ring-inset ring-primary/10 focus:outline-none focus:ring-2 focus:ring-accent [&>option]:bg-chrome [&>option]:text-primary"
                >
                  {resumes.map((r) => (
                    <option key={r} value={r} className="bg-chrome text-primary py-1.5">
                      {r} {r === meta.suggested_resume ? "(AI Recommended)" : ""}
                    </option>
                  ))}
                </select>
                {meta.suggested_resume_reason && (
                  <p className="mt-1 text-2xs text-accent">
                    💡 AI recommendation: {meta.suggested_resume_reason}
                  </p>
                )}
              </div>

              {mode === "manual" ? (
                /* Manual Website Apply Mode */
                <div className="space-y-4 rounded-xl bg-primary/[0.02] p-4 ring-1 ring-inset ring-primary/10">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-primary">
                        Apply via Company Website / Careers Portal
                      </p>
                      <p className="text-xs text-muted">
                        Use this option when the employer requires applying through their website or portal rather than email.
                      </p>
                    </div>
                    {meta.job_url && (
                      <a
                        href={meta.job_url}
                        target="_blank"
                        rel="noreferrer"
                        className="press inline-flex items-center gap-1.5 rounded-xl bg-accent px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-accent-deep"
                      >
                        Open Portal
                        <IconExternal className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-muted">
                      Application Notes
                    </label>
                    <input
                      type="text"
                      value={manualNotes}
                      onChange={(e) => setManualNotes(e.target.value)}
                      placeholder="e.g. Submitted on company careers portal with CHATHUSHKA_W.pdf"
                      className="mt-1.5 w-full rounded-xl bg-chrome px-3.5 py-2 text-sm text-primary ring-1 ring-inset ring-primary/10 focus:outline-none focus:ring-2 focus:ring-accent"
                    />
                  </div>
                </div>
              ) : (
                /* Email Dispatch Mode */
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-muted">
                        Sender Email
                      </label>
                      <input
                        type="email"
                        required
                        value={senderEmail}
                        onChange={(e) => setSenderEmail(e.target.value)}
                        className="mt-1.5 w-full rounded-xl bg-chrome px-3.5 py-2 text-sm text-primary ring-1 ring-inset ring-primary/10 focus:outline-none focus:ring-2 focus:ring-accent"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-muted">
                        Recipient (Employer Email)
                      </label>
                      <input
                        type="email"
                        required
                        value={recipientEmail}
                        onChange={(e) => setRecipientEmail(e.target.value)}
                        placeholder="careers@company.com"
                        className="mt-1.5 w-full rounded-xl bg-chrome px-3.5 py-2 text-sm text-primary ring-1 ring-inset ring-primary/10 focus:outline-none focus:ring-2 focus:ring-accent"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-muted">
                      Email Subject
                    </label>
                    <input
                      type="text"
                      required
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="mt-1.5 w-full rounded-xl bg-chrome px-3.5 py-2 text-sm text-primary ring-1 ring-inset ring-primary/10 focus:outline-none focus:ring-2 focus:ring-accent"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-muted">
                      Email Body (Cover Letter)
                    </label>
                    <textarea
                      rows={9}
                      required
                      value={emailBody}
                      onChange={(e) => setEmailBody(e.target.value)}
                      className="mt-1.5 w-full rounded-xl bg-chrome p-3.5 font-mono text-xs leading-relaxed text-primary ring-1 ring-inset ring-primary/10 focus:outline-none focus:ring-2 focus:ring-accent"
                    />
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3 border-t pt-4">
                <Button
                  type="submit"
                  variant="approve"
                  disabled={busy}
                  className="px-6 py-2 text-sm"
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
                  className="text-xs"
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
