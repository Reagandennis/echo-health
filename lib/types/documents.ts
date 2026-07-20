import type {
  clinicalNotes,
  goals,
  journalEntries,
  messages,
  moodLogs,
  notifications,
  profiles,
  sessionFeedback,
  therapySessions,
  therapists,
} from "@/lib/db/schema";

/**
 * Row shapes for UI code, derived from the Drizzle schema.
 *
 * Replaces the hand-written interfaces in `lib/appwrite/database.ts`, which
 * extended `Models.Document` and therefore demanded `$collectionId`,
 * `$permissions` and `$sequence` — members no Postgres row has — while typing
 * every timestamp as `string` where the driver now returns a `Date`.
 *
 * Deriving from the schema means these cannot drift from the tables again: add
 * a column and it appears here; rename one and every stale reader fails to
 * compile.
 *
 * TWO THINGS TO KNOW WHEN USING THESE:
 *
 *  1. Timestamps are real `Date` objects, not ISO strings. `.localeCompare()`
 *     does not exist on them — sort with `.getTime()`. Server Actions serialize
 *     `Date` across the RSC boundary correctly, so a client component receives a
 *     `Date`, not a string.
 *  2. Rows carry BOTH `id` and `$id`. The actions in `app/actions/database.ts`
 *     pass every row through `toDoc()`, which re-exposes `id` under the
 *     Appwrite-era `$id` name that ~40 call sites still read. New code should
 *     prefer `id`; `$id` exists so the two spellings can coexist.
 */
type Doc<T extends { id: string }> = T & { $id: string };

export type Profile = Doc<typeof profiles.$inferSelect>;
export type Therapist = Doc<typeof therapists.$inferSelect>;
export type TherapySession = Doc<typeof therapySessions.$inferSelect>;
export type Message = Doc<typeof messages.$inferSelect>;
export type MoodLog = Doc<typeof moodLogs.$inferSelect>;
export type JournalEntry = Doc<typeof journalEntries.$inferSelect>;
export type Goal = Doc<typeof goals.$inferSelect>;
export type ClinicalNote = Doc<typeof clinicalNotes.$inferSelect>;
export type SessionFeedback = Doc<typeof sessionFeedback.$inferSelect>;
export type Notification = Doc<typeof notifications.$inferSelect>;

/** `goals.milestones` is a `jsonb` array — never `JSON.parse` it. */
export type { GoalMilestone } from "@/lib/db/schema";
