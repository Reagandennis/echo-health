/**
 * Remove the Auth0 `therapist` role from everyone Postgres no longer considers
 * verified.
 *
 *   npx tsx scripts/revoke-therapist-roles.ts             # dry run — prints the plan
 *   npx tsx scripts/revoke-therapist-roles.ts --confirm   # actually revokes
 *
 * WHY THIS EXISTS. Migration 0013 withdrew every existing approval, because
 * those therapists were verified against zero documents. That `UPDATE` settled
 * the question in Postgres and nowhere else: the portal's access check reads a
 * ROLE CLAIM issued by Auth0, which is a separate system with no transactional
 * relationship to this database. So the revoked therapists still hold the
 * `therapist` role, and would walk back into the therapist portal on their next
 * login with `kyc_status = 'incomplete'` behind them.
 *
 * Postgres is the source of truth for who is verified; this script makes Auth0
 * agree with it.
 *
 * It is a one-shot operational task rather than application code because it
 * reconciles a historical divergence. The ongoing path is
 * `/api/admin/therapist-kyc`, which assigns and revokes the role as part of each
 * review.
 *
 * NOT LOGGED TO `kyc_review_events`. Migration 0013 already wrote a `revoked`
 * event for each of these therapists with `actor_id = 'system'`; this is the
 * second half of that same decision, not a new one, and a second row would imply
 * two revocations happened.
 *
 * SCOPE. Driven by the `therapists` table, so it covers exactly the users this
 * platform has a credentialing record for. A user who holds the Auth0
 * `therapist` role with NO `therapists` row at all is NOT touched — that set
 * includes anyone mid-signup who has been granted the role but not yet created
 * their profile, and revoking from them would break a legitimate onboarding.
 * Audit it separately (User Management → Roles → Therapist → Users) if you need
 * to; it is a different question from the one this script answers.
 *
 * Requires AUTH0_M2M_CLIENT_ID / AUTH0_M2M_CLIENT_SECRET with `read:roles`,
 * `read:role_members` and `delete:role_members`, plus DATABASE_URL.
 */

import { readFileSync } from "node:fs";
import postgres from "postgres";

/**
 * Load `.env.local` into `process.env` BEFORE anything reads it.
 *
 * `lib/auth0-management.ts` captures AUTH0_DOMAIN / AUTH0_M2M_* into module-scope
 * constants at import time, so it must not be imported until this has run — see
 * the dynamic import in `main()`. A static import at the top of this file would
 * capture `undefined` and report the Management API as unconfigured no matter
 * what is in the file.
 */
function loadEnvLocal(): void {
  try {
    for (const line of readFileSync(".env.local", "utf8").split("\n")) {
      const i = line.indexOf("=");
      if (i > 0 && !line.trimStart().startsWith("#")) {
        const key = line.slice(0, i).trim();
        if (!process.env[key]) process.env[key] = line.slice(i + 1).trim();
      }
    }
  } catch {
    /* process.env only */
  }
}

loadEnvLocal();

const ROLE = "therapist";

interface TherapistRow {
  id: string;
  user_id: string;
  name: string;
  kyc_status: string;
}

/** Trim an Auth0 sub for display without losing which provider it came from. */
function shortSub(sub: string): string {
  return sub.length <= 34 ? sub : `${sub.slice(0, 31)}…`;
}

function pad(value: string, width: number): string {
  return value.length >= width ? value : value + " ".repeat(width - value.length);
}

async function main() {
  const confirm = process.argv.includes("--confirm");

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");

  // Imported here, not at the top — see `loadEnvLocal`.
  const { isManagementConfigured, getUserRoles, removeRole } = await import(
    "../lib/auth0-management"
  );

  if (!isManagementConfigured()) {
    console.error(
      "Auth0 Management API is not configured, so no role can be revoked.\n\n" +
        "Set AUTH0_DOMAIN, AUTH0_M2M_CLIENT_ID and AUTH0_M2M_CLIENT_SECRET from a\n" +
        "machine-to-machine application authorized for the Management API with the\n" +
        "scopes read:roles, read:role_members and delete:role_members.\n\n" +
        "Until then the revocation is incomplete: every therapist listed by\n" +
        "`SELECT name FROM therapists WHERE kyc_status <> 'verified'` still holds the\n" +
        "'therapist' role and regains portal access at their next login. The roles\n" +
        "can also be removed by hand under User Management → Roles → Therapist."
    );
    process.exitCode = 1;
    return;
  }

  const sql = postgres(url, { ssl: "require", max: 1 });

  try {
    // Read-only. This script writes nothing to Postgres — the database side of
    // the revocation is already done, which is precisely why Auth0 is now out
    // of step with it.
    const rows = (await sql`
      SELECT id, user_id, name, kyc_status
      FROM therapists
      WHERE kyc_status <> 'verified'
      ORDER BY name
    `) as unknown as TherapistRow[];

    const [{ verified }] = (await sql`
      SELECT count(*)::int AS verified FROM therapists WHERE kyc_status = 'verified'
    `) as unknown as { verified: number }[];

    console.log(`Auth0 role revocation — '${ROLE}'\n`);

    if (rows.length === 0) {
      console.log("Every therapist in the database is verified. Nothing to revoke.");
      return;
    }

    /*
     * Ask Auth0 what each user actually holds, rather than assuming. This is
     * what makes the script idempotent AND makes the dry run honest: a second
     * run reports "already revoked" instead of proposing the same change again,
     * and the plan never claims it will remove a role the user does not have.
     *
     * Deduplicated because the plan is per USER, not per therapist row. There is
     * a unique index on `therapists.user_id` so this should be a no-op, but the
     * consequence of it not being one is a duplicated DELETE per user.
     */
    const seen = new Set<string>();
    const plan: { row: TherapistRow; holdsRole: boolean; error?: string }[] = [];

    for (const row of rows) {
      if (seen.has(row.user_id)) continue;
      seen.add(row.user_id);

      try {
        const roles = await getUserRoles(row.user_id);
        plan.push({ row, holdsRole: roles.includes(ROLE) });
      } catch (err: unknown) {
        // A user deleted from Auth0 but still present in `therapists` lands
        // here. Reported rather than fatal — one unreadable account must not
        // stop the rest of the revocation.
        plan.push({
          row,
          holdsRole: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const nameWidth = Math.max(...plan.map((p) => p.row.name.length), 4);
    const statusWidth = Math.max(...plan.map((p) => p.row.kyc_status.length), 10);

    for (const { row, holdsRole, error } of plan) {
      const prefix =
        `  ${pad(row.name, nameWidth)}  ${pad(shortSub(row.user_id), 34)}  ` +
        `${pad(row.kyc_status, statusWidth)}  `;

      if (error) console.log(`${prefix}! could not read roles: ${error}`);
      else if (holdsRole) console.log(`${prefix}holds '${ROLE}' → REVOKE`);
      else console.log(`${prefix}no '${ROLE}' role → already revoked`);
    }

    const toRevoke = plan.filter((p) => p.holdsRole);
    const unreadable = plan.filter((p) => p.error);

    console.log(
      `\n${plan.length} unverified therapist(s); ${toRevoke.length} still hold '${ROLE}'. ` +
        `${verified} verified therapist(s) untouched.`
    );

    if (unreadable.length > 0) {
      console.log(`${unreadable.length} account(s) could not be read from Auth0 (see above).`);
    }

    if (toRevoke.length === 0) {
      console.log("\nNothing to do.");
      return;
    }

    if (!confirm) {
      console.log("\nDRY RUN — nothing was changed. Re-run with --confirm to apply.");
      return;
    }

    console.log("");
    let revoked = 0;
    let failed = 0;

    for (const { row } of toRevoke) {
      try {
        await removeRole(row.user_id, ROLE);
        revoked++;
        console.log(`✓ revoked  ${row.name}`);
      } catch (err: unknown) {
        failed++;
        console.error(`✗ FAILED   ${row.name}: ${err instanceof Error ? err.message : err}`);
      }
    }

    console.log(`\n✓ ${revoked} revoked${failed > 0 ? `, ${failed} failed` : ""}.`);

    if (revoked > 0) {
      console.log(
        "\nA revoked user keeps portal access until their CURRENT session ends — the\n" +
          "roles claim was issued at their last login and lives in their session\n" +
          "cookie, so removing the role does not retroactively alter an issued token.\n" +
          "They lose access at their next login. Force it sooner by invalidating their\n" +
          "sessions in the Auth0 dashboard."
      );
    }

    if (failed > 0) process.exitCode = 1;
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
