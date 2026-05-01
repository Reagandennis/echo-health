import { getLoggedInUser } from "@/lib/appwrite/server";
import { redirect } from "next/navigation";
import AdminPageHeader from "../../_components/AdminPageHeader";
import { UserX } from "lucide-react";

const COHORT = [
  { month: "Jan 2026", w1: "100%", w2: "84%", w3: "71%", w4: "62%" },
  { month: "Feb 2026", w1: "100%", w2: "81%", w3: "68%", w4: "58%" },
  { month: "Mar 2026", w1: "100%", w2: "87%", w3: "74%", w4: "65%" },
  { month: "Apr 2026", w1: "100%", w2: "89%", w3: "—", w4: "—" },
];

const AT_RISK = [
  { name: "James K.", lastSession: "21 days ago", therapist: "Dr. Osei" },
  { name: "Liam O.", lastSession: "28 days ago", therapist: "Unassigned" },
  { name: "Zara P.", lastSession: "35 days ago", therapist: "Dr. Santos" },
];

export default async function RetentionAnalyticsPage() {
  const user = await getLoggedInUser();
  if (!user || !user.labels?.includes("admin")) redirect("/dashboard");

  return (
    <div>
      <AdminPageHeader
        title="Client Retention"
        breadcrumbs={[{ label: "Analytics", href: "/admin/analytics" }, { label: "Retention" }]}
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[
          { label: "30-Day Retention", value: "78%", color: "text-teal-600" },
          { label: "60-Day Retention", value: "64%", color: "text-teal-600" },
          { label: "90-Day Retention", value: "51%", color: "text-amber-600" },
          { label: "Monthly Churn", value: "8%", color: "text-rose-600" },
        ].map((m) => (
          <div key={m.label} className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
            <p className="text-xs text-stone-400 uppercase tracking-wider font-medium mb-1">{m.label}</p>
            <p className={`text-2xl font-bold ${m.color}`}>{m.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden mb-6">
        <div className="p-5 border-b border-stone-100">
          <h3 className="text-sm font-bold text-stone-800">Cohort Retention Grid</h3>
          <p className="text-xs text-stone-400 mt-0.5">% of clients still active by weekly cohort</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-center min-w-[500px]">
            <thead className="bg-stone-50 border-b border-stone-100">
              <tr>
                <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-stone-500 text-left">Cohort</th>
                {["Week 1", "Week 2", "Week 3", "Week 4"].map((h) => (
                  <th key={h} className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-stone-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {COHORT.map((row) => (
                <tr key={row.month} className="hover:bg-stone-50/50">
                  <td className="px-5 py-4 text-sm font-medium text-stone-700 text-left">{row.month}</td>
                  {[row.w1, row.w2, row.w3, row.w4].map((v, i) => {
                    const num = parseInt(v);
                    const bg = v === "—" ? "bg-stone-50" : num >= 80 ? "bg-teal-100 text-teal-800" : num >= 60 ? "bg-amber-100 text-amber-800" : "bg-rose-100 text-rose-800";
                    return (
                      <td key={i} className="px-5 py-4">
                        <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-semibold ${bg}`}>{v}</span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-rose-100 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-rose-100 flex items-center gap-2">
          <UserX className="w-4 h-4 text-rose-500" />
          <h3 className="text-sm font-bold text-stone-800">At Risk of Churn</h3>
          <span className="text-[11px] bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full font-semibold ml-auto">3 clients</span>
        </div>
        <div className="divide-y divide-stone-50">
          {AT_RISK.map((c) => (
            <div key={c.name} className="flex items-center justify-between px-5 py-4">
              <div>
                <p className="text-sm font-semibold text-stone-800">{c.name}</p>
                <p className="text-xs text-stone-400">Last session: {c.lastSession} · {c.therapist}</p>
              </div>
              <button className="px-3 py-1.5 text-xs font-semibold text-teal-600 bg-teal-100 hover:bg-teal-200 rounded-lg transition-colors">Re-engage</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
