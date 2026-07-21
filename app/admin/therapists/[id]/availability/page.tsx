import { getLoggedInUser } from "@/lib/auth/session";
import { redirect, notFound } from "next/navigation";
import { AlertTriangle, CalendarX, Globe } from "lucide-react";

import AdminPageHeader from "../../../_components/AdminPageHeader";
import { getTherapist } from "../../../_lib/queries";
import { getTherapistAvailabilityAction } from "@/app/actions/database";
import {
  DAY_NAMES,
  MINUTES_IN_DAY,
  WEEK_ORDER,
  formatDuration,
  formatZoneNow,
  minutesToTime,
  weeklyMinutes,
  type AvailabilityBlock,
} from "@/lib/availability";

/**
 * A therapist's published working hours, read-only.
 *
 * WHAT THIS PAGE USED TO SHOW. A hardcoded `AVAILABLE` map — Mon 9/10/14/15, Tue
 * 9/10/11, and so on — rendered as a teal grid for every therapist in the
 * platform, identically. The only live data on the page was the therapist's name.
 * An admin comparing two clinicians' schedules was comparing the same fabricated
 * week twice.
 *
 * It now reads `therapist_availability`. The two things it must never do again
 * are invent hours nobody set, and present them as more binding than they are.
 */

/** Ticks on the day ruler. Hourly would be unreadable at this width. */
const RULER_HOURS = [0, 6, 12, 18, 24];

export default async function TherapistAvailabilityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getLoggedInUser();
  if (!user || !user.labels?.includes("admin")) redirect("/dashboard");
  const { id } = await params;
  const t = await getTherapist(id);
  if (!t) notFound();

  const availability = await getTherapistAvailabilityAction(id);

  const timezone = availability?.timezone ?? "Africa/Nairobi";
  const zoneNow = formatZoneNow(timezone);
  const blocks: AvailabilityBlock[] = availability?.blocks ?? [];
  const byDay = new Map(blocks.map((b) => [b.dayOfWeek, b]));
  const total = weeklyMinutes(blocks);

  return (
    <div>
      <AdminPageHeader
        title="Availability"
        description="The working hours this therapist has published. Read-only."
        breadcrumbs={[
          { label: "Therapists", href: "/admin/therapists" },
          { label: t.name, href: `/admin/therapists/${id}` },
          { label: "Availability" },
        ]}
      />

      {/*
        Stated first, because an admin reading a schedule is usually deciding
        something with it. Nothing downstream enforces these hours.
      */}
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 flex gap-3 mb-6">
        <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
        <div className="text-sm text-amber-900 space-y-1">
          <p className="font-semibold">Advisory only — bookings are not checked against this.</p>
          <p className="text-amber-800">
            Session booking does not consult availability, so clients can and do
            book outside these hours. A session on this therapist&apos;s calendar
            that falls outside the schedule below is not an error, and an empty
            schedule does not prevent anyone from booking.
          </p>
        </div>
      </div>

      {/* Whose clock these times are on. The single most important label here. */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5 mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex gap-3">
            <Globe size={16} className="text-teal-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-stone-800">
                All times below are in {timezone.replace(/_/g, " ")}
              </p>
              <p className="text-sm text-stone-500 mt-0.5">
                {t.name}&apos;s own timezone
                {zoneNow ? ` — it is ${zoneNow} there now.` : "."} Times are stored
                as local wall-clock times in this zone, not converted.
              </p>
            </div>
          </div>
          <dl className="flex gap-6 text-sm">
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
                Session
              </dt>
              <dd className="text-stone-800 font-medium mt-0.5">
                {availability?.sessionDurationMinutes ?? 50} min
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
                Buffer
              </dt>
              <dd className="text-stone-800 font-medium mt-0.5">
                {availability?.bufferMinutes ?? 10} min
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
                Weekly
              </dt>
              <dd className="text-stone-800 font-medium mt-0.5">
                {blocks.length === 0 ? "—" : formatDuration(total)}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {blocks.length === 0 ? (
        /*
         * The honest empty state. The previous page could not have one: it had no
         * data to be empty of, so a therapist who had set nothing was still shown
         * a full week of hours.
         */
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-10 text-center">
          <CalendarX size={28} className="text-stone-300 mx-auto mb-3" />
          <p className="font-semibold text-stone-800">
            No working hours published
          </p>
          <p className="text-sm text-stone-500 mt-1 max-w-md mx-auto">
            {t.name} has not set a schedule, so their profile shows no
            availability to clients. This does not block booking — clients can
            still request sessions with them.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
          <div className="divide-y divide-stone-100">
            {WEEK_ORDER.map((day) => {
              const block = byDay.get(day);
              const name = DAY_NAMES[day];

              return (
                <div key={day} className="flex items-center gap-4 px-5 py-3.5">
                  <span
                    className={`w-12 text-sm font-medium shrink-0 ${block ? "text-stone-800" : "text-stone-400"}`}
                  >
                    {name.slice(0, 3)}
                  </span>

                  {/*
                    A proportional bar across the full 24 hours, not a slot grid.
                    A grid would imply bookable slots; the table stores one
                    continuous range per day and this draws exactly that.
                  */}
                  <div className="flex-1 min-w-0">
                    <div className="relative h-6 rounded-lg bg-stone-50 border border-stone-100 overflow-hidden">
                      {block && (
                        <div
                          className="absolute top-0 bottom-0 bg-teal-100 border border-teal-300 rounded-md"
                          style={{
                            left: `${(block.startMinute / MINUTES_IN_DAY) * 100}%`,
                            width: `${((block.endMinute - block.startMinute) / MINUTES_IN_DAY) * 100}%`,
                          }}
                        />
                      )}
                    </div>
                  </div>

                  <span
                    className={`w-32 text-right text-sm tabular-nums shrink-0 ${block ? "text-stone-700" : "text-stone-300"}`}
                  >
                    {block
                      ? `${minutesToTime(block.startMinute)} – ${minutesToTime(block.endMinute)}`
                      : "Not working"}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Ruler, so the bars above are readable as times rather than shapes. */}
          <div className="px-5 pb-3">
            <div className="flex items-center gap-4">
              <span className="w-12 shrink-0" />
              <div className="flex-1 flex justify-between text-[10px] text-stone-400 tabular-nums">
                {RULER_HOURS.map((hour) => (
                  <span key={hour}>{String(hour).padStart(2, "0")}:00</span>
                ))}
              </div>
              <span className="w-32 shrink-0" />
            </div>
          </div>

          <div className="px-5 py-3 border-t border-stone-100 bg-stone-50 text-xs text-stone-500">
            One block of hours per day — split shifts are not modelled yet, so a
            therapist who works mornings and evenings can currently only publish
            the outer span.
          </div>
        </div>
      )}
    </div>
  );
}
