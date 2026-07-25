"use server";

import { and, asc, desc, eq, gte, inArray, isNotNull, lt, or, sql } from "drizzle-orm";

import { getLoggedInUser, type SessionUser } from "@/lib/auth/session";
import { withAnonymous, withSystem, withUser } from "@/lib/db/session";
import { analyzeRisk } from "@/lib/clinical/risk";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import { captureServer } from "@/lib/analytics/server";
import { rateLimit } from "@/lib/rate-limit";
import { mintVideoSession, type IceServer } from "@/lib/video";
import {
  validateAvailabilityDraft,
  type AvailabilityBlock,
  type AvailabilityDraft,
} from "@/lib/availability";
import {
  PLAN_CURRENCY,
  PLAN_SESSIONS,
  THERAPIST_PAID_ON_LIST_PRICE,
  THERAPIST_REVENUE_SHARE,
  listPriceMinorPerSession,
  therapistShareMinor,
} from "@/lib/constants";
import {
  KYC_DOCUMENT_SPECS,
  canSubmitForReview,
  kycDocumentLabel,
  missingRequiredTypes,
  type KycDocReview,
  type KycDocumentType,
  type KycStatus,
} from "@/lib/kyc";
import {
  avatars,
  chatMessages,
  chatSessions,
  clinicalNotes,
  goals,
  journalEntries,
  kycDocuments,
  matchConflicts,
  messages,
  moodLogs,
  notifications,
  payments,
  payoutLedger,
  profiles,
  riskAlerts,
  therapySessions,
  therapistAvailability,
  therapists,
  type GoalMilestone,
} from "@/lib/db/schema";

/*
 * AUTHORIZATION MODEL (post-Auth0, post-Postgres migration)
 * ---------------------------------------------------------
 * Two independent layers guard every row, and BOTH are load-bearing:
 *
 *  1. Postgres row-level security (lib/db/migrations/0001_row_level_security.sql).
 *     Identity reaches the database through `withUser()`, which opens a
 *     transaction and sets `app.user_id` / `app.user_roles` as transaction-local
 *     GUCs. EVERY query in this file therefore runs inside a `withUser(...)`
 *     callback and uses its `tx` handle — never the bare `db` export. A query
 *     issued outside one carries no identity, so `app_user_id()` is null and
 *     every ownership predicate fails closed, silently returning zero rows.
 *
 *  2. The application checks below (`requirePatientAccess`, `ownsTherapistDoc`,
 *     …). RLS is defense-in-depth, not a replacement: it fails a request closed
 *     by returning nothing, whereas these checks fail it loudly with "Forbidden",
 *     which is what the UI and the audit trail need. A few are now strictly
 *     redundant with a policy; they are kept deliberately and annotated as such.
 *
 * Identifier vocabulary used throughout (do not confuse these):
 *   - `user.$id` / `userId` / `patientId` / `senderId` — Auth0 `sub`, the user PK.
 *     These are `text` columns, never uuid.
 *   - `therapistId` — a `therapists.id` UUID, NOT a user id. Map it to a person
 *     via the therapist row's own `userId` field.
 *   - `profiles.therapistId` — the therapist row a client is matched with; this
 *     is the only record of the therapist↔patient relationship, and the one
 *     `app_treats()` consults.
 */

/**
 * The transaction handle threaded through every helper, derived from `withUser`
 * so that this module never has to import the bare `db` export it must not use.
 */
type Tx = Parameters<Parameters<typeof withUser>[1]>[0];

/**
 * Return type of every row-returning action.
 *
 * Deliberately permissive. Call sites still hold the Appwrite-era interfaces
 * (`TherapySession`, `Goal`, `MoodLog` …) which extend `Models.Document` and
 * demand `$collectionId`/`$permissions`/`$sequence` — members no Drizzle row can
 * satisfy — and which type every timestamp as `string` where Postgres now hands
 * back a `Date`. A nominal row type here would break ~20 files this migration is
 * scoped not to touch. Retiring those interfaces is the follow-up that lets this
 * become a real type.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Doc = any;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Postgres raises `invalid input syntax for type uuid` on a malformed id, which
 * surfaces as a 500. Callers that pass a bad id deserve the same "Not found"
 * they used to get from Appwrite, so ids are screened before they reach a query.
 */
function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

/**
 * Re-expose a row's `id` as `$id`.
 *
 * Call sites read `$id` in ~40 places (React keys, ownership comparisons, and
 * the ids they feed straight back into these actions). Renaming the column to
 * `id` without this bridge would break all of them at once. Every returned row
 * carries BOTH keys, so a caller migrated to `id` and one still on `$id` can
 * coexist during the cutover.
 */
function toDoc<T extends { id: string }>(row: T): Doc {
  return { ...row, $id: row.id };
}

function toDocs<T extends { id: string }>(rows: T[]): Doc[] {
  return rows.map(toDoc);
}

/**
 * Coerce a caller-supplied timestamp to a `Date`.
 *
 * Columns are real `timestamptz` now, but call sites still send
 * `new Date().toISOString()` (dashboard/progress, dashboard/goals,
 * therapist/notes, …). Accepting both keeps them working; the ISO strings should
 * be replaced with `Date` objects as those files are migrated.
 */
function toDate(value: unknown): Date | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

/**
 * `goals.milestones` is `jsonb` typed as `GoalMilestone[]`, but
 * `app/dashboard/goals/page.tsx` still sends `JSON.stringify(ms)`. Parse the
 * legacy string form on the way in so the column holds a real array rather than
 * a JSON string wrapped in JSON. See the report: the matching `JSON.parse` on
 * the read side must be deleted.
 */
function toMilestones(value: unknown): GoalMilestone[] {
  if (Array.isArray(value)) return value as GoalMilestone[];
  if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value);
      return Array.isArray(parsed) ? (parsed as GoalMilestone[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * `messages.sessionId` is a nullable uuid FK. The Appwrite version wrote the
 * literal string "direct" for messages belonging to no session (see
 * `app/dashboard/messages/page.tsx`), which will not cast to uuid — null carries
 * that meaning now.
 */
function toSessionRef(value: unknown): string | null {
  return isUuid(value) ? value : null;
}

/** Copy only the listed keys, dropping `undefined`, so a spread payload from a
 *  fetched row cannot mass-assign `$id`, `userId` or any other column. */
function pick(
  data: unknown,
  keys: readonly string[]
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!data || typeof data !== "object") return out;
  const source = data as Record<string, unknown>;
  for (const key of keys) {
    if (source[key] !== undefined) out[key] = source[key];
  }
  return out;
}

/**
 * True when a whitelisted patch came out empty.
 *
 * Drizzle renders `.set({})` as `UPDATE … SET WHERE …`, which is a syntax error
 * rather than a no-op. Appwrite accepted an empty update happily, so callers
 * that send only unknown fields must keep getting the row back, not a 500.
 */
function isEmptyPatch(patch: Record<string, unknown>): boolean {
  return Object.keys(patch).length === 0;
}

/** Resolve the caller, or reject. Every exported action starts here. */
async function requireUser(): Promise<SessionUser> {
  const user = await getLoggedInUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

function isAdmin(user: SessionUser): boolean {
  return user.labels.includes("admin");
}

function isTherapist(user: SessionUser): boolean {
  return user.labels.includes("therapist");
}

/** Caller must hold the "admin" label. */
async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (!isAdmin(user)) throw new Error("Forbidden");
  return user;
}

/** Caller must be staff — a therapist or an admin. */
async function requireStaff(): Promise<SessionUser> {
  const user = await requireUser();
  if (!isAdmin(user) && !isTherapist(user)) throw new Error("Forbidden");
  return user;
}

/**
 * Identity of the `therapists` row belonging to `user`, or null.
 *
 * DELIBERATELY NARROW — it projects only the columns needed to answer "which
 * row is theirs", because its callers are ownership checks. Do not widen it;
 * `therapists_select` is public for the directory, and the row carries
 * `license_number` and `kyc_status`.
 *
 * COROLLARY, and the reason this comment exists: anything that needs to *read*
 * a therapist's state must issue its own SELECT naming those columns. Passing
 * the result of this function to a caller that then reads `.kycStatus` yields
 * `undefined`, not the stored value — which is exactly how a verified therapist
 * ended up being told to redo their KYC. See `getTherapistDashboardAction`.
 */
async function getTherapistDocForUser(tx: Tx, user: SessionUser) {
  const [row] = await tx
    .select({ id: therapists.id, userId: therapists.userId })
    .from(therapists)
    .where(eq(therapists.userId, user.$id))
    .limit(1);
  return row ?? null;
}

/** True when `therapistDocId` is the `therapists` row owned by `user`. */
async function ownsTherapistDoc(
  tx: Tx,
  user: SessionUser,
  therapistDocId: unknown
): Promise<boolean> {
  if (!isUuid(therapistDocId)) return false;
  const [row] = await tx
    .select({ userId: therapists.userId })
    .from(therapists)
    .where(eq(therapists.id, therapistDocId))
    .limit(1);
  return row?.userId === user.$id;
}

/**
 * True when `user` is a therapist whose therapist row is the assigned
 * `therapistId` on `patientUserId`'s profile. This is the only "real
 * relationship" test available — a therapist with no matched profile row for the
 * patient has no clinical claim to that patient's data.
 *
 * Mirrors the `app_treats()` SQL function backing the RLS policies, so the two
 * layers agree on what "treats" means.
 */
async function treatsPatient(
  tx: Tx,
  user: SessionUser,
  patientUserId: string
): Promise<boolean> {
  if (!isTherapist(user)) return false;
  const therapistDoc = await getTherapistDocForUser(tx, user);
  if (!therapistDoc) return false;

  const [row] = await tx
    .select({ id: profiles.id })
    .from(profiles)
    .where(
      and(
        eq(profiles.userId, patientUserId),
        eq(profiles.therapistId, therapistDoc.id)
      )
    )
    .limit(1);
  return Boolean(row);
}

/** Caller may read/write `patientUserId`'s data: it's theirs, they're admin, or they treat them. */
async function requirePatientAccess(
  tx: Tx,
  patientUserId: string
): Promise<SessionUser> {
  const user = await requireUser();
  if (user.$id === patientUserId) return user;
  if (isAdmin(user)) return user;
  if (await treatsPatient(tx, user, patientUserId)) return user;
  throw new Error("Forbidden");
}

/** Caller acts as the therapist behind `therapistDocId` (or is an admin). */
async function requireTherapistDocAccess(
  tx: Tx,
  therapistDocId: unknown
): Promise<SessionUser> {
  const user = await requireUser();
  if (isAdmin(user)) return user;
  if (await ownsTherapistDoc(tx, user, therapistDocId)) return user;
  throw new Error("Forbidden");
}

/**
 * Caller is a participant on the session row (patient or its therapist), or an
 * admin.
 *
 * Redundant with `therapy_sessions_select`, which already hides non-participant
 * rows — a stranger gets "Not found" from RLS before these checks run. Kept so
 * the failure is an explicit "Forbidden" rather than an ambiguous empty result,
 * and so the rule survives if the policy is ever relaxed.
 */
async function requireSessionAccess(tx: Tx, sessionId: string) {
  const user = await requireUser();
  if (!isUuid(sessionId)) throw new Error("Not found");

  const [sess] = await tx
    .select()
    .from(therapySessions)
    .where(eq(therapySessions.id, sessionId))
    .limit(1);
  if (!sess) throw new Error("Not found");

  if (isAdmin(user)) return { user, sess };
  if (sess.patientId === user.$id) return { user, sess };
  if (await ownsTherapistDoc(tx, user, sess.therapistId)) return { user, sess };
  throw new Error("Forbidden");
}

/**
 * The user-owned tables `requireDocumentOwner` can police. Each has a uuid `id`
 * and a `userId` holding an Auth0 sub.
 */
type OwnedTable =
  | typeof notifications
  | typeof journalEntries
  | typeof goals
  | typeof profiles;

/**
 * Fetch a row from `table` and assert `user` owns it via `userId`.
 * Admins bypass. Used for every update/delete of a pre-existing user-owned row.
 *
 * SIGNATURE CHANGE (internal helper): took `(collectionId, documentId,
 * ownerField)`; now takes `(tx, table, documentId)`. The owner column is no
 * longer a caller-supplied string because every one of these tables names it
 * `userId`, and a stringly-typed field name cannot be checked by the compiler.
 */
async function requireDocumentOwner(
  tx: Tx,
  table: OwnedTable,
  documentId: string
): Promise<SessionUser> {
  const user = await requireUser();
  if (!isUuid(documentId)) throw new Error("Not found");

  const [row] = await tx
    .select({ userId: table.userId })
    .from(table)
    .where(eq(table.id, documentId))
    .limit(1);
  if (!row) throw new Error("Not found");

  if (isAdmin(user)) return user;
  if (row.userId !== user.$id) throw new Error("Forbidden");
  return user;
}

/**
 * Notification writer used internally by other actions in this file. Kept
 * separate from the exported `createNotificationAction` so intra-file callers
 * are not re-subjected to that action's admin gate.
 *
 * `notifications_insert` is admin-only in RLS, so every path reaching this must
 * already run under an admin identity — which today they all do.
 */
async function writeNotification(
  tx: Tx,
  data: {
    userId: string;
    title: string;
    message: string;
    type: "info" | "success" | "warning" | "alert";
    link?: string;
  }
): Promise<Doc> {
  const [row] = await tx
    .insert(notifications)
    .values({
      userId: data.userId,
      title: data.title,
      message: data.message,
      type: data.type,
      link: data.link ?? null,
      read: false,
    })
    .returning();
  return toDoc(row);
}

/**
 * Upload ceilings. Bytes are stored in Postgres `bytea`, so these bound database
 * growth as well as request size.
 *
 * `serverActions.bodySizeLimit` in `next.config.ts` must stay ABOVE both, or the
 * framework rejects the request before these checks run and the user sees a raw
 * "Body exceeded 1 MB limit" instead of a useful message.
 */
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
/** Licence scans are frequently multi-page PDFs, so they get more headroom. */
const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const ALLOWED_DOCUMENT_TYPES = [...ALLOWED_IMAGE_TYPES, "application/pdf"];

function readUpload(formData: FormData, allowedTypes: string[], maxBytes: number) {
  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("No file provided");
  if (file.size > maxBytes) {
    throw new Error(
      `File is ${(file.size / 1024 / 1024).toFixed(1)} MB — the limit is ${maxBytes / 1024 / 1024} MB`
    );
  }
  // Content type is client-supplied and therefore untrusted; the allowlist keeps
  // an arbitrary payload (HTML, SVG with script) out of storage regardless.
  if (!allowedTypes.includes(file.type)) {
    throw new Error(`Unsupported file type: ${file.type || "unknown"}`);
  }
  return file;
}

/**
 * Store a profile photo as an `avatars` row.
 *
 * Separate from KYC uploads on purpose: avatars are readable by anyone (they
 * render in the public therapist directory), whereas KYC documents are
 * identity papers restricted to their owner and admins. Routing both through
 * one table, as the first Appwrite port did, would force a single RLS policy to
 * cover both — either hiding avatars from the directory or exposing IDs.
 *
 * Unlike KYC, this needs no therapist row: clients have avatars too.
 */
export async function uploadAvatarAction(formData: FormData) {
  const user = await requireUser();
  const file = readUpload(formData, ALLOWED_IMAGE_TYPES, MAX_AVATAR_BYTES);
  const content = Buffer.from(await file.arrayBuffer());

  return withUser(user, async (tx) => {
    const [row] = await tx
      .insert(avatars)
      .values({
        ownerId: user.$id,
        filename: (file.name || "avatar").slice(0, 255),
        mimeType: file.type,
        sizeBytes: content.byteLength,
        content,
      })
      .returning({ id: avatars.id });

    return { id: row.id, url: `/api/avatar/${row.id}` };
  });
}

/**
 * A KYC document as the THERAPIST sees it in their own application.
 *
 * Named for the caller's perspective, not the table, because `app/admin/_lib/
 * queries.ts` exports a `KycDocumentSummary` for the SAME rows seen by a
 * reviewer — that one carries `uploadedBy`, `reviewedBy` and `reviewedAt`, which
 * are review-side metadata an applicant has no reason to receive. Two names for
 * two audiences, rather than one shared type that quietly grows the union of
 * both and leaks the wider half.
 *
 * `content` is deliberately absent. It is a `bytea` column holding the whole
 * file, and a server action's return value is serialised into the RSC payload —
 * projecting it here would ship every uploaded megabyte to the browser on a
 * page that only wants to render a filename. The bytes have exactly one
 * delivery route, `GET /api/kyc/<id>`, which authorizes per request.
 */
export interface MyKycDocument {
  id: string;
  docType: KycDocumentType;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: Date;
  reviewStatus: KycDocReview;
  reviewNote: string | null;
}

/**
 * Read and validate the `docType` field of an upload.
 *
 * `kyc_documents.doc_type` is NOT NULL with NO database default (migration 0013
 * adds a default to backfill two legacy rows, then drops it), so an insert that
 * omits this fails at the database rather than quietly landing as `other`. That
 * is the intended behaviour, but the resulting error is a Postgres constraint
 * message; this turns it into something an applicant can act on.
 *
 * The value is matched against `KYC_DOCUMENT_SPECS` rather than cast, because it
 * arrives from a form field and a bad cast would hand an unchecked string to the
 * enum column.
 */
function readDocType(formData: FormData): KycDocumentType {
  const raw = formData.get("docType");
  if (typeof raw !== "string" || raw === "") {
    throw new Error(
      "Select what this document is before uploading — an untyped document cannot be checked against a requirement"
    );
  }

  const spec = KYC_DOCUMENT_SPECS.find((s) => s.type === raw);
  if (!spec) {
    throw new Error(
      `Unknown document type "${raw}". Expected one of: ${KYC_DOCUMENT_SPECS.map((s) => s.type).join(", ")}`
    );
  }
  return spec.type;
}

/**
 * The therapist-visible columns of `kyc_documents`, for one therapist row.
 *
 * Shared by `listMyKycDocumentsAction` and `getMyKycStatusAction` so the latter
 * answers from a single transaction. Calling the action from inside the other
 * action would open a second `withUser` transaction — a second connection
 * checkout and a second identity round-trip — for data this one already has.
 */
async function selectKycDocuments(
  tx: Tx,
  therapistId: string
): Promise<MyKycDocument[]> {
  return tx
    .select({
      id: kycDocuments.id,
      docType: kycDocuments.docType,
      filename: kycDocuments.filename,
      mimeType: kycDocuments.mimeType,
      sizeBytes: kycDocuments.sizeBytes,
      uploadedAt: kycDocuments.uploadedAt,
      reviewStatus: kycDocuments.reviewStatus,
      reviewNote: kycDocuments.reviewNote,
    })
    .from(kycDocuments)
    .where(eq(kycDocuments.therapistId, therapistId))
    .orderBy(asc(kycDocuments.uploadedAt));
}

/**
 * Store an identity document as a `kyc_documents` row.
 *
 * PORTED FROM APPWRITE STORAGE, where these sat at a public bucket URL that
 * anyone holding the link could read. Bytes now live in a `bytea` column behind
 * the `kyc_documents_select` policy, served by `GET /api/kyc/<id>`.
 *
 * SIGNATURE CHANGE: the FormData must now carry a `docType` field alongside
 * `file`. Uploads used to be untyped, which is why "has this clinician provided
 * a practising certificate" could only be answered by opening files one at a
 * time — and why the admin screen answered it with hardcoded values instead.
 */
export async function uploadKycDocumentAction(formData: FormData) {
  const user = await requireUser();
  const docType = readDocType(formData);
  const file = readUpload(formData, ALLOWED_DOCUMENT_TYPES, MAX_DOCUMENT_BYTES);
  const content = Buffer.from(await file.arrayBuffer());

  return withUser(user, async (tx) => {
    // `kyc_documents.therapist_id` is NOT NULL and its RLS insert policy is
    // `app_owns_therapist(therapist_id)`, so an upload has to be attributable to
    // an existing therapist row.
    const therapistDoc = await getTherapistDocForUser(tx, user);
    if (!therapistDoc) {
      throw new Error(
        "No therapist profile for this user — save the therapist profile before uploading documents"
      );
    }

    const [row] = await tx
      .insert(kycDocuments)
      .values({
        therapistId: therapistDoc.id,
        uploadedBy: user.$id,
        docType,
        filename: (file.name || "document").slice(0, 255),
        mimeType: file.type,
        sizeBytes: content.byteLength,
        content,
      })
      .returning({ id: kycDocuments.id });

    return { id: row.id, url: `/api/kyc/${row.id}`, docType };
  });
}

/**
 * Remove one of the caller's own KYC documents.
 *
 * ONLY WHILE THE APPLICATION IS EDITABLE — `incomplete` or `rejected`. Once it
 * is `pending` a reviewer may be part-way through assessing exactly these files,
 * and once it is `verified` the documents are the evidence the approval rests
 * on. Letting an applicant withdraw either would mean the trail no longer shows
 * what was actually reviewed, which is the specific failure migration 0013
 * exists to end.
 *
 * OWNER ONLY — no admin bypass, unlike most delete actions in this file. An
 * admin destroying credentialing evidence should not be a side effect of a
 * therapist-facing action: it leaves no `kyc_review_events` row, so nothing
 * records that the document ever existed. The status gate above is also
 * meaningless for an admin acting on someone else's application. If admins need
 * to remove a document, that belongs in the admin review route, alongside the
 * event write.
 *
 * NOTE — RLS is stricter than this action. `kyc_documents_delete` is
 * `USING (app_is_admin())`, so a therapist deleting their own document
 * satisfies every check below and still removes zero rows. Same shape as the
 * mismatch documented on `deleteClinicalNoteAction`. It is surfaced loudly
 * rather than reported as success; the policy needs
 * `app_owns_therapist(therapist_id)` added before this action can work. Do not
 * "fix" it by weakening the checks here.
 */
export async function deleteKycDocumentAction(documentId: string) {
  const user = await requireUser();
  if (!isUuid(documentId)) throw new Error("Not found");

  return withUser(user, async (tx) => {
    const [doc] = await tx
      .select({ id: kycDocuments.id, therapistId: kycDocuments.therapistId })
      .from(kycDocuments)
      .where(eq(kycDocuments.id, documentId))
      .limit(1);
    if (!doc) throw new Error("Not found");

    if (!(await ownsTherapistDoc(tx, user, doc.therapistId))) {
      throw new Error("Forbidden");
    }

    /*
     * Its own SELECT, naming the column. `getTherapistDocForUser` projects only
     * `{ id, userId }` and reading `.kycStatus` off it yields `undefined` —
     * which here would compare unequal to every blocked status and wave the
     * delete through on a submitted application. See the comment on that helper.
     */
    const [therapist] = await tx
      .select({ kycStatus: therapists.kycStatus })
      .from(therapists)
      .where(eq(therapists.id, doc.therapistId))
      .limit(1);
    if (!therapist) throw new Error("Not found");

    /*
     * Coincides with `canSubmitForReview` today — both mean "the application is
     * still the applicant's to edit". Stated separately because they answer
     * different questions, and a future rule that lets a rejected applicant
     * resubmit without letting them delete the rejected evidence should not
     * arrive silently by way of a shared predicate.
     */
    if (therapist.kycStatus !== "incomplete" && therapist.kycStatus !== "rejected") {
      throw new Error(
        therapist.kycStatus === "pending"
          ? "Your application is under review — documents cannot be removed until a decision is made"
          : "Your application has been approved — the documents it was approved against cannot be removed"
      );
    }

    const deleted = await tx
      .delete(kycDocuments)
      .where(eq(kycDocuments.id, documentId))
      .returning({ id: kycDocuments.id });

    if (deleted.length === 0) {
      throw new Error(
        "Could not remove the document — the kyc_documents delete policy admits admins only"
      );
    }
    return { success: true };
  });
}

/**
 * The caller's own KYC documents, newest requirement work last.
 *
 * Returns `[]` rather than throwing when the caller has no `therapists` row: a
 * user who has not started a therapist profile has no documents, which is an
 * empty list and not an error.
 *
 * These rows carry no `$id` alias. Every other list action in this file adds one
 * for Appwrite-era call sites; this action is new, so it has no callers to keep
 * working and no reason to inherit the bridge.
 */
export async function listMyKycDocumentsAction(): Promise<MyKycDocument[]> {
  const user = await requireUser();

  return withUser(user, async (tx) => {
    const therapistDoc = await getTherapistDocForUser(tx, user);
    if (!therapistDoc) return [];
    return selectKycDocuments(tx, therapistDoc.id);
  });
}

/** Everything the therapist's own KYC page needs, in one transaction. */
export interface MyKycStatus {
  kycStatus: KycStatus;
  kycSubmittedAt: Date | null;
  kycReviewedAt: Date | null;
  /** The reviewer's overall reason. On a rejection this is the whole explanation. */
  kycReviewNote: string | null;
  documents: MyKycDocument[];
  /** Required types not yet uploaded. Empty means the application can be submitted. */
  missingRequired: readonly KycDocumentType[];
}

/**
 * The caller's KYC state and documents. Null when they have no therapist row.
 *
 * Null is "you are not a therapist applicant", which the caller must render
 * differently from "you are an applicant with nothing uploaded" — the second is
 * a real application sitting at `incomplete`, the first is not an application at
 * all. Collapsing them is how a client account ends up being shown a
 * credentialing form.
 */
export async function getMyKycStatusAction(): Promise<MyKycStatus | null> {
  const user = await requireUser();

  return withUser(user, async (tx) => {
    // Named columns rather than `getTherapistDocForUser`, which projects only
    // the identity pair — `kycStatus` is the value this whole action is about.
    const [therapist] = await tx
      .select({
        id: therapists.id,
        kycStatus: therapists.kycStatus,
        kycSubmittedAt: therapists.kycSubmittedAt,
        kycReviewedAt: therapists.kycReviewedAt,
        kycReviewNote: therapists.kycReviewNote,
      })
      .from(therapists)
      .where(eq(therapists.userId, user.$id))
      .limit(1);

    if (!therapist) return null;

    const documents = await selectKycDocuments(tx, therapist.id);

    return {
      kycStatus: therapist.kycStatus,
      kycSubmittedAt: therapist.kycSubmittedAt,
      kycReviewedAt: therapist.kycReviewedAt,
      kycReviewNote: therapist.kycReviewNote,
      documents,
      missingRequired: missingRequiredTypes(documents.map((d) => d.docType)),
    };
  });
}

/**
 * Hand the caller's application to the review queue.
 *
 * The completeness check is repeated here even though the form disables its own
 * submit button while documents are missing. A disabled button is a courtesy to
 * the applicant, not a control: this action is a POST like any other and the
 * button is not what keeps an empty application out of the queue.
 *
 * Does NOT write a `kyc_review_events` row, deliberately. That table's insert
 * policy is `app_is_admin()`, so the write would be refused inside a therapist's
 * transaction and — because a policy refusal on INSERT raises rather than
 * returning zero rows — would roll back the submission with it. Submission
 * events are recorded by the admin review route, which runs as an admin.
 */
export async function submitKycForReviewAction(): Promise<{
  kycStatus: KycStatus;
  kycSubmittedAt: Date | null;
}> {
  const user = await requireUser();

  return withUser(user, async (tx) => {
    const [therapist] = await tx
      .select({ id: therapists.id, kycStatus: therapists.kycStatus })
      .from(therapists)
      .where(eq(therapists.userId, user.$id))
      .limit(1);

    if (!therapist) {
      throw new Error(
        "No therapist profile for this user — save the therapist profile before submitting for review"
      );
    }

    if (!canSubmitForReview(therapist.kycStatus)) {
      throw new Error(
        therapist.kycStatus === "pending"
          ? "Your application is already under review"
          : "You are already verified — there is nothing to submit"
      );
    }

    const documents = await tx
      .select({ docType: kycDocuments.docType })
      .from(kycDocuments)
      .where(eq(kycDocuments.therapistId, therapist.id));

    // `hasAllRequiredTypes` inlined as its own definition, so the refusal can
    // name the gap. "Something is missing" sends the applicant back to hunt
    // through a form they already believe they completed.
    const missing = missingRequiredTypes(documents.map((d) => d.docType));
    if (missing.length > 0) {
      throw new Error(
        `Still required: ${missing.map(kycDocumentLabel).join(", ")}`
      );
    }

    const submittedAt = new Date();

    /*
     * The status guard is repeated in the WHERE, not just the check above.
     * Between the SELECT and this UPDATE the transaction is READ COMMITTED, so a
     * concurrent submit (double-clicked button, two tabs) could commit in
     * between and this would overwrite a decision an admin had just made.
     * Naming the permitted source states makes the transition atomic.
     */
    const updated = await tx
      .update(therapists)
      .set({
        kycStatus: "pending",
        kycSubmittedAt: submittedAt,
        /*
         * Cleared so a stale rejection reason does not sit next to a fresh
         * submission, reading as a verdict on documents nobody has looked at.
         *
         * `kycReviewedAt` / `kycReviewedBy` are left alone: they record a review
         * that genuinely happened, and the full history is in
         * `kyc_review_events` either way.
         */
        kycReviewNote: null,
        updatedAt: submittedAt,
      })
      .where(
        and(
          eq(therapists.id, therapist.id),
          inArray(therapists.kycStatus, ["incomplete", "rejected"])
        )
      )
      .returning({ kycStatus: therapists.kycStatus, kycSubmittedAt: therapists.kycSubmittedAt });

    if (updated.length === 0) {
      throw new Error(
        "Could not submit — the application status changed while you were submitting. Reload and try again."
      );
    }

    return { kycStatus: updated[0].kycStatus, kycSubmittedAt: updated[0].kycSubmittedAt };
  });
}

/** Payload accepted by `createSessionAction` / `updateTherapySessionAction`. */
type SessionInput = {
  patientId: string;
  therapistId: string;
  scheduledAt: Date | string;
  /** Real column now. Appwrite packed this into `notes` as `${type}|${note}`. */
  sessionType?: string;
  notes?: string | null;
  feedback?: string | null;
  amount?: number | null;
  status?: "pending" | "confirmed" | "completed" | "cancelled";
};

/**
 * Book a session. `data.patientId` is ignored for non-admins and forced to the
 * caller — a client may only book on their own behalf. Admins may book for
 * anyone, so the supplied `patientId` is honoured for them.
 *
 * `sessionType` and `notes` are now separate columns. See the report: the one
 * caller that still packs them as `${type}|${note}` needs updating.
 */
/**
 * The signed-in user's own payment history, newest first.
 *
 * Reads the real `payments` ledger. The billing page previously rendered a
 * hardcoded array of invoices in USD, for amounts and dates that never existed —
 * a fabricated financial record shown to real customers, which reads as
 * unauthorised charges.
 *
 * RLS (`payments_select`) already restricts this to the caller's rows; the
 * explicit `userId` filter is defence in depth, not the primary control.
 */
export async function listMyPaymentsAction(): Promise<Doc[]> {
  const user = await requireUser();

  return withUser(user, async (tx) => {
    const rows = await tx
      .select({
        id: payments.id,
        reference: payments.reference,
        plan: payments.plan,
        amountMinor: payments.amountMinor,
        currency: payments.currency,
        status: payments.status,
        channel: payments.channel,
        paidAt: payments.paidAt,
        createdAt: payments.createdAt,
      })
      .from(payments)
      .where(eq(payments.userId, user.$id))
      .orderBy(desc(payments.createdAt))
      .limit(50);

    return toDocs(rows);
  });
}

/**
 * The caller's session credits: how many they bought, used, and have left.
 *
 * Computed with EXACTLY the same rules `createSessionAction` enforces — sum of
 * `PLAN_SESSIONS` across all successful payments, minus non-cancelled bookings,
 * for life.
 *
 * It exists because the dashboards computed their own answer and got a different
 * one: they read `PLAN_SESSIONS[current plan]` (ignoring earlier purchases) and
 * counted usage from the start of the calendar month (implying a monthly reset
 * that does not exist). Someone with two bundles saw "2 sessions" while holding
 * 4, and every month the display appeared to refresh credits that had never
 * expired — while the pricing pages promise credits never expire.
 *
 * A display that disagrees with the enforcement is worse than no display: the
 * user is told they can book when they cannot, or vice versa. One function now
 * answers both.
 */
export async function getSessionCreditsAction(): Promise<{
  entitled: number;
  used: number;
  remaining: number;
}> {
  const user = await requireUser();

  return withUser(user, async (tx) => {
    const paid = await tx
      .select({ plan: payments.plan })
      .from(payments)
      .where(and(eq(payments.userId, user.$id), eq(payments.status, "success")));

    const entitled = paid.reduce((sum, p) => sum + (PLAN_SESSIONS[p.plan] ?? 0), 0);

    const [booked] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(therapySessions)
      .where(
        and(
          eq(therapySessions.patientId, user.$id),
          // Cancelled sessions release their credit — same rule as booking.
          sql`${therapySessions.status} <> 'cancelled'`
        )
      );

    return {
      entitled,
      used: booked.count,
      remaining: Math.max(0, entitled - booked.count),
    };
  });
}

export async function createSessionAction(data: SessionInput): Promise<Doc> {
  const user = await requireUser();

  const scheduledAt = toDate(data.scheduledAt);
  if (!scheduledAt) throw new Error("A valid scheduledAt is required");
  if (!isUuid(data.therapistId)) throw new Error("A valid therapistId is required");

  const booked = await withUser(user, async (tx) => {
    const patientId = isAdmin(user) ? data.patientId : user.$id;

    /**
     * ENTITLEMENT CHECK. Booking was previously unlimited.
     *
     * `PLAN_SESSIONS` existed only to render "2 of 4 used" on dashboards —
     * nothing enforced it — so a client who paid for one session could book as
     * many as they liked. The payments ledger is the source of truth for what
     * was actually bought; the plan claim on the session cookie is not, because
     * it can be stale and is not a record of money received.
     *
     * Admins are exempt: they book on a client's behalf for operational reasons.
     */
    let perSessionAmount: number | null = null;
    /**
     * Pricing provenance for the payout ledger, captured HERE because here is
     * the only place it is knowable.
     *
     * Which bundle funds session N is a FIFO answer that depends on how many
     * non-cancelled sessions exist at this instant. Cancel an earlier session
     * tomorrow and the queue renumbers, so re-deriving this at payout time
     * yields a different — wrong — answer. See migration 0008.
     */
    let fundingPaymentReference: string | null = null;
    let fundingPlan: string | null = null;
    let listAmountMinor: number | null = null;

    if (!isAdmin(user)) {
      // Ordered oldest-first: credits are consumed FIFO, so a session is priced
      // by the bundle it actually draws from.
      const paid = await tx
        .select({
          plan: payments.plan,
          amountMinor: payments.amountMinor,
          reference: payments.reference,
        })
        .from(payments)
        .where(and(eq(payments.userId, patientId), eq(payments.status, "success")))
        .orderBy(asc(payments.paidAt));

      const entitled = paid.reduce((sum, p) => sum + (PLAN_SESSIONS[p.plan] ?? 0), 0);

      const [booked] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(therapySessions)
        .where(
          and(
            eq(therapySessions.patientId, patientId),
            // A cancelled session releases its credit rather than consuming it.
            sql`${therapySessions.status} <> 'cancelled'`
          )
        );

      if (booked.count >= entitled) {
        throw new Error(
          entitled === 0
            ? "You have no sessions available. Please purchase a plan to book."
            : `You have used all ${entitled} of your booked sessions. Purchase another plan to continue.`
        );
      }

      /**
       * Value of this session, derived from the SPECIFIC bundle it consumes.
       *
       * Never from `data.amount` — that arrives from the browser and drives the
       * therapist's payout, so a client-supplied amount would be a
       * client-supplied payroll.
       *
       * FIFO, not a lifetime average. Averaging every payment over every
       * entitled session made clinician pay depend on the client's purchase
       * history and booking order: a client who bought Individual (2,000/1) and
       * later Plus (3,500/2) produced 1,833 for EVERY session, so the same
       * therapist doing the same 50 minutes was paid three different rates
       * depending on when the booking happened. Non-deterministic compensation
       * is corrosive in a marketplace — a clinician could not predict, or check,
       * what an hour pays.
       *
       * Credits are consumed in purchase order, so session N draws from whichever
       * bundle still has capacity at position N.
       */
      let cumulative = 0;
      for (const purchase of paid) {
        cumulative += PLAN_SESSIONS[purchase.plan] ?? 0;
        if (booked.count < cumulative) {
          const sessionsInBundle = PLAN_SESSIONS[purchase.plan] ?? 1;
          perSessionAmount = Math.round(
            purchase.amountMinor / 100 / Math.max(1, sessionsInBundle)
          );

          // What the therapist's payout will be measured against. Note this is
          // the LIST price of the plan, deliberately NOT `purchase.amountMinor`,
          // which is what the client actually paid after any promo.
          fundingPaymentReference = purchase.reference;
          fundingPlan = purchase.plan;
          listAmountMinor = listPriceMinorPerSession(purchase.plan);
          break;
        }
      }
    }

    const [row] = await tx
      .insert(therapySessions)
      .values({
        patientId,
        therapistId: data.therapistId,
        scheduledAt,
        sessionType: data.sessionType ?? "1-on-1",
        notes: data.notes ?? null,
        feedback: data.feedback ?? null,
        // Admins may set an amount explicitly (comped or manually-invoiced
        // sessions); everyone else gets the value computed from their payments.
        amount: isAdmin(user) ? (data.amount ?? null) : perSessionAmount,
        fundingPaymentReference,
        fundingPlan,
        listAmountMinor,
        status: data.status ?? "pending",
      })
      .returning();

    return toDoc(row);
  });

  /*
   * Booking is the conversion event that matters most on the client side, and
   * it is captured here — AFTER the transaction has committed, never inside it.
   *
   * `captureServer` makes a network call and waits up to 3s for the flush.
   * Inside `withUser` that would hold a pooled Postgres connection open for the
   * duration; the Azure tier allows roughly 24 app connections in total, so a
   * slow PostHog would translate directly into booking failures for everyone
   * else. This mirrors the risk scanner's ordering rule in AGENTS.md: analytics
   * runs after the write it describes is durable.
   *
   * `therapist_id` is included deliberately — a therapist is a business entity
   * on this platform, and directory→booking conversion cannot be measured
   * without it. The patient id is NOT included: the distinct id already carries
   * who booked, and repeating a patient identifier in a property is exactly the
   * shape of leak `lib/analytics/sanitize.ts` exists to prevent. Lead time is
   * bucketed rather than raw so it cannot act as a fingerprint that
   * re-identifies one specific appointment.
   */
  const leadTimeHours = Math.max(
    0,
    Math.round((scheduledAt.getTime() - Date.now()) / 3_600_000)
  );
  await captureServer({
    distinctId: user.$id,
    event: ANALYTICS_EVENTS.SESSION_BOOKED,
    properties: {
      therapist_id: data.therapistId,
      session_type: data.sessionType ?? "1-on-1",
      booked_by_admin: isAdmin(user),
      funding_plan: booked.fundingPlan ?? null,
      list_amount_minor: booked.listAmountMinor ?? null,
      lead_time_bucket:
        leadTimeHours < 24 ? "<24h" : leadTimeHours < 168 ? "1-7d" : ">7d",
    },
  });

  return booked;
}

/**
 * Mint a 1:1 video-call session for a therapy session, authorized to its
 * participants.
 *
 * REPLACES the Cloudflare Calls proxy and the DB-based track signaling this
 * file used to carry (`updateSessionTracksAction` / `getSessionTracksAction`).
 * The Echo video backend signals over its own WebSocket, so no track metadata
 * is persisted here any more — the `therapy_sessions.patient_tracks` /
 * `therapist_tracks` columns are now vestigial and can be dropped in a later
 * migration.
 *
 * `room` is the therapy session id, so the therapist and the client join the
 * SAME room (each gets their own short-lived token). Authorization mirrors the
 * retired track actions exactly: a client must be the session's patient; a
 * therapist must own the session's therapist row (RLS also constrains the
 * SELECT to those two, so a stranger's id returns no row → "Not found"). The
 * `sk_live_` API key never leaves the server — see `lib/video.ts`; the browser
 * receives only a short-lived signaling URL and ICE servers.
 */
export async function createVideoSessionAction(
  sessionId: string,
  role: "client" | "therapist"
): Promise<{ wsUrl: string; iceServers: IceServer[] }> {
  const user = await requireUser();
  if (!isUuid(sessionId)) throw new Error("Not found");

  // Defense-in-depth against a participant spamming session creation; the real
  // guard is the ownership check below.
  if (!rateLimit(`video:${user.$id}`, { limit: 60, windowMs: 60_000 }).ok) {
    throw new Error("Too many requests — wait a moment and try again");
  }

  await withUser(user, async (tx) => {
    const [sess] = await tx
      .select({
        patientId: therapySessions.patientId,
        therapistId: therapySessions.therapistId,
      })
      .from(therapySessions)
      .where(eq(therapySessions.id, sessionId))
      .limit(1);
    if (!sess) throw new Error("Not found");

    if (role === "client") {
      if (sess.patientId !== user.$id) throw new Error("Forbidden");
    } else if (!(await ownsTherapistDoc(tx, user, sess.therapistId))) {
      throw new Error("Forbidden");
    }
  });

  const session = await mintVideoSession(sessionId);
  return { wsUrl: session.wsUrl, iceServers: session.iceServers };
}

/**
 * Sessions for a patient. `patientId` is retained (the therapist client-detail
 * view legitimately reads another user's sessions) but is authorized: self,
 * admin, or the therapist matched to that patient.
 */
export async function listPatientSessionsAction(
  patientId: string
): Promise<Doc[]> {
  const user = await requireUser();

  return withUser(user, async (tx) => {
    await requirePatientAccess(tx, patientId);

    const rows = await tx
      .select()
      .from(therapySessions)
      .where(eq(therapySessions.patientId, patientId))
      .orderBy(desc(therapySessions.scheduledAt));

    return toDocs(rows);
  });
}

/** `therapistId` is a `therapists.id` — the caller must own it. */
export async function listTherapistSessionsAction(
  therapistId: string
): Promise<Doc[]> {
  const user = await requireUser();

  return withUser(user, async (tx) => {
    await requireTherapistDocAccess(tx, therapistId);

    const rows = await tx
      .select()
      .from(therapySessions)
      .where(eq(therapySessions.therapistId, therapistId))
      .orderBy(asc(therapySessions.scheduledAt));

    return toDocs(rows);
  });
}

/** Mood history. `userId` is authorized: self, admin, or treating therapist. */
export async function listMoodLogsAction(
  userId: string,
  days = 30
): Promise<Doc[]> {
  const user = await requireUser();

  const since = new Date();
  since.setDate(since.getDate() - days);

  return withUser(user, async (tx) => {
    await requirePatientAccess(tx, userId);

    const rows = await tx
      .select()
      .from(moodLogs)
      .where(and(eq(moodLogs.userId, userId), gte(moodLogs.createdAt, since)))
      .orderBy(asc(moodLogs.createdAt))
      .limit(days);

    return toDocs(rows);
  });
}

/** Goals. `userId` is authorized: self, admin, or treating therapist. */
export async function listGoalsAction(userId: string): Promise<Doc[]> {
  const user = await requireUser();

  return withUser(user, async (tx) => {
    await requirePatientAccess(tx, userId);

    const rows = await tx
      .select()
      .from(goals)
      .where(eq(goals.userId, userId))
      .orderBy(desc(goals.createdAt));

    return toDocs(rows);
  });
}

/** Only a session participant (patient / its therapist) or an admin may update it. */
export async function updateTherapySessionAction(
  documentId: string,
  data: Partial<SessionInput>
): Promise<Doc> {
  const user = await requireUser();

  /*
   * Captured inside the transaction, emitted after it commits. The status
   * TRANSITION is only knowable here — once the update lands, the previous
   * status is gone — but `captureServer` must not run inside `withUser`, where
   * its network flush would pin a pooled connection. Same split as
   * `createSessionAction`.
   */
  let cancellation: { previousStatus: string; therapistId: string; leadTimeBucket: string } | null =
    null;

  const updated = await withUser(user, async (tx) => {
    const { sess } = await requireSessionAccess(tx, documentId);

    const patch = pick(data, [
      "scheduledAt",
      "sessionType",
      "notes",
      "feedback",
      "amount",
      "status",
    ]);
    if ("scheduledAt" in patch) patch.scheduledAt = toDate(patch.scheduledAt);
    // Nothing writable was supplied — hand back the row `requireSessionAccess`
    // already fetched rather than emitting an empty UPDATE.
    if (isEmptyPatch(patch)) return toDoc(sess);

    const [row] = await tx
      .update(therapySessions)
      .set(patch)
      .where(eq(therapySessions.id, documentId))
      .returning();

    /**
     * THE ACCRUAL POINT. A session's lifecycle ends here, so this is where the
     * therapist's earnings become a recorded fact.
     *
     * Inside the same transaction as the status change on purpose: "the session
     * completed" and "the platform owes for it" are one event, and a crash
     * between them would produce delivered work with no liability recorded.
     *
     * Ordered AFTER the UPDATE because `payout_ledger_insert` requires the
     * session to already read `status = 'completed'` — the policy checks the
     * committed-in-transaction state, so accruing first fails the check.
     *
     * Guarded on a genuine transition so re-saving a completed session does not
     * try to accrue again; UNIQUE(session_id) is the real defence, this just
     * avoids a pointless round-trip.
     */
    if (row.status === "completed" && sess.status !== "completed") {
      await accrueSessionEarnings(tx, row);
    }

    /*
     * Guarded on a genuine transition, mirroring the accrual guard above: a
     * re-save of an already-cancelled session is not a second cancellation, and
     * counting it as one would inflate the churn signal this event exists to
     * measure.
     */
    if (row.status === "cancelled" && sess.status !== "cancelled") {
      const hoursToScheduled = row.scheduledAt
        ? Math.round((row.scheduledAt.getTime() - Date.now()) / 3_600_000)
        : null;
      cancellation = {
        previousStatus: sess.status ?? "unknown",
        therapistId: row.therapistId,
        // How late a cancellation lands is the operationally interesting part:
        // a same-day drop costs the therapist a slot they cannot refill.
        leadTimeBucket:
          hoursToScheduled === null
            ? "unknown"
            : hoursToScheduled < 0
              ? "after_scheduled_time"
              : hoursToScheduled < 24
                ? "<24h"
                : hoursToScheduled < 168
                  ? "1-7d"
                  : ">7d",
      };
    }

    return toDoc(row);
  });

  if (cancellation) {
    const { previousStatus, therapistId, leadTimeBucket } = cancellation;
    await captureServer({
      distinctId: user.$id,
      event: ANALYTICS_EVENTS.SESSION_CANCELLED,
      properties: {
        therapist_id: therapistId,
        previous_status: previousStatus,
        lead_time_bucket: leadTimeBucket,
        // Who abandoned the appointment is the whole question — a client
        // cancelling and a therapist cancelling are different problems.
        cancelled_by: isAdmin(user) ? "admin" : isTherapist(user) ? "therapist" : "client",
      },
    });
  }

  return updated;
}

/**
 * Write the therapist's accrual for a completed session.
 *
 * Everything it records is derived from values captured at BOOKING
 * (`list_amount_minor`, `funding_plan`, `funding_payment_reference`) plus the
 * policy constants — never from caller input, because this is payroll.
 *
 * Silent on conflict: `UNIQUE(session_id)` means a session accrues exactly once,
 * so a redelivered request, a double-click, or two racing transactions all
 * converge on one row instead of erroring or paying twice.
 */
async function accrueSessionEarnings(
  tx: Tx,
  session: typeof therapySessions.$inferSelect
): Promise<void> {
  // The FK guarantees this resolves; `therapists_select` is USING (true), so the
  // completing user can read it whoever they are.
  const [therapist] = await tx
    .select({ userId: therapists.userId })
    .from(therapists)
    .where(eq(therapists.id, session.therapistId))
    .limit(1);
  if (!therapist) return;

  /**
   * `therapy_sessions.amount` is WHOLE KES; everything in the ledger is minor
   * units. This ×100 is the only place the two conventions meet.
   */
  const chargedMinor = Math.max(0, Math.round((session.amount ?? 0) * 100));
  const listMinor = session.listAmountMinor;

  /**
   * WHAT THE 40% IS TAKEN ON — the point of `THERAPIST_PAID_ON_LIST_PRICE`.
   *
   * On list price, a clinician earns the same for the same 50 minutes whether or
   * not marketing was running a promotion that week. On the charged price, a
   * 50%-off code halves their fee for work they already agreed to do, without
   * their knowledge or consent. See the constant for what the choice costs.
   *
   * Falls back to the charged amount when there is no list price to use — an
   * older session, or one booked outside the purchase flow — so a missing value
   * under-pays by the discount rather than paying nothing at all.
   */
  let grossMinor: number;
  let basis: "list" | "charged" | "unfunded";

  if (THERAPIST_PAID_ON_LIST_PRICE && listMinor !== null && listMinor > 0) {
    grossMinor = listMinor;
    basis = "list";
  } else if (chargedMinor > 0) {
    grossMinor = chargedMinor;
    basis = "charged";
  } else {
    // No purchase behind this session (admin-comped, or booked before payments
    // existed). Accrued at zero rather than skipped: a completed session with no
    // attributable revenue is a fact worth having on the ledger, and a missing
    // row is indistinguishable from one that was never written.
    grossMinor = 0;
    basis = "unfunded";
  }

  /**
   * `payout_ledger_amount_within_gross` rejects an amount above the gross, and
   * the `basis: "list"` branch can exceed `charged` legitimately — that IS the
   * policy — but never its own gross, since the share is a fraction ≤ 1.
   */
  const shareBp = Math.round(THERAPIST_REVENUE_SHARE * 10000);

  await tx
    .insert(payoutLedger)
    .values({
      sessionId: session.id,
      therapistId: session.therapistId,
      therapistUserId: therapist.userId,
      patientId: session.patientId,
      sessionScheduledAt: session.scheduledAt,
      plan: session.fundingPlan,
      fundingPaymentReference: session.fundingPaymentReference,
      grossMinor,
      chargedMinor,
      basis,
      shareBp,
      amountMinor: therapistShareMinor(grossMinor),
      currency: PLAN_CURRENCY,
    })
    .onConflictDoNothing({ target: payoutLedger.sessionId });
}

/**
 * The signed-in therapist's own payout ledger.
 *
 * Reads STORED accruals. It does not recompute anything from
 * `therapy_sessions.amount`, which is what the earnings page used to do — that
 * made a clinician's reported earnings a function of a mutable column and of
 * whichever constants happened to be deployed when the page was opened.
 *
 * RLS (`payout_ledger_select`) already restricts this to the caller's rows; the
 * explicit `therapistUserId` filter is defence in depth, not the control.
 * Amounts are returned in MINOR units — formatting is the caller's job, and
 * dividing by 100 in three different components is how currencies drift.
 */
export async function listMyEarningsAction(): Promise<{
  currency: string;
  accruedMinor: number;
  paidMinor: number;
  reversedMinor: number;
  entries: Doc[];
}> {
  const user = await requireStaff();

  return withUser(user, async (tx) => {
    const rows = await tx
      .select({
        id: payoutLedger.id,
        sessionId: payoutLedger.sessionId,
        sessionScheduledAt: payoutLedger.sessionScheduledAt,
        plan: payoutLedger.plan,
        grossMinor: payoutLedger.grossMinor,
        chargedMinor: payoutLedger.chargedMinor,
        basis: payoutLedger.basis,
        shareBp: payoutLedger.shareBp,
        amountMinor: payoutLedger.amountMinor,
        currency: payoutLedger.currency,
        status: payoutLedger.status,
        payoutBatch: payoutLedger.payoutBatch,
        paidAt: payoutLedger.paidAt,
        accruedAt: payoutLedger.accruedAt,
      })
      .from(payoutLedger)
      .where(eq(payoutLedger.therapistUserId, user.$id))
      .orderBy(desc(payoutLedger.sessionScheduledAt))
      .limit(500);

    // Summed here rather than in SQL because the rows are already being fetched
    // for the table below; a second aggregate query would cost a ~230ms
    // round-trip to restate what is in hand.
    let accruedMinor = 0;
    let paidMinor = 0;
    let reversedMinor = 0;
    for (const row of rows) {
      if (row.status === "accrued") accruedMinor += row.amountMinor;
      else if (row.status === "paid") paidMinor += row.amountMinor;
      else if (row.status === "reversed") reversedMinor += row.amountMinor;
    }

    return {
      // From the rows when present, so the label always matches the money it is
      // labelling; the constant is only the empty-ledger default.
      currency: rows[0]?.currency ?? PLAN_CURRENCY,
      accruedMinor,
      paidMinor,
      reversedMinor,
      entries: toDocs(rows),
    };
  });
}

/**
 * The caller's own therapist profile.
 *
 * SIGNATURE CHANGE (pre-existing): the `userId` parameter was removed — it is
 * now derived from the session. Every call site passed the current user's id,
 * and accepting it from the client would have let anyone read any therapist's
 * licence number and KYC status.
 */
export async function getTherapistByUserIdAction(): Promise<Doc> {
  const user = await requireUser();

  return withUser(user, async (tx) => {
    const [row] = await tx
      .select()
      .from(therapists)
      .where(eq(therapists.userId, user.$id))
      .limit(1);

    return row ? toDoc(row) : null;
  });
}

/**
 * Therapist directory. Readable by any authenticated user.
 *
 * The application check below is stricter than `therapists_select`, which is
 * deliberately `USING (true)` so unauthenticated visitors can browse providers.
 * Kept as-is: this action has always required a session and no caller expects
 * otherwise.
 */
export async function listTherapistsAction(
  therapistId?: string
): Promise<Doc[]> {
  const user = await requireUser();

  // A supplied-but-malformed id must not silently widen to "every therapist".
  if (therapistId && !isUuid(therapistId)) return [];

  return withUser(user, async (tx) => {
    const rows = await tx
      .select()
      .from(therapists)
      .where(therapistId ? eq(therapists.id, therapistId) : undefined)
      .limit(100);

    return toDocs(rows);
  });
}

/** Single directory entry. Readable by any authenticated user. */
export async function getTherapistAction(therapistId: string): Promise<Doc> {
  const user = await requireUser();
  if (!isUuid(therapistId)) throw new Error("Not found");

  return withUser(user, async (tx) => {
    const [row] = await tx
      .select()
      .from(therapists)
      .where(eq(therapists.id, therapistId))
      .limit(1);
    if (!row) throw new Error("Not found");

    return toDoc(row);
  });
}

export async function listTherapistDashboardStatsAction(therapistId: string) {
  const user = await requireUser();

  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  const weekEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7);

  return withUser(user, async (tx) => {
    await requireTherapistDocAccess(tx, therapistId);

    const mine = eq(therapySessions.therapistId, therapistId);

    // Sequential, not `Promise.all`: these share one pooled connection inside the
    // transaction, and postgres.js cannot interleave statements on it.
    const [all] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(therapySessions)
      .where(mine);

    const todayRows = await tx
      .select()
      .from(therapySessions)
      .where(
        and(
          mine,
          gte(therapySessions.scheduledAt, todayStart),
          lt(therapySessions.scheduledAt, todayEnd)
        )
      )
      .orderBy(asc(therapySessions.scheduledAt));

    const [thisWeek] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(therapySessions)
      .where(
        and(
          mine,
          gte(therapySessions.scheduledAt, todayStart),
          lt(therapySessions.scheduledAt, weekEnd)
        )
      );

    const [pending] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(therapySessions)
      .where(and(mine, eq(therapySessions.status, "pending")));

    return {
      all: all.count,
      today: toDocs(todayRows),
      thisWeek: thisWeek.count,
      pending: pending.count,
    };
  });
}

/**
 * Everything the therapist dashboard needs, in ONE transaction.
 *
 * Replaces a three-call sequence (`getTherapistByUserIdAction`, then
 * `listTherapistDashboardStatsAction` + `listPendingTherapistSessionsAction`)
 * that cost roughly 12 network round-trips: each action pays BEGIN, set_config
 * and COMMIT of its own, each re-ran the therapist access check, and the second
 * wave could not start until the first resolved the therapist id.
 *
 * Two things make this cheaper:
 *
 *  1. One transaction and one access check instead of three.
 *  2. The three separate `count(*)` queries collapse into a single scan using
 *     `FILTER`. They read the same rows with different predicates, so asking
 *     three times was three round-trips for one table scan.
 *
 * Note that queries inside a transaction CANNOT be parallelised — they share one
 * pooled connection and postgres.js will not interleave them. Reducing the
 * NUMBER of queries is therefore the only lever here, not concurrency.
 *
 * ~12 round-trips → 7. On a high-latency link that is the difference between a
 * dashboard that feels broken and one that feels slow; co-locating the app with
 * the database is what makes it feel instant.
 */
export async function getTherapistDashboardAction() {
  const user = await requireUser();

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const weekEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7);

  return withUser(user, async (tx) => {
    /*
     * Selected here rather than via `getTherapistDocForUser`, which projects
     * only `{ id, userId }` for ownership checks.
     *
     * THIS WAS A LIVE BUG. The dashboard reads `therapist.kycStatus`, the narrow
     * helper never selected that column, so the value was always `undefined` and
     * the component's `?? "incomplete"` fallback turned "the query did not ask
     * for it" into "this clinician has not submitted their KYC". An admin would
     * approve an application, the row would correctly read `verified` in
     * Postgres, and the therapist would sign in to a banner telling them to
     * start KYC over — with no way to tell the difference from the UI.
     *
     * `kycStatus` is what the banner branches on, so it must come from the same
     * query that establishes the row exists.
     */
    const [therapist] = await tx
      .select({
        id: therapists.id,
        userId: therapists.userId,
        name: therapists.name,
        kycStatus: therapists.kycStatus,
        onboardingComplete: therapists.onboardingComplete,
      })
      .from(therapists)
      .where(eq(therapists.userId, user.$id))
      .limit(1);

    if (!therapist) {
      return { therapist: null, stats: null, today: [], pending: [] };
    }

    const mine = eq(therapySessions.therapistId, therapist.id);

    // One scan, three counts.
    const [counts] = await tx
      .select({
        all: sql<number>`count(*)::int`,
        /*
         * The bounds are passed as ISO strings with an explicit `::timestamptz`
         * cast, NOT as JS `Date`s.
         *
         * Drizzle only applies a column's `toDriver` mapping when it can see the
         * column — which it can for `gte`/`lt` below, but not for a value
         * interpolated into a raw `sql` fragment. There the `Date` reaches
         * postgres.js untyped and the driver throws `ERR_INVALID_ARG_TYPE`
         * ("Received an instance of Date"), failing the whole dashboard query.
         * The cast is what keeps the comparison a timestamptz one rather than
         * text after the conversion.
         */
        thisWeek: sql<number>`count(*) FILTER (
          WHERE ${therapySessions.scheduledAt} >= ${todayStart.toISOString()}::timestamptz
            AND ${therapySessions.scheduledAt} < ${weekEnd.toISOString()}::timestamptz
        )::int`,
        pending: sql<number>`count(*) FILTER (
          WHERE ${therapySessions.status} = 'pending'
        )::int`,
      })
      .from(therapySessions)
      .where(mine);

    const todayRows = await tx
      .select()
      .from(therapySessions)
      .where(
        and(mine, gte(therapySessions.scheduledAt, todayStart), lt(therapySessions.scheduledAt, todayEnd))
      )
      .orderBy(asc(therapySessions.scheduledAt));

    const pendingRows = await tx
      .select()
      .from(therapySessions)
      .where(and(mine, eq(therapySessions.status, "pending")))
      .orderBy(asc(therapySessions.scheduledAt))
      .limit(10);

    return {
      therapist: toDoc(therapist),
      stats: { all: counts.all, thisWeek: counts.thisWeek, pending: counts.pending },
      today: toDocs(todayRows),
      pending: toDocs(pendingRows),
    };
  });
}

export async function listPendingTherapistSessionsAction(
  therapistId: string
): Promise<Doc[]> {
  const user = await requireUser();

  return withUser(user, async (tx) => {
    await requireTherapistDocAccess(tx, therapistId);

    const rows = await tx
      .select()
      .from(therapySessions)
      .where(
        and(
          eq(therapySessions.therapistId, therapistId),
          eq(therapySessions.status, "pending")
        )
      )
      .orderBy(asc(therapySessions.scheduledAt))
      .limit(10);

    return toDocs(rows);
  });
}

/**
 * The caller's own notifications.
 *
 * SIGNATURE CHANGE (pre-existing): the `userId` parameter was removed —
 * notifications are strictly personal, so the id is derived from the session.
 */
export async function listNotificationsAction(): Promise<Doc[]> {
  const user = await requireUser();

  return withUser(user, async (tx) => {
    const rows = await tx
      .select()
      .from(notifications)
      .where(eq(notifications.userId, user.$id))
      .orderBy(desc(notifications.createdAt))
      .limit(20);

    return toDocs(rows);
  });
}

export async function markNotificationAsReadAction(id: string): Promise<Doc> {
  const user = await requireUser();

  return withUser(user, async (tx) => {
    await requireDocumentOwner(tx, notifications, id);

    const [row] = await tx
      .update(notifications)
      .set({ read: true })
      .where(eq(notifications.id, id))
      .returning();

    return toDoc(row);
  });
}

/**
 * Create/update the caller's therapist profile during onboarding.
 *
 * SIGNATURE CHANGE (pre-existing): the `userId` parameter was removed — it is
 * derived from the session. Accepting it would have let any user overwrite
 * another therapist's profile (including `kycStatus`).
 *
 * FIXED: this used to force `kycStatus: "pending"` on every write, silently
 * demoting a `verified` therapist to re-review whenever they edited their bio.
 *
 * FIXED AGAIN (migration 0013): saving a profile no longer moves `kycStatus` AT
 * ALL, and a new row is created at the column default `incomplete` rather than
 * `pending`. Advancing on profile save meant an applicant reached the review
 * queue by filling in a bio, with zero documents attached — the queue then held
 * applications there was nothing to review, which is how "verified" came to mean
 * "someone clicked approve". It also broke the real submission path:
 * `submitKycForReviewAction` refuses a status that is already `pending`, so an
 * applicant who saved their profile first could never submit.
 *
 * `submitKycForReviewAction` is now the ONLY route to `pending`, and it checks
 * the required documents are actually present. `kycStatus` is never accepted
 * from the caller.
 */
export async function upsertTherapistProfileAction(
  data: Record<string, unknown>
): Promise<Doc> {
  const user = await requireUser();

  const fields = pick(data, [
    "name",
    "bio",
    "avatarUrl",
    "experience",
    "rating",
    "specialties",
    "licenseNumber",
    "licenseUrl",
  ]);

  return withUser(user, async (tx) => {
    const [existing] = await tx
      .select({ id: therapists.id })
      .from(therapists)
      .where(eq(therapists.userId, user.$id))
      .limit(1);

    if (existing) {
      const [row] = await tx
        .update(therapists)
        .set({
          ...fields,
          onboardingComplete: true,
          updatedAt: new Date(),
        })
        .where(eq(therapists.id, existing.id))
        .returning();

      return toDoc(row);
    }

    // SECURITY: sensitive fields (`licenseNumber`, `kycStatus`) live on this
    // row. `therapists_select` is intentionally public for the directory, so any
    // public-facing therapist listing must project columns explicitly rather
    // than returning the whole row.
    const [row] = await tx
      .insert(therapists)
      .values({
        ...fields,
        userId: user.$id,
        name: typeof fields.name === "string" ? fields.name : user.name,
        bio: typeof fields.bio === "string" ? fields.bio : "",
        experience: typeof fields.experience === "number" ? fields.experience : 0,
        // No `kycStatus` — the column defaults to `incomplete`, and only
        // `submitKycForReviewAction` may advance it.
        onboardingComplete: true,
      })
      .returning();

    return toDoc(row);
  });
}

/**
 * Send a notification to an arbitrary user. Admin-only: the recipient, title and
 * body are all caller-supplied, so an open version is a spoofing primitive.
 * Intra-file callers use `writeNotification` instead.
 */
export async function createNotificationAction(data: {
  userId: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "alert";
  link?: string;
}): Promise<Doc> {
  const user = await requireAdmin();
  return withUser(user, (tx) => writeNotification(tx, data));
}

export async function assignTherapistToPatientAction(
  patientProfileId: string,
  therapistId: string
): Promise<Doc> {
  const user = await requireAdmin();
  if (!isUuid(patientProfileId)) throw new Error("Not found");
  if (!isUuid(therapistId)) throw new Error("Not found");

  return withUser(user, async (tx) => {
    // 1. Update patient profile
    const [profile] = await tx
      .update(profiles)
      .set({ therapistId })
      .where(eq(profiles.id, patientProfileId))
      .returning();
    if (!profile) throw new Error("Not found");

    // 2. Get therapist info for notification
    const [therapist] = await tx
      .select({ userId: therapists.userId, name: therapists.name })
      .from(therapists)
      .where(eq(therapists.id, therapistId))
      .limit(1);
    if (!therapist) throw new Error("Not found");

    // 3. Notify patient
    await writeNotification(tx, {
      userId: profile.userId,
      title: "New Therapist Assigned",
      message: `You've been matched with ${therapist.name}. You can now schedule your first session.`,
      type: "success",
      link: "/dashboard/sessions",
    });

    // 4. Notify therapist
    await writeNotification(tx, {
      userId: therapist.userId,
      title: "New Patient Assigned",
      message: `A new patient, ${profile.name}, has been assigned to you.`,
      type: "info",
      link: "/therapist/clients",
    });

    return toDoc(profile);
  });
}

export async function listMatchedProfilesAction(): Promise<Doc[]> {
  const user = await requireAdmin();

  return withUser(user, async (tx) => {
    const rows = await tx
      .select()
      .from(profiles)
      .where(isNotNull(profiles.therapistId))
      .orderBy(desc(profiles.createdAt))
      .limit(50);

    return toDocs(rows);
  });
}

/** The client roster for a therapist row. Caller must own that row, or be admin. */
export async function listTherapistClientsAction(
  therapistId: string
): Promise<Doc[]> {
  const user = await requireUser();

  return withUser(user, async (tx) => {
    await requireTherapistDocAccess(tx, therapistId);

    const rows = await tx
      .select()
      .from(profiles)
      .where(eq(profiles.therapistId, therapistId))
      .limit(100);

    return toDocs(rows);
  });
}

export async function listMatchConflictsAction(): Promise<Doc[]> {
  const user = await requireAdmin();

  return withUser(user, async (tx) => {
    const rows = await tx
      .select()
      .from(matchConflicts)
      .orderBy(desc(matchConflicts.createdAt))
      .limit(50);

    return toDocs(rows);
  });
}

export async function resolveMatchConflictAction(id: string): Promise<Doc> {
  const user = await requireAdmin();
  if (!isUuid(id)) throw new Error("Not found");

  return withUser(user, async (tx) => {
    const [row] = await tx
      .update(matchConflicts)
      .set({ resolved: true })
      .where(eq(matchConflicts.id, id))
      .returning();
    if (!row) throw new Error("Not found");

    return toDoc(row);
  });
}

export async function listRiskAlertsAction(): Promise<Doc[]> {
  const user = await requireAdmin();

  return withUser(user, async (tx) => {
    const rows = await tx
      .select()
      .from(riskAlerts)
      .orderBy(desc(riskAlerts.createdAt))
      .limit(100);

    return toDocs(rows);
  });
}

export async function resolveRiskAlertAction(id: string): Promise<Doc> {
  const user = await requireAdmin();
  if (!isUuid(id)) throw new Error("Not found");

  return withUser(user, async (tx) => {
    const [row] = await tx
      .update(riskAlerts)
      .set({ resolved: true })
      .where(eq(riskAlerts.id, id))
      .returning();
    if (!row) throw new Error("Not found");

    return toDoc(row);
  });
}

/**
 * Every profile in the system. Staff-only (admin console + the therapist notes
 * page, which uses it to resolve client names).
 *
 * BEHAVIOUR NARROWED BY RLS: `profiles_select` lets a therapist read only the
 * profiles they treat, so this returns the caller's roster rather than all 100
 * profiles when the caller is a therapist. Admins still see everything. This is
 * the safer reading and the one the therapist notes page wanted anyway.
 */
export async function listProfilesAction(): Promise<Doc[]> {
  const user = await requireStaff();

  return withUser(user, async (tx) => {
    const rows = await tx
      .select()
      .from(profiles)
      .orderBy(desc(profiles.createdAt))
      .limit(100);

    return toDocs(rows);
  });
}

/** Clinical notes authored under a therapist row. Caller must own it, or be admin. */
export async function listClinicalNotesAction(
  therapistId: string,
  patientId?: string
): Promise<Doc[]> {
  const user = await requireUser();

  return withUser(user, async (tx) => {
    await requireTherapistDocAccess(tx, therapistId);

    const rows = await tx
      .select()
      .from(clinicalNotes)
      .where(
        patientId
          ? and(
              eq(clinicalNotes.therapistId, therapistId),
              eq(clinicalNotes.patientId, patientId)
            )
          : eq(clinicalNotes.therapistId, therapistId)
      )
      .orderBy(desc(clinicalNotes.createdAt));

    return toDocs(rows);
  });
}

/** The note is written under `data.therapistId`, so the caller must own that row. */
export async function createClinicalNoteAction(
  data: Record<string, unknown>
): Promise<Doc> {
  const user = await requireUser();

  const therapistId = data.therapistId;
  const patientId = data.patientId;
  if (!isUuid(therapistId)) throw new Error("A valid therapistId is required");
  if (typeof patientId !== "string" || !patientId) {
    throw new Error("A valid patientId is required");
  }

  return withUser(user, async (tx) => {
    await requireTherapistDocAccess(tx, therapistId);

    const fields = pick(data, ["type", "content", "isPrivate", "sessionId"]);

    const [row] = await tx
      .insert(clinicalNotes)
      .values({
        ...fields,
        therapistId,
        patientId,
        content: typeof fields.content === "string" ? fields.content : "",
        sessionId: toSessionRef(fields.sessionId),
        createdAt: toDate(data.createdAt) ?? new Date(),
        updatedAt: toDate(data.updatedAt) ?? new Date(),
      })
      .returning();

    return toDoc(row);
  });
}

export async function updateClinicalNoteAction(
  documentId: string,
  data: Record<string, unknown>
): Promise<Doc> {
  const user = await requireUser();
  if (!isUuid(documentId)) throw new Error("Not found");

  return withUser(user, async (tx) => {
    const [note] = await tx
      .select({ therapistId: clinicalNotes.therapistId })
      .from(clinicalNotes)
      .where(eq(clinicalNotes.id, documentId))
      .limit(1);
    if (!note) throw new Error("Not found");

    if (!isAdmin(user) && !(await ownsTherapistDoc(tx, user, note.therapistId))) {
      throw new Error("Forbidden");
    }

    const patch = pick(data, ["type", "content", "isPrivate"]);
    patch.updatedAt = toDate(data.updatedAt) ?? new Date();

    const [row] = await tx
      .update(clinicalNotes)
      .set(patch)
      .where(eq(clinicalNotes.id, documentId))
      .returning();

    return toDoc(row);
  });
}

/**
 * NOTE — RLS is stricter than this check. `clinical_notes_delete` is
 * `USING (app_is_admin())`, so a therapist deleting their own note satisfies
 * the application rule below but deletes zero rows. The mismatch is surfaced as
 * a "Not found" rather than a silent success. Decide deliberately whether the
 * policy should gain `app_owns_therapist(therapist_id)` or this action should
 * become admin-only; do not "fix" it by weakening the check here.
 */
export async function deleteClinicalNoteAction(documentId: string) {
  const user = await requireUser();
  if (!isUuid(documentId)) throw new Error("Not found");

  return withUser(user, async (tx) => {
    const [note] = await tx
      .select({ therapistId: clinicalNotes.therapistId })
      .from(clinicalNotes)
      .where(eq(clinicalNotes.id, documentId))
      .limit(1);
    if (!note) throw new Error("Not found");

    if (!isAdmin(user) && !(await ownsTherapistDoc(tx, user, note.therapistId))) {
      throw new Error("Forbidden");
    }

    const deleted = await tx
      .delete(clinicalNotes)
      .where(eq(clinicalNotes.id, documentId))
      .returning({ id: clinicalNotes.id });

    if (deleted.length === 0) throw new Error("Not found");
    return { success: true };
  });
}

/**
 * The caller's direct-message thread with `therapistId`.
 *
 * SIGNATURE CHANGE (pre-existing): the leading `userId` parameter was removed —
 * it is the caller's own id, derived from the session. Accepting it let anyone
 * read any two users' private thread.
 *
 * NOTE: despite its name, `therapistId` here is the peer's *user* id (Auth0
 * sub), matched against `messages.senderId`/`receiverId`, not a `therapists.id`.
 */
export async function listDirectMessagesAction(
  therapistId: string,
  limit = 50
): Promise<Doc[]> {
  const user = await requireUser();

  return withUser(user, async (tx) => {
    const rows = await tx
      .select()
      .from(messages)
      .where(
        or(
          and(
            eq(messages.senderId, user.$id),
            eq(messages.receiverId, therapistId)
          ),
          and(
            eq(messages.senderId, therapistId),
            eq(messages.receiverId, user.$id)
          )
        )
      )
      .orderBy(asc(messages.createdAt))
      .limit(limit);

    return toDocs(rows);
  });
}

/** `senderId` is always forced to the caller — it is never trusted from the body. */
export async function sendMessageAction(
  data: Record<string, unknown>
): Promise<Doc> {
  const user = await requireUser();

  const receiverId = data.receiverId;
  const content = data.content;
  if (typeof receiverId !== "string" || !receiverId) {
    throw new Error("A receiverId is required");
  }
  if (typeof content !== "string" || !content) {
    throw new Error("A message content is required");
  }

  const doc = await withUser(user, async (tx) => {
    const [row] = await tx
      .insert(messages)
      .values({
        // The Appwrite sentinel "direct" is not a uuid; null carries that meaning.
        sessionId: toSessionRef(data.sessionId),
        senderId: user.$id,
        receiverId,
        content,
        createdAt: toDate(data.createdAt) ?? new Date(),
      })
      .returning();

    return toDoc(row);
  });

  /*
   * Risk scanning runs AFTER the transaction above has committed, and never
   * inside it. This ordering is the whole design, so do not "tidy" it by moving
   * the scan into the `withUser` callback to save a round-trip.
   *
   * WHY: the alert lands in `risk_alerts`, whose RLS policy is admin-only. When
   * a non-admin insert is refused, Postgres does not merely return zero rows —
   * it raises `new row violates row-level security policy`, which puts the
   * WHOLE transaction into an aborted state ("current transaction is aborted,
   * commands ignored until end of transaction block"). A try/catch in
   * TypeScript would swallow the JS exception and still leave the transaction
   * unable to commit, so the MESSAGE would be silently lost. A therapy message
   * failing to deliver because a logging insert errored is far worse than the
   * alert being missed, and the message must therefore be durable before the
   * alert is even attempted.
   *
   * Only client-authored messages are scanned. A therapist writing *about* a
   * client ("she told me she wanted to end it all") is the single most likely
   * source of a high-risk keyword on this platform, and attributing those words
   * to the therapist would file a crisis alert against the wrong person's
   * record — a fabricated clinical record, which is exactly what this scan is
   * supposed to avoid producing. Staff messages are therefore skipped rather
   * than misattributed.
   *
   * `moderate` deliberately does NOT alert. A keyword scanner firing on
   * "hopeless" and "crisis" would generate a steady stream of low-confidence
   * alerts, and an admin who dismisses fifty of those will dismiss the
   * fifty-first without reading it. Fewer alerts that get read beats more
   * alerts that get ignored.
   */
  if (!isAdmin(user) && !isTherapist(user) && analyzeRisk(content) === "high") {
    await recordHighRiskMessageAlert(user.$id, content);
  }

  /*
   * Message CONTENT never reaches analytics — not the text, not its length, not
   * a risk classification. Between-session messaging is the strongest signal of
   * an engaged therapeutic relationship, so the fact that a message was sent is
   * worth counting; what was said is a clinical record.
   *
   * Note in particular that the risk-scanner outcome computed immediately above
   * is NOT captured. A `risk_alert` against a stable person id would amount to
   * "this individual was flagged as in crisis" sitting in a third-party
   * analytics store. That stays in Postgres behind RLS, where the clinical team
   * reads it. See `lib/analytics/events.ts` for the full rule.
   */
  await captureServer({
    distinctId: user.$id,
    event: ANALYTICS_EVENTS.MESSAGE_SENT,
    properties: {
      sender_role: isAdmin(user) ? "admin" : isTherapist(user) ? "therapist" : "client",
      in_session_thread: Boolean(toSessionRef(data.sessionId)),
    },
  });

  return doc;
}

export async function getSessionAction(sessionId: string): Promise<Doc> {
  const user = await requireUser();

  return withUser(user, async (tx) => {
    const { sess } = await requireSessionAccess(tx, sessionId);
    return toDoc(sess);
  });
}

/**
 * A user's profile. `userId` is retained — therapists resolve client and chat
 * visitor names through it — but access is limited to self, admins and staff
 * therapists.
 *
 * The therapist branch is broader than `profiles_select`, which additionally
 * requires `app_treats(user_id)`. A therapist asking for a profile they do not
 * treat therefore gets null, not a row. Kept because the check is still the
 * right first gate for non-staff callers.
 */
export async function getProfileByUserIdAction(userId: string): Promise<Doc> {
  const user = await requireUser();
  if (user.$id !== userId && !isAdmin(user) && !isTherapist(user)) {
    throw new Error("Forbidden");
  }

  return withUser(user, async (tx) => {
    const [row] = await tx
      .select()
      .from(profiles)
      .where(eq(profiles.userId, userId))
      .limit(1);

    return row ? toDoc(row) : null;
  });
}

/** `userId` is forced to the caller — a mood log is always logged for oneself. */
export async function createMoodLogAction(
  data: Record<string, unknown>
): Promise<Doc> {
  const user = await requireUser();

  const score = data.score;
  const emoji = data.emoji;
  if (typeof score !== "number") throw new Error("A numeric score is required");
  if (typeof emoji !== "string") throw new Error("An emoji is required");

  return withUser(user, async (tx) => {
    const [row] = await tx
      .insert(moodLogs)
      .values({
        userId: user.$id,
        score,
        emoji,
        note: typeof data.note === "string" ? data.note : null,
        tags: Array.isArray(data.tags) ? (data.tags as string[]) : null,
        createdAt: toDate(data.createdAt) ?? new Date(),
      })
      .returning();

    return toDoc(row);
  });
}

/**
 * The caller's own journal.
 *
 * SIGNATURE CHANGE (pre-existing): the `userId` parameter was removed. Journal
 * entries are private to the author — not even the treating therapist reads
 * them here, and `journal_entries_all` enforces the same in the database.
 */
export async function listJournalEntriesAction(limit = 20): Promise<Doc[]> {
  const user = await requireUser();

  return withUser(user, async (tx) => {
    const rows = await tx
      .select()
      .from(journalEntries)
      .where(eq(journalEntries.userId, user.$id))
      .orderBy(desc(journalEntries.createdAt))
      .limit(limit);

    return toDocs(rows);
  });
}

/** `userId` is forced to the caller. */
export async function createJournalEntryAction(
  data: Record<string, unknown>
): Promise<Doc> {
  const user = await requireUser();

  const content = data.content;
  if (typeof content !== "string" || !content) {
    throw new Error("Journal content is required");
  }

  return withUser(user, async (tx) => {
    const [row] = await tx
      .insert(journalEntries)
      .values({
        userId: user.$id,
        content,
        prompt: typeof data.prompt === "string" ? data.prompt : null,
        createdAt: toDate(data.createdAt) ?? new Date(),
      })
      .returning();

    return toDoc(row);
  });
}

export async function updateJournalEntryAction(
  documentId: string,
  data: Record<string, unknown>
): Promise<Doc> {
  const user = await requireUser();

  return withUser(user, async (tx) => {
    await requireDocumentOwner(tx, journalEntries, documentId);

    const patch = pick(data, ["content", "prompt"]);

    const [row] = isEmptyPatch(patch)
      ? await tx
          .select()
          .from(journalEntries)
          .where(eq(journalEntries.id, documentId))
          .limit(1)
      : await tx
          .update(journalEntries)
          .set(patch)
          .where(eq(journalEntries.id, documentId))
          .returning();

    return toDoc(row);
  });
}

export async function deleteJournalEntryAction(documentId: string) {
  const user = await requireUser();

  return withUser(user, async (tx) => {
    await requireDocumentOwner(tx, journalEntries, documentId);

    await tx.delete(journalEntries).where(eq(journalEntries.id, documentId));
    return { success: true };
  });
}

/** `userId` is forced to the caller. */
export async function createGoalAction(
  data: Record<string, unknown>
): Promise<Doc> {
  const user = await requireUser();

  const title = data.title;
  if (typeof title !== "string" || !title) throw new Error("A goal title is required");

  return withUser(user, async (tx) => {
    const [row] = await tx
      .insert(goals)
      .values({
        userId: user.$id,
        title,
        description: typeof data.description === "string" ? data.description : null,
        // `jsonb`, not a JSON string — legacy stringified payloads are unwrapped.
        milestones: toMilestones(data.milestones),
        assignedBy: data.assignedBy === "therapist" ? "therapist" : "self",
        completedAt: toDate(data.completedAt),
        createdAt: toDate(data.createdAt) ?? new Date(),
      })
      .returning();

    return toDoc(row);
  });
}

export async function updateGoalAction(
  documentId: string,
  data: Record<string, unknown>
): Promise<Doc> {
  const user = await requireUser();

  return withUser(user, async (tx) => {
    await requireDocumentOwner(tx, goals, documentId);

    const patch = pick(data, ["title", "description", "assignedBy"]);
    if ("milestones" in data) patch.milestones = toMilestones(data.milestones);
    if ("completedAt" in data) patch.completedAt = toDate(data.completedAt);

    const [row] = isEmptyPatch(patch)
      ? await tx.select().from(goals).where(eq(goals.id, documentId)).limit(1)
      : await tx
          .update(goals)
          .set(patch)
          .where(eq(goals.id, documentId))
          .returning();

    return toDoc(row);
  });
}

export async function deleteGoalAction(documentId: string) {
  const user = await requireUser();

  return withUser(user, async (tx) => {
    await requireDocumentOwner(tx, goals, documentId);

    await tx.delete(goals).where(eq(goals.id, documentId));
    return { success: true };
  });
}

/**
 * Update a profile row. Non-admins may only update their own, and may not
 * rewrite the identity/matching fields (`userId`, `therapistId`) — reassignment
 * goes through `assignTherapistToPatientAction`.
 */
export async function updateProfileAction(
  documentId: string,
  data: Record<string, unknown>
): Promise<Doc> {
  const user = await requireUser();

  return withUser(user, async (tx) => {
    await requireDocumentOwner(tx, profiles, documentId);

    const allowed = isAdmin(user)
      ? ["name", "email", "goal", "avatarUrl", "userId", "therapistId"]
      : ["name", "email", "goal", "avatarUrl"];
    const patch = pick(data, allowed);

    const [row] = isEmptyPatch(patch)
      ? await tx.select().from(profiles).where(eq(profiles.id, documentId)).limit(1)
      : await tx
          .update(profiles)
          .set(patch)
          .where(eq(profiles.id, documentId))
          .returning();

    return toDoc(row);
  });
}

/**
 * Cross-user mood data for the assessments view. Staff-only.
 *
 * BEHAVIOUR NARROWED BY RLS: `mood_logs_select` limits a therapist to the logs
 * of patients they actually treat, where Appwrite returned every user's. Admins
 * still see all. The narrower result is the correct one clinically.
 */
export async function listAllMoodLogsAction(limit = 100): Promise<Doc[]> {
  const user = await requireStaff();

  return withUser(user, async (tx) => {
    const rows = await tx
      .select()
      .from(moodLogs)
      .orderBy(desc(moodLogs.createdAt))
      .limit(limit);

    return toDocs(rows);
  });
}

/**
 * Resolve whatever the support console hands us to a `chat_messages.sessionId`.
 *
 * Under Appwrite the chat-session document `$id` WAS the client-generated
 * session key, so `app/therapist/messages/page.tsx` passes `active.$id` straight
 * through. In Postgres those are two different columns — `chat_sessions.id`
 * (uuid) and `chat_sessions.sessionId` (the client key that `chat_messages`
 * actually joins on). Accept either so the console keeps working.
 */
async function resolveChatSessionKey(tx: Tx, idOrKey: string): Promise<string> {
  if (!isUuid(idOrKey)) return idOrKey;

  const [row] = await tx
    .select({ sessionId: chatSessions.sessionId })
    .from(chatSessions)
    .where(eq(chatSessions.id, idOrKey))
    .limit(1);

  return row?.sessionId ?? idOrKey;
}

/** Support-console inbox. Staff-only. */
export async function listChatSessionsAction(limit = 50): Promise<Doc[]> {
  const user = await requireStaff();

  return withUser(user, async (tx) => {
    const rows = await tx
      .select()
      .from(chatSessions)
      .orderBy(desc(chatSessions.createdAt))
      .limit(limit);

    return toDocs(rows);
  });
}

/** Support-console thread. Staff-only. */
export async function listChatMessagesAction(
  sessionId: string,
  limit = 100
): Promise<Doc[]> {
  const user = await requireStaff();

  return withUser(user, async (tx) => {
    const key = await resolveChatSessionKey(tx, sessionId);

    const rows = await tx
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.sessionId, key))
      .orderBy(asc(chatMessages.createdAt))
      .limit(limit);

    return toDocs(rows);
  });
}

/**
 * Reply as support. Staff-only — the message is stamped `role: "admin"`.
 *
 * FIXED: this wrote `{ sessionId, sender, body, createdAt }` against a table
 * requiring `{ sessionId, name, email, role, text }` and threw on every single
 * call. It now writes the shape the working writer in `app/api/chat/route.ts`
 * uses, with the replying staff member's own name/email for attribution.
 *
 * See the report: `app/therapist/messages/page.tsx` still renders `msg.sender`
 * and `msg.body`, which have never existed — it needs `msg.role` / `msg.text`.
 */
export async function sendChatReplyAction(
  sessionId: string,
  body: string
): Promise<Doc> {
  const user = await requireStaff();

  const text = body?.trim();
  if (!text) throw new Error("A reply body is required");

  return withUser(user, async (tx) => {
    const key = await resolveChatSessionKey(tx, sessionId);

    const [row] = await tx
      .insert(chatMessages)
      .values({
        sessionId: key,
        name: user.name,
        email: user.email,
        role: "admin",
        text,
      })
      .returning();

    return toDoc(row);
  });
}

// ─── Therapist availability (migration 0016) ─────────────────────────────────
//
// PUBLISHED HOURS, NOT A BOOKING CONSTRAINT. `createSessionAction` above does
// not consult any of this: it accepts whatever `scheduledAt` it is given, and a
// client can still book outside a therapist's published hours. Enforcing the
// schedule is a real change to the booking flow — what happens to an out-of-hours
// request, who may override it, what becomes of bookings that already sit outside
// the new hours — and it deserves its own decision rather than being smuggled in
// with the storage. Until that decision is made, every surface that renders this
// data has to describe it as published hours rather than as a lock.
//
// These replace a save handler that ran `setSaved(true)` and discarded the form.

/** A therapist's published week, as every reader of it needs it. */
export interface TherapistAvailability {
  therapistId: string;
  /** IANA zone name. Every minute value below is local to THIS zone. */
  timezone: string;
  sessionDurationMinutes: number;
  bufferMinutes: number;
  /**
   * Stored order (Sunday first, matching `day_of_week` 0–6). Callers that render
   * a Monday-first week run these through `sortForDisplay` from
   * `lib/availability` rather than re-deriving the order.
   */
  blocks: AvailabilityBlock[];
}

export type SaveAvailabilityResult =
  | { ok: true; availability: TherapistAvailability }
  | { ok: false; message: string };

/**
 * Read one therapist's settings and blocks on an already-open transaction.
 *
 * Projects `therapists` explicitly rather than `select()`: this feeds a
 * world-readable action, and the row it reads from carries `license_number` and
 * `kyc_status`.
 */
async function readAvailability(
  tx: Tx,
  therapistId: string
): Promise<TherapistAvailability | null> {
  const [therapist] = await tx
    .select({
      id: therapists.id,
      timezone: therapists.timezone,
      sessionDurationMinutes: therapists.sessionDurationMinutes,
      bufferMinutes: therapists.bufferMinutes,
    })
    .from(therapists)
    .where(eq(therapists.id, therapistId))
    .limit(1);

  if (!therapist) return null;

  const blocks = await tx
    .select({
      dayOfWeek: therapistAvailability.dayOfWeek,
      startMinute: therapistAvailability.startMinute,
      endMinute: therapistAvailability.endMinute,
    })
    .from(therapistAvailability)
    .where(eq(therapistAvailability.therapistId, therapistId))
    .orderBy(asc(therapistAvailability.dayOfWeek));

  return {
    therapistId: therapist.id,
    timezone: therapist.timezone,
    sessionDurationMinutes: therapist.sessionDurationMinutes,
    bufferMinutes: therapist.bufferMinutes,
    blocks,
  };
}

/**
 * The caller's own published hours, or null when they have no `therapists` row.
 *
 * Null is not an error state: a user who reached the therapist section before
 * saving a profile genuinely has nowhere to hang a schedule, and the editor tells
 * them to complete the profile first rather than showing an empty week that
 * cannot be saved.
 */
export async function getMyAvailabilityAction(): Promise<TherapistAvailability | null> {
  const user = await requireUser();

  return withUser(user, async (tx) => {
    const [therapist] = await tx
      .select({ id: therapists.id })
      .from(therapists)
      .where(eq(therapists.userId, user.$id))
      .limit(1);

    if (!therapist) return null;
    return readAvailability(tx, therapist.id);
  });
}

/**
 * Replace the caller's whole week.
 *
 * WHY DELETE-THEN-INSERT RATHER THAN A DIFF. The editor submits a complete week,
 * and "no longer works Fridays" has to be expressible. A per-day upsert would
 * leave a row behind for any day the client stopped sending — publishing hours
 * the therapist had just removed, which is the failure mode this whole feature
 * exists to stop. `withUser` runs the callback in a single transaction, so the
 * delete and the inserts commit together or not at all; a constraint violation on
 * the insert rolls the delete back and the therapist keeps their previous week
 * rather than losing it to a half-applied save.
 *
 * VALIDATION FAILURES ARE RETURNED, NOT THROWN. They are expected errors in the
 * Next.js sense — a thrown one is replaced with a generic message in a production
 * build, so the specific complaint ("Tuesday: the end time must be after the
 * start time") would never reach the person who can fix it. The CHECK constraints
 * and the UNIQUE index are the backstop behind this, not the user's error message.
 */
export async function saveMyAvailabilityAction(
  input: AvailabilityDraft
): Promise<SaveAvailabilityResult> {
  const user = await requireUser();

  /*
   * The payload arrives over the network, so its declared type is a convenience
   * for the call site and not a guarantee here. Rebuilding it field by field
   * means anything else the client sent — an `id`, a `therapistId` — is dropped
   * before it can reach an INSERT. `validateAvailabilityDraft` then does the
   * runtime type checking on what is left.
   */
  const draft: AvailabilityDraft = {
    timezone: typeof input?.timezone === "string" ? input.timezone.trim() : "",
    sessionDurationMinutes: input?.sessionDurationMinutes,
    bufferMinutes: input?.bufferMinutes,
    blocks: Array.isArray(input?.blocks) ? input.blocks : [],
  };

  const problem = validateAvailabilityDraft(draft);
  if (problem) return { ok: false, message: problem };

  return withUser(user, async (tx) => {
    const [therapist] = await tx
      .select({ id: therapists.id })
      .from(therapists)
      .where(eq(therapists.userId, user.$id))
      .limit(1);

    if (!therapist) {
      return {
        ok: false,
        message:
          "This account has no therapist profile yet, so there is nothing to attach a schedule to. Complete your therapist profile first.",
      };
    }

    // The three settings live on `therapists` rather than on the availability
    // rows: they describe how the therapist works, not when, and they must
    // survive a week with no blocks in it at all.
    await tx
      .update(therapists)
      .set({
        timezone: draft.timezone,
        sessionDurationMinutes: draft.sessionDurationMinutes,
        bufferMinutes: draft.bufferMinutes,
        updatedAt: new Date(),
      })
      .where(eq(therapists.id, therapist.id));

    await tx
      .delete(therapistAvailability)
      .where(eq(therapistAvailability.therapistId, therapist.id));

    if (draft.blocks.length > 0) {
      await tx.insert(therapistAvailability).values(
        draft.blocks.map((block) => ({
          therapistId: therapist.id,
          dayOfWeek: block.dayOfWeek,
          startMinute: block.startMinute,
          endMinute: block.endMinute,
        }))
      );
    }

    const availability = await readAvailability(tx, therapist.id);
    if (!availability) {
      // Unreachable: the row was selected inside this transaction. Throwing
      // rather than asserting non-null, because if it ever does happen the save
      // must not report success.
      throw new Error("Availability was saved but could not be read back");
    }

    return { ok: true, availability };
  });
}

/**
 * Any therapist's published hours, by `therapists.id`.
 *
 * ANONYMOUS ON PURPOSE. `therapist_availability_select` is `USING (true)`, for
 * the same reason `therapists_select` is: visitors browse the directory before
 * signing in, and "when does this clinician work" is part of choosing one.
 * Published working hours are the business equivalent of a shop sign. Running
 * this under `withAnonymous` keeps that honest — the read genuinely needs no
 * identity, so it does not ask for one, and the action can serve the public
 * directory as well as the admin view.
 *
 * The projection in `readAvailability` is what keeps that safe: it names four
 * columns, and `therapists` also holds `license_number` and `kyc_status`.
 */
export async function getTherapistAvailabilityAction(
  therapistId: string
): Promise<TherapistAvailability | null> {
  if (!isUuid(therapistId)) return null;

  return withAnonymous((tx) => readAvailability(tx, therapistId));
}

// ─── Clinical risk alerts ────────────────────────────────────────────────────

/**
 * Window in which one unresolved crisis alert per patient suppresses the next.
 *
 * Without it, a distressed client sending six messages in a row files six
 * identical crisis alerts, and the admin queue becomes a message log rather than
 * a work queue. The window is deliberately short: it collapses one *episode*
 * into one alert, but a client still in crisis tomorrow produces a fresh alert,
 * and resolving an alert re-arms the scan immediately. Suppression is capped
 * this way because an escalation an admin never sees is the failure mode that
 * matters most here.
 */
const RISK_ALERT_DEDUPE_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Message excerpt stored on the alert, in characters. */
const RISK_ALERT_EXCERPT_CHARS = 280;

/**
 * File a crisis alert for a client whose message matched a high-risk keyword.
 *
 * NEVER THROWS. Every failure path is swallowed after logging, because the
 * caller has already committed the therapy message and must return it to the
 * sender regardless of what happens here.
 *
 * ⚠️ THIS CURRENTLY FAILS ON EVERY CALL, BY DESIGN OF THE EXISTING POLICY.
 * `risk_alerts_all` (migration 0001) is `FOR ALL USING (app_is_admin()) WITH
 * CHECK (app_is_admin())`, and neither a client's session nor the system context
 * used below satisfies it — verified directly against the database, which
 * answers `new row violates row-level security policy for table "risk_alerts"`.
 * The scan, the dedupe and the insert are all correct; they need a policy that
 * admits `app_is_system()`, e.g.
 *
 *     CREATE POLICY risk_alerts_system ON risk_alerts FOR ALL
 *       USING (app_is_system()) WITH CHECK (app_is_system());
 *
 * (or `OR app_is_system()` folded into the existing policy). Once that lands
 * this function starts working with no code change.
 *
 * WHY `withSystem` RATHER THAN WIDENING THE POLICY TO SENDERS. The obvious
 * alternative — letting any authenticated sender insert their own alert — is a
 * security hole: `patient_id` is free text with no foreign key, so a client
 * granted INSERT could file arbitrary "crisis" alerts against ANY other user's
 * id and poison a stranger's clinical record, on a table only admins can read
 * and therefore only admins would ever act on. Under system context the caller
 * carries no identity at all (`app_user_id()` is null, so every ownership
 * predicate still fails closed) and `patientId` is chosen here on the server
 * from the authenticated session, never from request data.
 */
async function recordHighRiskMessageAlert(
  patientId: string,
  content: string
): Promise<void> {
  try {
    await withSystem("risk-scanner", async (tx) => {
      const since = new Date(Date.now() - RISK_ALERT_DEDUPE_WINDOW_MS);

      const [existing] = await tx
        .select({ id: riskAlerts.id })
        .from(riskAlerts)
        .where(
          and(
            eq(riskAlerts.patientId, patientId),
            eq(riskAlerts.type, "crisis"),
            eq(riskAlerts.resolved, false),
            gte(riskAlerts.createdAt, since)
          )
        )
        .limit(1);

      if (existing) return;

      /*
       * The excerpt is stored so an admin can judge the flag without opening
       * the thread — most matches are false positives ("goodbye", a quoted
       * lyric, a past-tense account), and a bare "keyword matched" alert forces
       * the reader to go and read private messages just to dismiss it. Showing
       * the matched text is the smaller disclosure of the two.
       *
       * The provenance caveat is repeated in the row itself, not only in the
       * page chrome, so it survives being read anywhere the description is
       * shown. `description` is varchar(1000); the excerpt is bounded and the
       * whole string is truncated so a long message can never overflow the
       * column and turn a risk alert into a failed insert.
       */
      const excerpt = content.slice(0, RISK_ALERT_EXCERPT_CHARS).trim();
      const suffix = content.length > RISK_ALERT_EXCERPT_CHARS ? "…" : "";
      const description = `Automated keyword scan matched a high-risk term in a message from this client. Keyword matching only — not a clinical assessment, and it fires on quoted or past-tense speech. Review the conversation before acting. Message excerpt: "${excerpt}${suffix}"`;

      await tx.insert(riskAlerts).values({
        patientId,
        type: "crisis",
        severity: "high",
        description: description.slice(0, 1000),
      });
    });
  } catch (err) {
    /*
     * Swallowed on purpose — see the contract above. Logged loudly because a
     * risk alert that cannot be filed is a real operational defect, and the
     * message names the fix so it is diagnosable from the log line alone
     * rather than requiring someone to rediscover the policy interaction.
     */
    console.error(
      "[risk-scanner] Failed to record a high-risk alert; the message itself was " +
        "sent successfully. If this is an RLS violation, `risk_alerts` has no " +
        "policy admitting `app_is_system()` — see recordHighRiskMessageAlert.",
      err
    );
  }
}

/**
 * Manually file a risk alert. Backs the admin incident form.
 *
 * Admins hold INSERT here under `risk_alerts_all` (verified against the
 * database), so unlike the automated path above this works today.
 */
export async function createRiskAlertAction(data: {
  patientId: string;
  type: string;
  severity: string;
  description: string;
}): Promise<Doc> {
  const user = await requireAdmin();

  const patientId = data.patientId?.trim();
  const description = data.description?.trim();
  if (!patientId) throw new Error("A patient is required");
  if (!description) throw new Error("A description is required");

  // Enum columns: an unrecognised value would reach Postgres as a cast error.
  const type = (["crisis", "mood", "engagement", "flag"] as const).includes(
    data.type as "crisis"
  )
    ? (data.type as "crisis" | "mood" | "engagement" | "flag")
    : "flag";
  const severity = (["low", "medium", "high", "critical"] as const).includes(
    data.severity as "low"
  )
    ? (data.severity as "low" | "medium" | "high" | "critical")
    : "medium";

  return withUser(user, async (tx) => {
    const [row] = await tx
      .insert(riskAlerts)
      .values({
        patientId,
        type,
        severity,
        description: description.slice(0, 1000),
      })
      .returning();

    return toDoc(row);
  });
}
