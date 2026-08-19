/** @type {import('next').NextConfig} */

/*
  basePath must be a build-time constant baked into the bundle, so it's read
  from NEXT_BASE_PATH here (set in the environment that runs `next build`),
  not from a runtime-configurable source. On the VPS this is "/secondbrain",
  since the app lives at secondbrain.xubi.org/secondbrain rather than its own
  subdomain. Local dev leaves it unset and runs at the root as before.

  "standalone" output traces only the files actually needed at runtime into
  .next/standalone, instead of relying on the full node_modules tree. On a
  1GB VPS already running n8n, Nginx, and Xray, that's a meaningfully smaller
  footprint to run `node server.js` from — see DEPLOY.md.

  skipTrailingSlashRedirect: Next has its own opinion about trailing slashes
  on the basePath root and will 30x-redirect to enforce it. Behind a reverse
  proxy (Nginx here), that redirect can disagree with how the proxy already
  normalized the request, and the two volley forever — ERR_TOO_MANY_REDIRECTS
  on "/secondbrain" with no /login ever appearing in the loop is exactly that
  signature. This is the officially documented fix for a custom-server/proxy
  setup: https://nextjs.org/docs/app/api-reference/next-config-js/skipTrailingSlashRedirect
  — it tells Next to leave trailing-slash handling entirely to the proxy
  layer instead of asserting its own.
*/
const basePath = process.env.NEXT_BASE_PATH || undefined;

const nextConfig = {
  output: "standalone",
  basePath,
  skipTrailingSlashRedirect: true,
  // Approvals and Resumes moved under /jobs when the Jobs module became
  // self-contained (its own tab strip: Board/Approvals/Resumes/Settings).
  // These keep old bookmarks and browser history working.
  async redirects() {
    return [
      { source: "/approvals", destination: "/jobs/approvals", permanent: true },
      { source: "/approvals/:id", destination: "/jobs/approvals/:id", permanent: true },
      { source: "/resumes", destination: "/jobs/resumes", permanent: true },
    ];
  },
};

module.exports = nextConfig;
