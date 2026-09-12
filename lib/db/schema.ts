import {
  date,
  pgTable,
  pgEnum,
  uuid,
  text,
  varchar,
  integer,
  smallint,
  real,
  boolean,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
  customType,
} from "drizzle-orm/pg-core";

/** Drizzle has no built-in `bytea`; this maps it to a Node Buffer. */
const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});

/**
 * Postgres schema, ported from the 15 Appwrite collections.
 *
 * Conventions and deliberate departures from the Appwrite original:
 *
 *  • `id uuid` replaces Appwrite's `$id`. The one exception is `promos`, whose
 *    document id WAS the promo code — that becomes a natural text primary key.
 *  • User identifiers are `text`, never uuid: they hold Auth0 `sub` values
 *    (`auth0|68f…`, `google-oauth2|…`). Appwrite declared these varchar(36),
 *    which is already too short for some Auth0 subs.
 *  • Every `createdAt` was `varchar(32)` holding an ISO-8601 string, compared
 *    lexicographically for range queries. They are `timestamptz` here; nothing
 *    was enforcing the string format and the comparisons only worked by luck.
 *  • Fields that held JSON inside a varchar (goal milestones, WebRTC track
 *    lists) are `jsonb`.
 *  • Appwrite declared indexes on only 6 of 15 collections, while querying
 *    almost all of them by foreign key. Every FK lookup is indexed here.
 *
 * `therapistId` vs user id: `therapist_id` columns hold a `therapists.id` row
 * reference, NOT a user id. Resolve to a person via `therapists.user_id`. This
 * distinction was implicit and frequently gotten wrong in the Appwrite version;
 * real foreign keys now make it explicit.
 */

// ─── Enums ───────────────────────────────────────────────────────────────────

/**
 * How a licence was checked, recorded per licence by the reviewer.
 *
 * Stored rather than derived from `lib/licensing.ts` at display time, so the
 * claim made to a client is the claim the reviewer actually verified — if the
 * requirements file is later corrected, history does not silently change.
 */
export const licenceVerificationEnum = pgEnum("licence_verification", [
  "named_regulator",
  "sub_national",
  "case_by_case",
]);

export const kycStatusEnum = pgEnum("kyc_status", [
  "incomplete",
  "pending",
  "verified",
  "rejected",
]);

/**
 * What an applicant says an uploaded document is (migration 0013).
 *
 * Kept short on purpose: a long list invites uploading something adjacent to
 * what was asked for. `other` is never required and never satisfies a
 * requirement — see `lib/kyc.ts` for which types are mandatory.
 */
export const kycDocumentTypeEnum = pgEnum("kyc_document_type", [
  "government_id",
  "professional_license",
  "practising_certificate",
  "qualification",
  "insurance",
  "other",
]);

/**
 * Per-document decision, distinct from the therapist's overall `kycStatus`.
 * Lets a reviewer accept four documents and reject one with a reason, rather
 * than making the whole application all-or-nothing.
 */
export const kycDocReviewEnum = pgEnum("kyc_doc_review", [
  "pending",
  "accepted",
  "rejected",
]);

export const sessionStatusEnum = pgEnum("session_status", [
  "pending",
  "confirmed",
  "completed",
  "cancelled",
]);

export const goalAssignedByEnum = pgEnum("goal_assigned_by", ["self", "therapist"]);

/**
 * Appwrite had three disagreeing definitions of this. The setup script said
 * `session|message|risk`, the reader component said the same, and the actual
 * writer used `info|success|warning|alert` — only `info` and `success` were
 * ever produced. The writer wins; the reader's union was dead code.
 */
export const notificationTypeEnum = pgEnum("notification_type", [
  "info",
  "success",
  "warning",
  "alert",
]);

export const clinicalNoteTypeEnum = pgEnum("clinical_note_type", ["soap", "freeform"]);

export const chatRoleEnum = pgEnum("chat_role", ["user", "bot", "admin", "system"]);

export const severityEnum = pgEnum("severity", ["low", "medium", "high", "critical"]);

export const riskAlertTypeEnum = pgEnum("risk_alert_type", [
  "crisis",
  "mood",
  "engagement",
  "flag",
]);

/**
 * What a reviewer concluded about a risk alert (migration 0017).
 *
 * `open` is the default so an unreviewed alert can never be mistaken for a
 * judged one.
 */
export const riskAlertDispositionEnum = pgEnum("risk_alert_disposition", [
  "open",
  "actioned",
  "false_positive",
  "duplicate",
]);

// ─── Therapists ──────────────────────────────────────────────────────────────

/**
 * Declared before `profiles` because `profiles.therapist_id` references it.
 * Appwrite had NO index on `user_id` despite it being the hottest lookup in the
 * application; it is unique here, since a user is at most one therapist.
 */
export const therapists = pgTable(
  "therapists",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    name: varchar("name", { length: 128 }).notNull(),
    bio: varchar("bio", { length: 2000 }).notNull(),
    avatarUrl: text("avatar_url"),
    experience: integer("experience").notNull(),
    rating: real("rating"),
    specialties: text("specialties").array(),
    kycStatus: kycStatusEnum("kyc_status").notNull().default("incomplete"),
    licenseNumber: varchar("license_number", { length: 64 }),
    /** Legacy opaque URL. New uploads use `kyc_documents` instead. */
    licenseUrl: text("license_url"),
    onboardingComplete: boolean("onboarding_complete").notNull().default(false),
    /**
     * IANA zone name (migration 0016). Every `therapist_availability` row for
     * this therapist is expressed in it — "Monday 09:00" means nothing without
     * knowing whose 09:00, and the clinicians are in Nairobi while clients are
     * worldwide. A name rather than a UTC offset, because offsets move with DST.
     */
    timezone: text("timezone").notNull().default("Africa/Nairobi"),
    sessionDurationMinutes: integer("session_duration_minutes").notNull().default(50),
    bufferMinutes: integer("buffer_minutes").notNull().default(10),
    /**
     * When the applicant last submitted for review (migration 0013).
     * Distinct from `createdAt`: a rejected applicant resubmits, and the review
     * queue sorts on this so the longest-waiting application surfaces first.
     */
    kycSubmittedAt: timestamp("kyc_submitted_at", { withTimezone: true }),
    kycReviewedAt: timestamp("kyc_reviewed_at", { withTimezone: true }),
    /** Auth0 sub of the reviewing admin. */
    kycReviewedBy: text("kyc_reviewed_by"),
    /**
     * Overall decision reason, SHOWN TO THE THERAPIST. On a rejection this is
     * the only explanation they receive, so it has to stand on its own.
     */
    kycReviewNote: varchar("kyc_review_note", { length: 1000 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("therapists_user_id_idx").on(t.userId)]
);

/**
 * One licence per therapist per jurisdiction (migration 0018).
 *
 * `therapists.license_number` is the single implicitly-Kenyan licence this
 * replaces. It is deliberately still there and still written: dropping it in
 * the same migration that introduces the replacement means a failed deploy
 * loses the data. A later migration removes it.
 *
 * ## The security property, so it is not accidentally removed
 *
 * `therapist_licences_update` authorises the ROW, not the columns, so without
 * the `therapist_licences_guard` trigger a therapist could insert a licence
 * for the United Kingdom, set it `verified`, and be presented to UK clients as
 * HCPC-registered with no reviewer involved. That is migration 0015's hole in
 * a worse place. The trigger also requires a `subdivision` for `united-states`
 * and `canada`, where licensure is sub-national and "licensed in the United
 * States" is not a meaningful claim.
 */
export const therapistLicences = pgTable(
  "therapist_licences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    therapistId: uuid("therapist_id")
      .notNull()
      .references(() => therapists.id, { onDelete: "cascade" }),
    /** A market slug from `lib/markets.ts`. Text, not an enum: the market list
     *  is product configuration and should not need a schema change. */
    jurisdiction: text("jurisdiction").notNull(),
    /** State or province. Required for sub-national jurisdictions; the trigger
     *  enforces it, so this stays nullable for the national cases. */
    subdivision: text("subdivision"),
    regulator: text("regulator"),
    licenceNumber: varchar("licence_number", { length: 128 }),
    verification: licenceVerificationEnum("verification").notNull().default("case_by_case"),
    /** Reuses `kyc_status` so a licence and an application speak one language. */
    status: kycStatusEnum("status").notNull().default("incomplete"),
    expiresAt: date("expires_at"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewedBy: text("reviewed_by"),
    /** Shown to the therapist on a rejection — the only explanation they get. */
    reviewNote: varchar("review_note", { length: 1000 }),
    documentId: uuid("document_id").references(() => kycDocuments.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("therapist_licences_unique").on(t.therapistId, t.jurisdiction, t.subdivision),
    index("therapist_licences_therapist_idx").on(t.therapistId),
  ]
);

// ─── Profiles ────────────────────────────────────────────────────────────────

export const profiles = pgTable(
  "profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Auth0 sub. One profile per user. */
    userId: text("user_id").notNull(),
    name: varchar("name", { length: 128 }).notNull(),
    email: varchar("email", { length: 254 }).notNull(),
    goal: varchar("goal", { length: 256 }),
    /** The sole record of the therapist↔patient relationship. */
    therapistId: uuid("therapist_id").references(() => therapists.id, {
      onDelete: "set null",
    }),
    avatarUrl: text("avatar_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("profiles_user_id_idx").on(t.userId),
    index("profiles_therapist_id_idx").on(t.therapistId),
  ]
);

// ─── Therapy sessions ────────────────────────────────────────────────────────

export const therapySessions = pgTable(
  "therapy_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    patientId: text("patient_id").notNull(),
    therapistId: uuid("therapist_id")
      .notNull()
      .references(() => therapists.id, { onDelete: "restrict" }),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
    /**
     * Appwrite packed two values into this column as `${type}|${note}`.
     * Split into real columns — the delimiter broke on any note containing "|".
     */
    sessionType: varchar("session_type", { length: 32 }).notNull().default("1-on-1"),
    notes: varchar("notes", { length: 4000 }),
    feedback: varchar("feedback", { length: 2000 }),
    /** Cloudflare Calls track ids; was a JSON string in varchar(1000). */
    therapistTracks: jsonb("therapist_tracks"),
    patientTracks: jsonb("patient_tracks"),
    /** Read by the earnings page but never declared in Appwrite, so always
     *  undefined there and silently defaulted to a hardcoded rate.
     *
     *  NOTE THE UNIT: whole KES, unlike every other money column in this schema.
     *  It predates the minor-unit rule and is read by admin pages, so it stays
     *  as-is; `list_amount_minor` below is the correctly-scaled companion. */
    amount: integer("amount"),
    /**
     * The charge this session's credit was drawn from, captured at booking.
     *
     * Sessions are priced FIFO from the client's purchases, so which bundle
     * funds session N is only knowable at the moment of booking: a later
     * cancellation renumbers the queue and the answer changes. Recording it
     * makes the payout reconcilable back to a specific Paystack transaction
     * instead of a re-derivation that quietly drifts.
     */
    fundingPaymentReference: text("funding_payment_reference"),
    /**
     * Plan key of that bundle, captured at booking (migration 0011).
     *
     * Copied onto the payout ledger so a payout row explains its own gross
     * figure. It cannot be looked up at accrual time: `payments_select` does not
     * admit therapists, and the accrual runs in the completing user's
     * transaction.
     */
    fundingPlan: text("funding_plan"),
    /**
     * LIST value of this session in MINOR units, captured at booking.
     *
     * Stored rather than derived so `PLAN_PRICES` can be repriced without
     * retroactively restating what already-booked sessions were worth — the
     * same reason `payments.amount_minor` is a stored figure. Null for sessions
     * with no purchase behind them (admin-comped bookings).
     */
    listAmountMinor: integer("list_amount_minor"),
    status: sessionStatusEnum("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("therapy_sessions_patient_id_idx").on(t.patientId),
    index("therapy_sessions_therapist_id_idx").on(t.therapistId),
    index("therapy_sessions_scheduled_at_idx").on(t.scheduledAt),
  ]
);

// ─── Direct messages ─────────────────────────────────────────────────────────

/**
 * `session_id` is intentionally NOT a foreign key: the Appwrite version wrote
 * the literal string "direct" for direct messages that belong to no session.
 * Modelled as a nullable uuid instead, with null meaning "direct message".
 */
export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id").references(() => therapySessions.id, {
      onDelete: "cascade",
    }),
    senderId: text("sender_id").notNull(),
    receiverId: text("receiver_id").notNull(),
    content: varchar("content", { length: 4000 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("messages_session_id_idx").on(t.sessionId),
    index("messages_sender_id_idx").on(t.senderId),
    index("messages_receiver_id_idx").on(t.receiverId),
  ]
);

// ─── Mood logs ───────────────────────────────────────────────────────────────

export const moodLogs = pgTable(
  "mood_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    emoji: varchar("emoji", { length: 16 }).notNull(),
    score: integer("score").notNull(),
    note: varchar("note", { length: 1000 }),
    tags: text("tags").array(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  // Composite: every query filters by user and ranges over time.
  (t) => [index("mood_logs_user_id_created_at_idx").on(t.userId, t.createdAt)]
);

// ─── Journal entries ─────────────────────────────────────────────────────────

/** Strictly private to the author — no therapist or admin read path exists. */
export const journalEntries = pgTable(
  "journal_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    content: varchar("content", { length: 5000 }).notNull(),
    prompt: varchar("prompt", { length: 500 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("journal_entries_user_id_created_at_idx").on(t.userId, t.createdAt)]
);

// ─── Goals ───────────────────────────────────────────────────────────────────

export type GoalMilestone = { title: string; completed: boolean };

export const goals = pgTable(
  "goals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    title: varchar("title", { length: 256 }).notNull(),
    description: varchar("description", { length: 1000 }),
    /** Was a JSON string inside varchar(4000). */
    milestones: jsonb("milestones").$type<GoalMilestone[]>().notNull().default([]),
    assignedBy: goalAssignedByEnum("assigned_by").notNull().default("self"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("goals_user_id_idx").on(t.userId)]
);

// ─── Clinical notes ──────────────────────────────────────────────────────────

export const clinicalNotes = pgTable(
  "clinical_notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    patientId: text("patient_id").notNull(),
    therapistId: uuid("therapist_id")
      .notNull()
      .references(() => therapists.id, { onDelete: "restrict" }),
    sessionId: uuid("session_id").references(() => therapySessions.id, {
      onDelete: "set null",
    }),
    type: clinicalNoteTypeEnum("type").notNull().default("freeform"),
    /** Discriminated by `type`: JSON-shaped when "soap", plain text otherwise. */
    content: varchar("content", { length: 4000 }).notNull(),
    isPrivate: boolean("is_private").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("clinical_notes_patient_id_idx").on(t.patientId),
    index("clinical_notes_therapist_id_idx").on(t.therapistId),
  ]
);

// ─── Session feedback ────────────────────────────────────────────────────────

export const sessionFeedback = pgTable(
  "session_feedback",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => therapySessions.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    rating: integer("rating").notNull(),
    comment: varchar("comment", { length: 1000 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("session_feedback_session_id_idx").on(t.sessionId),
    index("session_feedback_user_id_idx").on(t.userId),
  ]
);

// ─── Notifications ───────────────────────────────────────────────────────────

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    title: varchar("title", { length: 128 }).notNull(),
    message: varchar("message", { length: 512 }).notNull(),
    type: notificationTypeEnum("type").notNull().default("info"),
    link: varchar("link", { length: 256 }),
    read: boolean("read").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("notifications_user_id_created_at_idx").on(t.userId, t.createdAt)]
);

// ─── Support chat ────────────────────────────────────────────────────────────

/**
 * Anonymous-friendly support chat, distinct from in-session therapy messaging.
 * `session_id` is a client-generated opaque string, not a therapy session.
 */
export const chatSessions = pgTable(
  "chat_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: varchar("session_id", { length: 64 }).notNull(),
    /** Null for anonymous visitors; Auth0 sub when the visitor is signed in. */
    userId: text("user_id"),
    name: varchar("name", { length: 128 }).notNull(),
    email: varchar("email", { length: 256 }).notNull(),
    lastMessage: varchar("last_message", { length: 4096 }),
    lastActive: timestamp("last_active", { withTimezone: true }).notNull().defaultNow(),
    isOnline: boolean("is_online").notNull().default(false),
    /** Appwrite ordered by this column without ever declaring it, so the query threw. */
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("chat_sessions_session_id_idx").on(t.sessionId),
    index("chat_sessions_last_active_idx").on(t.lastActive),
  ]
);

/**
 * Columns follow the WORKING writer (`app/api/chat/route.ts`), not the broken
 * `sendChatReplyAction`, which wrote `{sender, body, createdAt}` against a
 * collection requiring `{name, email, role, text}` and threw on every call.
 * `created_at` is explicit here; Appwrite relied on the builtin `$createdAt`.
 */
export const chatMessages = pgTable(
  "chat_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: varchar("session_id", { length: 64 }).notNull(),
    name: varchar("name", { length: 128 }).notNull(),
    email: varchar("email", { length: 256 }).notNull(),
    role: chatRoleEnum("role").notNull().default("user"),
    text: varchar("text", { length: 4096 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("chat_messages_session_id_created_at_idx").on(t.sessionId, t.createdAt)]
);

// ─── Matching & risk ─────────────────────────────────────────────────────────

export const matchConflicts = pgTable(
  "match_conflicts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Auth0 sub, per the repo-wide convention. See the note in the migration report. */
    patientId: text("patient_id").notNull(),
    fromTherapistId: uuid("from_therapist_id").references(() => therapists.id, {
      onDelete: "set null",
    }),
    toTherapistId: uuid("to_therapist_id").references(() => therapists.id, {
      onDelete: "set null",
    }),
    reason: varchar("reason", { length: 1000 }).notNull(),
    severity: severityEnum("severity").notNull().default("medium"),
    resolved: boolean("resolved").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("match_conflicts_resolved_idx").on(t.resolved, t.createdAt)]
);

export const riskAlerts = pgTable(
  "risk_alerts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    patientId: text("patient_id").notNull(),
    type: riskAlertTypeEnum("type").notNull(),
    description: varchar("description", { length: 1000 }).notNull(),
    severity: severityEnum("severity").notNull().default("medium"),
    /**
     * Kept alongside `disposition` (migration 0017) rather than dropped — it
     * carries an index and existing reads use it. A CHECK constraint makes the
     * two incapable of disagreeing: `resolved = (disposition <> 'open')`, so
     * neither can be written alone and leave the row saying two different
     * things about the same alert.
     */
    resolved: boolean("resolved").notNull().default(false),
    /**
     * What a reviewer concluded (migration 0017).
     *
     * `false_positive` is the load-bearing value. The detector is substring
     * matching over a fixed word list and `goodbye` is on it, so a cheerful
     * sign-off files a permanent crisis alert. Without a way to record
     * dismissal AS dismissal, every false positive is indistinguishable from a
     * real event that was handled — and the table accumulates as a crisis
     * history on a real person's record that is mostly a list of string matches.
     *
     * `duplicate` is separate because "fired twice on one episode" and "was
     * simply wrong" are different facts about the detector, and whoever tunes
     * the word list needs to tell them apart.
     */
    disposition: riskAlertDispositionEnum("disposition").notNull().default("open"),
    /** Required once disposition leaves 'open' — enforced by a CHECK. */
    dispositionBy: text("disposition_by"),
    dispositionAt: timestamp("disposition_at", { withTimezone: true }),
    dispositionNote: varchar("disposition_note", { length: 1000 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("risk_alerts_resolved_idx").on(t.resolved, t.createdAt),
    index("risk_alerts_patient_id_idx").on(t.patientId),
    index("risk_alerts_disposition_idx").on(t.disposition, t.createdAt),
  ]
);

// ─── Promos ──────────────────────────────────────────────────────────────────

/**
 * The Appwrite document id WAS the promo code, and uniqueness of redemption was
 * enforced only by a 409 on duplicate id. The code is the natural primary key.
 *
 * The admin pricing page reads `discount`, `limit`, `expiresAt` and `disabled`,
 * none of which Appwrite ever declared — so they always rendered as placeholder
 * dashes. Declared here so the page can actually work.
 */
/**
 * Promo DEFINITIONS. A row means "this code exists" — nothing about who used it.
 *
 * `used_by` / `used_at` used to live here, which made a code single-use
 * globally: one row per code meant one redemption, ever, by one person. Uses are
 * now rows in `promoRedemptions`.
 */
export const promos = pgTable("promos", {
  code: varchar("code", { length: 64 }).primaryKey(),
  /** Percentage off. Null falls back to `PROMO_DISCOUNT_PERCENT`. */
  discount: integer("discount"),
  /** Max total redemptions across all users. Null = unlimited. */
  redemptionLimit: integer("redemption_limit"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  disabled: boolean("disabled").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * One row per person per code. The UNIQUE constraint is the "already used it"
 * guarantee that the old single-table design could not express.
 *
 * `paymentReference` is null while checkout is in progress and set when the
 * payment succeeds — so an abandoned checkout no longer burns the code, and a
 * discounted charge can be traced back to the promo that produced it.
 */
export const promoRedemptions = pgTable(
  "promo_redemptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 64 }).notNull(),
    userId: text("user_id").notNull(),
    paymentReference: text("payment_reference"),
    redeemedAt: timestamp("redeemed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("promo_redemptions_code_user_unique").on(t.code, t.userId),
    index("promo_redemptions_code_idx").on(t.code),
    index("promo_redemptions_user_id_idx").on(t.userId),
  ]
);

// ─── Payments ────────────────────────────────────────────────────────────────

export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "success",
  "failed",
  "abandoned",
]);

/**
 * Paystack charge ledger. See migration 0006 for the RLS rationale.
 *
 * `amountMinor` is in the currency's minor unit (KES cents) and is an integer on
 * purpose — money in a float accumulates rounding error that cannot be undone,
 * and Paystack's API speaks minor units too, so this removes a conversion at the
 * exact boundary where a mistake means charging 100× the intended amount.
 */
export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Paystack reference. UNIQUE — this is the idempotency key for webhooks. */
    reference: text("reference").notNull().unique(),
    /** Auth0 sub of the payer. */
    userId: text("user_id").notNull(),
    plan: text("plan").notNull(),
    amountMinor: integer("amount_minor").notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("KES"),
    status: paymentStatusEnum("status").notNull().default("pending"),
    /** Paystack's own status string, kept verbatim for reconciliation. */
    paystackStatus: text("paystack_status"),
    channel: text("channel"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    /** Verified provider payload, for disputes and reconciliation. */
    raw: jsonb("raw"),
  },
  (t) => [
    index("payments_user_id_created_at_idx").on(t.userId, t.createdAt),
    index("payments_status_idx").on(t.status),
  ]
);

// ─── Therapist payout ledger ─────────────────────────────────────────────────

/**
 * `reversed` is a status rather than a deleted row: an accrual that turns out to
 * be wrong is cancelled in place and stays visible. A payout ledger you can
 * delete from is not a payout ledger.
 */
export const payoutStatusEnum = pgEnum("payout_status", [
  "accrued",
  "paid",
  "reversed",
]);

/**
 * What `gross_minor` was measured from — recorded because the answer is a policy
 * choice (`THERAPIST_PAID_ON_LIST_PRICE`) that may differ between rows once the
 * flag is ever flipped, and "why was I paid this?" has to be answerable from the
 * row alone, years later.
 *
 *  • `list`     — the plan's undiscounted per-session price.
 *  • `charged`  — what the client actually paid, after any promo.
 *  • `unfunded` — no purchase behind the session (admin-comped, or booked before
 *                 payments existed). Accrues zero, deliberately visibly.
 */
export const payoutBasisEnum = pgEnum("payout_basis", [
  "list",
  "charged",
  "unfunded",
]);

/**
 * NEW TABLE — no Appwrite equivalent, and no equivalent anywhere else.
 *
 * Therapists are contractors paid a share of session revenue, and until this
 * table existed the platform had no record of what it owed them. The earnings
 * page recomputed a number in the browser on every render from
 * `therapy_sessions.amount` — a mutable column — and stored nothing, so unpaid
 * contractor liability existed only as an arithmetic side effect of loading a
 * page. Nothing recorded that a payment had been made, which means nothing
 * prevented paying the same session twice or never.
 *
 * One row per completed session, written inside the transaction that completes
 * it. Every money column is in MINOR units and immutable after insert (enforced
 * by `payout_ledger_freeze()`); only the payout fields move, and only forward.
 *
 * Deliberately self-contained: `session_scheduled_at`, `plan` and the amounts
 * are copied in rather than joined at read time. A ledger line has to keep
 * meaning what it meant when it was written, even if the session row it came
 * from is later edited.
 */
export const payoutLedger = pgTable(
  "payout_ledger",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** UNIQUE — the idempotency guarantee. A session accrues exactly once. */
    sessionId: uuid("session_id")
      .notNull()
      .unique()
      .references(() => therapySessions.id, { onDelete: "restrict" }),
    therapistId: uuid("therapist_id")
      .notNull()
      .references(() => therapists.id, { onDelete: "restrict" }),
    /**
     * Auth0 sub of the therapist, denormalised from `therapists.user_id`.
     *
     * Carried so the RLS policy is a plain column comparison instead of a
     * subquery into `therapists` on every row — and so a therapist row being
     * re-pointed at a different user cannot silently reassign historical
     * earnings to someone else.
     */
    therapistUserId: text("therapist_user_id").notNull(),
    patientId: text("patient_id").notNull(),
    sessionScheduledAt: timestamp("session_scheduled_at", {
      withTimezone: true,
    }).notNull(),
    /** Plan the funding bundle was sold as. Null when `basis` is `unfunded`. */
    plan: text("plan"),
    /** Paystack reference of the funding charge, for reconciliation. */
    fundingPaymentReference: text("funding_payment_reference"),
    /** Session value the share was taken on. See `basis` for which value. */
    grossMinor: integer("gross_minor").notNull(),
    /** What the client actually paid for this session, after discounts. Kept
     *  alongside `gross_minor` so the cost of a promo is measurable rather than
     *  inferred: the two are equal only when nothing was discounted. */
    chargedMinor: integer("charged_minor").notNull(),
    basis: payoutBasisEnum("basis").notNull(),
    /**
     * Revenue share in BASIS POINTS (4000 = 40%), not a fraction.
     *
     * An integer for the same reason the amounts are: the rate is part of the
     * financial record, and `0.4` stored as a float is a value that cannot be
     * compared for equality or summed without drift.
     */
    shareBp: integer("share_bp").notNull(),
    /** Amount owed = round(gross_minor × share_bp / 10000). Computed once. */
    amountMinor: integer("amount_minor").notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("KES"),
    status: payoutStatusEnum("status").notNull().default("accrued"),
    /** Operator's payout run identifier, set when the batch is paid. */
    payoutBatch: text("payout_batch"),
    /** The provider's transfer reference for that payout. */
    payoutReference: text("payout_reference"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    reversedAt: timestamp("reversed_at", { withTimezone: true }),
    reversalReason: varchar("reversal_reason", { length: 500 }),
    accruedAt: timestamp("accrued_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // The therapist's own earnings view: their rows, newest first.
    index("payout_ledger_therapist_user_accrued_idx").on(
      t.therapistUserId,
      t.accruedAt
    ),
    // "What is outstanding?" — the query a payout run starts from.
    index("payout_ledger_status_idx").on(t.status),
    index("payout_ledger_therapist_id_idx").on(t.therapistId),
    index("payout_ledger_payout_batch_idx").on(t.payoutBatch),
  ]
);

// ─── Avatars ─────────────────────────────────────────────────────────────────

/**
 * Profile photos. Deliberately NOT in `kyc_documents`, despite both being
 * uploaded files: avatars render in the public therapist directory, whereas KYC
 * documents are government IDs readable only by their owner and admins. Sharing
 * a table would force one RLS policy to serve both sensitivity levels.
 */
export const avatars = pgTable(
  "avatars",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Auth0 sub. Clients have avatars too, so this is not a therapist FK. */
    ownerId: text("owner_id").notNull(),
    filename: varchar("filename", { length: 255 }).notNull(),
    mimeType: varchar("mime_type", { length: 128 }).notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    content: bytea("content").notNull(),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("avatars_owner_id_idx").on(t.ownerId)]
);

// ─── KYC documents ───────────────────────────────────────────────────────────

/**
 * NEW TABLE — no Appwrite equivalent.
 *
 * Appwrite stored the license document as an opaque public URL on
 * `therapists.license_url`, with no metadata whatsoever: no filename, no MIME
 * type, no size, no uploader, no review trail, and no ACL. The URL also
 * embedded the Appwrite endpoint and project id, hard-coding infrastructure
 * into the data.
 *
 * Bytes live in `content` (bytea) per the storage decision, and are served
 * through an authorizing route handler rather than a public URL.
 */
export const kycDocuments = pgTable(
  "kyc_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    therapistId: uuid("therapist_id")
      .notNull()
      .references(() => therapists.id, { onDelete: "cascade" }),
    /** Auth0 sub of the uploader, for audit. */
    uploadedBy: text("uploaded_by").notNull(),
    filename: varchar("filename", { length: 255 }).notNull(),
    mimeType: varchar("mime_type", { length: 128 }).notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    content: bytea("content").notNull(),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
    reviewedBy: text("reviewed_by"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    /**
     * Required — deliberately has NO database default (migration 0013 adds one
     * to backfill the two legacy rows, then drops it). An untyped document
     * cannot be checked against a requirement, so an insert that omits this
     * must fail rather than quietly becoming `other`.
     */
    docType: kycDocumentTypeEnum("doc_type").notNull(),
    reviewStatus: kycDocReviewEnum("review_status").notNull().default("pending"),
    /** Reviewer's reason, shown to the therapist. Write it for them to read. */
    reviewNote: varchar("review_note", { length: 1000 }),
  },
  (t) => [
    index("kyc_documents_therapist_id_idx").on(t.therapistId),
    index("kyc_documents_review_status_idx").on(t.reviewStatus),
  ]
);

/**
 * Append-only trail of KYC decisions (migration 0013).
 *
 * The columns on `therapists` hold CURRENT state and are overwritten on each
 * decision. The question asked after an incident is not "what is this
 * therapist's status" but "who approved them, when, and had anyone raised a
 * concern first" — which only a log answers. `echo_app` holds SELECT and INSERT
 * and nothing else; UPDATE and DELETE are revoked, and there is no policy for
 * them.
 */
/**
 * Published weekly working hours (migration 0016).
 *
 * ADVISORY, NOT ENFORCED. `createSessionAction` does not consult this — a client
 * can still book outside these hours. It exists so the schedule a therapist sets
 * is stored and shown, rather than discarded by a save handler that only
 * rendered "Saved ✓". Enforcing it at booking time is a separate change.
 *
 * Times are minutes from LOCAL midnight in `therapists.timezone`, not `time`
 * values: an integer cannot be accidentally compared against a `timestamptz`
 * elsewhere and silently pick up the server's zone.
 *
 * `dayOfWeek` is 0 = Sunday, matching both `Date.getDay()` and Postgres
 * `EXTRACT(DOW ...)`. The two common conventions differ by one, and an
 * off-by-one here is invisible until somebody misses an appointment.
 */
export const therapistAvailability = pgTable(
  "therapist_availability",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    therapistId: uuid("therapist_id")
      .notNull()
      .references(() => therapists.id, { onDelete: "cascade" }),
    dayOfWeek: smallint("day_of_week").notNull(),
    startMinute: smallint("start_minute").notNull(),
    endMinute: smallint("end_minute").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("therapist_availability_therapist_idx").on(t.therapistId, t.dayOfWeek),
    // Matches the DB constraint: one block per day. Split shifts are not
    // expressible yet — see the migration for why that was chosen.
    uniqueIndex("availability_one_block_per_day").on(t.therapistId, t.dayOfWeek),
  ]
);

export const kycReviewEvents = pgTable(
  "kyc_review_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    therapistId: uuid("therapist_id")
      .notNull()
      .references(() => therapists.id, { onDelete: "cascade" }),
    /** Auth0 sub of whoever acted, or 'system' for automated transitions. */
    actorId: text("actor_id").notNull(),
    /**
     * Free text, not an enum, because this is a log: one that rejects writes
     * because someone introduced a new action name has failed at its only job.
     * In use: submitted, approved, rejected, changes_requested, revoked,
     * document_accepted, document_rejected.
     */
    action: text("action").notNull(),
    note: varchar("note", { length: 1000 }),
    /** Set when the event concerns one document; null for overall decisions. */
    documentId: uuid("document_id").references(() => kycDocuments.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("kyc_review_events_therapist_idx").on(t.therapistId, t.createdAt)]
);
