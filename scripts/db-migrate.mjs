/**
 * Apply the SQL migrations in `lib/db/migrations/`, in order.
 *
 * ## Why this exists instead of `npm run db:migrate`
 *
 * `drizzle.config.ts` is written against the drizzle-kit 0.21+ API
 * (`dialect: "postgresql"`) while `package.json` pins `drizzle-kit@^0.18.1`,
 * which still expects `driver: "pg"`. So the drizzle-kit CLI — `db:generate`
 * and `db:migrate` both — cannot read its own config. That mismatch is real,
 * predates this script, and is flagged in `tsconfig.json`; fixing it means
 * bumping the migration tooling, which AGENTS.md warns about at length.
 *
 * This script does not go near drizzle-kit. It uses **drizzle-orm's runtime
 * migrator**, which is a completely separate code path: `drizzle-orm` is on
 * 0.45.2, reads the same `meta/_journal.json`, applies the same files, splits
 * on the same `--> statement-breakpoint` markers, and records the same
 * `drizzle.__drizzle_migrations` rows with the same content hashes.
 *
 * That last point is the one that matters: because the bookkeeping is
 * byte-compatible, whenever drizzle-kit is eventually fixed it will see these
 * migrations as already applied rather than trying to run them a second time.
 *
 * ## It connects as echo_admin, deliberately
 *
 * `DATABASE_URL`, not `APP_DATABASE_URL`. The migrations create tables and
 * policies, which the app role cannot do — and `echo_admin` is the role whose
 * `ALTER DEFAULT PRIVILEGES` grant (see `docker/postgres/init/01-roles.sql`)
 * makes each new table readable by `echo_app`. Running these as `echo_app`
 * would fail; running them as the bare superuser would create tables owned by
 * `postgres`, whose default privileges grant `echo_app` nothing, and every
 * query would then fail with "permission denied for table profiles".
 *
 *   node scripts/db-migrate.mjs
 */

import { readFileSync } from "node:fs";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

/**
 * `.env.local` then `.env`, the same precedence Next.js uses.
 *
 * This runs outside Next, so nothing has loaded either for us. Parsed here
 * rather than pulling in dotenv for two variables — the same reasoning, and
 * the same approach, as `drizzle.config.ts`.
 */
function loadEnv(name) {
  try {
    for (const line of readFileSync(name, "utf8").split("\n")) {
      const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
      if (!match) continue;
      const [, key, rawValue] = match;
      /* Later files must not clobber a variable already in the real
         environment — CI sets these directly and must win. */
      if (process.env[key] !== undefined) continue;
      process.env[key] = rawValue.trim().replace(/^["']|["']$/g, "");
    }
  } catch {
    /* Absent file is normal. */
  }
}

loadEnv(".env.local");
loadEnv(".env");

const url = process.env.DATABASE_URL;
if (!url) {
  console.error(
    "DATABASE_URL is not set. Migrations run as echo_admin (the owner), not as\n" +
      "the app role — see the note at the top of this file. For the local Docker\n" +
      "stack:\n\n" +
      "  DATABASE_URL=postgres://echo_admin:echo_admin_local@127.0.0.1:5432/echo?sslmode=disable\n"
  );
  process.exit(1);
}

/* Same rule as `lib/db/index.ts`: only an explicit `sslmode=disable` turns TLS
   off, so a production URL that forgot the parameter still gets encrypted. */
const sslMode = /[?&]sslmode=([a-z-]+)/i.exec(url)?.[1]?.toLowerCase();
const ssl = sslMode === "disable" ? false : "require";

/* `max: 1` because migrations are strictly sequential and drizzle wraps them
   in a single transaction; a pool would be connections held open for nothing. */
const sql = postgres(url, {
  ssl,
  max: 1,
  connect_timeout: 15,
  /* Notices are printed as full objects by default, so a routine
     `DROP TRIGGER IF EXISTS` in migration 0015 dumps a ten-line struct into
     the middle of an otherwise clean run and reads like a failure. Warnings
     and errors still surface — they come through the rejected promise. */
  onnotice: () => {},
});

const host = (() => {
  try {
    return new URL(url).host;
  } catch {
    return "the configured host";
  }
})();

try {
  console.log(`Applying migrations to ${host} …`);
  await migrate(drizzle(sql), { migrationsFolder: "lib/db/migrations" });

  /* The count is read back rather than assumed, because drizzle's migrator is
     a no-op when everything is already applied and says nothing about it.
     "0 pending" and "did not run" look identical otherwise. */
  const [{ count }] = await sql`
    SELECT count(*)::int AS count FROM drizzle.__drizzle_migrations
  `;
  console.log(`Done. ${count} migration${count === 1 ? "" : "s"} recorded as applied.`);
} catch (error) {
  /* Flattened rather than passed as an object: a refused connection rejects
     with an AggregateError, and printing that object is how the same failure
     turned into a two-minute hang elsewhere in this codebase. See the note in
     `lib/directory.ts`. */
  const detail =
    error instanceof AggregateError
      ? (error.errors ?? []).map((e) => e.message).join("; ")
      : error instanceof Error
        ? error.message
        : String(error);
  console.error(`\nMigration failed: ${detail}`);
  if (String(detail).includes("ECONNREFUSED")) {
    console.error("\nNothing is listening. Start the stack first:\n\n  docker compose up -d\n");
  }
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 }).catch(() => {});
}
