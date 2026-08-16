"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import AppShell from "./AppShell";

/*
  Some routes own the whole viewport. Onboarding is the important one: it runs
  *before* the user has a workspace to navigate, so a sidebar full of links to
  empty pages, a bottom tab bar, and a "current page" title bar are all noise
  around the one thing they're meant to be doing. Auth screens are the same
  shape - they render for a signed-out visitor today, but a stale session
  cookie would otherwise frame the login form in the shell it's trying to let
  you into.

  This has to be a client component: the root layout is async/server, and the
  decision keys off the pathname.
*/
const STANDALONE = ["/onboarding", "/login", "/verify-email"];

type UserInfo =
  | string
  | {
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role?: string | null;
    }
  | null;

export default function ShellGate({
  user,
  children,
}: {
  user?: UserInfo;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const standalone = STANDALONE.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  if (standalone) return <>{children}</>;

  return <AppShell user={user}>{children}</AppShell>;
}
