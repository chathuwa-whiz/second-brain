"use client";

import { useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button, Card, ErrorNote } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await signIn("credentials", {
      username,
      password,
      redirect: false,
    });

    setLoading(false);
    if (res?.error) {
      setError("That username and password don't match. Try again.");
      return;
    }
    router.push("/");
    router.refresh();
  }

  const field =
    "w-full min-h-[44px] rounded-xl bg-primary/[0.04] px-3.5 py-2.5 text-sm text-primary outline-none ring-1 ring-inset ring-hairline/15 transition-shadow placeholder:text-muted focus:ring-2 focus:ring-accent";

  return (
    <main className="grid min-h-screen place-items-center px-4 py-8 pb-safe pt-safe sm:py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center sm:mb-7">
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
          <h1 className="mt-3.5 text-lg font-semibold tracking-tight text-primary sm:mt-4 sm:text-xl">
            Second Brain
          </h1>
          <p className="mt-1 text-xs text-secondary sm:text-sm">
            Sign in to the control panel.
          </p>
        </div>

        <Card className="p-5 sm:p-6">
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="username"
                className="text-xs font-medium text-secondary"
              >
                Username
              </label>
              <input
                id="username"
                className={field}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="password"
                className="text-xs font-medium text-secondary"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                className={field}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>

            {error && <ErrorNote>{error}</ErrorNote>}

            <Button
              type="submit"
              variant="primary"
              disabled={loading}
              className="min-h-[44px] w-full text-sm font-semibold"
            >
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </Card>
      </div>
    </main>
  );
}
