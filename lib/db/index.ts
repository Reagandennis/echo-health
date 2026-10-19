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
 * TLS comes from the connection string's own `sslmode`, defaulting to require.
 *
 * `ssl: "require"` used to be hardcoded here, which is right for Azure and
 * makes the app impossible to run against a local Postgres: the container in
 * `docker-compose.yml` has no certificate, so every connection fails the
 * handshake before a query is sent.
 *
 * Honouring `sslmode` is what every other Postgres client does, and it keeps
 * production behaviour identical — the Azure URLs already carry
 * `?sslmode=require` because Azure rejects unencrypted connections, and
 * AGENTS.md says that must stay.
 *
 * ## The default is `require`, not `disable`, and that is deliberate
 *
 * An absent `sslmode` means "nobody said" — and the failure modes are wildly
 * asymmetric. Defaulting to require costs a clear handshake error on a local
 * database you forgot to mark `sslmode=disable`. Defaulting to disable would
 * mean a production URL missing one query parameter silently sends clinical
 * data over plaintext, with nothing anywhere to indicate it. So only an
 * explicit `disable` turns TLS off.
 *
 * `require` here encrypts WITHOUT demanding a verifiable certificate chain,
 * which is what Azure needs: its chain is not in Node's default trust store
 * for every region. That is a weaker guarantee than `verify-full` and is the
 * behaviour the production connection strings already ask for.
 */
function sslFromConnectionString(url: string): "require" | false {
  const mode = /[?&]sslmode=([a-z-]+)/i.exec(url)?.[1]?.toLowerCase();
  return mode === "disable" ? false : "require";
}

/**
 * Cached across hot reloads. Without this, every HMR pass in dev opens a fresh
 * pool and Postgres runs out of connections long before you notice why.
 */
const globalForDb = globalThis as unknown as {
  __echoSql?: ReturnType<typeof postgres>;
};

/**
 * Pool sizing is dictated by the server, not by throughput appetite — so it
 * is read from `DB_POOL_MAX`, because the server differs per deployment.
 *
 * The DEFAULT of 5 is sized for the Azure Flexible Server tier this app first
 * ran on: `max_connections = 50`, 10 `superuser_reserved`, ~16 held by Azure's
 * own processes, leaving roughly 24 for the application. Budget per instance:
 *
 *   5 (this pool) + 1 (the LISTEN/NOTIFY connection in lib/db/events.ts) = 6
 *
 * which allows ~3 instances with headroom on that tier.
 *
 * Production now runs a single instance against a LOCAL Postgres 17 on the
 * same VM (`max_connections = 100`), where that default is the wrong
 * constraint: a client portal page fires several Server Actions in parallel,
 * each needing its own transaction, so five connections made concurrent users
 * queue on the pool for no reason. That deployment sets `DB_POOL_MAX=20` in
 * `.env.local`. Raise it only in step with the server's `max_connections`,
 * remembering the LISTEN connection and any migration runner also count.
 */
function poolMaxFromEnv(): number {
  const raw = process.env.DB_POOL_MAX;
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 200) return parsed;
  if (raw) {
    console.warn(`[db] Ignoring DB_POOL_MAX=${JSON.stringify(raw)}; using the default of 5.`);
  }
  return 5;
}

const sql =
  globalForDb.__echoSql ??
  postgres(connectionString, {
    ssl: sslFromConnectionString(connectionString),
    max: poolMaxFromEnv(),


    /**
     * Keep connections warm for 10 minutes.
     *
     * This was 20s, which is a sensible default on a local network and a serious
     * mistake against a remote database: round-trip time to the Azure instance
     * was ~230ms, so a fresh connection — TCP plus TLS handshake — cost ~1.7
     * SECONDS, and anyone clicking through the admin or therapist menus at human
     * pace found the pool empty on nearly every navigation. On the local
     * Postgres the reconnect is cheap, but holding warm connections costs
     * nothing there either, so the setting stays.
     */

    idle_timeout: 600,

    // Generous: the handshake alone is ~1.7s on this link, so a tight timeout
    // would abort connections that were about to succeed.
    connect_timeout: 30,

    // Prepared statements are left ON (the default). They cost one extra
    // round-trip the first time a statement is seen on a connection, then save
    // parse/plan work on every reuse — which is the common case now that
    // connections stay warm for 10 minutes. Turn this off ONLY if PgBouncer in
    // transaction mode is ever put in front of this pool; it cannot support them.
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__echoSql = sql;
}

export const db = drizzle(sql, { schema });

/** Raw client — needed for LISTEN/NOTIFY, which Drizzle does not wrap. */
export { sql };
export * from "./schema";
