import { getLoggedInUser } from "@/lib/appwrite/server";
import { redirect } from "next/navigation";
import AdminPageHeader from "../_components/AdminPageHeader";
import { listRiskAlertsAction, listProfilesAction } from "@/app/actions/database";
import RiskAlertList from "./RiskAlertList";

export default async function RiskAlertsPage() {
  const user = await getLoggedInUser();
  if (!user || !user.labels?.includes("admin")) redirect("/dashboard");

  const [alerts, profiles] = await Promise.all([
    listRiskAlertsAction(),
    listProfilesAction(),
  ]);

  const stats = {
    critical: alerts.filter((a: any) => a.severity === "critical" && !a.resolved).length,
    high: alerts.filter((a: any) => a.severity === "high" && !a.resolved).length,
    medium: alerts.filter((a: any) => a.severity === "medium" && !a.resolved).length,
  };

  return (
    <div>
      <AdminPageHeader
        title="Risk & Crisis Management"
        description="AI-generated and manually flagged risk alerts."
        breadcrumbs={[{ label: "Risk & Crisis" }]}
        actions={
          <div className="flex gap-2">
            <button className="px-3 py-2 text-sm font-medium text-stone-600 bg-white border border-stone-200 rounded-xl hover:bg-stone-50 transition-colors">Escalation Workflow</button>
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {[
          { label: "Critical Alerts", value: stats.critical.toString(), color: "border-rose-200 bg-rose-50" },
          { label: "High Risk", value: stats.high.toString(), color: "border-orange-200 bg-orange-50" },
          { label: "Medium Risk", value: stats.medium.toString(), color: "border-amber-200 bg-amber-50" },
        ].map((m) => (
          <div key={m.label} className={`rounded-2xl border ${m.color} p-5`}>
            <p className="text-3xl font-bold text-stone-900">{m.value}</p>
            <p className="text-xs text-stone-500 mt-1">{m.label}</p>
          </div>
        ))}
      </div>

      <RiskAlertList initialAlerts={alerts} profiles={profiles} />
    </div>
  );
}
