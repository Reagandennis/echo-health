import { createAdminClient, getLoggedInUser } from "@/lib/appwrite/server";
import { redirect, notFound } from "next/navigation";
import AdminPageHeader from "../../../_components/AdminPageHeader";
import AdminBadge from "../../../_components/AdminBadge";
import { AlertTriangle, ShieldCheck, Clock } from "lucide-react";

const MOCK_FLAGS = [
  { id: "1", type: "AI Flag", description: "Expressed suicidal ideation in session notes", severity: "critical", date: "2026-04-20T10:30:00Z", resolved: false },
  { id: "2", type: "Manual Flag", description: "Missed 3 consecutive sessions", severity: "medium", date: "2026-04-15T08:00:00Z", resolved: true },
  { id: "3", type: "AI Flag", description: "Mood score dropped below 3 for 5 consecutive days", severity: "high", date: "2026-04-10T12:00:00Z", resolved: false },
];

export default async function RiskProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getLoggedInUser();
  if (!user || !user.labels?.includes("admin")) redirect("/dashboard");
  const { id } = await params;
  const { users } = createAdminClient();
  let client;
  try { client = await users.get(id); } catch { notFound(); }

  return (
    <div>
      <AdminPageHeader
        title="Risk Profile"
        breadcrumbs={[
          { label: "Clients", href: "/admin/users" },
          { label: client.name, href: `/admin/users/${id}` },
          { label: "Risk Profile" },
        ]}
      />

      {/* Score banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {[
          { label: "Overall Risk Score", value: "15 / 100", sub: "Low risk", color: "bg-emerald-50 border-emerald-200", textColor: "text-emerald-700" },
          { label: "Active Flags", value: "2", sub: "Unresolved", color: "bg-rose-50 border-rose-200", textColor: "text-rose-700" },
          { label: "Last Assessment", value: "Apr 20, 2026", sub: "7 days ago", color: "bg-stone-50 border-stone-200", textColor: "text-stone-700" },
        ].map((m) => (
          <div key={m.label} className={`rounded-2xl border ${m.color} p-5`}>
            <p className="text-xs text-stone-500 font-medium uppercase tracking-wider mb-2">{m.label}</p>
            <p className={`text-3xl font-bold ${m.textColor}`}>{m.value}</p>
            <p className="text-xs text-stone-400 mt-1">{m.sub}</p>
          </div>
        ))}
      </div>

      {/* Risk score bar */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6 mb-6">
        <h3 className="text-sm font-bold text-stone-800 mb-4">Risk Score Breakdown</h3>
        <div className="space-y-4">
          {[
            { label: "Mood Stability", score: 20 },
            { label: "Session Engagement", score: 10 },
            { label: "Crisis Indicators", score: 5 },
            { label: "Medication Compliance", score: 0 },
            { label: "Social Support", score: 15 },
          ].map((r) => (
            <div key={r.label}>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-stone-600 font-medium">{r.label}</span>
                <span className="text-stone-400">{r.score} / 100</span>
              </div>
              <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${r.score < 30 ? "bg-emerald-400" : r.score < 60 ? "bg-amber-400" : "bg-rose-500"}`}
                  style={{ width: `${r.score}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Flags */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-stone-100">
          <h3 className="text-sm font-bold text-stone-800">Alert History</h3>
        </div>
        <div className="divide-y divide-stone-50">
          {MOCK_FLAGS.map((flag) => (
            <div key={flag.id} className="flex items-start gap-4 px-5 py-4">
              <div className={`p-2 rounded-xl flex-shrink-0 ${flag.severity === "critical" ? "bg-rose-100" : flag.severity === "high" ? "bg-orange-100" : "bg-amber-100"}`}>
                <AlertTriangle className={`w-4 h-4 ${flag.severity === "critical" ? "text-rose-600" : flag.severity === "high" ? "text-orange-600" : "text-amber-600"}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-xs font-bold text-stone-500 uppercase">{flag.type}</span>
                  <AdminBadge
                    label={flag.severity}
                    variant={flag.severity === "critical" ? "danger" : flag.severity === "high" ? "danger" : "warning"}
                  />
                  {flag.resolved && <AdminBadge label="Resolved" variant="success" />}
                </div>
                <p className="text-sm text-stone-800">{flag.description}</p>
                <div className="flex items-center gap-1 text-xs text-stone-400 mt-1">
                  <Clock className="w-3 h-3" />
                  {new Date(flag.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </div>
              </div>
              {!flag.resolved && (
                <button className="flex items-center gap-1 px-3 py-1.5 bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-lg hover:bg-emerald-200 transition-colors flex-shrink-0">
                  <ShieldCheck className="w-3.5 h-3.5" /> Resolve
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
