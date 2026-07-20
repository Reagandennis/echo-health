import { desc, eq } from "drizzle-orm";

import { withCurrentUser } from "@/lib/db/session";
import {
  clinicalNotes,
  profiles,
  promos,
  sessionFeedback,
  therapySessions,
  therapists,
} from "@/lib/db/schema";

/**
 * Admin-console reads that `app/actions/database.ts` does not already cover.
 *
 * Everything here is platform-wide and therefore admin-only. The gate is the
 * `user.labels?.includes("admin")` check every admin Server Component layout and
 * page already performs BEFORE calling in, plus the Postgres RLS policies in
 * migration 0001 — `therapy_sessions_select` and `promos_select` both widen to
 * every row only for `app_is_admin()`, so a non-admin who reached these would
 * get an empty result rather than a leak.
 *
 * Queries run through `withCurrentUser`, which opens the transaction that
 * carries `app.user_id` / `app.user_roles` into the database. A query issued
 * outside it carries no identity and silently returns zero rows.
 */

export type ProfileRow = typeof profiles.$inferSelect;
export type TherapistRow = typeof therapists.$inferSelect;
export type TherapySessionRow = typeof therapySessions.$inferSelect;
export type PromoRow = typeof promos.$inferSelect;

/** A row re-exposed under the Appwrite-era `$id` alias the JSX still reads. */
export type Doc<T> = T & { $id: string };

/**
 * Local mirror of the `toDoc` bridge in `app/actions/database.ts`, which is not
 * exported (that module is `"use server"`, so it may only export async
 * functions). Admin JSX keys rows and builds hrefs off `$id`; rows carry both
 * `id` and `$id` so either spelling works.
 */
function toDoc<T extends { id: string }>(row: T): Doc<T> {
  return { ...row, $id: row.id };
}

function toDocs<T extends { id: string }>(rows: T[]): Doc<T>[] {
  return rows.map(toDoc);
}

/**
 * Identity for `/admin/users/[id]/*`.
 *
 * `userId` is an Auth0 `sub` (`auth0|68f…`), NOT a uuid — do not cast it. Since
 * the Auth0 migration there is no server-side user directory this app can query,
 * so `profiles` is the user store for admin purposes. Returns null when no
 * profile exists; callers decide between `notFound()` and a fallback.
 */
export async function getProfileByUserId(
  userId: string
): Promise<Doc<ProfileRow> | null> {
  return withCurrentUser(async (tx) => {
    const [row] = await tx
      .select()
      .from(profiles)
      .where(eq(profiles.userId, userId))
      .limit(1);

    return row ? toDoc(row) : null;
  });
}

/** The client roster. Replaces the Appwrite `users.list()` enumeration. */
export async function listProfiles(limit = 100): Promise<Doc<ProfileRow>[]> {
  return withCurrentUser(async (tx) => {
    const rows = await tx
      .select()
      .from(profiles)
      .orderBy(desc(profiles.createdAt))
      .limit(limit);

    return toDocs(rows);
  });
}

/** Every therapist row. */
export async function listTherapists(limit = 100): Promise<Doc<TherapistRow>[]> {
  return withCurrentUser(async (tx) => {
    const rows = await tx.select().from(therapists).limit(limit);
    return toDocs(rows);
  });
}

/** A single therapist row by `therapists.id` (a uuid). Null when absent. */
export async function getTherapist(
  therapistId: string
): Promise<Doc<TherapistRow> | null> {
  if (!isUuid(therapistId)) return null;

  return withCurrentUser(async (tx) => {
    const [row] = await tx
      .select()
      .from(therapists)
      .where(eq(therapists.id, therapistId))
      .limit(1);

    return row ? toDoc(row) : null;
  });
}

/** Platform-wide session list, newest scheduled first. */
export async function listAllSessions(
  limit = 100
): Promise<Doc<TherapySessionRow>[]> {
  return withCurrentUser(async (tx) => {
    const rows = await tx
      .select()
      .from(therapySessions)
      .orderBy(desc(therapySessions.scheduledAt))
      .limit(limit);

    return toDocs(rows);
  });
}

/**
 * Clinical notes about a patient that an admin is allowed to see.
 *
 * `is_private` is the therapist's "only I can read this" flag. RLS
 * (`clinical_notes_select`) does NOT filter on it for admins, so the exclusion
 * is applied here — an admin console must not surface notes the authoring
 * therapist marked private. The count of hidden notes is returned so the page
 * can say how many were withheld without revealing them.
 */
export async function listAdminVisibleNotes(patientId: string): Promise<{
  notes: (Doc<typeof clinicalNotes.$inferSelect> & { authorName: string })[];
  privateCount: number;
}> {
  return withCurrentUser(async (tx) => {
    const rows = await tx
      .select({
        note: clinicalNotes,
        authorName: therapists.name,
      })
      .from(clinicalNotes)
      .leftJoin(therapists, eq(clinicalNotes.therapistId, therapists.id))
      .where(eq(clinicalNotes.patientId, patientId))
      .orderBy(desc(clinicalNotes.createdAt))
      .limit(100);

    const visible = rows.filter((r) => !r.note.isPrivate);

    return {
      notes: visible.map((r) => ({
        ...toDoc(r.note),
        authorName: r.authorName ?? "Unknown therapist",
      })),
      privateCount: rows.length - visible.length,
    };
  });
}

/**
 * Client feedback on a therapist's sessions.
 *
 * `session_feedback` has no `therapist_id` of its own — it hangs off a session —
 * so this joins through `therapy_sessions`, and picks up the reviewer's display
 * name from `profiles` in the same query rather than issuing an N+1 per row.
 */
export async function listTherapistFeedback(therapistId: string): Promise<
  {
    id: string;
    rating: number;
    comment: string | null;
    createdAt: Date;
    clientName: string;
  }[]
> {
  if (!isUuid(therapistId)) return [];

  return withCurrentUser(async (tx) => {
    const rows = await tx
      .select({
        id: sessionFeedback.id,
        rating: sessionFeedback.rating,
        comment: sessionFeedback.comment,
        createdAt: sessionFeedback.createdAt,
        clientName: profiles.name,
      })
      .from(sessionFeedback)
      .innerJoin(
        therapySessions,
        eq(sessionFeedback.sessionId, therapySessions.id)
      )
      .leftJoin(profiles, eq(profiles.userId, sessionFeedback.userId))
      .where(eq(therapySessions.therapistId, therapistId))
      .orderBy(desc(sessionFeedback.createdAt))
      .limit(100);

    return rows.map((r) => ({ ...r, clientName: r.clientName ?? "Former client" }));
  });
}

/**
 * Promo codes. `promos` is keyed by `code` (a natural text primary key) and has
 * no `id` column, so these rows deliberately do NOT go through `toDoc`.
 */
export async function listPromos(limit = 100): Promise<PromoRow[]> {
  return withCurrentUser(async (tx) => {
    return tx.select().from(promos).orderBy(desc(promos.usedAt)).limit(limit);
  });
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Postgres raises `invalid input syntax for type uuid` on a malformed id, which
 * would surface as a 500 where the page wants a 404. Screen ids before querying.
 */
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}
