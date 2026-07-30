/*
  Next's `basePath` config (next.config.js) makes the framework itself
  basePath-aware for pages, next/link, next/navigation's redirect(), and API
  route matching — those all just work once basePath is set at build time.

  It does NOT retroactively fix:
    - raw `fetch("/api/...")` calls (a literal browser fetch, not a Next API)
    - raw `<a href="/...">` tags (not next/link, so no auto-prefixing)
    - next-auth's client-side signIn/signOut, which fetch their own API
      routes via a path next-auth tracks separately from Next's basePath

  BASE_PATH is the one place that prefix lives, so those three categories of
  call sites can prepend it explicitly instead of hardcoding "/secondbrain"
  (or getting it wrong) in a dozen files. Must be NEXT_PUBLIC_-prefixed to be
  readable in client components, and should always equal next.config.js's
  NEXT_BASE_PATH — set both together at build time.
*/
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function withBasePath(path: string): string {
  return `${BASE_PATH}${path}`;
}
