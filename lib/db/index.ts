import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Postgres connection (Azure Database for PostgreSQL, Flexible Server).
 *
 * Azure rejects unencrypted connections, so `sslmode=require` must stay in
 * `DATABASE_URL`. Note that Azure's certificate chain is not in Node's default
 * trust store for all regions; `ssl: "require"` encrypts without demanding a
 * verifiable chain, which is what the connection string already asks for.
 */
/**
 * The application connects as `echo_app`, NOT as the migration admin.
 *
 * This is load-bearing for security, not a convention: `echo_admin` owns the
 * tables and has `rolbypassrls = true`, so connecting as it would silently
 * disable every RLS policy in migration 0001. `DATABASE_URL` (admin) is for
 * drizzle-kit migrations only — see drizzle.config.ts.
 */
const connectionString = process.env.APP_DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "APP_DATABASE_URL is not set. The app must connect as echo_app so that " +
      "row-level security applies; DATABASE_URL is the admin role and bypasses it."
  );
}

/**
 * Cached across hot reloads. Without this, every HMR pass in dev opens a fresh
 * pool and Postgres runs out of connections long before you notice why.
 */
const globalForDb = globalThis as unknown as {
  __echoSql?: ReturnType<typeof postgres>;
};

/**
 * Pool sizing is dictated by the server, not by throughput appetite.
 *
 * This Azure tier reports `max_connections = 50`, of which 10 are
 * `superuser_reserved` and ~16 are already held by Azure's own processes —
 * leaving roughly 24 for the application. Budget per app instance:
 *
 *   5 (this pool) + 1 (the LISTEN/NOTIFY connection in lib/db/events.ts) = 6
 *
 * which allows ~3 instances with headroom. Raise `max` only after raising the
 * tier, or connections will be refused under load rather than queued.
 */
const sql =
  globalForDb.__echoSql ??
  postgres(connectionString, {
    ssl: "require",
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__echoSql = sql;
}

export const db = drizzle(sql, { schema });

/** Raw client — needed for LISTEN/NOTIFY, which Drizzle does not wrap. */
export { sql };
export * from "./schema";
