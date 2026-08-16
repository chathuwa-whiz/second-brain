"use client";

import Link from "next/link";

export default function TrialBadge() {
  return (
    <Link
      href="/settings"
      className="press inline-flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-2 py-0.5 text-3xs font-semibold text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
      title="Free Community Edition — All features unlocked"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
      <span>Community Edition</span>
    </Link>
  );
}
