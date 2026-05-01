import { getLoggedInUser } from "@/lib/appwrite/server";
import { redirect } from "next/navigation";
import AdminPageHeader from "../../_components/AdminPageHeader";

const DAYS = [
  { day: "Mon", sessions: 52 },
  { day: "Tue", sessions: 68 },
  { day: "Wed", sessions: 81 },
  { day: "Thu", sessions: 74 },
  { day: "Fri", sessions: 65 },
  { day: "Sat", sessions: 28 },
  { day: "Sun", sessions: 19 },
];

const TOP_THERAPISTS = [
  { name: "Dr. Patel", sessions: 84, completion: "96%", rating: "4.9" },
  { name: "Dr. Osei", sessions: 76, completion: "92%", rating: "4.7" },
  { name: "Dr. Santos", sessions: 71, completion: "89%", rating: "4.8" },
  { name: "Dr. Lee", sessions: 65, completion: "94%", rating: "4.6" },
  { name: "Dr. Müller", sessions: 58, completion: "87%", rating: "4.5" },
];

const maxSessions = Math.max(...DAYS.map((d) => d.sessions));

export default async function SessionAnalyticsPage() {
  const user = await getLoggedInUser();
  if (!user || !user.labels?.includes("admin")) redirect("/dashboard");

  return (
    <div>
      <AdminPageHeader
        title="Session Analytics"
        breadcrumbs={[{ label: "Analytics", href: "/admin/analytics" }, { label: "Sessions" }]}
        actions={
          <div className="flex gap-2">
            {["7d", "30d", "90d", "Custom"].map((p) => (
              <button key={p} className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${p === "30d" ? "bg-teal-600 text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200"}`}>{p}</button>
            ))}
          </div>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Total Sessions", value: "487" },
          { label: "Avg Duration", value: "52 min" },
          { label: "Completion Rate", value: "88%" },
          { label: "Peak Day", value: "Wednesday" },
        ].map((m) => (
          <div key={m.label} className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
            <p className="text-xs text-stone-400 uppercase tracking-wider font-medium mb-1">{m.label}</p>
            <p className="text-2xl font-bold text-stone-900">{m.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6 mb-6">
        <h3 className="text-sm font-bold text-stone-800 mb-6">Sessions by Day of Week</h3>
        <div className="flex items-end gap-4 h-40">
          {DAYS.map((d) => (
            <div key={d.day} className="flex-1 flex flex-col items-center gap-2">
              <span className="text-xs text-stone-500">{d.sessions}</span>
              <div className="w-full rounded-t-xl bg-gradient-to-t from-teal-600 to-teal-400 hover:opacity-90 transition-opacity"
                style={{ height: `${(d.sessions / maxSessions) * 100}%` }} />
              <span className="text-xs font-semibold text-stone-500">{d.day}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-stone-100">
          <h3 className="text-sm font-bold text-stone-800">Top Therapists by Session Volume</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-stone-50 border-b border-stone-100">
              <tr>
                {["#", "Therapist", "Sessions", "Completion", "Rating"].map((h) => (
                  <th key={h} className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-stone-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {TOP_THERAPISTS.map((t, i) => (
                <tr key={t.name} className="hover:bg-stone-50/50">
                  <td className="px-5 py-4 text-sm font-bold text-stone-400">#{i + 1}</td>
                  <td className="px-5 py-4 text-sm font-semibold text-stone-800">{t.name}</td>
                  <td className="px-5 py-4 text-sm text-stone-700">{t.sessions}</td>
                  <td className="px-5 py-4 text-sm text-stone-700">{t.completion}</td>
                  <td className="px-5 py-4 text-sm text-amber-600 font-semibold">★ {t.rating}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
