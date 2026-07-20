import { getLoggedInUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import Link from "next/link";
import AdminPageHeader from "../_components/AdminPageHeader";
import { DollarSign, TrendingUp, CreditCard, Users, ArrowRight } from "lucide-react";
import { listAllSessions, listProfiles } from "../_lib/queries";

/**
 * There is no payments integration, so every currency figure here is an
 * estimate derived from completed-session counts at a flat $50 — that was true
 * before this port and remains true. `therapy_sessions.amount` exists in the
 * schema but nothing writes it. The session and user counts ARE real.
 */
const ESTIMATED_RATE_USD = 50;

export default async function BillingDashboardPage() {
  const user = await getLoggedInUser();
  if (!user || !user.labels?.includes("admin")) redirect("/dashboard");

  const [sessions, profiles] = await Promise.all([
    listAllSessions(),
    listProfiles(),
  ]);

  const completed = sessions.filter((s) => s.status === "completed");
  const totalCompleted = completed.length;
  const mrr = totalCompleted * ESTIMATED_RATE_USD;
  const arr = mrr * 12;

  // Real trailing-six-month distribution, replacing five hardcoded zeroes and a
  // single bar labelled "Apr" that held the entire all-time total.
  const now = new Date();
  const MONTHLY = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const count = completed.filter(
      (s) =>
        s.scheduledAt.getFullYear() === d.getFullYear() &&
        s.scheduledAt.getMonth() === d.getMonth()
    ).length;
    return {
      month: d.toLocaleDateString("en-US", { month: "short" }),
      value: count * ESTIMATED_RATE_USD,
    };
  });
  const max = Math.max(...MONTHLY.map((m) => m.value)) || 1000;

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
          { label: "Est. MRR", value: `$${mrr.toLocaleString()}`, change: "Based on completions", icon: DollarSign, color: "bg-emerald-100 text-emerald-700" },
          { label: "Est. ARR", value: `$${arr.toLocaleString()}`, change: "Projected annual", icon: TrendingUp, color: "bg-teal-100 text-teal-700" },
          { label: "Total Users", value: profiles.length.toString(), change: "Active across platform", icon: Users, color: "bg-blue-100 text-blue-700" },
          { label: "Sessions", value: totalCompleted.toString(), change: "Completed to date", icon: CreditCard, color: "bg-amber-100 text-amber-700" },
        ].map((m) => (
          <div key={m.label} className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
            <div className={`w-9 h-9 rounded-xl ${m.color} flex items-center justify-center mb-3`}><m.icon className="w-4 h-4" /></div>
            <p className="text-xs text-stone-400 uppercase tracking-wider">{m.label}</p>
            <p className="text-2xl font-bold text-stone-900 mt-1">{m.value}</p>
            <p className="text-xs text-stone-400 mt-1">{m.change}</p>
          </div>
        ))}
      </div>

      {/* Revenue chart */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6 mb-6">
        <h3 className="text-sm font-bold text-stone-800 mb-6">Platform Volume Estimate</h3>
        <div className="flex items-end gap-4 h-48">
          {MONTHLY.map((m) => (
            <div key={m.month} className="flex-1 flex flex-col items-center gap-2">
              <span className="text-xs text-stone-500">${(m.value / 1000).toFixed(1)}k</span>
              <div className="w-full rounded-t-xl bg-gradient-to-t from-teal-600 to-teal-400 hover:from-teal-700 hover:to-teal-500 transition-colors"
                style={{ height: `${(m.value / max) * 100}%` }} />
              <span className="text-xs font-medium text-stone-500">{m.month}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Transactions", href: "/admin/billing/transactions" },
          { label: "Refunds", href: "/admin/billing/refunds" },
          { label: "Invoices", href: "/admin/billing/invoices" },
          { label: "Plans", href: "/admin/billing/plans" },
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
