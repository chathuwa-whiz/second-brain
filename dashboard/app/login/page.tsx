"use client";

import { useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Card, ErrorNote } from "@/components/ui";
import { IconGoogle } from "@/components/icons";
import { withBasePath } from "@/lib/basePath";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function handleGoogleSignIn() {
    setGoogleLoading(true);
    setError(null);
    try {
      await signIn("google", { callbackUrl });
    } catch (err) {
      console.error("Google sign in failed:", err);
      setError("Failed to initialize Google Sign In.");
      setGoogleLoading(false);
    }
  }

  async function handleSignIn(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      setLoading(false);

      if (res?.error) {
        setError(
          res.error === "CredentialsSignin"
            ? "Invalid email or password."
            : res.error
        );
        return;
      }

      router.push(callbackUrl);
      router.refresh();
    } catch (err) {
      setLoading(false);
      setError("An unexpected error occurred. Please try again.");
    }
  }

  async function handleSignUp(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(withBasePath("/api/auth/register"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setLoading(false);
        setError(data.error || "Failed to create account.");
        return;
      }

      // Auto sign-in immediately after account creation
      const signinRes = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      setLoading(false);

      if (signinRes?.error) {
        setError("Account created! Please enter your password to sign in.");
        setMode("signin");
        return;
      }

      // Route directly to onboarding wizard for new user setup
      router.push(withBasePath("/onboarding"));
      router.refresh();
    } catch (err) {
      setLoading(false);
      setError("Failed to register. Please try again.");
    }
  }

  const field =
    "w-full min-h-[44px] rounded-xl bg-primary/[0.04] px-3.5 py-2.5 text-sm text-primary outline-none ring-1 ring-inset ring-hairline/15 transition-shadow placeholder:text-muted focus:ring-2 focus:ring-accent";

  return (
    <main className="grid min-h-screen place-items-center px-4 py-8 pb-safe pt-safe sm:py-12">
      <div className="w-full max-w-md">
        {/* Brand Header */}
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
          <h1 className="mt-3.5 text-xl font-bold tracking-tight text-primary sm:mt-4 sm:text-2xl">
            Second Brain
          </h1>
          <p className="mt-1 text-xs text-secondary sm:text-sm">
            {mode === "signin"
              ? "Sign in to your autonomous AI workspace"
              : "Create your personal AI & career copilot workspace"}
          </p>
        </div>

        <Card className="p-5 sm:p-7 shadow-2xl">
          {/* Mode Switcher Tabs */}
          <div className="mb-5 grid grid-cols-2 gap-1 rounded-xl bg-primary/[0.05] p-1 text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setMode("signin");
                setError(null);
              }}
              className={`rounded-lg py-2 transition-all ${
                mode === "signin"
                  ? "bg-card text-primary shadow-sm"
                  : "text-secondary hover:text-primary"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("signup");
                setError(null);
              }}
              className={`rounded-lg py-2 transition-all ${
                mode === "signup"
                  ? "bg-card text-primary shadow-sm"
                  : "text-secondary hover:text-primary"
              }`}
            >
              Create Account
            </button>
          </div>

          {/* Social Google OAuth Button */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={googleLoading || loading}
            className="press flex min-h-[44px] w-full items-center justify-center gap-3 rounded-xl border border-hairline/20 bg-primary/[0.03] px-4 py-2.5 text-sm font-medium text-primary shadow-sm hover:bg-primary/[0.07] focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50"
          >
            <IconGoogle className="h-5 w-5" />
            <span>{googleLoading ? "Connecting to Google…" : "Continue with Google"}</span>
          </button>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-hairline/15" />
            <span className="text-2xs font-medium uppercase tracking-wider text-muted">
              or continue with email
            </span>
            <div className="h-px flex-1 bg-hairline/15" />
          </div>

          {/* Form */}
          <form
            onSubmit={mode === "signin" ? handleSignIn : handleSignUp}
            className="space-y-4"
          >
            {mode === "signup" && (
              <div className="space-y-1.5">
                <label
                  htmlFor="name"
                  className="text-xs font-medium text-secondary"
                >
                  Full Name
                </label>
                <input
                  id="name"
                  type="text"
                  placeholder="Alex Morgan"
                  className={field}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  required={mode === "signup"}
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className="text-xs font-medium text-secondary"
              >
                Email Address
              </label>
              <input
                id="email"
                type="email"
                placeholder="you@company.com"
                className={field}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="text-xs font-medium text-secondary"
                >
                  Password
                </label>
                {mode === "signup" && (
                  <span className="text-2xs text-muted">Min. 8 characters</span>
                )}
              </div>
              <input
                id="password"
                type="password"
                placeholder="••••••••"
                className={field}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={
                  mode === "signin" ? "current-password" : "new-password"
                }
                minLength={mode === "signup" ? 8 : undefined}
                required
              />
            </div>

            {error && <ErrorNote>{error}</ErrorNote>}

            <Button
              type="submit"
              variant="primary"
              disabled={loading || googleLoading}
              className="min-h-[44px] w-full text-sm font-semibold mt-2"
            >
              {loading
                ? mode === "signin"
                  ? "Signing in…"
                  : "Creating account…"
                : mode === "signin"
                ? "Sign in"
                : "Create Account"}
            </Button>
          </form>
        </Card>

        {/* Footer Note */}
        <p className="mt-6 text-center text-2xs text-muted">
          By signing in, you agree to Second Brain's Terms of Service and Privacy Policy.
        </p>
      </div>
    </main>
  );
}
