import { getLoggedInUser } from "@/lib/appwrite/server";
import { redirect } from "next/navigation";
import AdminPageHeader from "../../_components/AdminPageHeader";
import AdminBadge from "../../_components/AdminBadge";
import { RefreshCw, CheckCircle, XCircle } from "lucide-react";

const REFUNDS = [
  { id: "ref_001", txn: "txn_004", client: "Daniel T.", amount: "$45.00", reason: "Service not rendered", status: "pending", date: "Apr 22, 2026" },
  { id: "ref_002", txn: "txn_009", client: "Amara L.", amount: "$79.00", reason: "Duplicate charge", status: "approved", date: "Apr 18, 2026" },
  { id: "ref_003", txn: "txn_012", client: "Monica J.", amount: "$39.00", reason: "Plan downgrade refund", status: "approved", date: "Apr 15, 2026" },
  { id: "ref_004", txn: "txn_015", client: "Ethan R.", amount: "$149.00", reason: "Cancelled subscription", status: "rejected", date: "Apr 10, 2026" },
  { id: "ref_005", txn: "txn_018", client: "Priya V.", amount: "$79.00", reason: "Therapist no-show", status: "pending", date: "Apr 8, 2026" },
];

export default async function RefundsPage() {
  const user = await getLoggedInUser();
  if (!user || !user.labels?.includes("admin")) redirect("/dashboard");

  const totalRefunded = "$118.00";
  const pending = REFUNDS.filter((r) => r.status === "pending").length;
  const approved = REFUNDS.filter((r) => r.status === "approved").length;
  const approvalRate = Math.round((approved / REFUNDS.length) * 100);

  return (
    <div>
      <AdminPageHeader
        title="Refund Management"
        description="Review and process client refund requests."
        breadcrumbs={[{ label: "Billing", href: "/admin/billing" }, { label: "Refunds" }]}
      />

      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: "Refunded This Month", value: totalRefunded, sub: "2 processed" },
          { label: "Pending Requests", value: pending.toString(), sub: "Awaiting review" },
          { label: "Approval Rate", value: `${approvalRate}%`, sub: "Of all requests" },
        ].map((m) => (
          <div key={m.label} className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
            <p className="text-xs text-stone-400 uppercase tracking-wider font-medium mb-1">{m.label}</p>
            <p className="text-2xl font-bold text-stone-900">{m.value}</p>
            <p className="text-xs text-stone-400 mt-1">{m.sub}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[700px]">
            <thead className="bg-stone-50 border-b border-stone-100">
              <tr>
                {["Refund ID", "Transaction", "Client", "Amount", "Reason", "Status", "Date", "Actions"].map((h) => (
                  <th key={h} className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-stone-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {REFUNDS.map((r) => (
                <tr key={r.id} className="hover:bg-stone-50/50 transition-colors">
                  <td className="px-5 py-4 text-xs font-mono text-stone-400">{r.id}</td>
                  <td className="px-5 py-4 text-xs font-mono text-stone-500">{r.txn}</td>
                  <td className="px-5 py-4 text-sm font-medium text-stone-800">{r.client}</td>
                  <td className="px-5 py-4 text-sm font-semibold text-stone-900">{r.amount}</td>
                  <td className="px-5 py-4 text-sm text-stone-600 max-w-[160px] truncate">{r.reason}</td>
                  <td className="px-5 py-4">
                    <AdminBadge
                      label={r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                      variant={r.status === "approved" ? "success" : r.status === "rejected" ? "danger" : "warning"}
                      dot
                    />
                  </td>
                  <td className="px-5 py-4 text-sm text-stone-500">{r.date}</td>
                  <td className="px-5 py-4">
                    {r.status === "pending" ? (
                      <div className="flex gap-2">
                        <button className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors">
                          <CheckCircle className="w-3 h-3" /> Approve
                        </button>
                        <button className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors">
                          <XCircle className="w-3 h-3" /> Reject
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-stone-400">Processed</span>
                    )}
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
