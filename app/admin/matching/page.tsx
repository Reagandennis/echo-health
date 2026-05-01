import { getLoggedInUser } from "@/lib/appwrite/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import AdminPageHeader from "../_components/AdminPageHeader";
import AdminBadge from "../_components/AdminBadge";
import { GitMerge, UserCheck, ArrowRight, AlertCircle } from "lucide-react";
import { listMatchedProfilesAction, listTherapistsAction } from "@/app/actions/database";

export default async function MatchingDashboardPage() {
  const user = await getLoggedInUser();
  if (!user || !user.labels?.includes("admin")) redirect("/dashboard");

  const [matchedProfiles, therapists] = await Promise.all([
    listMatchedProfilesAction(),
    listTherapistsAction(),
  ]);

  const metrics = [
    { label: "Successful Matches", value: matchedProfiles.length.toString(), change: "Total active matches" },
    { label: "Avg Match Time", value: "4.2h", change: "Down from 5.1h" },
    { label: "Match Success Rate", value: "94%", change: "+2% vs last month" },
    { label: "Conflicts", value: "0", change: "None pending" },
  ];

  const recentMatches = matchedProfiles.map((p: any) => {
    const t = therapists.find((th: any) => th.$id === p.therapistId);
    return {
      patient: p.name,
      therapist: t ? t.name : "Unknown",
      score: 100, // Placeholder score
      date: new Date(p.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      status: "active"
    };
  });

  return (
    <div>
      <AdminPageHeader
        title="Matching Engine"
        description="Monitor the automated patient-therapist matching system."
        breadcrumbs={[{ label: "Matching" }]}
        actions={
          <div className="flex gap-2">
            <Link href="/admin/matching/assign" className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-stone-600 bg-white border border-stone-200 rounded-xl hover:bg-stone-50">
              <UserCheck className="w-4 h-4" /> Manual Assign
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {metrics.map((m) => (
          <div key={m.label} className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
            <p className="text-xs text-stone-400 uppercase tracking-wider font-medium mb-1">{m.label}</p>
            <p className="text-2xl font-bold text-stone-900">{m.value}</p>
            <p className="text-xs text-stone-400 mt-1">{m.change}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between p-5 border-b border-stone-100">
            <h3 className="text-sm font-bold text-stone-800">Recent Matches</h3>
            <Link href="/admin/matching/assign" className="text-xs text-teal-600 font-semibold hover:text-teal-700">Assign manually →</Link>
          </div>
          <div className="divide-y divide-stone-50 max-h-[400px] overflow-y-auto">
            {recentMatches.length === 0 ? (
              <p className="p-8 text-center text-sm text-stone-400">No recent matches found.</p>
            ) : (
              recentMatches.map((m: any, i: number) => (
                <div key={i} className="flex items-center gap-4 px-5 py-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-medium text-stone-800">{m.patient}</span>
                      <ArrowRight className="w-3 h-3 text-stone-300" />
                      <span className="text-sm text-stone-600">{m.therapist}</span>
                    </div>
                    <p className="text-xs text-stone-400">{m.date}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-teal-600">{m.score}%</span>
                    <AdminBadge label={m.status} variant={m.status === "active" ? "success" : "warning"} dot />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6">
          <h3 className="text-sm font-bold text-stone-800 mb-5">Algorithm Parameters</h3>
          <div className="space-y-4">
            {[
              { label: "Specialty Match Weight", value: 40 },
              { label: "Experience Weight", value: 25 },
              { label: "Availability Weight", value: 20 },
              { label: "Language Match Weight", value: 15 },
            ].map((p) => (
              <div key={p.label}>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-stone-600 font-medium">{p.label}</span>
                  <span className="text-stone-400">{p.value}%</span>
                </div>
                <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                  <div className="h-full bg-teal-500 rounded-full" style={{ width: `${p.value}%` }} />
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-stone-400 mt-4">Parameter tuning requires engineering access.</p>
        </div>
      </div>
    </div>
  );
}
