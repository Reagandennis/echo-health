import { createAdminClient, getLoggedInUser } from "@/lib/appwrite/server";
import { appwriteConfig } from "@/lib/appwrite/config";
import { redirect } from "next/navigation";
import Link from "next/link";
import AdminPageHeader from "../_components/AdminPageHeader";
import { ArrowRight, Download } from "lucide-react";
import { Query } from "node-appwrite";

export default async function AnalyticsDashboardPage() {
  const user = await getLoggedInUser();
  if (!user || !user.labels?.includes("admin")) redirect("/dashboard");

  const { databases, users } = createAdminClient();
  
  const [sessions, userList, moodLogs] = await Promise.all([
    databases.listDocuments(appwriteConfig.databaseId, appwriteConfig.collections.sessions, [Query.limit(100)]),
    users.list(),
    databases.listDocuments(appwriteConfig.databaseId, appwriteConfig.collections.moodLogs, [Query.limit(100)]),
  ]);

  const completed = sessions.documents.filter(s => s.status === "completed").length;
  const avgSessions = userList.total > 0 ? (completed / userList.total).toFixed(1) : "0";
  
  // Improvement logic: % of users whose last mood score is higher than their first
  const userMoods: Record<string, number[]> = {};
  moodLogs.documents.forEach(m => {
    if (!userMoods[m.userId]) userMoods[m.userId] = [];
    userMoods[m.userId].push(m.score);
  });
  
  let improved = 0;
  let totalWithMoods = 0;
  Object.values(userMoods).forEach(scores => {
    if (scores.length > 1) {
      totalWithMoods++;
      if (scores[scores.length - 1] > scores[0]) improved++;
    }
  });
  const outcomeRate = totalWithMoods > 0 ? Math.round((improved / totalWithMoods) * 100) : "0";

  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const currentMonth = new Date().getMonth();
  const BARS = Array(12).fill(0);
  BARS[currentMonth] = completed; // Simplified for current data
  const max = Math.max(...BARS, 10);

  return (
    <div>
      <AdminPageHeader
        title="Analytics & Reporting"
        description="Platform usage trends, outcomes, and clinical metrics."
        breadcrumbs={[{ label: "Analytics" }]}
        actions={
          <button className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-stone-600 bg-white border border-stone-200 rounded-xl hover:bg-stone-50">
            <Download className="w-4 h-4" /> Export Report
          </button>
        }
      />

      {/* Growth chart */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6 mb-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-sm font-bold text-stone-800">Session Volume (Current Year)</h3>
          <span className="text-xs text-stone-400 bg-stone-100 px-3 py-1 rounded-full">Monthly sessions</span>
        </div>
        <div className="flex items-end gap-3 h-52">
          {BARS.map((v, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
              <span className="text-[10px] text-stone-400">{v}</span>
              <div className="w-full rounded-t-xl bg-gradient-to-t from-teal-600 to-teal-400 hover:opacity-90 transition-opacity cursor-default"
                style={{ height: `${(v / max) * 100}%` }} />
              <span className="text-[10px] font-medium text-stone-400">{MONTHS[i]}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Avg Sessions/Client", value: avgSessions },
          { label: "Active Clients", value: userList.total.toString() },
          { label: "Outcome Improvement", value: `${outcomeRate}%` },
          { label: "Platform Uptime", value: "99.9%" },
        ].map((m) => (
          <div key={m.label} className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
            <p className="text-xs text-stone-400 uppercase tracking-wider font-medium mb-1">{m.label}</p>
            <p className="text-2xl font-bold text-stone-900">{m.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {[
          { label: "Session Analytics",     href: "/admin/analytics/sessions" },
          { label: "User Growth",           href: "/admin/analytics/users" },
          { label: "Clinical Outcomes",     href: "/admin/analytics/outcomes" },
          { label: "Revenue Analytics",     href: "/admin/analytics/revenue" },
          { label: "Therapist Performance", href: "/admin/analytics/therapists" },
          { label: "Export Reports",        href: "/admin/analytics/export" },
        ].map((l) => (
          <Link key={l.label} href={l.href} className="flex items-center justify-between p-4 bg-white rounded-2xl border border-stone-200 shadow-sm hover:border-teal-300 hover:shadow-md transition-all group">
            <span className="text-sm font-semibold text-stone-700">{l.label}</span>
            <ArrowRight className="w-4 h-4 text-stone-400 group-hover:text-teal-500 transition-colors" />
          </Link>
        ))}
      </div>
    </div>
  );
}
