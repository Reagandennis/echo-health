/**
 * Adversarial check on the clinical risk-alert pipeline (migrations 0001 / 0017).
 *
 *   npx tsx scripts/verify-risk-pipeline.ts
 *
 * The companion to `scripts/verify-kyc-security.ts`, and a jest test for the
 * same reason it is not one: it asserts on live RLS policies and CHECK
 * constraints, which the jest suite mocks away entirely — every policy here
 * could be dropped and all 93 tests would still pass.
 *
 * SAFE AGAINST PRODUCTION. Every case runs in a transaction that is always
 * rolled back, and it connects as `echo_app`. Connecting as the migration admin
 * would pass everything regardless, because that role has `rolbypassrls`.
 *
 * The two cases that matter most, if you are skimming:
 *   - "a client CANNOT file a crisis alert against another user" — `patient_id`
 *     is free text with no foreign key, so a policy admitting senders would be a
 *     defamation vector on a table only admins read and act on.
 *   - "an alert cannot be judged anonymously" — an unattributed "false positive"
 *     on a clinical record is the same failure as the fabricated KYC review
 *     states this codebase has already had to remove once.
 */
import postgres from "postgres";
import { readFileSync } from "fs";

const env = readFileSync(".env.local", "utf8");
const url = /^APP_DATABASE_URL=(.+)$/m.exec(env)![1].trim().replace(/^["']|["']$/g, "");
const sql = postgres(url, { max: 1, onnotice: () => {} });

let pass = 0, fail = 0;
function report(n: string, ok: boolean, d: string) {
  if (ok) { pass++; console.log(`  PASS  ${n}`); } else { fail++; console.log(`  FAIL  ${n}\n        ${d}`); }
}
async function tryTx(fn: (tx: postgres.TransactionSql) => Promise<unknown>): Promise<string | null> {
  try { await sql.begin(async (tx) => { await fn(tx); throw new Error("__RB__"); }); return null; }
  catch (e) { const m = (e as Error).message; return m === "__RB__" ? null : m; }
}
const beUser = (tx: postgres.TransactionSql, u: string, r: string) =>
  tx`SELECT set_config('app.user_id', ${u}, true), set_config('app.user_roles', ${r}, true), set_config('app.system_context','',true)`;
const beSystem = (tx: postgres.TransactionSql, ctx: string) =>
  tx`SELECT set_config('app.user_id','',true), set_config('app.user_roles','',true), set_config('app.system_context', ${ctx}, true)`;

const PATIENT = "auth0|risk-probe-patient";
const alert = (o: Record<string, unknown> = {}) => ({
  patient_id: PATIENT, type: "crisis", description: "probe", severity: "high", ...o,
});

async function main() {
  console.log("\n=== risk_alerts pipeline ===\n");

  // 1. THE FIX: the scanner (system context) can now file an alert.
  report("scanner CAN file an alert under system context",
    (await tryTx(async (tx) => { await beSystem(tx, "risk-scanner");
      const r = await tx`INSERT INTO risk_alerts ${tx(alert())} RETURNING id`;
      if (r.length !== 1) throw new Error("insert matched nothing"); })) === null,
    "the scanner still cannot write — sendMessageAction's alert path is dead");

  // 2. ...and can read for the 24h dedupe.
  report("scanner CAN read for deduplication",
    (await tryTx(async (tx) => { await beSystem(tx, "risk-scanner");
      await tx`INSERT INTO risk_alerts ${tx(alert())}`;
      const [c] = await tx`SELECT count(*)::int n FROM risk_alerts WHERE patient_id = ${PATIENT}`;
      if ((c.n as number) < 1) throw new Error("dedupe SELECT returned nothing"); })) === null, "");

  // 3. ...but cannot resolve or delete. Least privilege: a background job that
  //    can silently close clinical alerts is worse than one that cannot write.
  report("scanner CANNOT resolve an alert",
    (await tryTx(async (tx) => { await beSystem(tx, "risk-scanner");
      await tx`INSERT INTO risk_alerts ${tx(alert())}`;
      const u = await tx`UPDATE risk_alerts SET resolved = true, disposition = 'actioned',
                         disposition_by = 'scanner', disposition_at = now()
                         WHERE patient_id = ${PATIENT} RETURNING id`;
      if (u.length !== 0) throw new Error(`updated ${u.length} rows`); })) === null,
    "a background job can close clinical alerts");

  report("scanner CANNOT delete an alert",
    (await tryTx(async (tx) => { await beSystem(tx, "risk-scanner");
      await tx`INSERT INTO risk_alerts ${tx(alert())}`;
      const d = await tx`DELETE FROM risk_alerts WHERE patient_id = ${PATIENT} RETURNING id`;
      if (d.length !== 0) throw new Error(`deleted ${d.length} rows`); })) === null,
    "a background job can destroy clinical alerts");

  // 4. THE DEFAMATION VECTOR: a client must not be able to file an alert
  //    against another user's id. patient_id is free text with no FK.
  report("a client CANNOT file a crisis alert against another user",
    await (async () => { const r = await tryTx(async (tx) => {
      await beUser(tx, "auth0|malicious-client", "client");
      await tx`INSERT INTO risk_alerts ${tx(alert({ patient_id: "auth0|victim" }))}`; });
      return r !== null && /row-level security/i.test(r); })(),
    "any client can file crisis alerts against any other user's record");

  report("a therapist CANNOT file an alert directly",
    await (async () => { const r = await tryTx(async (tx) => {
      await beUser(tx, "auth0|some-therapist", "therapist");
      await tx`INSERT INTO risk_alerts ${tx(alert())}`; });
      return r !== null; })(), "therapists can write clinical alerts unmediated");

  // 5. A patient must not be able to read alerts about themselves being
  //    watched — nor anyone else's.
  report("a client CANNOT read risk alerts about themselves",
    (await tryTx(async (tx) => { await beSystem(tx, "risk-scanner");
      await tx`INSERT INTO risk_alerts ${tx(alert())}`;
      await beUser(tx, PATIENT, "client");
      const [c] = await tx`SELECT count(*)::int n FROM risk_alerts`;
      if ((c.n as number) !== 0) throw new Error(`client saw ${c.n} alerts`); })) === null, "");

  // 6. Disposition integrity (migration 0017).
  report("an alert cannot be judged anonymously",
    await (async () => { const r = await tryTx(async (tx) => {
      await beUser(tx, "auth0|admin-probe", "admin");
      await tx`INSERT INTO risk_alerts ${tx(alert({ resolved: true, disposition: "false_positive" }))}`; });
      return r !== null && /attributed/i.test(r); })(),
    "a false-positive judgement can be recorded with no author");

  report("resolved and disposition cannot disagree",
    await (async () => { const r = await tryTx(async (tx) => {
      await beUser(tx, "auth0|admin-probe", "admin");
      // resolved=true while still 'open' — the row would say two things at once.
      await tx`INSERT INTO risk_alerts ${tx(alert({ resolved: true }))}`; });
      return r !== null && /matches_resolved/i.test(r); })(),
    "a row can claim to be both open and resolved");

  report("admin CAN record a false positive, attributed",
    (await tryTx(async (tx) => { await beUser(tx, "auth0|admin-probe", "admin");
      const [a] = await tx`INSERT INTO risk_alerts ${tx(alert())} RETURNING id`;
      const u = await tx`UPDATE risk_alerts
                         SET resolved = true, disposition = 'false_positive',
                             disposition_by = 'auth0|admin-probe', disposition_at = now(),
                             disposition_note = 'message read: "goodbye, see you Tuesday"'
                         WHERE id = ${a.id} RETURNING id`;
      if (u.length !== 1) throw new Error("admin could not record a disposition"); })) === null,
    "an admin cannot mark a false positive — the whole point of 0017");

  console.log(`\n  ${pass} passed, ${fail} failed\n`);
  await sql.end();
  if (fail) process.exitCode = 1;
}
main().catch(async (e) => { console.error(e); await sql.end(); process.exit(1); });
