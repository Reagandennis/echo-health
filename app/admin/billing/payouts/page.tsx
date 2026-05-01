import { getLoggedInUser } from "@/lib/appwrite/server";
import { redirect } from "next/navigation";
import AdminPageHeader from "../../_components/AdminPageHeader";
import AdminBadge from "../../_components/AdminBadge";
import { RefreshCw } from "lucide-react";

export default async function PayoutsDashboardPage() {
  const user = await getLoggedInUser();
  if (!user || !user.labels?.includes("admin")) redirect("/dashboard");

  const payouts = [
    { id: "po_001", therapist: "Dr. Patel", period: "April 2026", sessions: 22, net: "$1,584", status: "pending" },
    { id: "po_002", therapist: "Dr. Osei", period: "April 2026", sessions: 18, net: "$1,296", status: "pending" },
    { id: "po_003", therapist: "Dr. Santos", period: "March 2026", sessions: 20, net: "$1,440", status: "paid" },
    { id: "po_004", therapist: "Dr. Lee", period: "March 2026", sessions: 15, net: "$1,080", status: "paid" },
  ];

  return (
    <div>
      <AdminPageHeader
        title="Therapist Payouts"
        description="Review and approve therapist earnings payouts."
        breadcrumbs={[{ label: "Billing", href: "/admin/billing" }, { label: "Payouts" }]}
      />
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: "Pending Payouts", value: "$2,880", sub: "2 therapists" },
          { label: "Paid This Month", value: "$2,520", sub: "2 processed" },
          { label: "Total Disbursed", value: "$38,400", sub: "All time" },
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
          <table className="w-full text-left min-w-[600px]">
            <thead className="bg-stone-50 border-b border-stone-100">
              <tr>{["Therapist", "Period", "Sessions", "Net Payout", "Status", ""].map((h) => <th key={h} className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-stone-500">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {payouts.map((p) => (
                <tr key={p.id} className="hover:bg-stone-50/50 transition-colors">
                  <td className="px-5 py-4 text-sm font-medium text-stone-800">{p.therapist}</td>
                  <td className="px-5 py-4 text-sm text-stone-600">{p.period}</td>
                  <td className="px-5 py-4 text-sm text-stone-600">{p.sessions}</td>
                  <td className="px-5 py-4 text-sm font-semibold text-stone-900">{p.net}</td>
                  <td className="px-5 py-4"><AdminBadge label={p.status === "paid" ? "Paid" : "Pending"} variant={p.status === "paid" ? "success" : "warning"} dot /></td>
                  <td className="px-5 py-4 text-right">
                    {p.status === "pending" && (
                      <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors ml-auto">
                        <RefreshCw className="w-3 h-3" /> Approve
                      </button>
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
