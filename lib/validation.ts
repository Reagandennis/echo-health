import { z } from "zod";

import { requirementFor, requiresSubdivision } from "./licensing";

// Reusable primitives
export const userIdSchema = z.string().min(1).max(128);
export const emailSchema = z.string().email().max(254);
export const safeTextSchema = z.string().min(1).max(4000);
export const shortTextSchema = z.string().min(1).max(256);

// /api/chat — public widget POST
export const chatMessageSchema = z.object({
  sessionId: z.string().min(8).max(128),
  name: shortTextSchema,
  email: emailSchema,
  text: safeTextSchema,
});

/**
 * Presence beacon for the anonymous support chat.
 *
 * The session id is a `crypto.randomUUID()` minted in the browser and acts as a
 * bearer capability — holding it *is* the authorization, since anonymous
 * visitors have no account to check. Requiring the UUID shape here means a
 * caller cannot probe with arbitrary strings.
 */
export const chatOfflineSchema = z.object({
  sessionId: z.string().uuid(),
});

// /api/chat/reply — admin-only
export const chatReplySchema = z.object({
  sessionId: z.string().min(8).max(128),
  text: safeTextSchema,
  userEmail: emailSchema,
  userName: shortTextSchema,
});

// /api/user/set-role — self-service strictly limited to "client";
// "therapist" promotion happens only via admin KYC approval.
export const setRoleSchema = z.object({
  userId: userIdSchema,
  role: z.enum(["client", "therapist"]),
});

// /api/admin/therapist-kyc
//
// Both ids are validated as uuids HERE rather than in the route. Postgres raises
// `invalid input syntax for type uuid` on a malformed value, which surfaces as a
// 500 for what is plainly a bad request — so the shape has to be rejected before
// the query is built, and the schema is the one place guaranteed to run first.
const kycIdSchema = z.string().uuid();

/**
 * A reviewer's note. Trimmed before the length check, because "   " is not a
 * reason — and on a rejection this text is the entire explanation the therapist
 * receives, so whitespace passing as one is worse than an empty field.
 *
 * 1000 chars matches `therapists.kyc_review_note` / `kyc_documents.review_note`;
 * a longer note would be truncated by Postgres or, with a strict column, error.
 */
const kycNoteSchema = z.string().trim().min(1).max(1000);

/**
 * The review actions, as a discriminated union rather than one object with
 * everything optional.
 *
 * The point is that `note` is REQUIRED on `reject` and `request_changes` and the
 * type system knows it. A rejection with no reason is one the therapist cannot
 * act on and the platform cannot defend later, so "the admin UI always sends
 * one" is not a strong enough guarantee — the schema refuses it.
 */
export const kycReviewSchema = z.discriminatedUnion("action", [
  z.object({
    therapistDocId: kycIdSchema,
    action: z.literal("approve"),
    // Optional: an approval needs no justification beyond the accepted documents.
    note: kycNoteSchema.optional(),
  }),
  z.object({
    therapistDocId: kycIdSchema,
    action: z.literal("reject"),
    note: kycNoteSchema,
  }),
  /**
   * "Fix these and resubmit", as distinct from "no". It lands on the same
   * `rejected` status — there is no separate enum value, and inventing one would
   * mean a migration plus every status switch in the app growing a case — but it
   * sends different mail, because "your application was declined" and "we need a
   * clearer copy of your ID" should not read identically.
   */
  z.object({
    therapistDocId: kycIdSchema,
    action: z.literal("request_changes"),
    note: kycNoteSchema,
  }),
  /**
   * A decision on ONE document. This is what lets a reviewer accept four and
   * reject one, then come back to it, instead of restarting the whole review.
   */
  z
    .object({
      therapistDocId: kycIdSchema,
      action: z.literal("review_document"),
      documentId: kycIdSchema,
      decision: z.enum(["accepted", "rejected"]),
      note: kycNoteSchema.optional(),
    })
    .refine((d) => d.decision !== "rejected" || Boolean(d.note), {
      message: "A note is required when rejecting a document",
      path: ["note"],
    }),
]);

export type KycReviewPayload = z.infer<typeof kycReviewSchema>;

/* ── Therapist licences, one per jurisdiction (migration 0018) ───────────────
 *
 * These schemas guard `app/actions/licensing.ts`. They are the FIRST of three
 * layers, and the only one that can explain itself to the applicant:
 *
 *   1. here — the payload is the wrong shape, said in a sentence a form can show;
 *   2. the application checks in `app/actions/licensing.ts` — "Forbidden", loudly;
 *   3. `therapist_licences_guard` — the trigger, which raises rather than
 *      returning zero rows, and is the layer that cannot be bypassed.
 *
 * Layer 3 is the one that matters and the reason layers 1 and 2 exist: a
 * database exception surfaces to the applicant as an untranslated Postgres
 * message, so anything the guard will refuse should have been refused here with
 * words instead.
 */

/**
 * Mirrors the `licence_verification` enum.
 *
 * Declared rather than imported from `lib/db/schema.ts` on purpose — the same
 * discipline as `lib/kyc.ts` mirroring `kyc_status`. Importing the schema would
 * pull `drizzle-orm/pg-core` into the bundle of anything that validates a
 * payload, and these values are a contract with the database, not a detail of
 * the ORM.
 */
export type LicenceVerification = "named_regulator" | "sub_national" | "case_by_case";

export const licenceVerificationSchema = z.enum([
  "named_regulator",
  "sub_national",
  "case_by_case",
]);

/**
 * A jurisdiction Echo actually has requirements for.
 *
 * `therapist_licences.jurisdiction` is plain `text` — deliberately, so adding a
 * market is not a schema change — which means NOTHING in the database refuses a
 * licence filed against `atlantis`. Every claim made about a licence
 * (`applicantGuidance`, `reviewerGuidance`, `canListInJurisdiction`) is looked
 * up by this slug in `lib/licensing.ts`, so an unrecognised one produces a row
 * a reviewer has no instructions for and the directory cannot describe. The
 * schema is the only point guaranteed to run before the insert.
 */
const jurisdictionSlugSchema = z
  .string()
  .min(1)
  .max(64)
  .refine((slug) => Boolean(requirementFor(slug)), {
    message:
      "not a jurisdiction Echo has licensing requirements for — see lib/licensing.ts",
  });

/** Matches `varchar(128)` on `therapist_licences.licence_number`. */
const licenceNumberSchema = z.string().trim().min(1).max(128);

/**
 * The state or province. `text` in the database, capped here because it is
 * rendered in the directory and a 4 kB "state" is a layout bug, not a licence.
 */
const subdivisionSchema = z.string().trim().min(1).max(120);

/** Free text by design — see the column comment; Echo does not know which body
 *  is authoritative in every jurisdiction, so an enum would force a wrong answer. */
const regulatorSchema = z.string().trim().min(1).max(200);

/**
 * `expires_at` is a Postgres `date`, which Drizzle hands back as `YYYY-MM-DD`.
 *
 * The second check is not redundant with the regex: `2026-02-31` matches the
 * pattern and Postgres rejects it with `date/time field value out of range`,
 * which reaches the applicant as a 500 for what is a typo in a date field.
 */
const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "must be a date in YYYY-MM-DD form")
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00Z`);
    return (
      !Number.isNaN(parsed.getTime()) &&
      parsed.toISOString().slice(0, 10) === value
    );
  }, "not a real date");

/**
 * Create or edit one of the caller's own licences.
 *
 * `id` distinguishes an edit from a claim. Without it, correcting a typo in a
 * subdivision ("Californa" → "California") would not update the row — it would
 * insert a second one, because the natural key the upsert falls back on
 * INCLUDES the subdivision. The therapist would then hold two Californian
 * licences and nothing downstream could say which was authoritative, which is
 * precisely what `therapist_licences_unique` exists to prevent and cannot,
 * since the two rows differ.
 *
 * `verification` and every review column are ABSENT, not optional. They are the
 * reviewer's conclusion; `therapist_licences_guard` raises
 * `insufficient_privilege` on an applicant who sends any of them, so a field
 * here that a client could populate would be a form that cannot submit.
 */
export const licenceUpsertSchema = z
  .object({
    /** Present when editing an existing licence, absent when claiming a new one. */
    id: z.string().uuid().optional(),
    jurisdiction: jurisdictionSlugSchema,
    subdivision: subdivisionSchema.optional(),
    regulator: regulatorSchema.optional(),
    licenceNumber: licenceNumberSchema.optional(),
    expiresAt: isoDateSchema.optional(),
  })
  .superRefine((value, ctx) => {
    const needsSubdivision = requiresSubdivision(value.jurisdiction);
    const country = requirementFor(value.jurisdiction)?.country ?? value.jurisdiction;

    /*
     * The guard raises on this too. Caught here so the applicant reads "tell us
     * which state" rather than a Postgres check_violation — and so the error
     * arrives attached to the field it concerns.
     */
    if (needsSubdivision && !value.subdivision) {
      ctx.addIssue({
        code: "custom",
        path: ["subdivision"],
        message: `licensure in ${country} is issued by a state or province, not nationally — name the one that licensed you`,
      });
    }

    /*
     * Rejected rather than silently dropped. A subdivision on a national
     * licence would sit in the unique key, so "kenya/null" and "kenya/Nairobi"
     * would be two rows for one licence — and because the constraint treats
     * NULLs as distinct, Postgres would accept both. Dropping the value quietly
     * is how a form comes to disagree with the row it just wrote.
     */
    if (!needsSubdivision && value.subdivision) {
      ctx.addIssue({
        code: "custom",
        path: ["subdivision"],
        message: `${country} licenses nationally — leave the state or province blank`,
      });
    }
  });

export type LicenceUpsertPayload = z.infer<typeof licenceUpsertSchema>;

/**
 * A reviewer's verdict on one licence.
 *
 * `verification` is REQUIRED on an approval and absent from a rejection,
 * because it records how the reviewer checked — and a rejection confirms
 * nothing. It is the column a client later reads as "this clinician's standing
 * was verified against their regulator", so it cannot default.
 */
export const licenceReviewSchema = z.discriminatedUnion("action", [
  z.object({
    licenceId: z.string().uuid(),
    action: z.literal("approve"),
    verification: licenceVerificationSchema,
    note: kycNoteSchema.optional(),
  }),
  z.object({
    licenceId: z.string().uuid(),
    action: z.literal("reject"),
    /** The therapist reads this verbatim. A rejection with no reason is not one. */
    note: kycNoteSchema,
  }),
]);

export type LicenceReviewPayload = z.infer<typeof licenceReviewSchema>;

/**
 * The conclusions a reviewer may honestly record for a jurisdiction.
 *
 * This is the enforcement of the whole point of `VerificationMode`. For a
 * `case-by-case` jurisdiction Echo has NOT established which body regulates
 * psychotherapy, so `named_regulator` is not a checkable claim — recording it
 * would have the platform telling clients it verified a registration against a
 * register it never identified. `lib/licensing.ts` says as much in the
 * `reviewerGuidance` for those entries; this is the half a UI cannot skip.
 *
 * `case_by_case` is always permitted: a reviewer who could not reach the
 * register must be able to say so, even where a register exists.
 *
 * It lives in this file rather than in `lib/licensing.ts` because it answers a
 * question about a PAYLOAD — which values of `verification` are acceptable for
 * this jurisdiction — which is what everything else here does.
 */
export function allowedVerificationsFor(
  slug: string
): readonly LicenceVerification[] {
  switch (requirementFor(slug)?.verification) {
    case "named-regulator":
      return ["named_regulator", "case_by_case"];
    case "sub-national":
      return ["sub_national", "case_by_case"];
    case "case-by-case":
      return ["case_by_case"];
    default:
      /* Unknown slug. Empty, so every approval is refused rather than one
         arbitrary mode being waved through for a jurisdiction nobody described. */
      return [];
  }
}

// /api/promo
export const promoSchema = z.object({
  code: z.string().min(1).max(64),
  userId: userIdSchema,
});

// The video-session proxy schema (endpoint/method/data allowlist for the
// Cloudflare Calls proxy) was removed with the migration to the Echo video
// backend: session minting now goes through the `createVideoSessionAction`
// server action (authorized by therapy-session participation), not a REST proxy.

// Helpers that turn a parse failure into a 400-friendly message
export function parseOrError<T>(schema: z.ZodType<T>, value: unknown):
  | { ok: true; data: T }
  | { ok: false; message: string } {
  const r = schema.safeParse(value);
  if (r.success) return { ok: true, data: r.data };
  const first = r.error.issues[0];
  const path = first?.path?.join(".") ?? "input";
  return { ok: false, message: `${path}: ${first?.message ?? "invalid"}` };
}
