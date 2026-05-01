import { getLoggedInUser } from "@/lib/appwrite/server";
import { redirect } from "next/navigation";
import AdminPageHeader from "../../_components/AdminPageHeader";

const OUTCOMES = [
  { name: "PHQ-9 (Depression)", before: 16, after: 8, scale: 27 },
  { name: "GAD-7 (Anxiety)", before: 14, after: 6, scale: 21 },
  { name: "WHO-5 (Wellbeing)", before: 28, after: 58, scale: 100 },
];

const SURVEYS = [
  { client: "Sarah M.", date: "Apr 24, 2026", phq: 5, gad: 4, who: 72, sessions: 12 },
  { client: "Priya V.", date: "Apr 22, 2026", phq: 8, gad: 6, who: 60, sessions: 8 },
  { client: "Monica J.", date: "Apr 20, 2026", phq: 3, gad: 2, who: 84, sessions: 16 },
  { client: "Ethan R.", date: "Apr 18, 2026", phq: 11, gad: 9, who: 48, sessions: 6 },
  { client: "Amara L.", date: "Apr 15, 2026", phq: 6, gad: 5, who: 68, sessions: 10 },
];

export default async function ClinicalOutcomesPage() {
  const user = await getLoggedInUser();
  if (!user || !user.labels?.includes("admin")) redirect("/dashboard");

  return (
    <div>
      <AdminPageHeader
        title="Clinical Outcomes"
        description="Aggregated therapy outcome metrics across the platform."
        breadcrumbs={[{ label: "Analytics", href: "/admin/analytics" }, { label: "Outcomes" }]}
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Client Improvement Rate", value: "65%" },
          { label: "Avg Sessions to Improvement", value: "8" },
          { label: "PHQ-9 Score Reduction", value: "42%" },
          { label: "Client Satisfaction", value: "4.6 / 5" },
        ].map((m) => (
          <div key={m.label} className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
            <p className="text-xs text-stone-400 uppercase tracking-wider font-medium mb-1">{m.label}</p>
            <p className="text-2xl font-bold text-teal-700">{m.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6 mb-6">
        <h3 className="text-sm font-bold text-stone-800 mb-6">Before / After Comparison (Platform Average)</h3>
        <div className="space-y-6">
          {OUTCOMES.map((o) => (
            <div key={o.name}>
              <div className="flex justify-between text-xs mb-2">
                <span className="font-semibold text-stone-700">{o.name}</span>
                <span className="text-stone-400">Lower is better for PHQ/GAD · Higher for WHO-5</span>
              </div>
              <div className="space-y-1.5">
                <div>
                  <div className="flex justify-between text-[11px] text-stone-400 mb-1">
                    <span>Before therapy</span>
                    <span>{o.before} / {o.scale}</span>
                  </div>
                  <div className="h-2.5 bg-stone-100 rounded-full overflow-hidden">
                    <div className="h-full bg-rose-400 rounded-full" style={{ width: `${(o.before / o.scale) * 100}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-[11px] text-stone-400 mb-1">
                    <span>After therapy</span>
                    <span>{o.after} / {o.scale}</span>
                  </div>
                  <div className="h-2.5 bg-stone-100 rounded-full overflow-hidden">
                    <div className="h-full bg-teal-500 rounded-full" style={{ width: `${(o.after / o.scale) * 100}%` }} />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-4 mt-4 text-xs">
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-rose-400" /><span className="text-stone-500">Before therapy</span></div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-teal-500" /><span className="text-stone-500">After therapy</span></div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-stone-100">
          <h3 className="text-sm font-bold text-stone-800">Recent Outcome Surveys</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[550px]">
            <thead className="bg-stone-50 border-b border-stone-100">
              <tr>
                {["Client", "Date", "PHQ-9", "GAD-7", "WHO-5", "Sessions"].map((h) => (
                  <th key={h} className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-stone-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {SURVEYS.map((s) => (
                <tr key={s.client} className="hover:bg-stone-50/50">
                  <td className="px-5 py-4 text-sm font-semibold text-stone-800">{s.client}</td>
                  <td className="px-5 py-4 text-xs text-stone-500">{s.date}</td>
                  <td className="px-5 py-4"><span className={`text-sm font-bold ${s.phq <= 5 ? "text-teal-600" : s.phq <= 10 ? "text-amber-600" : "text-rose-600"}`}>{s.phq}</span></td>
                  <td className="px-5 py-4"><span className={`text-sm font-bold ${s.gad <= 5 ? "text-teal-600" : s.gad <= 10 ? "text-amber-600" : "text-rose-600"}`}>{s.gad}</span></td>
                  <td className="px-5 py-4"><span className={`text-sm font-bold ${s.who >= 60 ? "text-teal-600" : s.who >= 40 ? "text-amber-600" : "text-rose-600"}`}>{s.who}</span></td>
                  <td className="px-5 py-4 text-sm text-stone-700">{s.sessions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
