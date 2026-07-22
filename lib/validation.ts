import { z } from "zod";

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
