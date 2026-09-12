import { getLoggedInUser } from "@/lib/auth/session";
import { notFound, redirect } from "next/navigation";
import AdminPageHeader from "../../../_components/AdminPageHeader";
import AdminBadge from "../../../_components/AdminBadge";
import { getSessionQuality } from "../../../_lib/queries";
import { Star, Info } from "lucide-react";

/**
 * Session quality — the client's own rating, and nothing invented.
 *
 * ## What was here
 *
 * Six metric tiles, all literals: "Overall Quality Score 92/100", "Connection
 * Latency 42ms avg", "Video Drop Events 0", "Audio Quality Excellent", "Session
 * Duration 52 min", "Reconnections 0" — each with a green "Normal" badge. Then
 * a "Connection Timeline" chart of 52 bars whose heights were
 * `40 + Math.random() * 60`.
 *
 * The numbers were the same for every session, because they were hardcoded, and
 * the chart was different on every render, because it was random. Both sat
 * under a breadcrumb naming a real session id, which is what made them a claim
 * about that session rather than obvious placeholder furniture.
 *
 * None of it was collectable. Video runs on the Echo backend, which relays call
 * setup and never sees media, so there is no latency or drop-event telemetry
 * anywhere in the system. `therapy_sessions` has no columns for it.
 *
 * The `Math.random()` call was also a genuine rendering bug independent of the
 * honesty problem: an impure call during render, so the server HTML and the
 * first client render disagreed on all 52 heights. React logs a hydration
 * mismatch for that and discards the server markup.
 *
 * ## What is here now
 *
 * The session's real state, and the client's real feedback if they left any.
 * That is the signal clients were told about — `/reviews` says feedback goes to
 * their therapist "and to the team that reviews session quality" — and admins
 * are admitted to `session_feedback` by policy for that purpose. Where there is
 * no feedback the page says so, which is a useful fact rather than a gap to
 * fill.
 */
export default async function SessionQualityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getLoggedInUser();
  if (!user || !user.labels?.includes("admin")) redirect("/dashboard");
  const { id } = await params;

  const session = await getSessionQuality(id);
  if (!session) notFound();

  const ratings = session.feedback.map((f) => f.rating);
  /* Stated as a mean of N ratings, never as a score out of 100. The previous
     "92/100" implied a composite measurement that does not exist. */
  const mean =
    ratings.length > 0
      ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1)
      : null;

  return (
    <div>
      <AdminPageHeader
        title="Session quality"
        description="What clients reported about this session."
        breadcrumbs={[
          { label: "Sessions", href: "/admin/sessions" },
          { label: id.slice(0, 10) + "…", href: `/admin/sessions/${id}` },
          { label: "Quality" },
        ]}
      />

      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-stone-400">
            Client rating
          </p>
          <p className="mb-2 text-2xl font-bold text-stone-900">
            {mean ? `${mean} / 5` : "Not rated"}
          </p>
          <AdminBadge
            label={mean ? `${ratings.length} response${ratings.length === 1 ? "" : "s"}` : "No feedback"}
            variant={mean ? "success" : "neutral"}
          />
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-stone-400">
            Status
          </p>
          <p className="mb-2 text-2xl font-bold capitalize text-stone-900">{session.status}</p>
          <AdminBadge
            label={session.sessionType ?? "unspecified"}
            variant="neutral"
          />
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-stone-400">
            Scheduled
          </p>
          <p className="mb-2 text-2xl font-bold text-stone-900">
            {session.scheduledAt.toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </p>
          <AdminBadge
            label={session.scheduledAt.toLocaleTimeString("en-GB", {
              hour: "2-digit",
              minute: "2-digit",
              timeZone: "Africa/Nairobi",
            })}
            variant="neutral"
          />
        </div>
      </div>

      <div className="mb-8 flex gap-3 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-stone-400" />
        <div className="text-sm leading-6 text-stone-600">
          <p className="font-semibold text-stone-900">
            No connection telemetry is collected.
          </p>
          <p className="mt-1">
            This page previously showed latency, drop events and a connection
            timeline. None of it existed: the video service relays call setup and
            never sees media, so there is nothing to measure and the figures were
            literals. If connection quality needs monitoring, it has to be
            reported by the client during the call and stored — that work has not
            been done.
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
        <div className="border-b border-stone-100 p-5">
          <h3 className="text-sm font-bold text-stone-800">Feedback</h3>
        </div>
        {session.feedback.length === 0 ? (
          <p className="p-5 text-sm text-stone-500">
            Nobody left feedback on this session.
          </p>
        ) : (
          <ul className="divide-y divide-stone-50">
            {session.feedback.map((f, i) => (
              <li key={i} className="p-5">
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }, (_, n) => (
                      <Star
                        key={n}
                        className={`h-3.5 w-3.5 ${
                          n < f.rating ? "fill-amber-400 text-amber-400" : "text-stone-200"
                        }`}
                      />
                    ))}
                  </span>
                  <span className="text-sm font-medium text-stone-800">{f.author}</span>
                  <span className="text-xs text-stone-400">
                    {f.createdAt.toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </div>
                {f.comment && (
                  <p className="mt-2 text-sm leading-6 text-stone-600">{f.comment}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
