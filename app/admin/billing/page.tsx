import { getLoggedInUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import Link from "next/link";
import AdminPageHeader from "../_components/AdminPageHeader";
import { DollarSign, TrendingUp, CreditCard, Users, ArrowRight } from "lucide-react";
import { getRevenueSummary, listAllSessions, listProfiles } from "../_lib/queries";
import { formatKes, formatKesCompact } from "../_lib/money";

/**
 * Revenue read from the `payments` ledger.
 *
 * This page used to multiply completed sessions by a flat `ESTIMATED_RATE_USD =
 * 50` and label the result MRR. That was wrong three ways at once: it counted
 * sessions instead of money, it never touched the payments table, and it printed
 * the answer in USD for an account that settles in KES. Nothing here is an
 * estimate any more, so nothing is labelled as one.
 */
export default async function BillingDashboardPage() {
  const user = await getLoggedInUser();
  if (!user || !user.labels?.includes("admin")) redirect("/dashboard");

  const [revenue, sessions, profiles] = await Promise.all([
    getRevenueSummary(),
    listAllSessions(),
    listProfiles(),
  ]);

  const completed = sessions.filter((s) => s.status === "completed").length;
  const max = Math.max(...revenue.monthly.map((m) => m.grossMinor), 1);

  return (
    <div>
      <AdminPageHeader
        title="Revenue Dashboard"
        description="Platform financial overview and billing metrics."
        breadcrumbs={[{ label: "Billing" }]}
        actions={
          <div className="flex gap-2">
            <Link href="/admin/billing/payouts" className="px-3 py-2 text-sm font-medium text-stone-600 bg-white border border-stone-200 rounded-xl hover:bg-stone-50">Payouts</Link>
            <Link href="/admin/billing/transactions" className="px-3 py-2 text-sm font-medium text-white bg-teal-600 rounded-xl hover:bg-teal-700">Transactions</Link>
          </div>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Gross Revenue", value: formatKes(revenue.grossMinor), change: "Successful charges, all time", icon: DollarSign, color: "bg-emerald-100 text-emerald-700" },
          { label: "Paying Clients", value: revenue.payingClients.toString(), change: `of ${profiles.length} registered`, icon: Users, color: "bg-teal-100 text-teal-700" },
          { label: "Successful Charges", value: revenue.successCount.toString(), change: `${revenue.failedCount} failed · ${revenue.pendingCount} pending`, icon: CreditCard, color: "bg-blue-100 text-blue-700" },
          { label: "Sessions Completed", value: completed.toString(), change: "Delivered to date", icon: TrendingUp, color: "bg-amber-100 text-amber-700" },
        ].map((m) => (
          <div key={m.label} className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
            <div className={`w-9 h-9 rounded-xl ${m.color} flex items-center justify-center mb-3`}><m.icon className="w-4 h-4" /></div>
            <p className="text-xs text-stone-400 uppercase tracking-wider">{m.label}</p>
            <p className="text-2xl font-bold text-stone-900 mt-1">{m.value}</p>
            <p className="text-xs text-stone-400 mt-1">{m.change}</p>
          </div>
        ))}
      </div>

      {/* Charges settled in another currency are excluded from every total above
          rather than folded in — adding shillings to dollars is the bug this
          page existed to demonstrate. Disclosed so the gap is visible. */}
      {revenue.foreignCurrencyCount > 0 && (
        <div className="mb-6 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
          {revenue.foreignCurrencyCount} successful{" "}
          {revenue.foreignCurrencyCount === 1 ? "charge is" : "charges are"} settled in a
          currency other than KES and {revenue.foreignCurrencyCount === 1 ? "is" : "are"} not
          included in these totals.
        </div>
      )}

      {/* Revenue chart */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6 mb-6">
        <h3 className="text-sm font-bold text-stone-800 mb-1">Revenue — Last 6 Months</h3>
        <p className="text-xs text-stone-400 mb-6">Successful charges, by month settled.</p>
        <div className="flex items-end gap-4 h-48">
          {revenue.monthly.map((m) => (
            <div key={m.month} className="flex-1 flex flex-col items-center gap-2">
              <span className="text-xs text-stone-500">{formatKesCompact(m.grossMinor)}</span>
              <div className="w-full rounded-t-xl bg-gradient-to-t from-teal-600 to-teal-400 hover:from-teal-700 hover:to-teal-500 transition-colors"
                style={{ height: `${(m.grossMinor / max) * 100}%` }} />
              <span className="text-xs font-medium text-stone-500">{m.month}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {[
          { label: "Transactions", href: "/admin/billing/transactions" },
          { label: "Plans", href: "/admin/billing/plans" },
          { label: "Pricing & Promos", href: "/admin/config/pricing" },
        ].map((l) => (
          <Link key={l.label} href={l.href} className="flex items-center justify-between p-4 bg-white rounded-2xl border border-stone-200 shadow-sm hover:border-teal-300 hover:shadow-md transition-all group">
            <span className="text-sm font-semibold text-stone-700">{l.label}</span>
            <ArrowRight className="w-4 h-4 text-stone-400 group-hover:text-teal-500 transition-colors" />
          </Link>
        ))}
      </div>
    </div>
  );
}
