"use server";

import { and, asc, eq, inArray } from "drizzle-orm";

import { getLoggedInUser, type SessionUser } from "@/lib/auth/session";
import { withUser } from "@/lib/db/session";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import { captureServer } from "@/lib/analytics/server";
import { requirementFor, requiresSubdivision } from "@/lib/licensing";
import type { KycStatus } from "@/lib/kyc";
import {
  allowedVerificationsFor,
  licenceReviewSchema,
  licenceUpsertSchema,
  parseOrError,
  type LicenceVerification,
} from "@/lib/validation";
import { kycReviewEvents, notifications, therapistLicences, therapists } from "@/lib/db/schema";

/*
 * PER-JURISDICTION LICENCES (migration 0018)
 * ------------------------------------------
 * Every clinician on Echo was licensed in Kenya and every client — in thirteen
 * countries — got one of them. A therapist can now hold one licence per
 * jurisdiction, each verified separately, and this file is the only write path
 * to `therapist_licences`.
 *
 * It follows the model documented at the top of `app/actions/database.ts`, and
 * the parts that matter most here are the parts that are easiest to drop:
 *
 *  1. EVERY query runs inside a `withUser(...)` callback on its `tx` handle,
 *     never the bare `db` export. `withUser` is what sets `app.user_id` /
 *     `app.user_roles`; a query issued outside one carries no identity, so
 *     `app_owns_therapist()` is false, and the write fails CLOSED and silent.
 *
 *  2. The application checks below are not redundant with RLS, for a reason
 *     specific to this table: `therapist_licences_select` is `USING (true)`.
 *     The directory has to be able to say which jurisdictions a clinician is
 *     licensed in before a visitor signs in, so a SELECT by id returns ANY
 *     therapist's licence. RLS will not answer "is this mine" on a read here —
 *     these checks are the only thing that does, and they answer "Forbidden"
 *     loudly rather than handing back someone else's row.
 *
 *  3. `therapist_licences_guard` (the trigger) is the layer that cannot be
 *     bypassed: an applicant may write `status = 'incomplete'` on insert and
 *     may make exactly one transition, `incomplete`/`rejected` → `pending`.
 *     `verification`, `reviewed_at`, `reviewed_by` and any non-null
 *     `review_note` are refused outright with `insufficient_privilege`.
 *
 *     So nothing on the applicant path below ever SETS those columns. That is
 *     not defensive coding — a payload carrying `verification` raises, and a
 *     raise inside a transaction rolls back the licence with it, so a form that
 *     sends the reviewer's conclusion is a form that cannot save anything.
 *
 *  4. Migration 0019 extended the guard to the EVIDENCE columns —
 *     `jurisdiction`, `subdivision`, `licence_number`, `regulator`,
 *     `expires_at`, `document_id` and `submitted_at` are frozen once a licence
 *     is `pending` or `verified`. Until then 0018 guarded only the verdict, and
 *     `assertApplicantEditable` was the ONLY thing standing between a clinician
 *     getting Kenya approved and swapping in a different registration number
 *     under the same verified badge.
 *
 *     `assertApplicantEditable` is still here, and still worth having: RLS and
 *     the trigger refuse the write with `insufficient_privilege`, which reaches
 *     the user as a 500. This turns the same refusal into a sentence explaining
 *     what to do instead. The database is the guarantee; this is the message.
 */

/** The transaction handle, derived so this module never imports the bare `db`. */
type Tx = Parameters<Parameters<typeof withUser>[1]>[0];

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Postgres raises `invalid input syntax for type uuid` on a malformed id,
 *  which surfaces as a 500 where the caller deserves "Not found". */
function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

async function requireUser(): Promise<SessionUser> {
  const user = await getLoggedInUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (!user.labels.includes("admin")) throw new Error("Forbidden");
  return user;
}

/**
 * The caller's `therapists.id`, or null.
 *
 * Narrow on purpose, exactly like its twin in `app/actions/database.ts`: the
 * row is publicly readable and carries `license_number` and `kyc_status`.
 * Anything needing those must issue its own SELECT naming them.
 */
async function getTherapistDocForUser(tx: Tx, user: SessionUser) {
  const [row] = await tx
    .select({ id: therapists.id, userId: therapists.userId })
    .from(therapists)
    .where(eq(therapists.userId, user.$id))
    .limit(1);
  return row ?? null;
}

/**
 * Resolve the caller's therapist row or explain what is missing.
 *
 * The therapist row MUST exist before a licence can be written:
 * `therapist_licences.therapist_id` is NOT NULL and
 * `therapist_licences_insert` is `app_owns_therapist(therapist_id)`, so there
 * is nothing to attribute a licence to until the profile is saved. Identical
 * constraint to `kyc_documents`, and the reason the onboarding wizard saves the
 * profile before it offers either step.
 */
async function requireOwnTherapist(tx: Tx, user: SessionUser) {
  const therapistDoc = await getTherapistDocForUser(tx, user);
  if (!therapistDoc) {
    throw new Error(
      "No therapist profile for this user — save the therapist profile before adding a licence"
    );
  }
  return therapistDoc;
}

/**
 * A licence the applicant may still change.
 *
 * As of migration 0019 this IS also enforced by the database:
 * `therapist_licences_guard` freezes `licence_number`, `regulator`,
 * `expires_at`, `subdivision`, `jurisdiction` and `document_id` once the row is
 * `pending` or `verified`. Under 0018 it guarded only the verdict columns, and
 * this function was the whole defence — a therapist could have Kenya approved,
 * then edit the registration number, leaving the verified badge, the
 * reviewer's `verification` and the `reviewed_at` trail sitting beside a number
 * nobody checked.
 *
 * Keep both. The trigger is what makes the guarantee hold for a write path
 * nobody has written yet; this is what makes the refusal readable. Same shape
 * as `deleteKycDocumentAction`: once a reviewer is looking at it or has signed
 * it off, the evidence stops being the applicant's to move.
 */
function assertApplicantEditable(status: KycStatus): void {
  if (status === "pending") {
    throw new Error(
      "This licence is under review — it cannot be changed until a decision is made"
    );
  }
  if (status === "verified") {
    throw new Error(
      "This licence has been verified — its details cannot be changed. Add a new jurisdiction, or contact support if something here is wrong."
    );
  }
}

// ─── Shapes the UI reads ─────────────────────────────────────────────────────

/**
 * One of the caller's own licences, as they are permitted to see it.
 *
 * `reviewedBy` is deliberately absent: the therapist gets the decision and the
 * note, not the reviewing admin's Auth0 sub.
 */
export interface MyLicence {
  id: string;
  jurisdiction: string;
  subdivision: string | null;
  regulator: string | null;
  licenceNumber: string | null;
  /** How the reviewer checked it. `case_by_case` until one has. */
  verification: LicenceVerification;
  status: KycStatus;
  /** `YYYY-MM-DD` — a Postgres `date`, not a timestamp. */
  expiresAt: string | null;
  submittedAt: Date | null;
  reviewedAt: Date | null;
  /** The reviewer's reason on a rejection. The only explanation they get. */
  reviewNote: string | null;
}

function selectMyLicences(tx: Tx, therapistId: string): Promise<MyLicence[]> {
  return tx
    .select({
      id: therapistLicences.id,
      jurisdiction: therapistLicences.jurisdiction,
      subdivision: therapistLicences.subdivision,
      regulator: therapistLicences.regulator,
      licenceNumber: therapistLicences.licenceNumber,
      verification: therapistLicences.verification,
      status: therapistLicences.status,
      expiresAt: therapistLicences.expiresAt,
      submittedAt: therapistLicences.submittedAt,
      reviewedAt: therapistLicences.reviewedAt,
      reviewNote: therapistLicences.reviewNote,
    })
    .from(therapistLicences)
    .where(eq(therapistLicences.therapistId, therapistId))
    .orderBy(asc(therapistLicences.createdAt));
}

/**
 * The caller's own licences.
 *
 * `[]` rather than a throw when they have no therapist row: a user who has not
 * started a therapist profile holds no licences, which is an empty list and not
 * an error. (Contrast `getMyKycStatusAction`, which returns null for that case
 * because "you are not an applicant" and "you are an applicant with nothing
 * uploaded" must render differently. Here they render the same.)
 */
export async function listMyLicencesAction(): Promise<MyLicence[]> {
  const user = await requireUser();

  return withUser(user, async (tx) => {
    const therapistDoc = await getTherapistDocForUser(tx, user);
    if (!therapistDoc) return [];
    return selectMyLicences(tx, therapistDoc.id);
  });
}

// ─── Applicant writes ────────────────────────────────────────────────────────

/**
 * Claim a jurisdiction, or correct a claim not yet reviewed.
 *
 * ALWAYS lands at `status: 'incomplete'`. Submission is the separate,
 * deliberate act of `submitLicenceForReviewAction` — which is also the only
 * transition the guard permits an applicant to make. Writing `pending` here
 * would mean a half-typed licence number entering the review queue on the
 * keystroke that created the row.
 *
 * Returns every licence afterwards rather than just the written one, so the
 * caller re-renders from one round trip instead of merging a patch into local
 * state and drifting from what was stored.
 */
export async function upsertTherapistLicenceAction(
  input: unknown
): Promise<MyLicence[]> {
  const user = await requireUser();

  const parsed = parseOrError(licenceUpsertSchema, input);
  if (!parsed.ok) throw new Error(parsed.message);
  const data = parsed.data;

  /* Trimmed to null, not "". The unique key spans `subdivision`, and an empty
     string is a distinct value from NULL — two rows for one Kenyan licence. */
  const subdivision = data.subdivision?.trim() || null;
  const regulator = data.regulator?.trim() || null;
  const licenceNumber = data.licenceNumber?.trim() || null;
  const expiresAt = data.expiresAt ?? null;

  return withUser(user, async (tx) => {
    const therapistDoc = await requireOwnTherapist(tx, user);

    /*
     * An explicit id is an EDIT. Resolved before the natural-key lookup because
     * the two disagree exactly when it matters: changing a subdivision. Keyed
     * on the natural key alone, "Californa" → "California" inserts a second
     * Californian licence instead of fixing the first, and
     * `therapist_licences_unique` cannot catch it because the rows differ.
     */
    const existing = data.id
      ? await findOwnLicenceById(tx, therapistDoc.id, data.id)
      : await findOwnLicenceByJurisdiction(
          tx,
          therapistDoc.id,
          data.jurisdiction,
          subdivision
        );

    if (existing) {
      assertApplicantEditable(existing.status);

      /*
       * Named columns. NOT a spread of the payload, and NOT `verification`,
       * `status` or any review field — the guard raises `insufficient_privilege`
       * on those, and a raise aborts the transaction rather than returning zero
       * rows, so one stray column loses the whole edit.
       */
      await tx
        .update(therapistLicences)
        .set({
          jurisdiction: data.jurisdiction,
          subdivision,
          regulator,
          licenceNumber,
          expiresAt,
        })
        .where(
          and(
            eq(therapistLicences.id, existing.id),
            /* Ownership is re-stated in the WHERE as well as checked above.
               `therapist_licences_update` does enforce it, but this makes the
               statement correct on its own rather than only in context. */
            eq(therapistLicences.therapistId, therapistDoc.id)
          )
        );

      return selectMyLicences(tx, therapistDoc.id);
    }

    /*
     * `status` is stated rather than left to the column default. The default IS
     * `incomplete`, but this is the value the guard checks on INSERT, and
     * relying on a default for a security-relevant value means a later
     * migration changing it would silently change what an applicant can create.
     */
    await tx.insert(therapistLicences).values({
      therapistId: therapistDoc.id,
      jurisdiction: data.jurisdiction,
      subdivision,
      regulator,
      licenceNumber,
      expiresAt,
      status: "incomplete",
    });

    return selectMyLicences(tx, therapistDoc.id);
  });
}

/**
 * Look up one of the caller's own licences by id.
 *
 * The ownership comparison is in JS rather than the WHERE, so a licence that
 * exists but belongs to someone else is "Forbidden" and not "Not found".
 * `therapist_licences_select` is `USING (true)` for the public directory, so
 * RLS hides nothing on this read — this function is the check.
 */
async function findOwnLicenceById(tx: Tx, therapistId: string, licenceId: string) {
  const [row] = await tx
    .select({
      id: therapistLicences.id,
      therapistId: therapistLicences.therapistId,
      jurisdiction: therapistLicences.jurisdiction,
      subdivision: therapistLicences.subdivision,
      status: therapistLicences.status,
    })
    .from(therapistLicences)
    .where(eq(therapistLicences.id, licenceId))
    .limit(1);

  if (!row) throw new Error("Not found");
  if (row.therapistId !== therapistId) throw new Error("Forbidden");
  return row;
}

/**
 * The natural key: one licence per therapist per jurisdiction+subdivision.
 *
 * Matched in JS rather than with `isNull(...)` in SQL because that is the same
 * comparison the unique constraint gets wrong. Postgres treats NULLs as
 * distinct in a unique index, so `(therapist, 'kenya', NULL)` does not conflict
 * with itself and a second Kenyan licence inserts happily. Reading the
 * therapist's licences and matching here means the application enforces the
 * uniqueness the constraint only half-covers.
 */
async function findOwnLicenceByJurisdiction(
  tx: Tx,
  therapistId: string,
  jurisdiction: string,
  subdivision: string | null
) {
  const rows = await tx
    .select({
      id: therapistLicences.id,
      therapistId: therapistLicences.therapistId,
      jurisdiction: therapistLicences.jurisdiction,
      subdivision: therapistLicences.subdivision,
      status: therapistLicences.status,
    })
    .from(therapistLicences)
    .where(
      and(
        eq(therapistLicences.therapistId, therapistId),
        eq(therapistLicences.jurisdiction, jurisdiction)
      )
    );

  return rows.find((r) => (r.subdivision ?? null) === subdivision) ?? null;
}

/** What a submission actually moved, so the caller can report it honestly. */
export interface LicenceSubmission {
  id: string;
  jurisdiction: string;
  subdivision: string | null;
}

/**
 * Hand licences to the review queue: `incomplete`/`rejected` → `pending`.
 *
 * This is the ONLY status transition `therapist_licences_guard` permits a
 * therapist, and it is made one statement whose WHERE names the permitted
 * source states. Between a SELECT and an UPDATE the transaction is READ
 * COMMITTED, so a double-clicked button or a second tab could otherwise
 * overwrite a decision a reviewer had just committed — the same reasoning as
 * `submitKycForReviewAction`.
 *
 * With no `licenceId` it submits everything submittable, in one transaction.
 * The onboarding wizard calls it that way before submitting the application, so
 * a therapist who filled the form and pressed the one button at the end does
 * not leave jurisdictions sitting at `incomplete`, invisible to the queue.
 */
export async function submitLicenceForReviewAction(
  licenceId?: string
): Promise<LicenceSubmission[]> {
  const user = await requireUser();
  if (licenceId !== undefined && !isUuid(licenceId)) throw new Error("Not found");

  const submitted = await withUser(user, async (tx) => {
    const therapistDoc = await requireOwnTherapist(tx, user);

    const candidates = licenceId
      ? [await findOwnLicenceById(tx, therapistDoc.id, licenceId)]
      : await tx
          .select({
            id: therapistLicences.id,
            therapistId: therapistLicences.therapistId,
            jurisdiction: therapistLicences.jurisdiction,
            subdivision: therapistLicences.subdivision,
            status: therapistLicences.status,
          })
          .from(therapistLicences)
          .where(eq(therapistLicences.therapistId, therapistDoc.id));

    /*
     * A therapist with no jurisdiction at all is the status quo this migration
     * exists to end: a clinician listed to clients in thirteen countries with
     * nothing on file about where they may practise. Refused here rather than
     * only in the form, because the wizard calls this before it submits the KYC
     * application — which makes it the server-side gate on that path.
     */
    if (!licenceId && candidates.length === 0) {
      throw new Error(
        "Add at least one jurisdiction you are licensed in before submitting your application"
      );
    }

    const submittable = candidates.filter(
      (c) => c.status === "incomplete" || c.status === "rejected"
    );

    if (licenceId && submittable.length === 0) {
      const [only] = candidates;
      throw new Error(
        only.status === "pending"
          ? "This licence is already under review"
          : "This licence is already verified — there is nothing to submit"
      );
    }

    /* Nothing to do, and not an error: every licence is already pending or
       verified. Returning empty lets the wizard carry on to the KYC submit. */
    if (submittable.length === 0) return [];

    const submittedAt = new Date();

    const updated = await tx
      .update(therapistLicences)
      .set({
        status: "pending",
        submittedAt,
        /*
         * Cleared so a stale "your certificate had expired" does not sit beside
         * a fresh submission, reading as a verdict on documents nobody has
         * looked at. This is the one review column the guard lets an applicant
         * write, and only to NULL, and only while moving to `pending` — which
         * is exactly this statement. `reviewed_at` / `reviewed_by` are left
         * alone: they record a review that genuinely happened.
         */
        reviewNote: null,
      })
      .where(
        and(
          eq(therapistLicences.therapistId, therapistDoc.id),
          inArray(
            therapistLicences.id,
            submittable.map((s) => s.id)
          ),
          inArray(therapistLicences.status, ["incomplete", "rejected"])
        )
      )
      .returning({
        id: therapistLicences.id,
        jurisdiction: therapistLicences.jurisdiction,
        subdivision: therapistLicences.subdivision,
      });

    if (updated.length === 0) {
      throw new Error(
        "Could not submit — the licence status changed while you were submitting. Reload and try again."
      );
    }

    return updated.map((row) => ({
      ...row,
      wasRejected:
        submittable.find((s) => s.id === row.id)?.status === "rejected",
    }));
  });

  /*
   * AFTER the transaction commits, never inside it. `captureServer` makes a
   * network call and waits up to 3s for the flush; inside `withUser` that holds
   * a pooled Postgres connection for the duration and the Azure tier allows
   * roughly 24 in total. Same ordering rule as the risk scanner.
   */
  for (const licence of submitted) {
    const requirement = requirementFor(licence.jurisdiction);
    await captureServer({
      distinctId: user.$id,
      event: ANALYTICS_EVENTS.THERAPIST_LICENCE_SUBMITTED,
      properties: {
        jurisdiction: licence.jurisdiction,
        subdivision: licence.subdivision,
        verification_mode: requirement?.verification ?? null,
        needs_local_confirmation: requirement?.needsLocalConfirmation ?? null,
        /* A resubmission after a rejection is a different funnel step from a
           first claim, and indistinguishable without this. */
        resubmission: licence.wasRejected,
      },
    });
  }

  return submitted.map(({ id, jurisdiction, subdivision }) => ({
    id,
    jurisdiction,
    subdivision,
  }));
}

// ─── Reviewer writes ─────────────────────────────────────────────────────────

export interface LicenceReviewResult {
  status: KycStatus;
  verification: LicenceVerification;
  jurisdiction: string;
  subdivision: string | null;
}

/**
 * Record a verdict on one licence. Admin only.
 *
 * The check that carries the weight is `allowedVerificationsFor`: for a
 * `case-by-case` jurisdiction Echo has not established WHICH body regulates
 * psychotherapy, so `named_regulator` is not a claim anybody can make — and
 * recording it would have the platform telling a client it checked a
 * registration against a register it never identified. The reviewer UI does not
 * offer the option; this refuses it anyway, because the UI is not the control.
 *
 * Only a `pending` licence can be decided. Approving an `incomplete` one
 * approves something the applicant never claimed, and there is deliberately no
 * revocation path here: withdrawing a verified licence needs its own action and
 * its own trail entry, not an overloaded `reject` that guesses at the contract.
 */
export async function reviewLicenceAction(
  input: unknown
): Promise<LicenceReviewResult> {
  const admin = await requireAdmin();

  const parsed = parseOrError(licenceReviewSchema, input);
  if (!parsed.ok) throw new Error(parsed.message);
  const data = parsed.data;

  const reviewedAt = new Date();

  const result = await withUser(admin, async (tx) => {
    const [licence] = await tx
      .select({
        id: therapistLicences.id,
        therapistId: therapistLicences.therapistId,
        jurisdiction: therapistLicences.jurisdiction,
        subdivision: therapistLicences.subdivision,
        status: therapistLicences.status,
        submittedAt: therapistLicences.submittedAt,
      })
      .from(therapistLicences)
      .where(eq(therapistLicences.id, data.licenceId))
      .limit(1);

    if (!licence) throw new Error("Not found");

    const requirement = requirementFor(licence.jurisdiction);
    if (!requirement) {
      /* The column is free text, so this is reachable. A reviewer has no
         guidance for a jurisdiction nobody described, and approving against no
         requirements is the failure this whole file exists to prevent. */
      throw new Error(
        `No licensing requirements are defined for "${licence.jurisdiction}" — it cannot be reviewed until lib/licensing.ts describes it`
      );
    }

    if (licence.status !== "pending") {
      throw new Error(
        licence.status === "incomplete"
          ? "This licence has not been submitted for review"
          : `This licence has already been decided (${licence.status})`
      );
    }

    if (data.action === "approve") {
      const allowed = allowedVerificationsFor(licence.jurisdiction);
      if (!allowed.includes(data.verification)) {
        throw new Error(
          `Cannot record "${data.verification}" for ${requirement.country}: ` +
            `${requirement.verification === "case-by-case" ? "Echo has not established which body regulates practice there, so there is no register to have checked against" : `its licensing is ${requirement.verification}`}. ` +
            `Permitted: ${allowed.join(", ")}.`
        );
      }

      /* The trigger enforces this for every writer, admins included. Repeated
         so an approval missing a state fails with a sentence rather than a
         `check_violation`. "Licensed in the United States" is not a claim. */
      if (requiresSubdivision(licence.jurisdiction) && !licence.subdivision) {
        throw new Error(
          `${requirement.country} licenses sub-nationally and this licence names no state or province — it cannot be approved as covering the country`
        );
      }
    }

    const [updated] = await tx
      .update(therapistLicences)
      .set(
        data.action === "approve"
          ? {
              status: "verified",
              verification: data.verification,
              reviewedAt,
              reviewedBy: admin.$id,
              reviewNote: data.note ?? null,
            }
          : {
              status: "rejected",
              /*
               * `verification` is left untouched on a rejection. It records how
               * a licence WAS checked and confirmed; a rejection confirms
               * nothing, and stamping a mode on one would put "verified against
               * the HCPC register" beside a refusal.
               */
              reviewedAt,
              reviewedBy: admin.$id,
              reviewNote: data.note,
            }
      )
      .where(
        and(
          eq(therapistLicences.id, licence.id),
          /* Atomic transition, for the reason given on the submit path: the
             SELECT above is not a lock. */
          eq(therapistLicences.status, "pending")
        )
      )
      .returning({
        status: therapistLicences.status,
        verification: therapistLicences.verification,
        jurisdiction: therapistLicences.jurisdiction,
        subdivision: therapistLicences.subdivision,
      });

    if (!updated) {
      throw new Error(
        "Could not record the decision — this licence was decided by someone else while you were reviewing it. Reload and check what was recorded."
      );
    }

    const place = describePlace(licence.jurisdiction, licence.subdivision);

    /*
     * The append-only trail. `kyc_review_events` has no licence column — it
     * predates this table — so the jurisdiction goes in the note, which is what
     * makes the entry answerable later. `documentId` is left null: it is a
     * `kyc_documents` FK and the credentials page renders a non-null one as
     * "this decision was about a file", which a licence verdict is not.
     *
     * `kyc_review_events_insert` is `app_is_admin()`, satisfied because this
     * whole transaction runs under the reviewing admin.
     */
    await tx.insert(kycReviewEvents).values({
      therapistId: licence.therapistId,
      actorId: admin.$id,
      action: data.action === "approve" ? "licence_approved" : "licence_rejected",
      note: truncateNote(
        data.action === "approve"
          ? `${place} — verified as ${data.verification}.${data.note ? ` ${data.note}` : ""}`
          : `${place} — rejected. ${data.note}`
      ),
    });

    /*
     * Tell the therapist. Without this a rejection is a status change they have
     * to go looking for; `notifications_insert` is `app_is_admin()`, so this
     * write is only possible from a reviewer's transaction — which is why it
     * lives here and not on the applicant path.
     */
    const [owner] = await tx
      .select({ userId: therapists.userId })
      .from(therapists)
      .where(eq(therapists.id, licence.therapistId))
      .limit(1);

    if (owner) {
      await tx.insert(notifications).values({
        userId: owner.userId,
        title:
          data.action === "approve"
            ? `Licence verified: ${place}`
            : `Licence not approved: ${place}`,
        message:
          data.action === "approve"
            ? `Your licence for ${place} has been verified. Clients there will see that you are locally licensed.`
            : data.note,
        type: data.action === "approve" ? "success" : "warning",
        link: "/onboarding/therapist",
        read: false,
      });
    }

    return { updated, licence, requirement };
  });

  /* After the commit — see the note on the submit path. */
  await captureServer({
    distinctId: admin.$id,
    event: ANALYTICS_EVENTS.THERAPIST_LICENCE_REVIEWED,
    properties: {
      /* A provider is a business entity here, which is why AGENTS.md admits
         `therapist_id` and refuses patient identifiers. It is what makes
         "how many clinicians are licensed in the UK" answerable. */
      therapist_id: result.licence.therapistId,
      jurisdiction: result.updated.jurisdiction,
      subdivision: result.updated.subdivision,
      outcome: data.action === "approve" ? "approved" : "rejected",
      /* What the reviewer actually recorded, which is not always the
         jurisdiction's declared mode — the gap between these two is the only
         measure of how often a register could not be reached. Null on a
         rejection, where nothing was verified. */
      verification: data.action === "approve" ? data.verification : null,
      verification_mode: result.requirement.verification,
      needs_local_confirmation: result.requirement.needsLocalConfirmation,
      days_waiting: daysSince(result.licence.submittedAt, reviewedAt),
    },
  });

  return {
    status: result.updated.status,
    verification: result.updated.verification,
    jurisdiction: result.updated.jurisdiction,
    subdivision: result.updated.subdivision,
  };
}

/**
 * Remove a licence. ADMIN ONLY, and only one nobody has decided.
 *
 * ## Why there is no `deleteOwnLicenceAction`
 *
 * `therapist_licences_delete` is `USING (app_is_admin())`, and the migration
 * says why: "A therapist removing a rejected licence would erase the record
 * that a jurisdiction had already turned them down." A therapist-facing delete
 * would satisfy every application check, remove zero rows, and — because RLS
 * fails a DELETE by matching nothing rather than raising — report success. The
 * repo already carries one of those (`deleteKycDocumentAction`, annotated as
 * such), and adding a second knowingly is worse than not shipping it: the
 * applicant's escape hatch for a jurisdiction added by mistake is to EDIT it
 * while it is `incomplete`, which `upsertTherapistLicenceAction` supports.
 *
 * The admin gate is `reviewed_at IS NULL`, not a status list. A licence
 * carrying a verdict is the credentialing record for a decision that was
 * actually made — deleting one destroys the answer to "who approved this
 * clinician for California, and when". A never-reviewed row is a data-entry
 * mistake, which is the only thing this is for.
 */
export async function deleteLicenceAction(
  licenceId: string
): Promise<{ success: true }> {
  const admin = await requireAdmin();
  if (!isUuid(licenceId)) throw new Error("Not found");

  return withUser(admin, async (tx) => {
    const [licence] = await tx
      .select({
        id: therapistLicences.id,
        status: therapistLicences.status,
        reviewedAt: therapistLicences.reviewedAt,
      })
      .from(therapistLicences)
      .where(eq(therapistLicences.id, licenceId))
      .limit(1);

    if (!licence) throw new Error("Not found");

    if (licence.reviewedAt) {
      throw new Error(
        `This licence has been reviewed (${licence.status}) — the record of that decision cannot be deleted`
      );
    }

    const deleted = await tx
      .delete(therapistLicences)
      .where(eq(therapistLicences.id, licenceId))
      .returning({ id: therapistLicences.id });

    if (deleted.length === 0) {
      /* RLS matched nothing. Surfaced loudly rather than reported as success —
         the difference between "removed" and "silently did nothing" is the
         whole reason this branch exists. */
      throw new Error(
        "Could not remove the licence — the therapist_licences delete policy admits admins only"
      );
    }

    return { success: true as const };
  });
}

// ─── Formatting ──────────────────────────────────────────────────────────────

/**
 * "California, the United States" / "Kenya".
 *
 * The subdivision comes FIRST because it is the jurisdiction that actually
 * licensed them. "The United States, California" reads as a country with a note
 * attached, which is the misreading `sub-national` exists to prevent.
 */
function describePlace(jurisdiction: string, subdivision: string | null): string {
  const country = requirementFor(jurisdiction)?.country ?? jurisdiction;
  return subdivision ? `${subdivision}, ${country}` : country;
}

/** Matches `varchar(1000)` on `kyc_review_events.note`; Postgres would error. */
function truncateNote(note: string): string {
  return note.length <= 1000 ? note : `${note.slice(0, 997)}...`;
}

/** How long the applicant waited. Structural, so it is safe to capture. */
function daysSince(from: Date | null, to: Date): number | null {
  if (!from) return null;
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / 86_400_000));
}
