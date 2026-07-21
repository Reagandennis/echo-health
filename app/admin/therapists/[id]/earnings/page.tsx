import { getLoggedInUser } from "@/lib/auth/session";
import { redirect, notFound } from "next/navigation";
import AdminPageHeader from "../../../_components/AdminPageHeader";
import AdminEmptyState from "../../../_components/AdminEmptyState";
import { getTherapist, getTherapistEarnings } from "../../../_lib/queries";
import { formatKes } from "../../../_lib/money";
import { THERAPIST_REVENUE_SHARE } from "@/lib/constants";
import { DollarSign, TrendingUp, Wallet, CalendarCheck } from "lucide-react";

/**
 * Earnings computed from this therapist's completed sessions and the revenue
 * share in `lib/constants.ts`. `therapy_sessions.amount` is now populated at
 * booking time from the payment the session draws against, so the figures below
 * trace back to money actually received.
 *
 * This is an earnings statement, NOT a payout record. The page used to render a
 * "Payout History" table of USD amounts marked paid and pending, implying
 * disbursements that never happened — there is no payouts table. Accrued is
 * stated as accrued.
 */
export default async function TherapistEarningsPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const user = await getLoggedInUser();
  if (!user || !user.labels?.includes("admin")) redirect("/dashboard");
  const { id } = await params;

  const [t, earnings] = await Promise.all([
    getTherapist(id),
    getTherapistEarnings(id),
  ]);
  if (!t) notFound();

  const sharePercent = Math.round(THERAPIST_REVENUE_SHARE * 100);
  const maxMonth = Math.max(...earnings.monthly.map((m) => m.therapistShareMinor), 1);

  return (
    <div>
      <AdminPageHeader
        title="Earnings Summary"
        description="Accrued from completed sessions. No amount here has been disbursed."
        breadcrumbs={[{ label: "Therapists", href: "/admin/therapists" }, { label: t.name, href: `/admin/therapists/${id}` }, { label: "Earnings" }]}
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[
          { label: `Therapist Share (${sharePercent}%)`, value: formatKes(earnings.therapistShareMinor), icon: Wallet, color: "bg-emerald-100 text-emerald-700" },
          { label: "Client Value Delivered", value: formatKes(earnings.grossMinor), icon: DollarSign, color: "bg-teal-100 text-teal-700" },
          { label: `Platform Share (${100 - sharePercent}%)`, value: formatKes(earnings.platformShareMinor), icon: TrendingUp, color: "bg-stone-100 text-stone-700" },
          { label: "Sessions Completed", value: earnings.completedSessions.toString(), icon: CalendarCheck, color: "bg-amber-100 text-amber-700" },
        ].map((m) => (
          <div key={m.label} className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
            <div className={`w-9 h-9 rounded-xl ${m.color} flex items-center justify-center mb-3`}>
              <m.icon className="w-4 h-4" />
            </div>
            <p className="text-xs text-stone-400 uppercase tracking-wider font-medium">{m.label}</p>
            <p className="text-xl font-bold text-stone-900 mt-1">{m.value}</p>
          </div>
        ))}
      </div>

      {/* A completed session with no `amount` contributes nothing to the totals.
          Saying so distinguishes "earned little" from "we cannot tell", which
          matters before anyone pays against these numbers. */}
      {earnings.unpricedSessions > 0 && (
        <div className="mb-6 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
          {earnings.unpricedSessions} completed{" "}
          {earnings.unpricedSessions === 1 ? "session carries" : "sessions carry"} no
          recorded value and {earnings.unpricedSessions === 1 ? "is" : "are"} excluded
          from these totals.
        </div>
      )}

      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-stone-100">
          <h3 className="text-sm font-bold text-stone-800">Monthly Accrual</h3>
          <p className="text-xs text-stone-400 mt-0.5">Last 6 months, by session date.</p>
        </div>
        {earnings.completedSessions === 0 ? (
          <AdminEmptyState
            title="No completed sessions"
            description="Earnings accrue once this therapist completes a session that a client has paid for."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[500px]">
              <thead className="bg-stone-50 border-b border-stone-100">
                <tr>
                  {["Month", "Sessions", "Client Value", `Therapist Share (${sharePercent}%)`, ""].map((h) => (
                    <th key={h} className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-stone-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-50">
                {earnings.monthly.map((m) => (
                  <tr key={m.month} className="hover:bg-stone-50/50 transition-colors">
                    <td className="px-5 py-4 text-sm font-medium text-stone-800">{m.month}</td>
                    <td className="px-5 py-4 text-sm text-stone-600">{m.sessions}</td>
                    <td className="px-5 py-4 text-sm text-stone-600">{formatKes(m.grossMinor)}</td>
                    <td className="px-5 py-4 text-sm font-semibold text-stone-900">{formatKes(m.therapistShareMinor)}</td>
                    <td className="px-5 py-4 w-1/3">
                      <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
                        <div className="h-full bg-teal-500 rounded-full" style={{ width: `${(m.therapistShareMinor / maxMonth) * 100}%` }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="px-5 py-4 border-t border-stone-100 text-xs text-stone-400">
          Payouts are not yet implemented — these amounts are accrued, not paid.
        </p>
      </div>
    </div>
  );
}
