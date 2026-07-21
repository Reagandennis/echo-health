/**
 * Therapist availability — the shared vocabulary for published working hours.
 *
 * WHY THIS FILE EXISTS. Three places need to agree on what "Monday 09:00–17:00"
 * means: the therapist's editor (a client component), the admin's read-only view
 * (a server component), and the server action that validates and stores it. The
 * minutes ↔ "HH:MM" conversion is the kind of thing that gets re-derived inline
 * in each of them and then disagrees at the edges — 1440, midnight, a stray
 * off-by-one — so it lives here once. `app/actions/database.ts` is `"use server"`
 * and may only export async functions, so pure helpers could not live there.
 *
 * WHY MINUTES RATHER THAN A `time` COLUMN (migration 0016). A `time` invites
 * comparison against a `timestamptz` elsewhere in the codebase, which silently
 * drags in the SERVER's zone; an integer cannot be accidentally compared to a
 * moment in time. The trade is that every read and write has to convert, which is
 * what this module is for.
 *
 * WHY A TIMEZONE AT ALL. "Available Monday 09:00" is meaningless without knowing
 * whose 09:00. The clinicians are in Nairobi and the clients are worldwide, so
 * the two ends of a booking are routinely in different zones. An IANA name rather
 * than a UTC offset, because offsets move with DST.
 *
 * ADVISORY, NOT ENFORCED. Nothing here constrains booking. `createSessionAction`
 * does not consult availability and a client can still book outside these hours.
 * Both UIs must say so — a schedule that looks enforced but is not is a lie of
 * the same class as the "Saved ✓" that used to be shown for data that was
 * discarded.
 */

/** End-of-day sentinel. `end_minute` may be 1440 so a block can run to midnight. */
export const MINUTES_IN_DAY = 1440;

/**
 * Index IS the stored `day_of_week` value: 0 = Sunday.
 *
 * Pinned to match `Date.getDay()` and Postgres `EXTRACT(DOW ...)`, which agree
 * with each other and disagree with the ISO convention by one. Never index this
 * with a "Monday = 0" number.
 */
export const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

/**
 * Display order. Values are `day_of_week` codes, not positions — the working week
 * reads Monday-first even though Sunday is stored as 0.
 */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

/** One stored row: a single block of working time on one weekday. */
export interface AvailabilityBlock {
  /** 0 = Sunday. */
  dayOfWeek: number;
  /** Minutes from local midnight in the therapist's zone, 0–1439. */
  startMinute: number;
  /** Minutes from local midnight, 1–1440. Strictly greater than `startMinute`. */
  endMinute: number;
}

/** A therapist's whole published week, plus the settings that frame it. */
export interface AvailabilityDraft {
  /** IANA zone name. */
  timezone: string;
  sessionDurationMinutes: number;
  bufferMinutes: number;
  /** At most one block per day — the table has UNIQUE (therapist_id, day_of_week). */
  blocks: AvailabilityBlock[];
}

// ─── Conversion ──────────────────────────────────────────────────────────────

/**
 * 540 → "09:00", 1440 → "24:00".
 *
 * 24:00 is deliberate rather than wrapped to 00:00: it is a valid end value and
 * rendering it as midnight-at-the-start-of-the-day would make a 09:00–24:00 block
 * read as inverted.
 */
export function minutesToTime(minutes: number): string {
  const clamped = Math.max(0, Math.min(MINUTES_IN_DAY, Math.round(minutes)));
  const hours = Math.floor(clamped / 60);
  const mins = clamped % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

/**
 * "09:00" → 540. Returns null on anything it cannot parse, so a caller has to
 * decide what a bad value means rather than silently getting midnight.
 */
export function timeToMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;

  const hours = Number(match[1]);
  const mins = Number(match[2]);
  if (!Number.isInteger(hours) || !Number.isInteger(mins)) return null;
  if (mins > 59) return null;

  const total = hours * 60 + mins;
  if (total < 0 || total > MINUTES_IN_DAY) return null;
  return total;
}

/** "09:00–17:00" for one block, in the therapist's own zone. */
export function formatBlockRange(block: AvailabilityBlock): string {
  return `${minutesToTime(block.startMinute)}–${minutesToTime(block.endMinute)}`;
}

/** Total working minutes across the week. Used for the "N hrs/week" summaries. */
export function weeklyMinutes(blocks: readonly AvailabilityBlock[]): number {
  return blocks.reduce((sum, b) => sum + Math.max(0, b.endMinute - b.startMinute), 0);
}

/** "7 hrs 30 min", "8 hrs", "45 min". */
export function formatDuration(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (hours === 0) return `${mins} min`;
  if (mins === 0) return `${hours} hr${hours === 1 ? "" : "s"}`;
  return `${hours} hr${hours === 1 ? "" : "s"} ${mins} min`;
}

// ─── Pickable values ─────────────────────────────────────────────────────────

function buildTimes(fromMinute: number, toMinute: number): readonly string[] {
  const out: string[] = [];
  for (let m = fromMinute; m <= toMinute; m += 30) out.push(minutesToTime(m));
  return out;
}

/**
 * Half-hour granularity across the whole day. The screen this replaces offered
 * 08:00–20:00 on the hour only, which a clinician working an early shift or an
 * evening clinic simply could not express — so they would set something near
 * enough and publish hours they do not work.
 *
 * The two lists differ at the ends on purpose, matching the CHECK constraints:
 * a start is 0–1439 and an end is 1–1440.
 */
export const START_TIME_OPTIONS = buildTimes(0, MINUTES_IN_DAY - 30);
export const END_TIME_OPTIONS = buildTimes(30, MINUTES_IN_DAY);

/** Mirrors `therapists_session_duration_sane`. */
export const SESSION_DURATION_BOUNDS = { min: 15, max: 240 } as const;
/** Mirrors `therapists_buffer_sane`. */
export const BUFFER_BOUNDS = { min: 0, max: 120 } as const;

export const SESSION_DURATION_OPTIONS = [25, 30, 45, 50, 60, 90, 120] as const;
export const BUFFER_OPTIONS = [0, 5, 10, 15, 20, 30] as const;

/**
 * A curated shortlist, not a tz database. Nairobi first because that is where the
 * clinicians are and the column defaults to it.
 *
 * Deliberately short: the browser's own resolved zone is offered alongside this
 * (see the editor), and `isValidTimezone` accepts ANY name the runtime knows, so
 * a therapist in a zone missing from this list is not locked out — they are
 * simply not one click away.
 */
export const COMMON_TIMEZONES = [
  "Africa/Nairobi",
  "Africa/Lagos",
  "Africa/Cairo",
  "Africa/Johannesburg",
  "Africa/Accra",
  "Africa/Kampala",
  "Africa/Dar_es_Salaam",
  "Africa/Kigali",
  "Europe/London",
  "Europe/Dublin",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Lisbon",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Toronto",
  "Asia/Dubai",
  "Asia/Karachi",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
  "UTC",
] as const;

/**
 * Validated against the runtime's tz database rather than the list above.
 *
 * `therapists.timezone` is plain `text` with no CHECK constraint, so this is the
 * only thing standing between a typo and a stored zone that every later
 * `Intl.DateTimeFormat` call throws on.
 */
export function isValidTimezone(timezone: string): boolean {
  if (!timezone || typeof timezone !== "string") return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

/**
 * "14:32 (GMT+3)" — the wall-clock time right now in `timezone`.
 *
 * Renders the abstract zone name as something an admin can sanity-check against
 * a schedule. Returns null rather than throwing if the stored name is unknown to
 * this runtime, so a bad value degrades to "no clock" instead of a 500.
 */
export function formatZoneNow(timezone: string, at: Date = new Date()): string | null {
  try {
    const time = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(at);

    const offset = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      timeZoneName: "shortOffset",
    })
      .formatToParts(at)
      .find((part) => part.type === "timeZoneName")?.value;

    return offset ? `${time} (${offset})` : time;
  } catch {
    return null;
  }
}

// ─── Validation ──────────────────────────────────────────────────────────────

function isIntInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
}

/**
 * The authoritative check, run server-side before any write and reused by the
 * editor for instant feedback.
 *
 * Returns a sentence to show the user, or null when the draft is storable. The
 * CHECK constraints and the UNIQUE index in migration 0016 are the backstop — if
 * one of them ever fires, the caller sees `23514`/`23505` and a 500, which is not
 * an error message. Every constraint below therefore has a counterpart here that
 * names the day and says what is wrong with it.
 */
export function validateAvailabilityDraft(draft: AvailabilityDraft): string | null {
  if (!isValidTimezone(draft.timezone)) {
    return `"${draft.timezone}" is not a timezone this server recognises. Pick one from the list.`;
  }

  if (
    !isIntInRange(
      draft.sessionDurationMinutes,
      SESSION_DURATION_BOUNDS.min,
      SESSION_DURATION_BOUNDS.max
    )
  ) {
    return `Session duration must be a whole number of minutes between ${SESSION_DURATION_BOUNDS.min} and ${SESSION_DURATION_BOUNDS.max}.`;
  }

  if (!isIntInRange(draft.bufferMinutes, BUFFER_BOUNDS.min, BUFFER_BOUNDS.max)) {
    return `Buffer between sessions must be a whole number of minutes between ${BUFFER_BOUNDS.min} and ${BUFFER_BOUNDS.max}.`;
  }

  if (!Array.isArray(draft.blocks)) return "The weekly schedule is missing.";
  if (draft.blocks.length > DAY_NAMES.length) {
    return "A week has seven days — the schedule sent has more entries than that.";
  }

  const seen = new Set<number>();
  for (const block of draft.blocks) {
    if (!isIntInRange(block?.dayOfWeek, 0, 6)) {
      return "The schedule contains a day that is not a day of the week.";
    }

    const day = DAY_NAMES[block.dayOfWeek];

    // The UNIQUE index allows exactly one block per day. Split shifts
    // (09:00–12:00, 14:00–18:00) are a real pattern that migration 0016
    // deliberately does not model yet, so this refuses rather than silently
    // dropping the second block.
    if (seen.has(block.dayOfWeek)) {
      return `${day} appears twice. Only one block of hours per day is supported at the moment.`;
    }
    seen.add(block.dayOfWeek);

    if (!isIntInRange(block.startMinute, 0, MINUTES_IN_DAY - 1)) {
      return `${day}: the start time is not a valid time of day.`;
    }

    if (!isIntInRange(block.endMinute, 1, MINUTES_IN_DAY)) {
      return `${day}: the end time is not a valid time of day.`;
    }

    if (block.endMinute <= block.startMinute) {
      return `${day}: the end time (${minutesToTime(block.endMinute)}) must be after the start time (${minutesToTime(block.startMinute)}).`;
    }

    // Not a database constraint — a block shorter than one session is storable
    // and renders fine, it just cannot hold an appointment. Worth saying out loud
    // while the therapist is looking at the form.
    if (block.endMinute - block.startMinute < draft.sessionDurationMinutes) {
      return `${day}: ${formatBlockRange(block)} is shorter than one ${draft.sessionDurationMinutes}-minute session.`;
    }
  }

  return null;
}

/** Blocks in Monday-first display order. */
export function sortForDisplay(
  blocks: readonly AvailabilityBlock[]
): AvailabilityBlock[] {
  return [...blocks].sort(
    (a, b) => WEEK_ORDER.indexOf(a.dayOfWeek as 0) - WEEK_ORDER.indexOf(b.dayOfWeek as 0)
  );
}
