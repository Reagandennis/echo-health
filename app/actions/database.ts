"use server";

import { and, asc, desc, eq, gte, isNotNull, lt, or, sql } from "drizzle-orm";

import { getLoggedInUser, type SessionUser } from "@/lib/auth/session";
import { withUser } from "@/lib/db/session";
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
  profiles,
  riskAlerts,
  therapySessions,
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
 * Same treatment for the WebRTC track payloads, now `jsonb`. `useVideoSession`
 * still `JSON.stringify`s before calling `updateSessionTracksAction`.
 */
function toJson(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
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

/** The `therapists` row belonging to `user`, or null. */
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

/** Largest accepted upload. Bytes live in Postgres, so this is also a DB-size guard. */
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const ALLOWED_DOCUMENT_TYPES = [...ALLOWED_IMAGE_TYPES, "application/pdf"];

function readUpload(formData: FormData, allowedTypes: string[]) {
  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("No file provided");
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("File exceeds the 10 MB limit");
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
  const file = readUpload(formData, ALLOWED_IMAGE_TYPES);
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
 * Store an identity document as a `kyc_documents` row.
 *
 * PORTED FROM APPWRITE STORAGE, where these sat at a public bucket URL that
 * anyone holding the link could read. Bytes now live in a `bytea` column behind
 * the `kyc_documents_select` policy, served by `GET /api/kyc/<id>`.
 */
export async function uploadKycDocumentAction(formData: FormData) {
  const user = await requireUser();
  const file = readUpload(formData, ALLOWED_DOCUMENT_TYPES);
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
        filename: (file.name || "document").slice(0, 255),
        mimeType: file.type,
        sizeBytes: content.byteLength,
        content,
      })
      .returning({ id: kycDocuments.id });

    return { id: row.id, url: `/api/kyc/${row.id}` };
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
export async function createSessionAction(data: SessionInput): Promise<Doc> {
  const user = await requireUser();

  const scheduledAt = toDate(data.scheduledAt);
  if (!scheduledAt) throw new Error("A valid scheduledAt is required");
  if (!isUuid(data.therapistId)) throw new Error("A valid therapistId is required");

  return withUser(user, async (tx) => {
    const [row] = await tx
      .insert(therapySessions)
      .values({
        patientId: isAdmin(user) ? data.patientId : user.$id,
        therapistId: data.therapistId,
        scheduledAt,
        sessionType: data.sessionType ?? "1-on-1",
        notes: data.notes ?? null,
        feedback: data.feedback ?? null,
        amount: data.amount ?? null,
        status: data.status ?? "pending",
      })
      .returning();

    return toDoc(row);
  });
}

/**
 * Update the WebRTC track-signaling column on a session row.
 * Authorizes the caller (patient, or therapist-by-userId) then writes.
 *
 * `trackData` still arrives as a JSON string from `useVideoSession`; it is
 * parsed here so the `jsonb` column holds structured JSON rather than a quoted
 * string. See the report for the matching change owed on the read side.
 */
export async function updateSessionTracksAction(
  sessionId: string,
  role: "client" | "therapist",
  trackData: string
): Promise<Doc> {
  const user = await requireUser();
  if (!isUuid(sessionId)) throw new Error("Not found");

  return withUser(user, async (tx) => {
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

    const patch =
      role === "therapist"
        ? { therapistTracks: toJson(trackData) }
        : { patientTracks: toJson(trackData) };

    const [row] = await tx
      .update(therapySessions)
      .set(patch)
      .where(eq(therapySessions.id, sessionId))
      .returning();

    return toDoc(row);
  });
}

/**
 * Companion read for `updateSessionTracksAction`. The browser has no database
 * session, so it reads the published-track columns through this action after
 * verifying the caller is the patient/therapist on the session.
 *
 * Returns the parsed `jsonb` values, NOT the JSON strings Appwrite stored.
 */
export async function getSessionTracksAction(
  sessionId: string,
  role: "client" | "therapist"
) {
  const user = await requireUser();
  if (!isUuid(sessionId)) throw new Error("Not found");

  return withUser(user, async (tx) => {
    const [sess] = await tx
      .select({
        patientId: therapySessions.patientId,
        therapistId: therapySessions.therapistId,
        patientTracks: therapySessions.patientTracks,
        therapistTracks: therapySessions.therapistTracks,
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

    return {
      patientTracks: sess.patientTracks ?? null,
      therapistTracks: sess.therapistTracks ?? null,
    };
  });
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

  return withUser(user, async (tx) => {
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

    return toDoc(row);
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
 * KYC is now advanced to "pending" only from the initial "incomplete" state; an
 * already-verified, already-pending or rejected status is left untouched, and
 * `kycStatus` is never accepted from the caller.
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
      .select({ id: therapists.id, kycStatus: therapists.kycStatus })
      .from(therapists)
      .where(eq(therapists.userId, user.$id))
      .limit(1);

    if (existing) {
      // Only advance KYC out of "incomplete"; never regress a reviewed status.
      const kycStatus =
        existing.kycStatus === "incomplete" ? ("pending" as const) : undefined;

      const [row] = await tx
        .update(therapists)
        .set({
          ...fields,
          ...(kycStatus ? { kycStatus } : {}),
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
        kycStatus: "pending",
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

  return withUser(user, async (tx) => {
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
