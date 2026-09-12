-- ── The two roles, and why there are two ────────────────────────────────────
--
-- This is the single most important file in the local stack, because getting it
-- wrong produces an app that appears to work perfectly while enforcing none of
-- its security.
--
-- `lib/db/migrations/0001_row_level_security.sql` puts per-row isolation in the
-- database: a policy, not an application `if`, is what stops client A reading
-- client B's clinical notes. Those policies read an identity that
-- `lib/db/session.ts` sets per transaction.
--
-- Row-level security does not apply to a role with BYPASSRLS. So:
--
--   echo_admin  owns the tables, HAS BYPASSRLS. Migrations and admin tooling
--               only. This is `DATABASE_URL`.
--   echo_app    owns nothing, does NOT have BYPASSRLS. The application. This
--               is `APP_DATABASE_URL`.
--
-- Point the app at `echo_admin` and every policy in migration 0001 silently
-- stops applying — every query returns every row, all 47 ownership checks that
-- RLS was added to back up are bypassed, and nothing in the UI looks different.
-- AGENTS.md calls this "load-bearing" for exactly that reason.
--
-- The migrations GRANT to `echo_app` but never CREATE it, because on Azure the
-- roles were provisioned by hand before the first migration ran. This file is
-- that manual step, written down.
--
-- Runs once, on an empty data volume. `docker compose down -v` to re-run.

-- ── Roles ───────────────────────────────────────────────────────────────────

CREATE ROLE echo_admin LOGIN PASSWORD 'echo_admin_local' BYPASSRLS CREATEROLE;

-- No BYPASSRLS, and no attributes at all beyond LOGIN. If you find yourself
-- adding one to fix a permission error, the error is telling you a GRANT is
-- missing or a policy is wrong — adding a role attribute hides it.
CREATE ROLE echo_app LOGIN PASSWORD 'echo_app_local';

-- ── Ownership ───────────────────────────────────────────────────────────────

ALTER DATABASE echo OWNER TO echo_admin;

\connect echo

-- `public` is owned by `pg_database_owner` from PG 15 on, so the migration role
-- cannot create in it until it owns it.
ALTER SCHEMA public OWNER TO echo_admin;

GRANT USAGE ON SCHEMA public TO echo_app;

-- ── Privileges on tables that do not exist yet ──────────────────────────────
--
-- This is the part that is easy to get wrong. `GRANT ... ON ALL TABLES` applies
-- only to tables that exist at the moment it runs, and at this point the
-- migrations have not been applied, so there are none. A blanket grant here
-- would be a no-op and every query would fail with "permission denied for
-- table profiles".
--
-- ALTER DEFAULT PRIVILEGES instead: it applies to tables created LATER, by
-- `echo_admin`. That makes the grant self-maintaining — a new table added in a
-- future migration is readable by the app without anyone remembering to add a
-- GRANT line. Several of the existing migrations do remember (`avatars`,
-- `payments`, `promo_redemptions`, `payout_ledger` each grant explicitly), and
-- those grants become harmless duplicates rather than the only thing holding
-- the app up.
--
-- FOR ROLE echo_admin matters: default privileges are recorded per granting
-- role, and it is `echo_admin` that will create the tables.

ALTER DEFAULT PRIVILEGES FOR ROLE echo_admin IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO echo_app;

ALTER DEFAULT PRIVILEGES FOR ROLE echo_admin IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO echo_app;

-- The RLS helper functions in migration 0001 are called from inside policies,
-- so `echo_app` needs EXECUTE on them. 0001 grants that explicitly for the
-- functions it defines; this covers anything a later migration adds.
ALTER DEFAULT PRIVILEGES FOR ROLE echo_admin IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO echo_app;

-- ── Extensions ──────────────────────────────────────────────────────────────
--
-- Creating an extension requires superuser, so it happens here rather than in a
-- migration run as `echo_admin`. `gen_random_uuid()` is core from PG 13 and
-- every `uuid PRIMARY KEY DEFAULT gen_random_uuid()` in migration 0000 depends
-- on it; pgcrypto is requested anyway so the local database matches Azure,
-- where it is enabled.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
