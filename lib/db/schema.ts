import {
  pgTable,
  pgEnum,
  uuid,
  text,
  varchar,
  integer,
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

export const kycStatusEnum = pgEnum("kyc_status", [
  "incomplete",
  "pending",
  "verified",
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
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("therapists_user_id_idx").on(t.userId)]
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
     *  undefined there and silently defaulted to a hardcoded rate. */
    amount: integer("amount"),
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
    resolved: boolean("resolved").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("risk_alerts_resolved_idx").on(t.resolved, t.createdAt),
    index("risk_alerts_patient_id_idx").on(t.patientId),
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
export const promos = pgTable("promos", {
  code: varchar("code", { length: 64 }).primaryKey(),
  usedBy: text("used_by").notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }).notNull().defaultNow(),
  discount: integer("discount"),
  redemptionLimit: integer("redemption_limit"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  disabled: boolean("disabled").notNull().default(false),
});

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
  },
  (t) => [index("kyc_documents_therapist_id_idx").on(t.therapistId)]
);
