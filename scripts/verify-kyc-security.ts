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

/**
 * Put a therapist into a known `kyc_status` as an admin, then hand the
 * transaction back to whoever the caller wants to be next.
 *
 * ## Why several cases NEED this, and read as security failures without it
 *
 * The guard in migration 0015 raises on a *transition*, not on a value: it
 * compares `NEW.kyc_status` to `OLD.kyc_status` and permits a write that
 * changes nothing. That is correct — a no-op UPDATE grants nothing — but it
 * means the negative cases below only prove anything when the row starts
 * somewhere the attack would actually move it FROM.
 *
 * `db:seed` leaves every therapist `verified`. Against that fixture,
 * "self-approve to verified" is a no-op the guard rightly allows, and this
 * script reported `A THERAPIST CAN VERIFY THEMSELVES` — the most alarming line
 * it can print — about a database where nothing of the kind was possible. The
 * legitimate `incomplete -> pending` case failed at the same time, for the
 * mirror-image reason.
 *
 * So the state is established explicitly rather than inherited. Everything is
 * inside a rolled-back transaction, so this never touches the real row.
 */
async function fixtureStatus(
  tx: postgres.TransactionSql,
  therapistId: string,
  status: "incomplete" | "pending" | "rejected" | "verified"
) {
  await be(tx, ADMIN_SETUP, "admin");
  await tx`UPDATE therapists SET kyc_status = ${status}::kyc_status WHERE id = ${therapistId}`;
}

/* Declared out here because `fixtureStatus` needs it above `main`. */
const ADMIN_SETUP = "auth0|security-check-admin";

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
  const ADMIN = ADMIN_SETUP;

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
      await fixtureStatus(tx, A.id, "incomplete");
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
      await fixtureStatus(tx, A.id, "incomplete");
      await be(tx, A.user, "therapist");
      const [d] = await tx`INSERT INTO kyc_documents ${tx(doc(A.id))} RETURNING id`;
      /* Moved to `pending` as an admin, not as the therapist. A therapist can
         only make that transition FROM incomplete/rejected, so doing it here as
         A made this case's own setup fail against a seeded `verified` fixture —
         and the failure was reported as the document policy being broken. */
      await fixtureStatus(tx, A.id, "pending");
      await be(tx, A.user, "therapist");
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
        await fixtureStatus(tx, A.id, "incomplete");
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
      await fixtureStatus(tx, A.id, "incomplete");
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

  // ── Per-jurisdiction licences (migrations 0018 and 0019) ───────────────────
  //
  // The 0018 guard covered the VERDICT columns and left the EVIDENCE ones
  // open, so an approved licence could have its registration number or its
  // country rewritten while keeping the reviewer's attestation. 0019 freezes
  // them at `pending` and `verified`. These cases are the reason to believe
  // that, and the reason to notice if a later migration undoes it.

  /*
   * The probe jurisdiction is NOT Kenya, and that is load-bearing.
   *
   * 0018's backfill gave every existing therapist a verified `kenya` licence,
   * and 0019 made the uniqueness constraint NULLS NOT DISTINCT — so a fixture
   * that inserts ('kenya', NULL) now collides with the real row. It did not
   * before, which is the whole defect 0019 fixed: the first run of these cases
   * happily created a second Kenya licence and every one of them failed on the
   * setup rather than the policy.
   */
  const PROBE = "uganda";

  const held = await sql`SELECT 1 FROM therapist_licences
                         WHERE therapist_id = ${A.id} AND jurisdiction = ${PROBE}`;
  if (held.length > 0) {
    console.log(
      `  SKIPPED licence cases — fixture therapist already holds a ${PROBE} licence, ` +
        "so every insert below would collide with it rather than test anything."
    );
  }

  /** A licence owned by A, left at `incomplete`, inside the caller's tx. */
  async function licence(tx: postgres.TransactionSql, jurisdiction = PROBE) {
    const [l] = await tx`
      INSERT INTO therapist_licences (therapist_id, jurisdiction, regulator, licence_number)
      VALUES (${A.id}, ${jurisdiction}, 'security-check regulator', 'PROBE-0001')
      RETURNING id`;
    return l.id as string;
  }

  /** Move a licence to a terminal state as an admin, then return to A. */
  async function asReviewed(tx: postgres.TransactionSql, id: string, status: string) {
    await be(tx, ADMIN, "admin");
    await tx`UPDATE therapist_licences
             SET status = ${status}::kyc_status, verification = 'named_regulator',
                 reviewed_at = now(), reviewed_by = ${ADMIN}
             WHERE id = ${id}`;
    await be(tx, A.user, "therapist");
  }

  report(
    "therapist CANNOT self-verify a licence in a jurisdiction nobody assessed",
    await (async () => {
      const r = await tryTx(async (tx) => {
        await be(tx, A.user, "therapist");
        await tx`INSERT INTO therapist_licences
                   (therapist_id, jurisdiction, licence_number, status)
                 VALUES (${A.id}, 'united-kingdom', 'HCPC-FAKE', 'verified')`;
      });
      return r !== null && /insufficient_privilege|must be ''incomplete''|must be 'incomplete'/i.test(r);
    })(),
    "a clinician can present as HCPC-registered to UK clients with no reviewer involved"
  );

  for (const [column, mutate] of [
    ["licence_number", (tx: postgres.TransactionSql, id: string) =>
      tx`UPDATE therapist_licences SET licence_number = 'KE-SWAPPED' WHERE id = ${id}`],
    ["jurisdiction", (tx: postgres.TransactionSql, id: string) =>
      tx`UPDATE therapist_licences SET jurisdiction = 'united-kingdom' WHERE id = ${id}`],
    ["regulator", (tx: postgres.TransactionSql, id: string) =>
      tx`UPDATE therapist_licences SET regulator = 'Invented Board' WHERE id = ${id}`],
    ["expires_at", (tx: postgres.TransactionSql, id: string) =>
      tx`UPDATE therapist_licences SET expires_at = '2099-01-01' WHERE id = ${id}`],
  ] as const) {
    for (const state of ["pending", "verified"] as const) {
      report(
        `therapist CANNOT change ${column} on a ${state} licence`,
        await (async () => {
          const r = await tryTx(async (tx) => {
            await be(tx, A.user, "therapist");
            const id = await licence(tx);
            await asReviewed(tx, id, state);
            await mutate(tx, id);
          });
          return r !== null && /insufficient_privilege|cannot be changed/i.test(r);
        })(),
        `the evidence behind a ${state} licence is still the applicant's to rewrite — ` +
          "a reviewer's attestation can end up attached to a credential they never saw"
      );
    }
  }

  report(
    "therapist CANNOT reassign a licence to another therapist",
    await (async () => {
      const r = await tryTx(async (tx) => {
        await be(tx, A.user, "therapist");
        const id = await licence(tx);
        await tx`UPDATE therapist_licences SET therapist_id = ${B.id} WHERE id = ${id}`;
      });
      return r !== null && /insufficient_privilege|cannot be reassigned/i.test(r);
    })(),
    "a licence can be handed to another account, which is a credential transfer"
  );

  report(
    "one licence per jurisdiction is actually enforced when subdivision is NULL",
    await (async () => {
      const r = await tryTx(async (tx) => {
        await be(tx, A.user, "therapist");
        await licence(tx);
        await licence(tx);
      });
      /* Before 0019 this inserted both rows and returned null: the constraint
         was NULLS DISTINCT, so two NULL subdivisions did not collide and the
         table could hold a `verified` and a `rejected` row for one country. */
      return r !== null && /duplicate key|therapist_licences_unique/i.test(r);
    })(),
    "two rows can exist for one jurisdiction, and nothing downstream can say which is authoritative"
  );

  report(
    "a sub-national jurisdiction CANNOT be recorded without a state or province",
    await (async () => {
      const r = await tryTx(async (tx) => {
        await be(tx, A.user, "therapist");
        await tx`INSERT INTO therapist_licences (therapist_id, jurisdiction, licence_number)
                 VALUES (${A.id}, 'united-states', 'US-0001')`;
      });
      return r !== null && /sub-nationally|check_violation/i.test(r);
    })(),
    "a therapist licensed in one US state can be presented as licensed countrywide"
  );

  // ── The legitimate licence flows must still work ───────────────────────────

  report(
    "therapist CAN correct the details of an incomplete licence",
    (await tryTx(async (tx) => {
      await be(tx, A.user, "therapist");
      const id = await licence(tx);
      const u = await tx`UPDATE therapist_licences SET licence_number = 'KE-0002'
                         WHERE id = ${id} RETURNING id`;
      if (u.length !== 1) throw new Error(`updated ${u.length} rows, expected 1`);
    })) === null,
    "an applicant cannot fix a typo before submitting — 0019 froze too much"
  );

  report(
    "therapist CAN correct details after a rejection",
    (await tryTx(async (tx) => {
      await be(tx, A.user, "therapist");
      const id = await licence(tx);
      await asReviewed(tx, id, "rejected");
      const u = await tx`UPDATE therapist_licences SET licence_number = 'KE-0003'
                         WHERE id = ${id} RETURNING id`;
      if (u.length !== 1) throw new Error(`updated ${u.length} rows, expected 1`);
    })) === null,
    "a rejected applicant cannot answer the rejection, which makes rejection permanent"
  );

  report(
    "therapist CAN submit an incomplete licence for review",
    (await tryTx(async (tx) => {
      await be(tx, A.user, "therapist");
      const id = await licence(tx);
      const u = await tx`UPDATE therapist_licences
                         SET status = 'pending', submitted_at = now(), review_note = NULL
                         WHERE id = ${id} RETURNING id`;
      if (u.length !== 1) throw new Error(`updated ${u.length} rows, expected 1`);
    })) === null,
    "the submit path is broken — no licence can ever reach a reviewer"
  );

  report(
    "admin CAN verify a licence",
    (await tryTx(async (tx) => {
      await be(tx, A.user, "therapist");
      const id = await licence(tx);
      await be(tx, ADMIN, "admin");
      const u = await tx`UPDATE therapist_licences
                         SET status = 'verified', verification = 'named_regulator',
                             reviewed_at = now(), reviewed_by = ${ADMIN}
                         WHERE id = ${id} RETURNING id`;
      if (u.length !== 1) throw new Error(`updated ${u.length} rows, expected 1`);
    })) === null,
    "reviewers cannot approve anything — 0019's freeze caught admins too"
  );

  report(
    "admin CAN correct the evidence on a verified licence",
    (await tryTx(async (tx) => {
      await be(tx, A.user, "therapist");
      const id = await licence(tx);
      await asReviewed(tx, id, "verified");
      await be(tx, ADMIN, "admin");
      const u = await tx`UPDATE therapist_licences SET licence_number = 'KE-CORRECTED'
                         WHERE id = ${id} RETURNING id`;
      if (u.length !== 1) throw new Error(`updated ${u.length} rows, expected 1`);
    })) === null,
    "a genuine transcription error in an approved licence cannot be fixed by anyone"
  );

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
