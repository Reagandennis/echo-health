import { getLoggedInUser } from "@/lib/appwrite/server";
import { redirect } from "next/navigation";
import AdminPageHeader from "../../_components/AdminPageHeader";
import AdminBadge from "../../_components/AdminBadge";
import { Search } from "lucide-react";

const TRANSACTIONS = [
  { id: "txn_001", client: "Sarah M.", plan: "Growth", amount: "$79.00", date: "Apr 1, 2026", method: "Visa ****4242", status: "paid" },
  { id: "txn_002", client: "James K.", plan: "Basic", amount: "$39.00", date: "Apr 1, 2026", method: "Mastercard ****8899", status: "paid" },
  { id: "txn_003", client: "Amara L.", plan: "Growth", amount: "$79.00", date: "Apr 1, 2026", method: "Visa ****1234", status: "failed" },
  { id: "txn_004", client: "Daniel T.", plan: "Premium", amount: "$149.00", date: "Mar 28, 2026", method: "PayPal", status: "refunded" },
  { id: "txn_005", client: "Monica J.", plan: "Growth", amount: "$79.00", date: "Mar 1, 2026", method: "Visa ****5678", status: "paid" },
];

export default async function TransactionsPage() {
  const user = await getLoggedInUser();
  if (!user || !user.labels?.includes("admin")) redirect("/dashboard");

  return (
    <div>
      <AdminPageHeader
        title="Transactions"
        breadcrumbs={[{ label: "Billing", href: "/admin/billing" }, { label: "Transactions" }]}
      />
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex items-center gap-2 bg-white border border-stone-200 rounded-xl px-3 py-2 flex-1 min-w-[200px] max-w-sm">
          <Search className="w-4 h-4 text-stone-400" />
          <input type="text" placeholder="Search transactions…" className="text-sm outline-none text-stone-700 placeholder-stone-400 w-full bg-transparent" />
        </div>
        {["All", "Paid", "Failed", "Refunded"].map((f) => (
          <button key={f} className={`px-3 py-2 text-sm font-medium rounded-xl border transition-colors ${f === "All" ? "bg-teal-600 text-white border-teal-600" : "bg-white text-stone-600 border-stone-200 hover:bg-stone-50"}`}>{f}</button>
        ))}
      </div>
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[700px]">
            <thead className="bg-stone-50 border-b border-stone-100">
              <tr>{["Transaction ID", "Client", "Plan", "Amount", "Date", "Method", "Status", ""].map((h) => <th key={h} className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-stone-500">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {TRANSACTIONS.map((t) => (
                <tr key={t.id} className="hover:bg-stone-50/50 transition-colors group">
                  <td className="px-5 py-4 text-xs font-mono text-stone-400">{t.id}</td>
                  <td className="px-5 py-4 text-sm font-medium text-stone-800">{t.client}</td>
                  <td className="px-5 py-4 text-sm text-stone-600">{t.plan}</td>
                  <td className="px-5 py-4 text-sm font-semibold text-stone-900">{t.amount}</td>
                  <td className="px-5 py-4 text-sm text-stone-600">{t.date}</td>
                  <td className="px-5 py-4 text-xs text-stone-500">{t.method}</td>
                  <td className="px-5 py-4"><AdminBadge label={t.status.charAt(0).toUpperCase() + t.status.slice(1)} variant={t.status === "paid" ? "success" : t.status === "refunded" ? "warning" : "danger"} dot /></td>
                  <td className="px-5 py-4 text-right"><a href={`/admin/billing/transactions/${t.id}`} className="text-xs text-teal-600 hover:text-teal-700 font-medium opacity-0 group-hover:opacity-100 transition-opacity">View →</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
