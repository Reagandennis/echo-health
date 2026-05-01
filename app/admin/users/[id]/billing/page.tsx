import { createAdminClient, getLoggedInUser } from "@/lib/appwrite/server";
import { redirect, notFound } from "next/navigation";
import AdminPageHeader from "../../../_components/AdminPageHeader";
import AdminBadge from "../../../_components/AdminBadge";
import { CreditCard, Download, RefreshCw } from "lucide-react";

const MOCK_TRANSACTIONS = [
  { id: "txn_001", date: "2026-04-01", description: "Monthly Subscription — Growth Plan", amount: "$79.00", status: "paid" },
  { id: "txn_002", date: "2026-03-01", description: "Monthly Subscription — Growth Plan", amount: "$79.00", status: "paid" },
  { id: "txn_003", date: "2026-02-01", description: "Monthly Subscription — Growth Plan", amount: "$79.00", status: "paid" },
  { id: "txn_004", date: "2026-01-10", description: "One-time Session — Crisis Support", amount: "$45.00", status: "refunded" },
  { id: "txn_005", date: "2026-01-01", description: "Monthly Subscription — Basic Plan", amount: "$39.00", status: "paid" },
];

export default async function ClientBillingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getLoggedInUser();
  if (!user || !user.labels?.includes("admin")) redirect("/dashboard");
  const { id } = await params;
  const { users } = createAdminClient();
  let client;
  try { client = await users.get(id); } catch { notFound(); }

  return (
    <div>
      <AdminPageHeader
        title="Billing Summary"
        breadcrumbs={[
          { label: "Clients", href: "/admin/users" },
          { label: client.name, href: `/admin/users/${id}` },
          { label: "Billing" },
        ]}
        actions={
          <button className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-stone-600 bg-white border border-stone-200 rounded-xl hover:bg-stone-50 transition-colors">
            <Download className="w-4 h-4" /> Export Invoices
          </button>
        }
      />

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Current Plan",   value: "Growth",   sub: "$79 / month" },
          { label: "Total Paid",     value: "$355.00",  sub: "All time" },
          { label: "Last Payment",   value: "Apr 1",    sub: "Successful" },
          { label: "Next Renewal",   value: "May 1",    sub: "Upcoming" },
        ].map((m) => (
          <div key={m.label} className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
            <p className="text-xs text-stone-400 uppercase tracking-wider font-medium mb-1">{m.label}</p>
            <p className="text-xl font-bold text-stone-900">{m.value}</p>
            <p className="text-xs text-stone-400 mt-0.5">{m.sub}</p>
          </div>
        ))}
      </div>

      {/* Subscription */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5 mb-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center">
              <CreditCard className="w-6 h-6 text-teal-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-stone-900">Growth Plan</p>
              <p className="text-xs text-stone-500">$79.00 / month · Renews May 1, 2026</p>
            </div>
          </div>
          <div className="flex gap-2">
            <AdminBadge label="Active" variant="success" dot />
            <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-600 bg-amber-100 rounded-lg hover:bg-amber-200 transition-colors">
              <RefreshCw className="w-3.5 h-3.5" /> Refund
            </button>
          </div>
        </div>
      </div>

      {/* Transaction history */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-stone-100">
          <h3 className="text-sm font-bold text-stone-800">Transaction History</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[500px]">
            <thead className="bg-stone-50 border-b border-stone-100">
              <tr>
                {["Date", "Description", "Amount", "Status", ""].map((h) => (
                  <th key={h} className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-stone-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {MOCK_TRANSACTIONS.map((t) => (
                <tr key={t.id} className="hover:bg-stone-50/50 transition-colors">
                  <td className="px-5 py-4 text-xs text-stone-500">{t.date}</td>
                  <td className="px-5 py-4 text-sm text-stone-800">{t.description}</td>
                  <td className="px-5 py-4 text-sm font-semibold text-stone-900">{t.amount}</td>
                  <td className="px-5 py-4">
                    <AdminBadge label={t.status === "paid" ? "Paid" : "Refunded"} variant={t.status === "paid" ? "success" : "warning"} dot />
                  </td>
                  <td className="px-5 py-4 text-right">
                    <button className="text-xs text-stone-400 hover:text-teal-600 transition-colors">Receipt →</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
