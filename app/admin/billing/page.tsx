import { createAdminClient, getLoggedInUser } from "@/lib/appwrite/server";
import { appwriteConfig } from "@/lib/appwrite/config";
import { redirect } from "next/navigation";
import Link from "next/link";
import AdminPageHeader from "../_components/AdminPageHeader";
import { DollarSign, TrendingUp, CreditCard, Users, ArrowRight } from "lucide-react";
import { Query } from "node-appwrite";

export default async function BillingDashboardPage() {
  const user = await getLoggedInUser();
  if (!user || !user.labels?.includes("admin")) redirect("/dashboard");

  const { databases, users: authUsers } = createAdminClient();
  
  const [sessionList, userList] = await Promise.all([
    databases.listDocuments(appwriteConfig.databaseId, appwriteConfig.collections.sessions, [
      Query.equal("status", "completed"),
      Query.limit(100)
    ]),
    authUsers.list()
  ]);

  const totalCompleted = sessionList.total;
  const mrr = totalCompleted * 50; // Simple estimate: $50 per session
  const arr = mrr * 12;

  const MONTHLY = [
    { month: "Nov", value: 0 }, { month: "Dec", value: 0 },
    { month: "Jan", value: 0 }, { month: "Feb", value: 0 },
    { month: "Mar", value: 0 }, { month: "Apr", value: mrr },
  ];
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
          { label: "Total Users", value: userList.total.toString(), change: "Active across platform", icon: Users, color: "bg-blue-100 text-blue-700" },
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
