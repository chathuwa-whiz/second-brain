/** @type {import('next').NextConfig} */

/*
  basePath must be a build-time constant baked into the bundle, so it's read
  from NEXT_BASE_PATH here (set in the environment that runs `next build`),
  not from a runtime-configurable source. On the VPS this is "/secondbrain",
  since the app lives at chathushka.xubi.org/secondbrain rather than its own
  subdomain. Local dev leaves it unset and runs at the root as before.

  "standalone" output traces only the files actually needed at runtime into
  .next/standalone, instead of relying on the full node_modules tree. On a
  1GB VPS already running n8n, Nginx, and Xray, that's a meaningfully smaller
  footprint to run `node server.js` from — see DEPLOY.md.
*/
const basePath = process.env.NEXT_BASE_PATH || undefined;

const nextConfig = {
  output: "standalone",
  basePath,
};

module.exports = nextConfig;
