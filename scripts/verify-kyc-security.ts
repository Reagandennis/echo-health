/**
 * Adversarial check on the therapist-credentialing guarantees.
 *
 *   npx tsx scripts/verify-kyc-security.ts
 *
 * WHY THIS IS A SCRIPT AND NOT A JEST TEST. It asserts on the behaviour of the
 * live database — RLS policies and triggers — which the jest suite cannot see:
 * those tests mock `lib/db/session.ts` entirely, so a policy could be dropped
 * and every one of them would still pass. Making this a jest test would also
 * make `npm test` require a reachable Postgres, which it currently does not.
 *
 * Run it after any migration that touches `therapists`, `kyc_documents` or
 * `kyc_review_events`, and after any change to the RLS helper functions.
 *
 * SAFE TO RUN AGAINST PRODUCTION. Every case executes inside a transaction that
 * is always rolled back, and it connects as `echo_app` (the RLS-bound app role),
 * never as the migration admin — connecting as `echo_admin` would silently pass
 * every case, because that role has `rolbypassrls` and is not subject to any of
 * the policies under test.
 *
 * A FIXTURE NOTE THAT COST TIME. Documents must be inserted AS THEIR OWNER:
 * `kyc_documents_insert` is `app_owns_therapist(therapist_id)` and does not
 * admit admins. An earlier version created them as an admin, the setup itself
 * failed, and four cases reported as security failures that were really one bug
 * in the harness. If several cases fail at once with the same message, suspect
 * the fixture before the policy.
 */
import postgres from "postgres";
import { readFileSync } from "fs";

function appUrl(): string {
  // Read directly rather than importing `lib/db`, which pulls in the whole
  // Drizzle client and Next-specific module resolution for no benefit here.
  const env = readFileSync(".env.local", "utf8");
  const match = /^APP_DATABASE_URL=(.+)$/m.exec(env);
  if (!match) {
    throw new Error(
      "APP_DATABASE_URL not found in .env.local. This must be the `echo_app` " +
        "role — running as `echo_admin` bypasses RLS and every case would pass " +
        "regardless of whether the policies exist."
    );
  }
  return match[1].trim().replace(/^["']|["']$/g, "");
}

const sql = postgres(appUrl(), { max: 1, onnotice: () => {} });

let pass = 0;
let fail = 0;

function report(name: string, ok: boolean, detail: string) {
  if (ok) {
    pass++;
    console.log(`  \x1b[32mPASS\x1b[0m  ${name}`);
  } else {
    fail++;
    console.log(`  \x1b[31mFAIL\x1b[0m  ${name}\n        ${detail}`);
  }
}

/**
 * Runs `fn` in a transaction that is ALWAYS rolled back.
 * Returns the error message, or null when everything inside succeeded.
 */
async function tryTx(fn: (tx: postgres.TransactionSql) => Promise<unknown>): Promise<string | null> {
  try {
    await sql.begin(async (tx) => {
      await fn(tx);
      throw new Error("__ROLLBACK__");
    });
    return null;
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    return m === "__ROLLBACK__" ? null : m;
  }
}

/** Adopt an identity for the remainder of the transaction, as `withUser` does. */
function be(tx: postgres.TransactionSql, user: string, roles: string) {
  return tx`SELECT set_config('app.user_id', ${user}, true),
                   set_config('app.user_roles', ${roles}, true),
                   set_config('app.system_context', '', true)`;
}

async function main() {
  console.log("\n=== Therapist credentialing — adversarial security check ===\n");

  const therapists = await sql`SELECT id, user_id FROM therapists ORDER BY created_at`;
  if (therapists.length < 2) {
    console.log(
      `  SKIPPED — needs two therapist rows to test cross-tenant isolation, found ${therapists.length}.`
    );
    await sql.end();
    return;
  }

  const A = { id: therapists[0].id as string, user: therapists[0].user_id as string };
  const B = { id: therapists[1].id as string, user: therapists[1].user_id as string };
  const ADMIN = "auth0|security-check-admin";

  const doc = (therapistId: string) => ({
    therapist_id: therapistId,
    uploaded_by: "security-check",
    filename: "probe.pdf",
    mime_type: "application/pdf",
    size_bytes: 3,
    content: Buffer.from("abc"),
    doc_type: "government_id" as const,
  });

  // ── Document lifecycle ─────────────────────────────────────────────────────

  report(
    "owner CAN delete own document while incomplete",
    (await tryTx(async (tx) => {
      await be(tx, A.user, "therapist");
      const [d] = await tx`INSERT INTO kyc_documents ${tx(doc(A.id))} RETURNING id`;
      const del = await tx`DELETE FROM kyc_documents WHERE id = ${d.id} RETURNING id`;
      if (del.length !== 1) throw new Error(`deleted ${del.length} rows, expected 1`);
    })) === null,
    "the replace/remove flow in onboarding is broken"
  );

  report(
    "owner CANNOT delete a document while under review",
    (await tryTx(async (tx) => {
      await be(tx, A.user, "therapist");
      const [d] = await tx`INSERT INTO kyc_documents ${tx(doc(A.id))} RETURNING id`;
      await tx`UPDATE therapists SET kyc_status = 'pending' WHERE id = ${A.id}`;
      const del = await tx`DELETE FROM kyc_documents WHERE id = ${d.id} RETURNING id`;
      if (del.length !== 0) throw new Error(`deleted ${del.length} rows`);
    })) === null,
    "evidence can be withdrawn while a reviewer is looking at it"
  );

  report(
    "owner CANNOT delete a document after approval",
    (await tryTx(async (tx) => {
      await be(tx, A.user, "therapist");
      const [d] = await tx`INSERT INTO kyc_documents ${tx(doc(A.id))} RETURNING id`;
      await be(tx, ADMIN, "admin");
      await tx`UPDATE therapists SET kyc_status = 'verified' WHERE id = ${A.id}`;
      await be(tx, A.user, "therapist");
      const del = await tx`DELETE FROM kyc_documents WHERE id = ${d.id} RETURNING id`;
      if (del.length !== 0) throw new Error(`deleted ${del.length} rows`);
    })) === null,
    "the evidence an approval relied on can be destroyed after the fact"
  );

  report(
    "a document cannot be uploaded without a type",
    await (async () => {
      const r = await tryTx(async (tx) => {
        await be(tx, A.user, "therapist");
        await tx`INSERT INTO kyc_documents (therapist_id, uploaded_by, filename, mime_type, size_bytes, content)
                 VALUES (${A.id}, 'probe', 'x.pdf', 'application/pdf', 3, decode('414243','hex'))`;
      });
      return r !== null && /doc_type/i.test(r);
    })(),
    "untyped documents can accumulate again — nothing can be checked against a requirement"
  );

  // ── Cross-tenant isolation ─────────────────────────────────────────────────

  report(
    "therapist B cannot delete therapist A's document",
    (await tryTx(async (tx) => {
      await be(tx, A.user, "therapist");
      const [d] = await tx`INSERT INTO kyc_documents ${tx(doc(A.id))} RETURNING id`;
      await be(tx, B.user, "therapist");
      const del = await tx`DELETE FROM kyc_documents WHERE id = ${d.id} RETURNING id`;
      if (del.length !== 0) throw new Error(`deleted ${del.length} rows`);
    })) === null,
    "one clinician can destroy another's credentials"
  );

  report(
    "therapist B cannot read therapist A's documents",
    (await tryTx(async (tx) => {
      await be(tx, A.user, "therapist");
      await tx`INSERT INTO kyc_documents ${tx(doc(A.id))}`;
      await be(tx, B.user, "therapist");
      const [c] = await tx`SELECT count(*)::int n FROM kyc_documents WHERE therapist_id = ${A.id}`;
      if ((c.n as number) !== 0) throw new Error(`saw ${c.n} rows`);
    })) === null,
    "government IDs are readable across tenants"
  );

  // ── Self-certification (the escalation migration 0015 closed) ──────────────

  report(
    "therapist CANNOT self-approve their kyc_status",
    await (async () => {
      const r = await tryTx(async (tx) => {
        await be(tx, A.user, "therapist");
        await tx`UPDATE therapists SET kyc_status = 'verified' WHERE id = ${A.id}`;
      });
      return r !== null && /only move their own application/i.test(r);
    })(),
    "A THERAPIST CAN VERIFY THEMSELVES — the entire credentialing process is bypassable"
  );

  report(
    "a new therapist row CANNOT be self-created as verified",
    await (async () => {
      const r = await tryTx(async (tx) => {
        await be(tx, "auth0|security-check-applicant", "therapist");
        await tx`INSERT INTO therapists (user_id, name, bio, experience, kyc_status)
                 VALUES ('auth0|security-check-applicant', 'Probe', 'bio', 1, 'verified')`;
      });
      return r !== null && /must be ''?incomplete/i.test(r);
    })(),
    "an applicant can insert themselves pre-approved and never appear in the queue"
  );

  report(
    "therapist CANNOT forge reviewer identity or timestamp",
    await (async () => {
      const r = await tryTx(async (tx) => {
        await be(tx, A.user, "therapist");
        await tx`UPDATE therapists SET kyc_reviewed_by = ${A.user}, kyc_reviewed_at = now()
                 WHERE id = ${A.id}`;
      });
      return r !== null && /may only be written by an admin/i.test(r);
    })(),
    "review provenance can be fabricated by the applicant"
  );

  report(
    "therapist CANNOT author a review note",
    await (async () => {
      const r = await tryTx(async (tx) => {
        await be(tx, A.user, "therapist");
        await tx`UPDATE therapists SET kyc_review_note = 'Approved by compliance.' WHERE id = ${A.id}`;
      });
      return r !== null && /only clear/i.test(r);
    })(),
    "an applicant can write text that reads as a reviewer's decision"
  );

  report(
    "therapist CANNOT mark their own document accepted",
    (await tryTx(async (tx) => {
      await be(tx, A.user, "therapist");
      const [d] = await tx`INSERT INTO kyc_documents ${tx(doc(A.id))} RETURNING id`;
      const up = await tx`UPDATE kyc_documents SET review_status = 'accepted'
                          WHERE id = ${d.id} RETURNING id`;
      if (up.length !== 0) throw new Error("update succeeded");
    })) === null,
    "an applicant can satisfy the approval guard without a reviewer"
  );

  // ── The legitimate self-service transitions must still work ────────────────
  //
  // Guards that block real usage get removed by whoever is unblocking a user at
  // 2am. These cases exist so the next change to the trigger cannot quietly
  // break submission while still passing the negative cases above.

  report(
    "therapist CAN still submit (incomplete -> pending)",
    (await tryTx(async (tx) => {
      await be(tx, A.user, "therapist");
      const rows = await tx`UPDATE therapists SET kyc_status = 'pending', kyc_submitted_at = now()
                            WHERE id = ${A.id} RETURNING id`;
      if (rows.length !== 1) throw new Error("blocked");
    })) === null,
    "no therapist can submit an application at all"
  );

  report(
    "therapist CAN clear a stale review note when resubmitting",
    (await tryTx(async (tx) => {
      await be(tx, ADMIN, "admin");
      await tx`UPDATE therapists SET kyc_status = 'rejected', kyc_review_note = 'licence expired'
               WHERE id = ${A.id}`;
      await be(tx, A.user, "therapist");
      const rows = await tx`UPDATE therapists SET kyc_status = 'pending', kyc_review_note = NULL
                            WHERE id = ${A.id} RETURNING id`;
      if (rows.length !== 1) throw new Error("blocked");
    })) === null,
    "a rejected therapist cannot resubmit"
  );

  // ── The audit trail ────────────────────────────────────────────────────────

  report(
    "therapist CANNOT insert into their own review trail",
    await (async () => {
      const r = await tryTx(async (tx) => {
        await be(tx, A.user, "therapist");
        await tx`INSERT INTO kyc_review_events (therapist_id, actor_id, action, note)
                 VALUES (${A.id}, ${A.user}, 'approved', 'self-approved')`;
      });
      return r !== null;
    })(),
    "a therapist can manufacture an approval event in the audit log"
  );

  for (const [label, run] of [
    ["UPDATE", (tx: postgres.TransactionSql) => tx`UPDATE kyc_review_events SET note = 'rewritten'`],
    ["DELETE", (tx: postgres.TransactionSql) => tx`DELETE FROM kyc_review_events`],
  ] as const) {
    report(
      `admin CANNOT ${label} kyc_review_events`,
      await (async () => {
        const r = await tryTx(async (tx) => {
          await be(tx, ADMIN, "admin");
          await run(tx);
        });
        return r !== null && /permission denied/i.test(r);
      })(),
      `the audit trail is ${label.toLowerCase()}-able — it proves nothing`
    );
  }

  console.log(
    `\n  ${pass} passed, ${fail} failed` +
      (fail === 0 ? " — all credentialing guarantees hold\n" : "\n")
  );

  await sql.end();
  if (fail > 0) process.exitCode = 1;
}

main().catch(async (e) => {
  console.error("harness error:", e);
  await sql.end();
  process.exit(1);
});
