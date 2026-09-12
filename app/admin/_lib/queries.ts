import { and, asc, desc, eq, inArray, or, sql } from "drizzle-orm";

import { withCurrentUser } from "@/lib/db/session";
import { PLAN_CURRENCY, THERAPIST_REVENUE_SHARE } from "@/lib/constants";
import {
  missingRequiredTypes,
  type KycDocReview,
  type KycDocumentType,
  type KycStatus,
} from "@/lib/kyc";
import type { LicenceVerification } from "@/lib/validation";
import {
  clinicalNotes,
  kycDocuments,
  kycReviewEvents,
  messages,
  moodLogs,
  payments,
  profiles,
  promoRedemptions,
  promos,
  riskAlerts,
  sessionFeedback,
  therapySessions,
  therapistLicences,
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
 * The quality signals that genuinely exist for one session.
 *
 * ## What is NOT here, and why
 *
 * No latency, no packet loss, no reconnection count, no "quality score". The
 * page this feeds used to show all four, plus a 52-bar connection timeline
 * generated with `Math.random()` on every render. None of it could have been
 * real: video runs on the Echo backend, which relays call setup and never sees
 * media, and `therapy_sessions` has no telemetry columns — the vestigial
 * `patient_tracks` / `therapist_tracks` jsonb from the retired Cloudflare SFU
 * are the closest thing and hold nothing useful.
 *
 * What does exist is the client's own rating, which is the signal clients were
 * actually told about: `/reviews` says session feedback "goes to your therapist
 * and to the team that reviews session quality". Admins are admitted to
 * `session_feedback` by policy for exactly that purpose.
 *
 * Returns `null` when the session does not exist or RLS hides it, so the page
 * can 404 rather than render an empty shell.
 */
export async function getSessionQuality(sessionId: string): Promise<{
  id: string;
  status: string;
  sessionType: string | null;
  scheduledAt: Date;
  feedback: { rating: number; comment: string | null; createdAt: Date; author: string }[];
} | null> {
  if (!isUuid(sessionId)) return null;

  return withCurrentUser(async (tx) => {
    const [session] = await tx
      .select({
        id: therapySessions.id,
        status: therapySessions.status,
        sessionType: therapySessions.sessionType,
        scheduledAt: therapySessions.scheduledAt,
      })
      .from(therapySessions)
      .where(eq(therapySessions.id, sessionId))
      .limit(1);

    if (!session) return null;

    const feedback = await tx
      .select({
        rating: sessionFeedback.rating,
        comment: sessionFeedback.comment,
        createdAt: sessionFeedback.createdAt,
        author: profiles.name,
      })
      .from(sessionFeedback)
      .leftJoin(profiles, eq(profiles.userId, sessionFeedback.userId))
      .where(eq(sessionFeedback.sessionId, sessionId))
      .orderBy(desc(sessionFeedback.createdAt))
      .limit(20);

    return {
      ...session,
      feedback: feedback.map((f) => ({ ...f, author: f.author ?? "Former client" })),
    };
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
        /*
         * `promos.code` is written out, not interpolated — and this one failed
         * in the dangerous direction.
         *
         * `${promos.code}` rendered as a bare `"code"`, which inside
         * `FROM promo_redemptions r` resolved to `r.code`. The predicate became
         * `r.code = r.code`: true for every non-null row, so each promo
         * reported the redemption count of EVERY promo combined. The other two
         * instances of this mistake (`lib/directory.ts` and `docCount` below)
         * collapsed to always-false and under-reported; this one over-reported.
         *
         * Display only, and worth being precise about: the `redemption_limit`
         * is NOT enforced from here. `app/api/promo/route.ts` runs its own
         * correctly-bound count (`eq(promoRedemptions.code, normalised)`)
         * before accepting a code, so no campaign was cut short. What this
         * broke is the admin's view of which codes are being used — every
         * promo showed the same total, so a dead code and a popular one were
         * indistinguishable.
         */
        redemptions: sql<number>`(
          SELECT count(*)::int FROM promo_redemptions r
          WHERE r.code = promos.code AND r.payment_reference IS NOT NULL
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

/** One entry in the platform-wide credentialing trail. */
export interface PlatformAuditRow {
  id: string;
  actorId: string;
  /** Resolved from `profiles`; null when the actor has no profile row. */
  actorName: string | null;
  action: string;
  note: string | null;
  /** Who the decision was about. */
  subjectTherapistId: string;
  subjectName: string;
  documentId: string | null;
  documentType: KycDocumentType | null;
  createdAt: Date;
}

/**
 * Every credentialing decision on the platform, newest first.
 *
 * This is the ONLY genuinely immutable, append-only trail in the database:
 * `echo_app` holds SELECT and INSERT on `kyc_review_events` and nothing else,
 * UPDATE and DELETE are revoked at the grant level, and no policy exists for
 * them. Verified by `scripts/verify-kyc-security.ts`.
 *
 * It replaces ten hardcoded rows on the compliance page that described a user
 * suspension, a refund, a payout approval and a data export — none of which had
 * happened, and two of which describe features that do not exist. The page
 * called itself an "immutable log of all significant platform actions" while
 * containing no actions at all.
 *
 * SCOPE, which the page must state rather than imply: credentialing only.
 * Sign-ins are Auth0's. Payments are in `payments`. Admin configuration changes
 * are not recorded anywhere — if that matters for compliance, it needs building,
 * and a page that fabricated them was worse than one that admits the gap.
 */
export async function listPlatformAuditTrail(limit = 200): Promise<PlatformAuditRow[]> {
  return withCurrentUser(async (tx) => {
    return tx
      .select({
        id: kycReviewEvents.id,
        actorId: kycReviewEvents.actorId,
        actorName: profiles.name,
        action: kycReviewEvents.action,
        note: kycReviewEvents.note,
        subjectTherapistId: kycReviewEvents.therapistId,
        subjectName: therapists.name,
        documentId: kycReviewEvents.documentId,
        documentType: kycDocuments.docType,
        createdAt: kycReviewEvents.createdAt,
      })
      .from(kycReviewEvents)
      .innerJoin(therapists, eq(therapists.id, kycReviewEvents.therapistId))
      .leftJoin(profiles, eq(profiles.userId, kycReviewEvents.actorId))
      .leftJoin(kycDocuments, eq(kycDocuments.id, kycReviewEvents.documentId))
      .orderBy(desc(kycReviewEvents.createdAt))
      .limit(limit);
  });
}

/** One real, recorded event on a client's account. */
export interface ClientActivityEntry {
  id: string;
  kind: "payment" | "session";
  /** What happened, in words, built from stored values only. */
  description: string;
  /** Payment status or session status — the stored value, not a guess. */
  status: string;
  at: Date;
}

/**
 * A client's account activity, assembled from the two tables that actually
 * record it: `payments` and `therapy_sessions`.
 *
 * WHY THIS SHAPE. The admin audit-log page previously rendered seven invented
 * rows per client — logins with fabricated IP addresses, a "monthly
 * subscription renewed" (there are no subscriptions; plans are one-time
 * bundles), and an "AI risk flag raised (mood drop)" attributed to a named
 * client who had never been flagged. On a mental-health platform a fabricated
 * clinical risk event in someone's record is not a placeholder; it is something
 * an administrator could act on.
 *
 * So this returns only what is stored. It is a narrower feature than the mock
 * implied, and that is the correction: sign-in history genuinely does not exist
 * in this database — Auth0 holds it — and no amount of UI can change that.
 *
 * Both reads share one transaction so the merged timeline cannot straddle a
 * write, and so the page pays the RLS setup round-trip once rather than twice.
 */
export async function getClientActivity(
  userId: string,
  limit = 50
): Promise<ClientActivityEntry[]> {
  return withCurrentUser(async (tx) => {
    const paymentRows = await tx
      .select({
        id: payments.id,
        reference: payments.reference,
        plan: payments.plan,
        amountMinor: payments.amountMinor,
        currency: payments.currency,
        status: payments.status,
        createdAt: payments.createdAt,
      })
      .from(payments)
      .where(eq(payments.userId, userId))
      .orderBy(desc(payments.createdAt))
      .limit(limit);

    const sessionRows = await tx
      .select({
        id: therapySessions.id,
        scheduledAt: therapySessions.scheduledAt,
        status: therapySessions.status,
        sessionType: therapySessions.sessionType,
        therapistName: therapists.name,
      })
      .from(therapySessions)
      .leftJoin(therapists, eq(therapists.id, therapySessions.therapistId))
      .where(eq(therapySessions.patientId, userId))
      .orderBy(desc(therapySessions.scheduledAt))
      .limit(limit);

    const entries: ClientActivityEntry[] = [
      ...paymentRows.map((p) => ({
        id: `payment-${p.id}`,
        kind: "payment" as const,
        // Minor units divided here rather than in the page, so the one place
        // that knows these are cents is the one place that converts them.
        description: `${p.plan} plan — ${p.currency} ${(p.amountMinor / 100).toLocaleString()} (ref ${p.reference})`,
        status: p.status,
        at: p.createdAt,
      })),
      ...sessionRows.map((s) => ({
        id: `session-${s.id}`,
        kind: "session" as const,
        description: s.therapistName
          ? `${s.sessionType ?? "Session"} with ${s.therapistName}`
          : `${s.sessionType ?? "Session"} (therapist record removed)`,
        status: s.status,
        at: s.scheduledAt,
      })),
    ];

    // Merged after the fact rather than in SQL: a UNION across two tables with
    // different columns would need casts on both sides for no gain at these
    // row counts, and this keeps each side's projection readable.
    return entries.sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, limit);
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

// ─── Therapist KYC review ────────────────────────────────────────────────────

/**
 * A KYC document WITHOUT its bytes.
 *
 * `kyc_documents.content` is `bytea`. Selecting it into a list query would
 * serialise every uploaded file into the RSC payload of the page — several MB of
 * identity documents shipped to the browser to render a filename. The bytes are
 * served only by `/api/kyc/[id]`, one document at a time, as an attachment.
 * Every query in this section selects columns explicitly for that reason; do not
 * replace them with `select()`.
 */
export interface KycDocumentSummary {
  id: string;
  $id: string;
  docType: KycDocumentType;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: Date;
  uploadedBy: string;
  reviewStatus: KycDocReview;
  reviewNote: string | null;
  reviewedAt: Date | null;
  reviewedBy: string | null;
}

/** One entry from the append-only `kyc_review_events` trail. */
export interface KycReviewEventRow {
  id: string;
  actorId: string;
  /**
   * The actor's profile name when one exists. Null for `system` and for admins
   * who have no `profiles` row — the raw Auth0 sub is rendered in that case
   * rather than a placeholder, because "who approved this clinician" must not be
   * answered with a guess.
   */
  actorName: string | null;
  action: string;
  note: string | null;
  documentId: string | null;
  /** Filename of the document the event concerns, when it concerns one. */
  documentFilename: string | null;
  documentType: KycDocumentType | null;
  createdAt: Date;
}

/**
 * One `therapist_licences` row, for the reviewer.
 *
 * Every column is selected explicitly — including `licence_number`, which the
 * reviewer needs because checking it against the issuing body's own register is
 * the entire job. (Unlike `kyc_documents.content`, there is no `bytea` here, so
 * the reason for naming columns is precision rather than payload size.)
 */
export interface TherapistLicenceRow {
  id: string;
  $id: string;
  jurisdiction: string;
  subdivision: string | null;
  regulator: string | null;
  licenceNumber: string | null;
  verification: LicenceVerification;
  status: KycStatus;
  /** `YYYY-MM-DD`. A Postgres `date`, so it has no time and no zone. */
  expiresAt: string | null;
  submittedAt: Date | null;
  reviewedAt: Date | null;
  reviewedBy: string | null;
  reviewNote: string | null;
}

function selectLicenceColumns() {
  return {
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
    reviewedBy: therapistLicences.reviewedBy,
    reviewNote: therapistLicences.reviewNote,
  } as const;
}

export interface TherapistKycReview {
  therapist: Doc<TherapistRow>;
  documents: KycDocumentSummary[];
  events: KycReviewEventRow[];
  /**
   * The jurisdictions this clinician claims, in the order they claimed them.
   *
   * Read in the SAME transaction as the documents on purpose: a licence
   * approved between two separate reads would render a page whose licence list
   * disagreed with its own decision trail.
   */
  licences: TherapistLicenceRow[];
  /**
   * Required document types with no ACCEPTED document on file.
   *
   * Non-empty means the server will refuse an approval. Computed from
   * `review_status = 'accepted'`, not from "a file exists": an uploaded but
   * unreviewed document is exactly the state this whole workflow exists to stop
   * being mistaken for a completed check.
   */
  missingRequired: readonly KycDocumentType[];
}

/**
 * Everything the credentials screen needs, in ONE transaction.
 *
 * Three separate `withCurrentUser` calls would mean three round-trips of RLS
 * setup (~230ms each against this Azure instance, per the note in
 * `lib/db/session.ts`) before any data moves. The three reads are all
 * admin-scoped and consistent with each other only if they share a snapshot
 * anyway — a document accepted between two of them would render a page whose
 * gap list disagreed with its own document list.
 */
export async function getTherapistKycReview(
  therapistId: string
): Promise<TherapistKycReview | null> {
  if (!isUuid(therapistId)) return null;

  return withCurrentUser(async (tx) => {
    const [therapist] = await tx
      .select()
      .from(therapists)
      .where(eq(therapists.id, therapistId))
      .limit(1);

    if (!therapist) return null;

    const documents = await tx
      .select({
        id: kycDocuments.id,
        docType: kycDocuments.docType,
        filename: kycDocuments.filename,
        mimeType: kycDocuments.mimeType,
        sizeBytes: kycDocuments.sizeBytes,
        uploadedAt: kycDocuments.uploadedAt,
        uploadedBy: kycDocuments.uploadedBy,
        reviewStatus: kycDocuments.reviewStatus,
        reviewNote: kycDocuments.reviewNote,
        reviewedAt: kycDocuments.reviewedAt,
        reviewedBy: kycDocuments.reviewedBy,
      })
      .from(kycDocuments)
      .where(eq(kycDocuments.therapistId, therapistId))
      .orderBy(desc(kycDocuments.uploadedAt));

    /*
     * The trail is read oldest-LAST (newest first) because the question it
     * answers most often is "what was decided most recently, and by whom".
     * `profiles` resolves the actor's name; the join is a LEFT join so an event
     * by 'system' or by an admin without a profile still renders.
     */
    const events = await tx
      .select({
        id: kycReviewEvents.id,
        actorId: kycReviewEvents.actorId,
        actorName: profiles.name,
        action: kycReviewEvents.action,
        note: kycReviewEvents.note,
        documentId: kycReviewEvents.documentId,
        documentFilename: kycDocuments.filename,
        documentType: kycDocuments.docType,
        createdAt: kycReviewEvents.createdAt,
      })
      .from(kycReviewEvents)
      .leftJoin(profiles, eq(profiles.userId, kycReviewEvents.actorId))
      .leftJoin(kycDocuments, eq(kycDocuments.id, kycReviewEvents.documentId))
      .where(eq(kycReviewEvents.therapistId, therapistId))
      .orderBy(desc(kycReviewEvents.createdAt))
      .limit(200);

    const licences = await tx
      .select(selectLicenceColumns())
      .from(therapistLicences)
      .where(eq(therapistLicences.therapistId, therapistId))
      .orderBy(asc(therapistLicences.createdAt));

    const acceptedTypes = documents
      .filter((d) => d.reviewStatus === "accepted")
      .map((d) => d.docType);

    return {
      therapist: toDoc(therapist),
      documents: documents.map((d) => ({ ...d, $id: d.id })),
      events,
      licences: licences.map((l) => ({ ...l, $id: l.id })),
      missingRequired: missingRequiredTypes(acceptedTypes),
    };
  });
}

/**
 * Licences awaiting a decision, across every therapist, longest-waiting first.
 *
 * A SEPARATE query from `listVerificationQueue`, which filters
 * `therapists.kyc_status IN ('pending','incomplete')`. An already-verified
 * clinician who later claims a second jurisdiction is not in that set at all,
 * so their UK licence would sit `pending` forever with nothing on any screen
 * pointing at it — the same class of invisibility as an event nobody emits.
 *
 * `therapist_licences_select` is `USING (true)` for the public directory, so
 * RLS narrows nothing here; the admin gate is the `labels.includes("admin")`
 * check the calling page performs before this runs.
 */
export interface PendingLicenceRow extends TherapistLicenceRow {
  therapistId: string;
  therapistName: string;
  /** The clinician's own application status — an unverified applicant's licence
   *  is reviewed alongside their KYC, a verified one's stands alone. */
  therapistKycStatus: KycStatus;
}

export async function listPendingLicenceReviews(
  limit = 100
): Promise<PendingLicenceRow[]> {
  return withCurrentUser(async (tx) => {
    const rows = await tx
      .select({
        ...selectLicenceColumns(),
        therapistId: therapistLicences.therapistId,
        therapistName: therapists.name,
        therapistKycStatus: therapists.kycStatus,
      })
      .from(therapistLicences)
      .innerJoin(therapists, eq(therapists.id, therapistLicences.therapistId))
      .where(eq(therapistLicences.status, "pending"))
      .orderBy(
        sql`${therapistLicences.submittedAt} ASC NULLS LAST`,
        asc(therapistLicences.createdAt)
      )
      .limit(limit);

    return rows.map((r) => ({ ...r, $id: r.id }));
  });
}

export interface VerificationQueueRow {
  id: string;
  $id: string;
  name: string;
  experience: number;
  specialties: string[] | null;
  licenseNumber: string | null;
  kycStatus: KycStatus;
  /** Null when the applicant has never submitted. The queue sorts on this. */
  kycSubmittedAt: Date | null;
  kycReviewedAt: Date | null;
  kycReviewNote: string | null;
  createdAt: Date;
  updatedAt: Date;
  documentCount: number;
  /** Documents nobody has opened a decision on yet. */
  pendingDocumentCount: number;
  acceptedDocumentCount: number;
  rejectedDocumentCount: number;
  /** Required types with no accepted document — the gap the server enforces. */
  missingRequired: readonly KycDocumentType[];
}

/**
 * The verification queue, longest-waiting first.
 *
 * Ordered by `kyc_submitted_at ASC NULLS LAST`, so the applicant who has waited
 * longest is at the top and applicants who have not submitted anything sink to
 * the bottom — they are not waiting on the reviewer, the reviewer is waiting on
 * them. The previous version ordered by nothing at all and displayed
 * `updated_at` as "Submitted", which is a different fact wearing that label:
 * any profile edit moved it.
 *
 * Counts come from correlated subqueries rather than a grouped join so that a
 * therapist with zero documents still returns a row with zeroes, and so no
 * GROUP BY has to enumerate every selected column.
 */
export async function listVerificationQueue(
  limit = 100
): Promise<VerificationQueueRow[]> {
  return withCurrentUser(async (tx) => {
    /*
     * The `::kyc_doc_review` cast is belt-and-braces. postgres.js infers OID 0
     * (unspecified) for a JS string, so Postgres would resolve the parameter to
     * the enum from context anyway — which is why `eq(payments.status, …)`
     * elsewhere in this file works without one. Stated explicitly here because
     * the subquery is raw SQL, where nothing else records what type the
     * comparison is against.
     */
    /*
     * ## ⚠️ `therapists.id` is written out, not interpolated
     *
     * `WHERE d.therapist_id = ${therapists.id}` renders that column reference
     * **unqualified**, as a bare `"id"`, and this subquery's FROM is
     * `kyc_documents d` — so `"id"` resolved to `d.id` and the predicate became
     * `d.therapist_id = d.id`, which is false for every row. All four counts
     * below were therefore 0 for every applicant on the verification queue: an
     * admin reviewing a complete application saw "0 documents".
     *
     * Silent, because 0 is a legitimate count. Proven against the live
     * database: the same subquery shape returns `{}` unqualified and
     * `{kenya}` qualified. The identical mistake was in `lib/directory.ts`
     * (see the long note there, where it published the wrong professional
     * title) and in the promo redemption count above, where the inner table
     * also has the correlated column name and the predicate collapsed to
     * `r.code = r.code` — always TRUE, inflating every promo's count to the
     * platform-wide total.
     */
    const docCount = (status?: KycDocReview) => sql<number>`(
      SELECT count(*)::int FROM kyc_documents d
      WHERE d.therapist_id = therapists.id
      ${status ? sql`AND d.review_status = ${status}::kyc_doc_review` : sql.empty()}
    )`;

    const rows = await tx
      .select({
        id: therapists.id,
        name: therapists.name,
        experience: therapists.experience,
        specialties: therapists.specialties,
        licenseNumber: therapists.licenseNumber,
        kycStatus: therapists.kycStatus,
        kycSubmittedAt: therapists.kycSubmittedAt,
        kycReviewedAt: therapists.kycReviewedAt,
        kycReviewNote: therapists.kycReviewNote,
        createdAt: therapists.createdAt,
        updatedAt: therapists.updatedAt,
        documentCount: docCount(),
        pendingDocumentCount: docCount("pending"),
        acceptedDocumentCount: docCount("accepted"),
        rejectedDocumentCount: docCount("rejected"),
        /*
         * Cast to text[] rather than leaving it as the `kyc_document_type[]`
         * enum array: postgres.js parses arrays by element type OID, and a
         * custom enum's OID is not in its type table.
         */
        /* Qualified for the same reason as `docCount` above. */
        acceptedTypes: sql<string[]>`(
          SELECT coalesce(array_agg(DISTINCT d.doc_type::text), ARRAY[]::text[])
          FROM kyc_documents d
          WHERE d.therapist_id = therapists.id AND d.review_status = 'accepted'
        )`,
      })
      .from(therapists)
      .where(inArray(therapists.kycStatus, ["pending", "incomplete"]))
      .orderBy(sql`${therapists.kycSubmittedAt} ASC NULLS LAST`, asc(therapists.createdAt))
      .limit(limit);

    return rows.map(({ acceptedTypes, ...r }) => ({
      ...r,
      $id: r.id,
      missingRequired: missingRequiredTypes(acceptedTypes ?? []),
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

// ─── Direct messages (protected clinical communication) ──────────────────────

/**
 * Reads over the `messages` table for the two admin transcript pages.
 *
 * `messages_select` (migration 0001) is
 * `sender_id = app_user_id() OR receiver_id = app_user_id() OR app_is_admin()`,
 * so an admin genuinely is admitted to every row — this is a deliberate schema
 * decision, not an accident these queries are exploiting. It is also the whole
 * of the control: there is no second gate, no consent flag, and (see below) no
 * record of the read. The pages built on this are written accordingly.
 *
 * NOT LOGGED. Nothing in this database records that an administrator opened a
 * conversation. `kyc_review_events` is append-only but covers credentialing
 * decisions only; there is no access-log table of any kind. Both pages say so on
 * screen. Do not add wording that implies otherwise without first adding the
 * table that would make it true.
 */

/** The transaction handle `withCurrentUser` hands to its callback. */
type Tx = Parameters<Parameters<typeof withCurrentUser>[0]>[0];

/**
 * Loaded data, or an explicit failure.
 *
 * WHY THIS EXISTS when every other query in this file simply throws and lets
 * Next render `app/error.tsx`: `messages` is currently empty. On an empty table
 * "the query returned no rows" and "the query never ran" paint the same blank
 * panel, and the reader cannot tell which one they are looking at. For a
 * clinical record those are opposite claims — "these two people have never
 * exchanged a message" is a finding someone may act on, "we could not read their
 * messages" is an outage that must never be mistaken for one. The union makes it
 * impossible for a caller to render them the same way.
 *
 * The underlying error is logged server-side and deliberately NOT carried in
 * this type, so no page can drift into printing driver errors at an operator.
 */
export type LoadResult<T> = { ok: true; data: T } | { ok: false };

/** One end of a message, resolved as far as the database actually allows. */
export interface MessageParticipant {
  /** The stored Auth0 sub. Always present — it is what the row holds. */
  id: string;
  /**
   * Display name, or null when the sub matches neither `profiles` nor
   * `therapists`. Null means UNKNOWN, and the pages render the raw sub rather
   * than a friendly placeholder: mis-attributing a line of a therapy transcript
   * to the wrong person is a far worse failure than showing an ugly identifier.
   */
  name: string | null;
  role: "client" | "therapist" | null;
}

export interface AdminMessageRow {
  id: string;
  /** Null for a direct message that belongs to no session. */
  sessionId: string | null;
  content: string;
  createdAt: Date;
  sender: MessageParticipant;
  receiver: MessageParticipant;
}

export interface MessageThread {
  messages: AdminMessageRow[];
  /** True when more messages exist than `limit` returned. Pages must disclose it. */
  truncated: boolean;
  /** The cap applied, so the page can name the number it is disclosing. */
  limit: number;
}

/** Cap for one client's whole direct-message history. */
export const CLIENT_MESSAGE_LIMIT = 200;

/**
 * Cap for a single session's transcript. Higher than the per-client cap because
 * it is scoped to one appointment; a 50-minute session that exceeds it would be
 * remarkable, and if one ever does the page says so rather than truncating
 * silently.
 */
export const SESSION_MESSAGE_LIMIT = 500;

/**
 * Resolve Auth0 subs to display names.
 *
 * A sub may appear in `therapists`, in `profiles`, in both (a clinician who also
 * holds a client account), or in neither. `therapists` is applied second and so
 * wins a tie: on a therapy transcript, the clinically meaningful label for that
 * person is the one saying they are a clinician.
 *
 * Unresolved subs are ABSENT from the map rather than defaulted — callers turn
 * that into `{ name: null }`, which the pages render as the raw sub.
 *
 * Two statements, not one join, because the two tables are independent lookups
 * over the same key set; and sequential rather than `Promise.all` because these
 * share a single transaction's connection.
 */
async function resolveParticipants(
  tx: Tx,
  subs: string[]
): Promise<Map<string, MessageParticipant>> {
  const resolved = new Map<string, MessageParticipant>();
  const unique = [...new Set(subs)].filter(Boolean);
  if (unique.length === 0) return resolved;

  const clientRows = await tx
    .select({ userId: profiles.userId, name: profiles.name })
    .from(profiles)
    .where(inArray(profiles.userId, unique));

  for (const row of clientRows) {
    resolved.set(row.userId, { id: row.userId, name: row.name, role: "client" });
  }

  const therapistRows = await tx
    .select({ userId: therapists.userId, name: therapists.name })
    .from(therapists)
    .where(inArray(therapists.userId, unique));

  for (const row of therapistRows) {
    resolved.set(row.userId, { id: row.userId, name: row.name, role: "therapist" });
  }

  return resolved;
}

/** Map lookup with the "unknown participant" fallback applied in one place. */
function participant(
  resolved: Map<string, MessageParticipant>,
  sub: string
): MessageParticipant {
  return resolved.get(sub) ?? { id: sub, name: null, role: null };
}

export interface ClientMessageThread extends MessageThread {
  /**
   * The client the page is about, resolved in the same transaction as the
   * messages. Carried here so the page needs no second identity query and has a
   * single failure mode — and so a subject with no `profiles` row still renders
   * (as their raw sub) instead of 404ing.
   */
  subject: MessageParticipant;
}

/**
 * One client's entire direct-message history, newest first.
 *
 * Matches on `sender_id` OR `receiver_id`, so the thread is complete in both
 * directions regardless of who wrote which line.
 *
 * `limit + 1` rows are fetched and the extra is discarded: that reports
 * truncation EXACTLY, where `rows.length === limit` cannot tell "there are more"
 * from "there are precisely this many", and a `count(*)` would cost a round trip
 * to learn the same thing.
 *
 * The `id` tiebreak on the sort is not cosmetic. Two messages sharing a
 * `created_at` would otherwise come back in whatever order the plan produced,
 * so the same transcript could render in two different orders on two reloads.
 */
export async function listClientMessages(
  userId: string,
  limit = CLIENT_MESSAGE_LIMIT
): Promise<LoadResult<ClientMessageThread>> {
  try {
    const data = await withCurrentUser(async (tx) => {
      const rows = await tx
        .select()
        .from(messages)
        .where(
          or(eq(messages.senderId, userId), eq(messages.receiverId, userId))
        )
        .orderBy(desc(messages.createdAt), desc(messages.id))
        .limit(limit + 1);

      const truncated = rows.length > limit;
      const page = truncated ? rows.slice(0, limit) : rows;

      const resolved = await resolveParticipants(tx, [
        userId,
        ...page.flatMap((r) => [r.senderId, r.receiverId]),
      ]);

      return {
        subject: participant(resolved, userId),
        messages: page.map((r) => ({
          id: r.id,
          sessionId: r.sessionId,
          content: r.content,
          createdAt: r.createdAt,
          sender: participant(resolved, r.senderId),
          receiver: participant(resolved, r.receiverId),
        })),
        truncated,
        limit,
      };
    });

    return { ok: true, data };
  } catch (err) {
    console.error("[admin] listClientMessages failed", err);
    return { ok: false };
  }
}

/** The appointment a transcript belongs to. */
export interface SessionConversationSubject {
  id: string;
  scheduledAt: Date;
  status: string;
  sessionType: string;
  /** The booked patient, keyed by Auth0 sub. */
  patient: MessageParticipant;
  /**
   * The booked clinician. `therapy_sessions.therapist_id` is a `therapists.id`
   * uuid, NOT an Auth0 sub — a different id space from `messages.sender_id`.
   * Both are carried so the page never has to guess which one it is holding.
   */
  therapist: { therapistId: string; userId: string | null; name: string | null };
}

export interface SessionConversation {
  /** Null when no `therapy_sessions` row has this id. A distinct state from an
   *  existing session with an empty transcript, and the page renders it as one. */
  session: SessionConversationSubject | null;
  thread: MessageThread;
}

/**
 * One session's transcript, oldest first, with the appointment it belongs to.
 *
 * Session lookup, transcript and name resolution share ONE transaction: three
 * `withCurrentUser` calls would pay the RLS setup round-trip three times (~230ms
 * each against this instance, per `lib/db/session.ts`) and could observe the
 * session and its messages at two different snapshots.
 *
 * Ordered ASC because this is a transcript and it is read from the top. The cap
 * therefore drops the END of an over-long conversation, which is why the page
 * must show the truncation notice at the bottom of the list rather than the top.
 */
export async function getSessionConversation(
  sessionId: string,
  limit = SESSION_MESSAGE_LIMIT
): Promise<LoadResult<SessionConversation>> {
  const empty: MessageThread = { messages: [], truncated: false, limit };

  // Postgres raises `invalid input syntax for type uuid` on a malformed id.
  // A bad id is "no such session", not a failed load — say so without querying.
  if (!isUuid(sessionId)) return { ok: true, data: { session: null, thread: empty } };

  try {
    const data = await withCurrentUser(async (tx) => {
      const [sess] = await tx
        .select({
          id: therapySessions.id,
          patientId: therapySessions.patientId,
          scheduledAt: therapySessions.scheduledAt,
          status: therapySessions.status,
          sessionType: therapySessions.sessionType,
          therapistId: therapySessions.therapistId,
          therapistUserId: therapists.userId,
          therapistName: therapists.name,
        })
        .from(therapySessions)
        .leftJoin(therapists, eq(therapists.id, therapySessions.therapistId))
        .where(eq(therapySessions.id, sessionId))
        .limit(1);

      // No session means no transcript to look for: `messages.session_id` is a
      // FK with ON DELETE CASCADE, so orphaned rows cannot exist.
      if (!sess) return { session: null, thread: empty };

      const rows = await tx
        .select()
        .from(messages)
        .where(eq(messages.sessionId, sessionId))
        .orderBy(asc(messages.createdAt), asc(messages.id))
        .limit(limit + 1);

      const truncated = rows.length > limit;
      const page = truncated ? rows.slice(0, limit) : rows;

      const resolved = await resolveParticipants(tx, [
        sess.patientId,
        ...page.flatMap((r) => [r.senderId, r.receiverId]),
      ]);

      return {
        session: {
          id: sess.id,
          scheduledAt: sess.scheduledAt,
          status: sess.status,
          sessionType: sess.sessionType,
          patient: participant(resolved, sess.patientId),
          therapist: {
            therapistId: sess.therapistId,
            userId: sess.therapistUserId,
            name: sess.therapistName,
          },
        },
        thread: {
          messages: page.map((r) => ({
            id: r.id,
            sessionId: r.sessionId,
            content: r.content,
            createdAt: r.createdAt,
            sender: participant(resolved, r.senderId),
            receiver: participant(resolved, r.receiverId),
          })),
          truncated,
          limit,
        },
      };
    });

    return { ok: true, data };
  } catch (err) {
    console.error("[admin] getSessionConversation failed", err);
    return { ok: false };
  }
}

// ─── Clinical risk ───────────────────────────────────────────────────────────

export type RiskAlertRow = typeof riskAlerts.$inferSelect;
export type MoodLogRow = typeof moodLogs.$inferSelect;

/**
 * Every risk alert filed against one patient.
 *
 * `patientId` is an Auth0 `sub`, matching `profiles.userId` — NOT a profile row
 * id. An earlier version of the alert list compared it against `$id` and so
 * resolved every alert to "Unknown Patient"; the same mistake here would
 * silently return an empty history for a client who has alerts.
 */
export async function listRiskAlertsForPatient(
  userId: string,
  limit = 50
): Promise<Doc<RiskAlertRow>[]> {
  return withCurrentUser(async (tx) => {
    const rows = await tx
      .select()
      .from(riskAlerts)
      .where(eq(riskAlerts.patientId, userId))
      .orderBy(desc(riskAlerts.createdAt))
      .limit(limit);

    return toDocs(rows);
  });
}

/**
 * A patient's recent mood logs.
 *
 * `mood_logs_select` admits the owner, admins, and a therapist who treats the
 * patient, so an admin caller sees the full history. These are self-reported
 * scores the client entered themselves — the one genuine longitudinal signal
 * this platform holds about how someone is doing.
 */
export async function listMoodLogsForUser(
  userId: string,
  limit = 30
): Promise<Doc<MoodLogRow>[]> {
  return withCurrentUser(async (tx) => {
    const rows = await tx
      .select()
      .from(moodLogs)
      .where(eq(moodLogs.userId, userId))
      .orderBy(desc(moodLogs.createdAt))
      .limit(limit);

    return toDocs(rows);
  });
}

/**
 * Count of unresolved risk alerts, for the sidebar badge.
 *
 * Returns a number the caller can trust to be real. The badge it feeds
 * previously rendered a hardcoded `5` on every admin page — see AdminSidebar.
 */
export async function countUnresolvedRiskAlerts(): Promise<number> {
  return withCurrentUser(async (tx) => {
    const [row] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(riskAlerts)
      .where(eq(riskAlerts.resolved, false));

    return row?.n ?? 0;
  });
}
