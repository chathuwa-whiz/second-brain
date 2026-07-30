"use client";

import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";
import { BASE_PATH } from "@/lib/basePath";

/*
  next-auth's client hooks (signOut/useSession in the shell) need this above
  them. The basePath prop tells next-auth's client library where its own API
  routes actually live once Next's basePath is set - without it, signIn/
  signOut/session fetches would hit "/api/auth/..." literally and 404 under
  "/secondbrain/api/auth/...". Falls back to next-auth's own default
  ("/api/auth") when BASE_PATH is empty, i.e. local dev at the root.
*/
export default function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider basePath={`${BASE_PATH}/api/auth`}>
      {children}
    </SessionProvider>
  );
}
