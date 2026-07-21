import { and, desc, eq, sql } from "drizzle-orm";

import { withCurrentUser } from "@/lib/db/session";
import { PLAN_CURRENCY, THERAPIST_REVENUE_SHARE } from "@/lib/constants";
import {
  clinicalNotes,
  payments,
  profiles,
  promoRedemptions,
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
export type PromoRow = typeof promos.$inferSelect & { redemptions: number };

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
 * Promo codes with their real redemption counts.
 *
 * `promos` is keyed by `code` (a natural text primary key) and has no `id`
 * column, so these rows deliberately do NOT go through `toDoc`.
 *
 * The count comes from `promo_redemptions` and only includes redemptions tied to
 * a completed payment. The admin page previously hardcoded `1 / limit`, which
 * was an artefact of the old schema where a code could only ever be used once —
 * it would have reported "1" for a campaign with a thousand redemptions.
 */
export async function listPromos(limit = 100): Promise<PromoRow[]> {
  return withCurrentUser(async (tx) => {
    const rows = await tx
      .select({
        code: promos.code,
        discount: promos.discount,
        redemptionLimit: promos.redemptionLimit,
        expiresAt: promos.expiresAt,
        disabled: promos.disabled,
        createdAt: promos.createdAt,
        redemptions: sql<number>`(
          SELECT count(*)::int FROM promo_redemptions r
          WHERE r.code = ${promos.code} AND r.payment_reference IS NOT NULL
        )`,
      })
      .from(promos)
      .orderBy(desc(promos.createdAt))
      .limit(limit);

    return rows;
  });
}

// ─── Payments ────────────────────────────────────────────────────────────────

export type PaymentRow = typeof payments.$inferSelect;
export type PaymentStatus = PaymentRow["status"];

/** A ledger row with the payer's identity resolved in the same query. */
export type AdminPaymentRow = Doc<PaymentRow> & {
  clientName: string | null;
  clientEmail: string | null;
};

/**
 * Sums come back as text rather than `::int`, deliberately.
 *
 * `sum(integer)` is bigint in Postgres, and casting to int would overflow at KES
 * 21,474,836 of lifetime revenue — a ceiling this platform can plausibly reach,
 * at which point the revenue dashboard starts erroring instead of counting.
 * Text parses losslessly into a JS number far beyond any realistic total, and
 * avoids the float rounding that money must never be subjected to.
 */
function toMinor(value: string | number | null): number {
  return value === null ? 0 : Number(value);
}

/**
 * Trailing `count` months ending with the current one, oldest first.
 *
 * Bucketed in UTC on both sides — the SQL truncates `AT TIME ZONE 'UTC'` and so
 * does this — so a payment near a month boundary lands in the same bucket
 * regardless of the server's timezone.
 */
function monthWindow(count: number): { key: string; label: string }[] {
  const now = new Date();
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (count - 1 - i), 1)
    );
    return {
      key: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }),
    };
  });
}

/** SQL for the month a payment belongs to, as `YYYY-MM`. */
const PAYMENT_MONTH = sql<string>`to_char(date_trunc('month', coalesce(${payments.paidAt}, ${payments.createdAt}) AT TIME ZONE 'UTC'), 'YYYY-MM')`;

/**
 * The platform-wide charge ledger, newest first.
 *
 * Non-successful rows are included on purpose. `status` is Paystack's outcome,
 * not a display label — only `success` is money received — but a checkout that
 * failed or was abandoned is precisely what an operator investigating "I was
 * charged twice" needs to be able to see.
 */
export async function listPayments(
  opts: { status?: PaymentStatus; search?: string; limit?: number } = {}
): Promise<AdminPaymentRow[]> {
  return withCurrentUser(async (tx) => {
    const filters = [];
    if (opts.status) filters.push(eq(payments.status, opts.status));
    if (opts.search?.trim()) {
      const term = `%${opts.search.trim()}%`;
      filters.push(
        sql`(${payments.reference} ILIKE ${term} OR ${payments.plan} ILIKE ${term}
             OR ${profiles.name} ILIKE ${term} OR ${profiles.email} ILIKE ${term})`
      );
    }

    const rows = await tx
      .select({
        payment: payments,
        clientName: profiles.name,
        clientEmail: profiles.email,
      })
      .from(payments)
      .leftJoin(profiles, eq(profiles.userId, payments.userId))
      .where(filters.length ? and(...filters) : undefined)
      .orderBy(desc(payments.createdAt))
      .limit(opts.limit ?? 100);

    return rows.map((r) => ({
      ...toDoc(r.payment),
      clientName: r.clientName,
      clientEmail: r.clientEmail,
    }));
  });
}

/**
 * One charge, keyed by its Paystack reference.
 *
 * The reference rather than the row uuid: it is what appears on the customer's
 * bank statement and in Paystack's own dashboard, so it is the id an operator
 * handling a dispute actually has in front of them. It is UNIQUE in the schema,
 * which is what makes it safe to route on.
 */
export async function getPaymentByReference(
  reference: string
): Promise<(AdminPaymentRow & { promoCode: string | null }) | null> {
  return withCurrentUser(async (tx) => {
    const [row] = await tx
      .select({
        payment: payments,
        clientName: profiles.name,
        clientEmail: profiles.email,
        promoCode: promoRedemptions.code,
      })
      .from(payments)
      .leftJoin(profiles, eq(profiles.userId, payments.userId))
      .leftJoin(
        promoRedemptions,
        eq(promoRedemptions.paymentReference, payments.reference)
      )
      .where(eq(payments.reference, reference))
      .limit(1);

    if (!row) return null;

    return {
      ...toDoc(row.payment),
      clientName: row.clientName,
      clientEmail: row.clientEmail,
      promoCode: row.promoCode,
    };
  });
}

/** One client's charge history, for `/admin/users/[id]/billing`. */
export async function listPaymentsForUser(
  userId: string,
  limit = 50
): Promise<Doc<PaymentRow>[]> {
  return withCurrentUser(async (tx) => {
    const rows = await tx
      .select()
      .from(payments)
      .where(eq(payments.userId, userId))
      .orderBy(desc(payments.createdAt))
      .limit(limit);

    return toDocs(rows);
  });
}

export interface RevenueSummary {
  /** Minor units (KES cents). Successful charges only. */
  grossMinor: number;
  successCount: number;
  failedCount: number;
  pendingCount: number;
  payingClients: number;
  /**
   * Successful charges settled in some OTHER currency, excluded from the totals
   * above. Surfaced so the page can disclose them rather than the query silently
   * adding shillings to dollars.
   */
  foreignCurrencyCount: number;
  /** Trailing six months, oldest first. */
  monthly: { month: string; grossMinor: number }[];
}

/**
 * Platform revenue, straight from the `payments` ledger.
 *
 * This replaces a "completed sessions × $50" estimate that was wrong three ways
 * at once: it counted sessions rather than money, it ignored the ledger
 * entirely, and it reported the result in USD on an account that settles in KES.
 *
 * Totals are scoped to `PLAN_CURRENCY`. Summing mixed currencies into a single
 * figure is arithmetic on incomparable units — the exact failure this whole
 * change exists to remove — so foreign rows are counted separately instead.
 */
export async function getRevenueSummary(): Promise<RevenueSummary> {
  return withCurrentUser(async (tx) => {
    const [totals] = await tx
      .select({
        grossMinor: sql<string>`(coalesce(sum(${payments.amountMinor}) FILTER (
          WHERE ${payments.status} = 'success' AND ${payments.currency} = ${PLAN_CURRENCY}
        ), 0))::text`,
        successCount: sql<number>`(count(*) FILTER (WHERE ${payments.status} = 'success'))::int`,
        failedCount: sql<number>`(count(*) FILTER (WHERE ${payments.status} = 'failed'))::int`,
        pendingCount: sql<number>`(count(*) FILTER (WHERE ${payments.status} = 'pending'))::int`,
        payingClients: sql<number>`(count(DISTINCT ${payments.userId}) FILTER (
          WHERE ${payments.status} = 'success'
        ))::int`,
        foreignCurrencyCount: sql<number>`(count(*) FILTER (
          WHERE ${payments.status} = 'success' AND ${payments.currency} <> ${PLAN_CURRENCY}
        ))::int`,
      })
      .from(payments);

    const buckets = await tx
      .select({
        month: PAYMENT_MONTH,
        grossMinor: sql<string>`(sum(${payments.amountMinor}))::text`,
      })
      .from(payments)
      .where(
        and(
          eq(payments.status, "success"),
          eq(payments.currency, PLAN_CURRENCY)
        )
      )
      .groupBy(PAYMENT_MONTH);

    const byMonth = new Map(buckets.map((b) => [b.month, toMinor(b.grossMinor)]));

    return {
      grossMinor: toMinor(totals.grossMinor),
      successCount: totals.successCount,
      failedCount: totals.failedCount,
      pendingCount: totals.pendingCount,
      payingClients: totals.payingClients,
      foreignCurrencyCount: totals.foreignCurrencyCount,
      monthly: monthWindow(6).map((m) => ({
        month: m.label,
        grossMinor: byMonth.get(m.key) ?? 0,
      })),
    };
  });
}

export interface PlanRevenueRow {
  plan: string;
  purchases: number;
  buyers: number;
  /** Minor units (KES cents). */
  grossMinor: number;
}

/**
 * Revenue and purchase counts per plan, for the plans overview.
 *
 * Keyed by the `plan` string the checkout wrote, so a plan that was renamed or
 * retired still shows its historical takings instead of vanishing from the
 * totals. The page joins these onto `PLAN_LABELS` for display.
 */
export async function listPlanRevenue(): Promise<PlanRevenueRow[]> {
  return withCurrentUser(async (tx) => {
    const rows = await tx
      .select({
        plan: payments.plan,
        purchases: sql<number>`(count(*))::int`,
        buyers: sql<number>`(count(DISTINCT ${payments.userId}))::int`,
        grossMinor: sql<string>`(sum(${payments.amountMinor}))::text`,
      })
      .from(payments)
      .where(
        and(
          eq(payments.status, "success"),
          eq(payments.currency, PLAN_CURRENCY)
        )
      )
      .groupBy(payments.plan);

    return rows.map((r) => ({
      plan: r.plan,
      purchases: r.purchases,
      buyers: r.buyers,
      grossMinor: toMinor(r.grossMinor),
    }));
  });
}

// ─── Therapist earnings ──────────────────────────────────────────────────────

/**
 * `therapy_sessions.amount` is in WHOLE shillings, unlike `payments.amount_minor`.
 * It is multiplied up here so that everything leaving this module speaks minor
 * units and the admin console needs exactly one money formatter. Doing this
 * conversion in JSX instead is how a screen ends up off by 100×.
 */
const SESSION_VALUE_MINOR = sql<string>`(coalesce(sum(${therapySessions.amount}), 0) * 100)::text`;

export interface TherapistEarnings {
  /** Client-paid value of this therapist's completed sessions, in minor units. */
  grossMinor: number;
  /** The therapist's share under `THERAPIST_REVENUE_SHARE`, in minor units. */
  therapistShareMinor: number;
  /** The remainder retained by the platform, in minor units. */
  platformShareMinor: number;
  completedSessions: number;
  /**
   * Completed sessions carrying no `amount`. These predate the entitlement
   * logic that prices a booking from the payment it consumes, or were booked by
   * an admin without one — they are excluded from the totals, and reported so a
   * zero-looking figure can be told apart from an incomplete one.
   */
  unpricedSessions: number;
  /** Trailing six months, oldest first. */
  monthly: {
    month: string;
    sessions: number;
    grossMinor: number;
    therapistShareMinor: number;
  }[];
}

/** SQL for the month a session belongs to, as `YYYY-MM`. */
const SESSION_MONTH = sql<string>`to_char(date_trunc('month', ${therapySessions.scheduledAt} AT TIME ZONE 'UTC'), 'YYYY-MM')`;

/**
 * What a therapist has actually earned, derived from the sessions they
 * completed and the revenue share in `lib/constants.ts`.
 *
 * This is an earnings statement, NOT a payout record: there is no payouts table,
 * so nothing here says any of it has been disbursed. Callers must not present it
 * as paid.
 */
export async function getTherapistEarnings(
  therapistId: string
): Promise<TherapistEarnings> {
  const empty: TherapistEarnings = {
    grossMinor: 0,
    therapistShareMinor: 0,
    platformShareMinor: 0,
    completedSessions: 0,
    unpricedSessions: 0,
    monthly: monthWindow(6).map((m) => ({
      month: m.label,
      sessions: 0,
      grossMinor: 0,
      therapistShareMinor: 0,
    })),
  };

  if (!isUuid(therapistId)) return empty;

  return withCurrentUser(async (tx) => {
    const completed = and(
      eq(therapySessions.therapistId, therapistId),
      eq(therapySessions.status, "completed")
    );

    const [totals] = await tx
      .select({
        grossMinor: SESSION_VALUE_MINOR,
        completedSessions: sql<number>`(count(*))::int`,
        unpricedSessions: sql<number>`(count(*) FILTER (WHERE ${therapySessions.amount} IS NULL))::int`,
      })
      .from(therapySessions)
      .where(completed);

    const buckets = await tx
      .select({
        month: SESSION_MONTH,
        grossMinor: SESSION_VALUE_MINOR,
        sessions: sql<number>`(count(*))::int`,
      })
      .from(therapySessions)
      .where(completed)
      .groupBy(SESSION_MONTH);

    const byMonth = new Map(
      buckets.map((b) => [b.month, { gross: toMinor(b.grossMinor), sessions: b.sessions }])
    );

    const grossMinor = toMinor(totals.grossMinor);
    // Rounded once, here, so the therapist's share and the platform's always sum
    // back to the gross rather than drifting apart by a shilling per row.
    const therapistShareMinor = Math.round(grossMinor * THERAPIST_REVENUE_SHARE);

    return {
      grossMinor,
      therapistShareMinor,
      platformShareMinor: grossMinor - therapistShareMinor,
      completedSessions: totals.completedSessions,
      unpricedSessions: totals.unpricedSessions,
      monthly: monthWindow(6).map((m) => {
        const bucket = byMonth.get(m.key);
        const gross = bucket?.gross ?? 0;
        return {
          month: m.label,
          sessions: bucket?.sessions ?? 0,
          grossMinor: gross,
          therapistShareMinor: Math.round(gross * THERAPIST_REVENUE_SHARE),
        };
      }),
    };
  });
}

export interface TherapistLeaderboardRow {
  id: string;
  name: string;
  rating: number | null;
  completedSessions: number;
  totalSessions: number;
  /** The therapist's earned share, in minor units. */
  earningsMinor: number;
}

/**
 * Therapists ranked by completed session volume, with real earnings alongside.
 *
 * Aggregated in one grouped query rather than a per-therapist call, which at ten
 * rows would be eleven round-trips against a database already paying ~230ms for
 * the RLS transaction setup.
 */
export async function listTherapistLeaderboard(
  limit = 10
): Promise<TherapistLeaderboardRow[]> {
  return withCurrentUser(async (tx) => {
    const rows = await tx
      .select({
        id: therapists.id,
        name: therapists.name,
        rating: therapists.rating,
        totalSessions: sql<number>`(count(${therapySessions.id}))::int`,
        completedSessions: sql<number>`(count(*) FILTER (WHERE ${therapySessions.status} = 'completed'))::int`,
        grossMinor: sql<string>`(coalesce(sum(${therapySessions.amount}) FILTER (
          WHERE ${therapySessions.status} = 'completed'
        ), 0) * 100)::text`,
      })
      .from(therapists)
      .leftJoin(therapySessions, eq(therapySessions.therapistId, therapists.id))
      .groupBy(therapists.id, therapists.name, therapists.rating)
      .orderBy(
        sql`(count(*) FILTER (WHERE ${therapySessions.status} = 'completed')) DESC`
      )
      .limit(limit);

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      rating: r.rating,
      totalSessions: r.totalSessions,
      completedSessions: r.completedSessions,
      earningsMinor: Math.round(toMinor(r.grossMinor) * THERAPIST_REVENUE_SHARE),
    }));
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
