import { createAdminClient, getLoggedInUser } from "@/lib/appwrite/server";
import { appwriteConfig } from "@/lib/appwrite/config";
import { redirect, notFound } from "next/navigation";
import AdminPageHeader from "../../../_components/AdminPageHeader";
import AdminBadge from "../../../_components/AdminBadge";
import { DollarSign, TrendingUp, Download } from "lucide-react";

const MOCK_PAYOUTS = [
  { id: "p1", period: "April 2026", sessions: 22, gross: "$1,760", fee: "$176", net: "$1,584", status: "pending" },
  { id: "p2", period: "March 2026", sessions: 20, gross: "$1,600", fee: "$160", net: "$1,440", status: "paid" },
  { id: "p3", period: "February 2026", sessions: 18, gross: "$1,440", fee: "$144", net: "$1,296", status: "paid" },
];

export default async function TherapistEarningsPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const user = await getLoggedInUser();
  if (!user || !user.labels?.includes("admin")) redirect("/dashboard");
  const { id } = await params;
  const { databases } = createAdminClient();
  let t: Record<string, unknown>;
  try { t = await databases.getDocument(appwriteConfig.databaseId, appwriteConfig.collections.therapists, id) as unknown as Record<string, unknown>; } catch { notFound(); }

  return (
    <div>
      <AdminPageHeader
        title="Earnings Summary"
        breadcrumbs={[{ label: "Therapists", href: "/admin/therapists" }, { label: t.name as string, href: `/admin/therapists/${id}` }, { label: "Earnings" }]}
        actions={
          <button className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-stone-600 bg-white border border-stone-200 rounded-xl hover:bg-stone-50 transition-colors">
            <Download className="w-4 h-4" /> Export
          </button>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Total Earned", value: "$4,320", icon: DollarSign, color: "bg-emerald-100 text-emerald-700" },
          { label: "Pending Payout", value: "$1,584", icon: TrendingUp, color: "bg-amber-100 text-amber-700" },
          { label: "Platform Fee (10%)", value: "$480", icon: DollarSign, color: "bg-stone-100 text-stone-700" },
          { label: "Sessions This Month", value: "22", icon: TrendingUp, color: "bg-teal-100 text-teal-700" },
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

      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-stone-100">
          <h3 className="text-sm font-bold text-stone-800">Payout History</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[500px]">
            <thead className="bg-stone-50 border-b border-stone-100">
              <tr>
                {["Period", "Sessions", "Gross", "Platform Fee", "Net Payout", "Status", ""].map((h) => (
                  <th key={h} className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-stone-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {MOCK_PAYOUTS.map((p) => (
                <tr key={p.id} className="hover:bg-stone-50/50 transition-colors">
                  <td className="px-5 py-4 text-sm font-medium text-stone-800">{p.period}</td>
                  <td className="px-5 py-4 text-sm text-stone-600">{p.sessions}</td>
                  <td className="px-5 py-4 text-sm text-stone-600">{p.gross}</td>
                  <td className="px-5 py-4 text-sm text-stone-500">{p.fee}</td>
                  <td className="px-5 py-4 text-sm font-semibold text-stone-900">{p.net}</td>
                  <td className="px-5 py-4">
                    <AdminBadge label={p.status === "paid" ? "Paid" : "Pending"} variant={p.status === "paid" ? "success" : "warning"} dot />
                  </td>
                  <td className="px-5 py-4 text-right">
                    {p.status === "pending" && (
                      <button className="text-xs text-teal-600 hover:text-teal-700 font-semibold">Approve →</button>
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
