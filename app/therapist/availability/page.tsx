"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { AlertTriangle, Check, Clock, Globe, Loader2, Save } from "lucide-react";

import {
  getMyAvailabilityAction,
  saveMyAvailabilityAction,
  type TherapistAvailability,
} from "@/app/actions/database";
import {
  BUFFER_OPTIONS,
  COMMON_TIMEZONES,
  DAY_NAMES,
  END_TIME_OPTIONS,
  SESSION_DURATION_OPTIONS,
  START_TIME_OPTIONS,
  WEEK_ORDER,
  formatDuration,
  minutesToTime,
  timeToMinutes,
  validateAvailabilityDraft,
  weeklyMinutes,
  type AvailabilityDraft,
} from "@/lib/availability";

/**
 * Where a therapist publishes their working week.
 *
 * WHAT THIS PAGE USED TO DO. Its save handler was
 * `function save() { setSaved(true); setTimeout(() => setSaved(false), 2500) }`
 * — it set a local flag, rendered "Saved ✓", and discarded everything. There was
 * no action, no request and no table. A clinician configured their week, was told
 * explicitly that it had been saved, and lost it on reload. The confirmation was
 * the worst part: it asserted the opposite of what happened.
 *
 * The rule that replaces it: **"Saved" is only ever rendered from a server
 * response.** Not from a click, not optimistically, and never on a failure. The
 * form is re-seeded from the rows the server reports it stored, so what is on
 * screen after a save is what is in the table.
 */

/** One row of the editor. Times are "HH:MM" because that is what a `<select>` holds. */
interface DayForm {
  enabled: boolean;
  from: string;
  to: string;
}

/** Keyed by `day_of_week` (0 = Sunday), matching the stored values. */
type WeekForm = Record<number, DayForm>;

/**
 * Times a day carries before it is switched on.
 *
 * These are a starting point for a toggle, NOT a pre-filled schedule: every day
 * starts disabled for a therapist who has published nothing. The screen this
 * replaces arrived with Monday–Friday already toggled on, which reads as "these
 * are your hours" for someone who has never set any — the same lie as the fake
 * confirmation, told more quietly.
 */
const DAY_DEFAULT: DayForm = { enabled: false, from: "09:00", to: "17:00" };

function emptyWeek(): WeekForm {
  return Object.fromEntries(WEEK_ORDER.map((day) => [day, { ...DAY_DEFAULT }])) as WeekForm;
}

/**
 * The device's timezone, cached because `useSyncExternalStore` compares snapshots
 * by identity and a fresh read on every render would loop. A device does not
 * change zone mid-session, hence the no-op subscribe.
 */
let cachedBrowserZone: string | null | undefined;
function getBrowserZone(): string | null {
  if (cachedBrowserZone === undefined) {
    try {
      cachedBrowserZone = Intl.DateTimeFormat().resolvedOptions().timeZone || null;
    } catch {
      cachedBrowserZone = null;
    }
  }
  return cachedBrowserZone;
}
const subscribeNothing = () => () => {};

/** Server state → form state. The only place the two representations meet. */
function toForm(availability: TherapistAvailability): WeekForm {
  const week = emptyWeek();
  for (const block of availability.blocks) {
    week[block.dayOfWeek] = {
      enabled: true,
      from: minutesToTime(block.startMinute),
      to: minutesToTime(block.endMinute),
    };
  }
  return week;
}

export default function AvailabilityPage() {
  const [week, setWeek] = useState<WeekForm>(emptyWeek);
  const [timezone, setTimezone] = useState<string>("Africa/Nairobi");
  const [sessionDuration, setSessionDuration] = useState(50);
  const [buffer, setBuffer] = useState(10);

  const [loading, setLoading] = useState(true);
  /** Distinguishes "could not load" from "loaded, and there is nothing there". */
  const [loadError, setLoadError] = useState<string | null>(null);
  /** True when the account has no `therapists` row to hang a schedule on. */
  const [noProfile, setNoProfile] = useState(false);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Whether anything has been published yet, straight from the last server read. */
  const [publishedDays, setPublishedDays] = useState<number | null>(null);

  /**
   * The device's own zone, offered as a suggestion. Read through
   * `useSyncExternalStore` with a null server snapshot: this component is
   * server-rendered too, and `Intl.DateTimeFormat().resolvedOptions().timeZone`
   * there returns the SERVER's zone, which would mismatch at hydration.
   */
  const browserZone = useSyncExternalStore(subscribeNothing, getBrowserZone, () => null);

  const apply = useCallback((availability: TherapistAvailability) => {
    setWeek(toForm(availability));
    setTimezone(availability.timezone);
    setSessionDuration(availability.sessionDurationMinutes);
    setBuffer(availability.bufferMinutes);
    setPublishedDays(availability.blocks.length);
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const availability = await getMyAvailabilityAction();
        if (!active) return;
        if (!availability) {
          setNoProfile(true);
        } else {
          apply(availability);
        }
      } catch (err) {
        if (!active) return;
        // Deliberately NOT falling back to a default week. An unreadable schedule
        // shown as "Mon–Fri 09:00–17:00" invites a save that overwrites whatever
        // is actually stored with a guess.
        setLoadError(
          err instanceof Error
            ? err.message
            : "Could not load your availability."
        );
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [apply]);

  /** Any edit invalidates a previous confirmation — it no longer describes the form. */
  function touch() {
    setSaved(false);
    setError(null);
  }

  function toggleDay(day: number) {
    touch();
    setWeek((w) => ({ ...w, [day]: { ...w[day], enabled: !w[day].enabled } }));
  }

  function setDayTime(day: number, field: "from" | "to", value: string) {
    touch();
    setWeek((w) => ({ ...w, [day]: { ...w[day], [field]: value } }));
  }

  function buildDraft(): AvailabilityDraft {
    return {
      timezone,
      sessionDurationMinutes: sessionDuration,
      bufferMinutes: buffer,
      blocks: WEEK_ORDER.filter((day) => week[day].enabled).map((day) => ({
        dayOfWeek: day,
        // `-1` cannot come from the selects; it exists so a hand-edited value
        // fails validation loudly instead of silently becoming midnight.
        startMinute: timeToMinutes(week[day].from) ?? -1,
        endMinute: timeToMinutes(week[day].to) ?? -1,
      })),
    };
  }

  async function save() {
    const draft = buildDraft();

    // Same function the action runs. Local first only so an obvious mistake is
    // reported instantly; the server's answer is still the one that decides.
    const problem = validateAvailabilityDraft(draft);
    if (problem) {
      setError(problem);
      setSaved(false);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const result = await saveMyAvailabilityAction(draft);
      if (!result.ok) {
        setError(result.message);
        setSaved(false);
        return;
      }
      // Re-seed from what the server says it stored, so the confirmed state on
      // screen is the state in the table rather than the state that was typed.
      apply(result.availability);
      setSaved(true);
      setTimeout(() => setSaved(false), 4000);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Your schedule was not saved — the server could not be reached."
      );
      setSaved(false);
    } finally {
      setSaving(false);
    }
  }

  const draft = buildDraft();
  const totalMinutes = weeklyMinutes(draft.blocks);
  const zoneOptions = Array.from(
    new Set([timezone, ...(browserZone ? [browserZone] : []), ...COMMON_TIMEZONES])
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin text-brand" size={32} />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Availability</h1>
          <p className="text-sm text-stone-500 mt-1">
            The working hours shown to clients on your profile.
          </p>
        </div>
        <button
          onClick={() => void save()}
          disabled={saving || noProfile || !!loadError}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
        >
          {saving ? (
            <>
              <Loader2 size={14} className="animate-spin" /> Saving…
            </>
          ) : saved ? (
            <>
              <Check size={14} /> Saved
            </>
          ) : (
            <>
              <Save size={14} /> Save changes
            </>
          )}
        </button>
      </div>

      {/*
        The limitation, stated where it cannot be missed. A schedule that looks
        enforced but is not is the same class of untruth as a save button that
        confirms a write it never made.
      */}
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 flex gap-3">
        <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
        <div className="text-sm text-amber-900 space-y-1">
          <p className="font-semibold">These hours are published, not enforced.</p>
          <p className="text-amber-800">
            Booking does not check this schedule yet — a client can still request a
            session outside these hours, and existing bookings are unaffected by
            anything you change here. Treat this as what you advertise, not as a
            lock on your calendar.
          </p>
        </div>
      </div>

      {loadError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p className="font-semibold">Could not load your availability.</p>
          <p className="mt-1">{loadError}</p>
          <p className="mt-1 text-red-700">
            Nothing has been changed. Reload the page before editing — saving now
            would overwrite hours that could not be read.
          </p>
        </div>
      )}

      {noProfile && (
        <div className="rounded-2xl border border-stone-200 bg-white shadow-sm p-6 text-sm text-stone-600">
          <p className="font-semibold text-stone-800">
            No therapist profile on this account yet.
          </p>
          <p className="mt-1">
            Availability attaches to your therapist profile, so there is nothing to
            attach a schedule to until that exists. Complete your profile first and
            this page will be ready.
          </p>
        </div>
      )}

      {!noProfile && !loadError && (
        <>
          {error && (
            <div
              role="alert"
              className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
            >
              <p className="font-semibold">Not saved.</p>
              <p className="mt-1">{error}</p>
            </div>
          )}

          {publishedDays === 0 && !saved && (
            <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4 text-sm text-stone-600">
              You have not published any hours yet. Switch on the days you work and
              save — until then your profile shows no availability.
            </div>
          )}

          {/* Timezone — required, because "Monday 09:00" means nothing without it */}
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6 space-y-3">
            <div className="flex items-center gap-2">
              <Globe size={14} className="text-brand" />
              <h2 className="font-semibold text-stone-800">Timezone</h2>
            </div>
            <p className="text-sm text-stone-500">
              Every time on this page is your local time in this zone. Clients in
              other zones see the equivalent time where they are.
            </p>
            <select
              id="timezone"
              aria-label="Timezone"
              value={timezone}
              onChange={(e) => {
                touch();
                setTimezone(e.target.value);
              }}
              className="w-full px-4 py-3 rounded-xl border border-stone-200 text-sm outline-none focus:border-brand bg-white"
            >
              {zoneOptions.map((zone) => (
                <option key={zone} value={zone}>
                  {zone.replace(/_/g, " ")}
                </option>
              ))}
            </select>
            {browserZone && browserZone !== timezone && (
              <p className="text-sm text-stone-500">
                This device is set to {browserZone.replace(/_/g, " ")}.{" "}
                <button
                  type="button"
                  onClick={() => {
                    touch();
                    setTimezone(browserZone);
                  }}
                  className="text-brand font-medium hover:underline cursor-pointer"
                >
                  Use it instead
                </button>
              </p>
            )}
          </div>

          {/* Session settings — stored on the therapist row, not per day */}
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6 grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label
                htmlFor="session-duration"
                className="text-sm font-medium text-stone-700"
              >
                Session duration (min)
              </label>
              <select
                id="session-duration"
                value={sessionDuration}
                onChange={(e) => {
                  touch();
                  setSessionDuration(Number(e.target.value));
                }}
                className="w-full px-4 py-3 rounded-xl border border-stone-200 text-sm outline-none focus:border-brand bg-white"
              >
                {SESSION_DURATION_OPTIONS.map((v) => (
                  <option key={v} value={v}>
                    {v} min
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="buffer-time" className="text-sm font-medium text-stone-700">
                Buffer between sessions (min)
              </label>
              <select
                id="buffer-time"
                value={buffer}
                onChange={(e) => {
                  touch();
                  setBuffer(Number(e.target.value));
                }}
                className="w-full px-4 py-3 rounded-xl border border-stone-200 text-sm outline-none focus:border-brand bg-white"
              >
                {BUFFER_OPTIONS.map((v) => (
                  <option key={v} value={v}>
                    {v} min
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Weekly schedule */}
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Clock size={14} className="text-brand" />
                <h2 className="font-semibold text-stone-800">Weekly Schedule</h2>
              </div>
              <span className="text-xs text-stone-400">
                One block of hours per day
              </span>
            </div>
            <div className="divide-y divide-stone-100">
              {WEEK_ORDER.map((day) => {
                const name = DAY_NAMES[day];
                const row = week[day];
                return (
                  <div
                    key={day}
                    className={`flex flex-wrap items-center gap-3 px-6 py-4 transition-colors ${row.enabled ? "" : "opacity-50"}`}
                  >
                    <div className="flex items-center gap-3 w-32">
                      <button
                        type="button"
                        onClick={() => toggleDay(day)}
                        role="switch"
                        aria-checked={row.enabled}
                        aria-label={`Toggle ${name}`}
                        className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer shrink-0 ${row.enabled ? "bg-brand" : "bg-stone-200"}`}
                      >
                        <span
                          className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${row.enabled ? "translate-x-5" : ""}`}
                        />
                      </button>
                      <span className="text-sm font-medium text-stone-800">
                        {name.slice(0, 3)}
                      </span>
                    </div>

                    {row.enabled ? (
                      <div className="flex items-center gap-2">
                        <select
                          aria-label={`${name} start time`}
                          value={row.from}
                          onChange={(e) => setDayTime(day, "from", e.target.value)}
                          className="px-3 py-2 rounded-lg border border-stone-200 text-sm outline-none focus:border-brand bg-white"
                        >
                          {START_TIME_OPTIONS.map((h) => (
                            <option key={h} value={h}>
                              {h}
                            </option>
                          ))}
                        </select>
                        <span className="text-stone-400 text-sm">to</span>
                        <select
                          aria-label={`${name} end time`}
                          value={row.to}
                          onChange={(e) => setDayTime(day, "to", e.target.value)}
                          className="px-3 py-2 rounded-lg border border-stone-200 text-sm outline-none focus:border-brand bg-white"
                        >
                          {END_TIME_OPTIONS.map((h) => (
                            <option key={h} value={h}>
                              {h}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <span className="text-sm text-stone-400">Not working</span>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="px-6 py-3 border-t border-stone-100 bg-stone-50 text-xs text-stone-500">
              {draft.blocks.length === 0
                ? "No working days selected — your profile will show no availability."
                : `${formatDuration(totalMinutes)} across ${draft.blocks.length} day${draft.blocks.length === 1 ? "" : "s"}, in ${timezone.replace(/_/g, " ")}.`}
            </div>
          </div>

          <p className="text-xs text-stone-400">
            Split shifts (for example 09:00–12:00 and 14:00–18:00 on the same day)
            are not supported yet — each day holds one block of hours.
          </p>
        </>
      )}
    </div>
  );
}
