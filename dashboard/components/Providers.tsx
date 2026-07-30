"use client";

import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";

/* next-auth's client hooks (signOut in the shell) need this above them. */
export default function Providers({ children }: { children: ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
