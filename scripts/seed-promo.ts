/**
 * Create or update a promo code.
 *
 *   npx tsx scripts/seed-promo.ts WELCOME50
 *   npx tsx scripts/seed-promo.ts LAUNCH25 --discount 25 --limit 100 --expires 2026-12-31
 *   npx tsx scripts/seed-promo.ts OLDCODE --disable
 *
 * Codes live in the `promos` table, which is the source of truth — `/api/promo`
 * and the payment initialiser both read `discount`, `redemption_limit`,
 * `expires_at` and `disabled` from it. There is no longer a `PROMO_CODE`
 * environment variable; a code exists if and only if it has a row here.
 *
 * Runs as the migration admin (`DATABASE_URL`) rather than `echo_app`, because
 * writing to `promos` is admin-only under RLS and this is an operator task.
 */

import { readFileSync } from "node:fs";
import postgres from "postgres";

function env(): Record<string, string> {
  const out: Record<string, string> = { ...process.env } as Record<string, string>;
  try {
    for (const line of readFileSync(".env.local", "utf8").split("\n")) {
      const i = line.indexOf("=");
      if (i > 0 && !line.trimStart().startsWith("#")) {
        out[line.slice(0, i).trim()] ||= line.slice(i + 1).trim();
      }
    }
  } catch {
    /* process.env only */
  }
  return out;
}

function flag(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

async function main() {
  const code = process.argv[2]?.trim().toUpperCase();
  if (!code) {
    throw new Error(
      "Usage: npx tsx scripts/seed-promo.ts <CODE> [--discount N] [--limit N] [--expires YYYY-MM-DD] [--disable]"
    );
  }

  const E = env();
  const url = E.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");

  const discountArg = flag("discount");
  const limitArg = flag("limit");
  const expiresArg = flag("expires");
  const disabled = process.argv.includes("--disable");

  // `null` is meaningful in this table: null discount falls back to the platform
  // default, null limit means unlimited, null expiry means never. So an omitted
  // flag must write null rather than a zero.
  const discount = discountArg === undefined ? null : Number(discountArg);
  const redemptionLimit = limitArg === undefined ? null : Number(limitArg);
  const expiresAt = expiresArg === undefined ? null : new Date(expiresArg);

  if (discount !== null && (Number.isNaN(discount) || discount < 0 || discount > 100)) {
    throw new Error("--discount must be between 0 and 100");
  }
  if (redemptionLimit !== null && (Number.isNaN(redemptionLimit) || redemptionLimit < 1)) {
    throw new Error("--limit must be a positive integer");
  }
  if (expiresAt !== null && Number.isNaN(expiresAt.getTime())) {
    throw new Error("--expires must be a valid date, e.g. 2026-12-31");
  }

  const sql = postgres(url, { ssl: "require", max: 1 });

  try {
    const [row] = await sql`
      INSERT INTO promos (code, discount, redemption_limit, expires_at, disabled)
      VALUES (${code}, ${discount}, ${redemptionLimit}, ${expiresAt}, ${disabled})
      ON CONFLICT (code) DO UPDATE SET
        discount         = EXCLUDED.discount,
        redemption_limit = EXCLUDED.redemption_limit,
        expires_at       = EXCLUDED.expires_at,
        disabled         = EXCLUDED.disabled
      RETURNING code, discount, redemption_limit, expires_at, disabled
    `;

    // Existing redemptions are NOT reset by an update — they live in
    // `promo_redemptions` and are the record of who already used the code.
    const [{ used }] = await sql`
      SELECT count(*)::int AS used FROM promo_redemptions
      WHERE code = ${code} AND payment_reference IS NOT NULL
    `;

    console.log(`✓ ${row.code}`);
    console.log(`  discount: ${row.discount ?? "platform default (50%)"}%`);
    console.log(`  limit:    ${row.redemption_limit ?? "unlimited"}`);
    console.log(`  expires:  ${row.expires_at ? new Date(row.expires_at).toDateString() : "never"}`);
    console.log(`  disabled: ${row.disabled}`);
    console.log(`  redeemed: ${used}`);
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
