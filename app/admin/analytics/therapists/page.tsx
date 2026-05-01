import { getLoggedInUser } from "@/lib/appwrite/server";
import { redirect } from "next/navigation";
import AdminPageHeader from "../../_components/AdminPageHeader";
import { Star } from "lucide-react";

const LEADERBOARD = [
  { name: "Dr. Patel", sessions: 84, rating: 4.9, completion: 96, earnings: "$6,720" },
  { name: "Dr. Osei", sessions: 76, rating: 4.7, completion: 92, earnings: "$6,080" },
  { name: "Dr. Santos", sessions: 71, rating: 4.8, completion: 89, earnings: "$5,680" },
  { name: "Dr. Lee", sessions: 65, rating: 4.6, completion: 94, earnings: "$5,200" },
  { name: "Dr. Müller", sessions: 58, rating: 4.5, completion: 87, earnings: "$4,640" },
  { name: "Dr. Kim", sessions: 54, rating: 4.4, completion: 91, earnings: "$4,320" },
  { name: "Dr. Nguyen", sessions: 48, rating: 4.7, completion: 95, earnings: "$3,840" },
  { name: "Dr. Singh", sessions: 42, rating: 4.3, completion: 88, earnings: "$3,360" },
  { name: "Dr. Adeyemi", sessions: 38, rating: 4.6, completion: 90, earnings: "$3,040" },
  { name: "Dr. Williams", sessions: 31, rating: 4.2, completion: 85, earnings: "$2,480" },
];

export default async function TherapistAnalyticsPage() {
  const user = await getLoggedInUser();
  if (!user || !user.labels?.includes("admin")) redirect("/dashboard");

  return (
    <div>
      <AdminPageHeader
        title="Therapist Performance Analytics"
        breadcrumbs={[{ label: "Analytics", href: "/admin/analytics" }, { label: "Therapists" }]}
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Avg Rating", value: "4.3 ★" },
          { label: "Avg Sessions/Week", value: "18" },
          { label: "Therapist Retention", value: "94%" },
          { label: "New Applications", value: "3" },
        ].map((m) => (
          <div key={m.label} className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
            <p className="text-xs text-stone-400 uppercase tracking-wider font-medium mb-1">{m.label}</p>
            <p className="text-2xl font-bold text-stone-900">{m.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-stone-100">
          <h3 className="text-sm font-bold text-stone-800">Top Therapists Leaderboard</h3>
          <p className="text-xs text-stone-400 mt-0.5">Ranked by session volume — current month</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[600px]">
            <thead className="bg-stone-50 border-b border-stone-100">
              <tr>
                {["Rank", "Therapist", "Sessions", "Rating", "Completion", "Earnings"].map((h) => (
                  <th key={h} className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-stone-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {LEADERBOARD.map((t, i) => (
                <tr key={t.name} className={`hover:bg-stone-50/50 transition-colors ${i < 3 ? "bg-amber-50/30" : ""}`}>
                  <td className="px-5 py-4">
                    <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? "bg-amber-400 text-white" : i === 1 ? "bg-stone-300 text-white" : i === 2 ? "bg-orange-400 text-white" : "bg-stone-100 text-stone-500"}`}>
                      {i + 1}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-indigo-500 flex items-center justify-center text-white text-xs font-bold">
                        {t.name.charAt(3)}
                      </div>
                      <span className="text-sm font-semibold text-stone-800">{t.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-sm text-stone-700 font-semibold">{t.sessions}</td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1">
                      <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                      <span className="text-sm text-stone-700">{t.rating}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-20 bg-stone-100 rounded-full overflow-hidden">
                        <div className="h-full bg-teal-500 rounded-full" style={{ width: `${t.completion}%` }} />
                      </div>
                      <span className="text-xs text-stone-600">{t.completion}%</span>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-sm font-semibold text-emerald-700">{t.earnings}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
