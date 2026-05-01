import { getLoggedInUser } from "@/lib/appwrite/server";
import { redirect } from "next/navigation";
import AdminPageHeader from "../../_components/AdminPageHeader";
import AdminBadge from "../../_components/AdminBadge";
import { Scale } from "lucide-react";

const DISPUTES = [
  { id: "dsp_001", client: "Daniel T.", amount: "$149.00", reason: "Unauthorized charge", status: "pending", date: "Apr 23, 2026" },
  { id: "dsp_002", client: "Amara L.", amount: "$79.00", reason: "Service not rendered", status: "investigating", date: "Apr 20, 2026" },
  { id: "dsp_003", client: "Ethan R.", amount: "$39.00", reason: "Wrong amount charged", status: "resolved", date: "Apr 15, 2026" },
  { id: "dsp_004", client: "Monica J.", amount: "$79.00", reason: "Duplicate charge", status: "rejected", date: "Apr 10, 2026" },
  { id: "dsp_005", client: "James K.", amount: "$39.00", reason: "Cancelled subscription still charged", status: "pending", date: "Apr 5, 2026" },
];

export default async function DisputesPage() {
  const user = await getLoggedInUser();
  if (!user || !user.labels?.includes("admin")) redirect("/dashboard");

  return (
    <div>
      <AdminPageHeader
        title="Billing Disputes"
        description="Manage client billing disputes and chargebacks."
        breadcrumbs={[{ label: "Support", href: "/admin/support" }, { label: "Disputes" }]}
      />

      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: "Total Disputes", value: DISPUTES.length.toString() },
          { label: "Resolved", value: DISPUTES.filter((d) => d.status === "resolved").length.toString() },
          { label: "Pending Investigation", value: DISPUTES.filter((d) => d.status === "pending" || d.status === "investigating").length.toString() },
        ].map((m) => (
          <div key={m.label} className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
            <div className="w-9 h-9 bg-amber-100 rounded-xl flex items-center justify-center mb-3">
              <Scale className="w-4 h-4 text-amber-600" />
            </div>
            <p className="text-xs text-stone-400 uppercase tracking-wider">{m.label}</p>
            <p className="text-2xl font-bold text-stone-900 mt-1">{m.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[700px]">
            <thead className="bg-stone-50 border-b border-stone-100">
              <tr>
                {["Dispute ID", "Client", "Amount", "Reason", "Status", "Date", "Actions"].map((h) => (
                  <th key={h} className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-stone-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {DISPUTES.map((d) => (
                <tr key={d.id} className="hover:bg-stone-50/50 transition-colors">
                  <td className="px-5 py-4 text-xs font-mono text-stone-400">{d.id}</td>
                  <td className="px-5 py-4 text-sm font-medium text-stone-800">{d.client}</td>
                  <td className="px-5 py-4 text-sm font-semibold text-stone-900">{d.amount}</td>
                  <td className="px-5 py-4 text-sm text-stone-600 max-w-[160px] truncate">{d.reason}</td>
                  <td className="px-5 py-4">
                    <AdminBadge
                      label={d.status.charAt(0).toUpperCase() + d.status.slice(1)}
                      variant={d.status === "resolved" ? "success" : d.status === "rejected" ? "danger" : d.status === "investigating" ? "warning" : "neutral"}
                      dot
                    />
                  </td>
                  <td className="px-5 py-4 text-sm text-stone-500">{d.date}</td>
                  <td className="px-5 py-4">
                    <div className="flex gap-2">
                      {d.status !== "resolved" && d.status !== "rejected" && (
                        <>
                          <button className="px-2.5 py-1.5 text-[11px] font-semibold text-teal-600 bg-teal-100 hover:bg-teal-200 rounded-lg transition-colors">Investigate</button>
                          <button className="px-2.5 py-1.5 text-[11px] font-semibold text-emerald-600 bg-emerald-100 hover:bg-emerald-200 rounded-lg transition-colors">Resolve</button>
                        </>
                      )}
                    </div>
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
