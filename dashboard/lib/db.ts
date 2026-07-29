import { Pool } from "pg";

// Reused across hot-reloads in dev, single pool in prod.
declare global {
  // eslint-disable-next-line no-var
  var _pgPool: Pool | undefined;
}

const connectionString = process.env.LOG_DATABASE_URL;
if (!connectionString) {
  throw new Error(
    "LOG_DATABASE_URL is not set. Put your Postgres connection string " +
      "(e.g. a Neon connection string) in .env.local — never hardcode it " +
      "here or commit it. See .env.example."
  );
}

// Neon (and most managed Postgres) requires TLS. node-postgres doesn't
// reliably honor `sslmode=require` embedded in the connection string, so
// enable it explicitly for anything that isn't a local/dev database.
const isLocal = /localhost|127\.0\.0\.1/.test(connectionString);

export const pool =
  global._pgPool ??
  new Pool({
    connectionString,
    ssl: isLocal ? undefined : { rejectUnauthorized: false },
  });

if (process.env.NODE_ENV !== "production") {
  global._pgPool = pool;
}
