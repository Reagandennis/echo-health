import { getLoggedInUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import Link from "next/link";
import AdminPageHeader from "../../_components/AdminPageHeader";
import AdminEmptyState from "../../_components/AdminEmptyState";
import { listTherapistLeaderboard, listTherapists } from "../../_lib/queries";
import { formatKes } from "../../_lib/money";
import { THERAPIST_REVENUE_SHARE } from "@/lib/constants";
import { Star } from "lucide-react";

/**
 * Real therapists, ranked by completed sessions, with earnings derived from the
 * revenue share in `lib/constants.ts`.
 *
 * The leaderboard was ten invented clinicians — Dr. Patel, Dr. Osei, Dr. Santos
 * and so on — with invented ratings and USD earnings up to "$6,720". None of
 * them exist. Retention and completion rates are not derivable from the schema
 * and have been dropped rather than replaced with another plausible number.
 */
export default async function TherapistAnalyticsPage() {
  const user = await getLoggedInUser();
  if (!user || !user.labels?.includes("admin")) redirect("/dashboard");

  const [leaderboard, therapists] = await Promise.all([
    listTherapistLeaderboard(),
    listTherapists(),
  ]);

  const rated = therapists.filter((t) => typeof t.rating === "number");
  const avgRating = rated.length
    ? (rated.reduce((sum, t) => sum + (t.rating ?? 0), 0) / rated.length).toFixed(1)
    : "—";
  const completedTotal = leaderboard.reduce((sum, t) => sum + t.completedSessions, 0);
  const awaitingVerification = therapists.filter(
    (t) => t.kycStatus === "pending" || t.kycStatus === "incomplete"
  ).length;

  const sharePercent = Math.round(THERAPIST_REVENUE_SHARE * 100);

  return (
    <div>
      <AdminPageHeader
        title="Therapist Performance Analytics"
        breadcrumbs={[{ label: "Analytics", href: "/admin/analytics" }, { label: "Therapists" }]}
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Avg Rating", value: rated.length ? `${avgRating} ★` : "—", sub: `${rated.length} rated` },
          { label: "Therapists", value: therapists.length.toString(), sub: "On the platform" },
          { label: "Sessions Completed", value: completedTotal.toString(), sub: "Across the leaderboard" },
          { label: "Awaiting Verification", value: awaitingVerification.toString(), sub: "KYC not verified" },
        ].map((m) => (
          <div key={m.label} className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
            <p className="text-xs text-stone-400 uppercase tracking-wider font-medium mb-1">{m.label}</p>
            <p className="text-2xl font-bold text-stone-900">{m.value}</p>
            <p className="text-xs text-stone-400 mt-1">{m.sub}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-stone-100">
          <h3 className="text-sm font-bold text-stone-800">Top Therapists Leaderboard</h3>
          <p className="text-xs text-stone-400 mt-0.5">
            Ranked by completed sessions, all time. Earnings are the {sharePercent}% therapist
            share, accrued — not paid.
          </p>
        </div>
        {leaderboard.length === 0 ? (
          <AdminEmptyState
            title="No therapists yet"
            description="Rankings appear once therapists join and complete sessions."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[600px]">
              <thead className="bg-stone-50 border-b border-stone-100">
                <tr>
                  {["Rank", "Therapist", "Completed", "Total Booked", "Rating", "Earnings"].map((h) => (
                    <th key={h} className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-stone-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-50">
                {leaderboard.map((t, i) => (
                  <tr key={t.id} className={`hover:bg-stone-50/50 transition-colors ${i < 3 ? "bg-amber-50/30" : ""}`}>
                    <td className="px-5 py-4">
                      <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? "bg-amber-400 text-white" : i === 1 ? "bg-stone-300 text-white" : i === 2 ? "bg-orange-400 text-white" : "bg-stone-100 text-stone-500"}`}>
                        {i + 1}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-indigo-500 flex items-center justify-center text-white text-xs font-bold">
                          {t.name.charAt(0).toUpperCase()}
                        </div>
                        <Link href={`/admin/therapists/${t.id}`} className="text-sm font-semibold text-stone-800 hover:text-teal-600 transition-colors">
                          {t.name}
                        </Link>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-stone-700 font-semibold">{t.completedSessions}</td>
                    <td className="px-5 py-4 text-sm text-stone-600">{t.totalSessions}</td>
                    <td className="px-5 py-4">
                      {typeof t.rating === "number" ? (
                        <div className="flex items-center gap-1">
                          <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                          <span className="text-sm text-stone-700">{t.rating.toFixed(1)}</span>
                        </div>
                      ) : (
                        <span className="text-sm text-stone-400">Unrated</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-sm font-semibold text-emerald-700">{formatKes(t.earningsMinor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
