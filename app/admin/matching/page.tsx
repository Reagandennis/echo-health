import { getLoggedInUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import Link from "next/link";
import AdminPageHeader from "../_components/AdminPageHeader";
import AdminBadge from "../_components/AdminBadge";
import { UserCheck, ArrowRight, AlertCircle } from "lucide-react";
import {
  listMatchConflictsAction,
  listMatchedProfilesAction,
  listTherapistsAction,
} from "@/app/actions/database";

/**
 * Manual assignment console — there is no matching engine.
 *
 * ## What this page claimed
 *
 * It was titled "Matching Engine", subtitled "Monitor the automated
 * patient-therapist matching system", and showed:
 *
 *   • "Avg Match Time 4.2h — Down from 5.1h"
 *   • "Match Success Rate 94% — +2% vs last month"
 *   • "Conflicts 0 — None pending", hardcoded, while `match_conflicts` is a
 *     real table with a real `resolved` flag and its own admin page
 *   • a per-match score rendered as "100%", from `score: 100, // Placeholder`
 *   • "Algorithm Parameters": Specialty Match Weight 40%, Experience 25%,
 *     Availability 20%, Language 15%, each with a progress bar, under
 *     "Parameter tuning requires engineering access"
 *
 * No such algorithm exists. There is no scoring, weighting or ranking code
 * anywhere in the repo — a client is assigned a therapist by an administrator
 * on `/admin/matching/assign`, which is what those four weights were
 * describing the internals of.
 *
 * The weights were the most misleading part, because they invited tuning: an
 * administrator reading "Specialty Match Weight 40%" reasonably concludes that
 * changing it would change who gets matched with whom.
 *
 * ## What it shows now
 *
 * The three counts that are real, the assignments that actually exist with no
 * invented confidence score, and a plain statement that assignment is manual.
 */

/** The fields this page reads. `Doc` is `any` by design (see its note in
 *  `app/actions/database.ts`), so the shapes are narrowed here instead. */
interface MatchedProfileRow {
  $id: string;
  name: string | null;
  therapistId: string | null;
  createdAt: string | Date;
}
interface TherapistRow {
  $id: string;
  name: string | null;
}
interface ConflictRow {
  resolved: boolean;
}

export default async function MatchingDashboardPage() {
  const user = await getLoggedInUser();
  if (!user || !user.labels?.includes("admin")) redirect("/dashboard");

  const [matchedProfiles, therapists, conflicts] = await Promise.all([
    listMatchedProfilesAction() as Promise<MatchedProfileRow[]>,
    listTherapistsAction() as Promise<TherapistRow[]>,
    listMatchConflictsAction() as Promise<ConflictRow[]>,
  ]);

  const openConflicts = conflicts.filter((c) => !c.resolved).length;

  /*
   * Every figure below is a count of rows this page just read. Nothing is a
   * rate, an average or a month-on-month change, because none of those are
   * recorded anywhere — and a trend line is the easiest thing to invent.
   *
   * `listMatchedProfilesAction` caps at 50 and `listMatchConflictsAction` at
   * 50, so these are "of the most recent" rather than totals. Said out loud in
   * the caption, since a capped count presented as a total is its own quiet
   * lie.
   */
  const metrics = [
    {
      label: "Assigned clients",
      value: matchedProfiles.length.toString(),
      change: "Most recent 50 with a therapist",
    },
    {
      label: "Therapists available",
      value: therapists.length.toString(),
      change: "Eligible to be assigned",
    },
    {
      label: "Open conflicts",
      value: openConflicts.toString(),
      change: openConflicts === 0 ? "None pending" : "Need a decision",
    },
  ];

  const recentMatches = matchedProfiles.map((p) => {
    const t = therapists.find((th) => th.$id === p.therapistId);
    return {
      key: p.$id,
      patient: p.name ?? "Unnamed client",
      /* "Unknown" was shown when the lookup missed, which reads as data loss.
         The therapist list is capped, so a miss usually just means they are
         outside this page's window. */
      therapist: t?.name ?? "Not in this list",
      date: new Date(p.createdAt).toLocaleDateString("en-GB", {
        month: "short",
        day: "numeric",
      }),
    };
  });

  return (
    <div>
      <AdminPageHeader
        title="Matching"
        description="Clients are assigned a therapist by hand. There is no automated matching."
        breadcrumbs={[{ label: "Matching" }]}
        actions={
          <div className="flex gap-2">
            <Link href="/admin/matching/assign" className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-stone-600 bg-white border border-stone-200 rounded-xl hover:bg-stone-50">
              <UserCheck className="w-4 h-4" /> Manual Assign
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {metrics.map((m) => (
          <div key={m.label} className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
            <p className="text-xs text-stone-400 uppercase tracking-wider font-medium mb-1">{m.label}</p>
            <p className="text-2xl font-bold text-stone-900">{m.value}</p>
            <p className="text-xs text-stone-400 mt-1">{m.change}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between p-5 border-b border-stone-100">
            <h3 className="text-sm font-bold text-stone-800">Recent Matches</h3>
            <Link href="/admin/matching/assign" className="text-xs text-teal-600 font-semibold hover:text-teal-700">Assign manually →</Link>
          </div>
          <div className="divide-y divide-stone-50 max-h-[400px] overflow-y-auto">
            {recentMatches.length === 0 ? (
              <p className="p-8 text-center text-sm text-stone-400">No recent matches found.</p>
            ) : (
              recentMatches.map((m) => (
                <div key={m.key} className="flex items-center gap-4 px-5 py-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-medium text-stone-800">{m.patient}</span>
                      <ArrowRight className="w-3 h-3 text-stone-300" />
                      <span className="text-sm text-stone-600">{m.therapist}</span>
                    </div>
                    <p className="text-xs text-stone-400">{m.date}</p>
                  </div>
                  {/* A "100%" match score used to sit here, from a literal
                      commented `// Placeholder score`. There is no scoring, so
                      there is no number to put in its place. */}
                  <AdminBadge label="Assigned" variant="success" dot />
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6">
          <h3 className="text-sm font-bold text-stone-800 mb-5">How assignment works</h3>
          <p className="text-sm leading-6 text-stone-600">
            An administrator picks the therapist on{" "}
            <Link href="/admin/matching/assign" className="font-semibold text-teal-600 hover:text-teal-700">
              Manual assign
            </Link>
            . There is no scoring, no weighting and no ranking — this panel
            previously showed four tunable weights (specialty 40%, experience
            25%, availability 20%, language 15%) for an algorithm that does not
            exist in the codebase.
          </p>
          <p className="mt-4 text-sm leading-6 text-stone-600">
            What the intake does produce is{" "}
            <code className="rounded bg-stone-100 px-1 py-0.5 text-xs">requiresLicensedPractitioner</code>
            , which decides whether a client needs a licensed therapist rather
            than a wellness coach. That is a safety gate on who may be assigned,
            not a ranking of who fits best.
          </p>
          <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-amber-100 bg-amber-50 p-3">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
            <p className="text-xs leading-5 text-stone-700">
              Intake answers never reach the server. The quiz keeps them in the
              browser&apos;s <code className="rounded bg-white px-1">sessionStorage</code>{" "}
              and submits nothing, so the stated focus, prior therapy and
              preferences (language, gender, faith, LGBTQ+ affirming) are not
              available to whoever assigns — and the licensed-therapist gate
              cannot be enforced here, only shown to the client.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
