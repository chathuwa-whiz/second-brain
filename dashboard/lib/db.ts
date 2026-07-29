import { Pool } from "pg";

// Reused across hot-reloads in dev, single pool in prod.
declare global {
  // eslint-disable-next-line no-var
  var _pgPool: Pool | undefined;
}

export const pool =
  global._pgPool ??
  new Pool({
    connectionString: process.env.LOG_DATABASE_URL,
  });

if (process.env.NODE_ENV !== "production") {
  global._pgPool = pool;
}
