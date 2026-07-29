"use client";

import { useState, FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
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
      setError("Invalid username or password");
      return;
    }
    router.push("/actions");
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 rounded-xl border border-slate-800 bg-slate-900 p-6"
      >
        <h1 className="text-xl font-semibold">Second Brain</h1>
        <p className="text-sm text-slate-400">Sign in to view the agent log.</p>

        <div className="space-y-1">
          <label className="text-sm text-slate-300">Username</label>
          <input
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 outline-none focus:border-slate-500"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm text-slate-300">Password</label>
          <input
            type="password"
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 outline-none focus:border-slate-500"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-slate-100 px-3 py-2 font-medium text-slate-900 hover:bg-white disabled:opacity-50"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </main>
  );
}
