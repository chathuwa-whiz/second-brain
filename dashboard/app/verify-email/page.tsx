"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Card } from "@/components/ui";
import { IconCheck, IconMail } from "@/components/icons";
import { withBasePath } from "@/lib/basePath";

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const emailParam = searchParams.get("email");

  const [loading, setLoading] = useState(Boolean(token));
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailInput, setEmailInput] = useState(emailParam || "");
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    let isMounted = true;

    async function verify() {
      try {
        const res = await fetch(
          withBasePath(`/api/auth/verify-email?token=${encodeURIComponent(token!)}`)
        );
        const data = await res.json();

        if (!isMounted) return;

        if (res.ok && data.success) {
          setSuccess(true);
          setError(null);
        } else {
          setError(data.error || "Failed to verify email.");
          setSuccess(false);
        }
      } catch (err) {
        if (isMounted) {
          setError("Network error while verifying your account. Please try again.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    verify();

    return () => {
      isMounted = false;
    };
  }, [token]);

  async function handleResend(e: React.FormEvent) {
    e.preventDefault();
    if (!emailInput) return;

    setResending(true);
    setResendMessage(null);

    try {
      const res = await fetch(withBasePath("/api/auth/verify-email"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailInput }),
      });
      const data = await res.json();
      setResending(false);

      if (res.ok && data.success) {
        setResendMessage(data.message || "A fresh verification link has been sent to your email.");
      } else {
        setResendMessage(data.error || "Failed to resend verification email.");
      }
    } catch {
      setResending(false);
      setResendMessage("Network error. Please try again.");
    }
  }

  return (
    <main className="grid min-h-screen place-items-center px-4 py-8 pb-safe pt-safe sm:py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center sm:mb-8">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-accent to-violet shadow-xl shadow-accent/30 sm:h-14 sm:w-14">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-6 w-6 sm:h-7 sm:w-7"
              aria-hidden="true"
            >
              <path d="M12 4.5a3 3 0 0 0-3 3v9a3 3 0 0 0 6 0v-9a3 3 0 0 0-3-3z" />
              <path d="M9 8.5H6.5a2.5 2.5 0 0 0 0 5H9M15 8.5h2.5a2.5 2.5 0 0 1 0 5H15" />
            </svg>
          </div>
          <h1 className="mt-3.5 text-xl font-semibold tracking-tight text-primary sm:mt-4 sm:text-2xl">
            Second Brain
          </h1>
          <p className="mt-1 text-xs text-secondary sm:text-sm">
            Account Verification
          </p>
        </div>

        <Card className="p-6 text-center sm:p-8">
          {loading && (
            <div className="py-6 space-y-4">
              <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-accent border-t-transparent" />
              <p className="text-sm font-medium text-primary">
                Verifying your email address…
              </p>
              <p className="text-xs text-muted">
                Please wait while we activate your workspace.
              </p>
            </div>
          )}

          {!loading && success && (
            <div className="py-4 space-y-4">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-ok/12 text-ok-ink ring-1 ring-ok/25">
                <IconCheck className="h-7 w-7" />
              </div>
              <h2 className="text-lg font-semibold text-primary">
                Email verified
              </h2>
              <p className="text-xs text-secondary leading-relaxed">
                Your Second Brain workspace is now active and ready for use.
              </p>
              <div className="pt-3">
                <Link href="/login" className="block w-full">
                  <Button variant="primary" className="min-h-[44px] w-full text-sm font-medium">
                    Sign in to your workspace
                  </Button>
                </Link>
              </div>
            </div>
          )}

          {!loading && !success && (
            <div className="py-2 space-y-4 text-left">
              {error && (
                <div className="rounded-xl border border-danger/25 bg-danger/10 p-3.5 text-xs text-danger-ink">
                  <p className="font-semibold">Verification Failed</p>
                  <p className="mt-0.5 leading-relaxed">{error}</p>
                </div>
              )}

              <div className="text-center">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-accent/10 text-accent-ink mb-3">
                  <IconMail className="h-6 w-6" />
                </div>
                <h2 className="text-base font-semibold text-primary">
                  Request a new verification link
                </h2>
                <p className="mt-1 text-xs text-secondary">
                  Enter your email address to receive a fresh verification link.
                </p>
              </div>

              <form onSubmit={handleResend} className="space-y-3.5 mt-4">
                <div className="space-y-1">
                  <label htmlFor="resend-email" className="text-xs font-medium text-secondary">
                    Email Address
                  </label>
                  <input
                    id="resend-email"
                    type="email"
                    placeholder="you@company.com"
                    className="field"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    required
                  />
                </div>

                {resendMessage && (
                  <p className="text-xs font-medium text-accent-ink">{resendMessage}</p>
                )}

                <Button
                  type="submit"
                  variant="primary"
                  disabled={resending}
                  className="min-h-[44px] w-full text-sm font-medium"
                >
                  {resending ? "Sending link…" : "Send verification email"}
                </Button>
              </form>

              <div className="pt-2 text-center">
                <Link
                  href="/login"
                  className="text-xs font-medium text-muted hover:text-primary transition-colors"
                >
                  Back to Sign In
                </Link>
              </div>
            </div>
          )}
        </Card>
      </div>
    </main>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-screen place-items-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
