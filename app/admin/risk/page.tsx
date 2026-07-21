import { getLoggedInUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import Link from "next/link";
import AdminPageHeader from "../_components/AdminPageHeader";
import { listRiskAlertsAction, listProfilesAction } from "@/app/actions/database";
import { RISK_SCANNER_DISCLOSURE } from "@/lib/clinical/risk";
import { Info } from "lucide-react";
import RiskAlertList from "./RiskAlertList";

/**
 * The risk queue. Every number on this page is a count of real `risk_alerts`
 * rows; nothing is synthesised.
 *
 * The description previously read "AI-generated and manually flagged risk
 * alerts". There is no AI here — `lib/clinical/risk.ts` is a substring match
 * against a fixed word list, and calling that "AI-generated" oversells its
 * reliability to precisely the reader who is deciding whether to act on it.
 */
export default async function RiskAlertsPage() {
  const user = await getLoggedInUser();
  if (!user || !user.labels?.includes("admin")) redirect("/dashboard");

  const [alerts, profiles] = await Promise.all([
    listRiskAlertsAction(),
    listProfilesAction(),
  ]);

  const unresolved = alerts.filter((a: { resolved: boolean }) => !a.resolved);
  const countBy = (severity: string) =>
    unresolved.filter((a: { severity: string }) => a.severity === severity).length;

  const stats = [
    { label: "Critical", value: countBy("critical"), color: "border-rose-200 bg-rose-50" },
    { label: "High", value: countBy("high"), color: "border-orange-200 bg-orange-50" },
    { label: "Medium", value: countBy("medium"), color: "border-amber-200 bg-amber-50" },
    { label: "Low", value: countBy("low"), color: "border-stone-200 bg-stone-50" },
  ];

  return (
    <div>
      <AdminPageHeader
        title="Risk & Crisis Management"
        description="Alerts raised by the message keyword scan, plus incidents logged by admins."
        breadcrumbs={[{ label: "Risk & Crisis" }]}
        actions={
          <div className="flex gap-2">
            {/*
              These were `<button>` elements with no handler — clicking them did
              nothing at all. In a crisis runbook a dead control is worse than a
              missing one, because staff believe they invoked something.
            */}
            <Link
              href="/admin/risk/incidents"
              className="px-3 py-2 text-sm font-medium text-stone-600 bg-white border border-stone-200 rounded-xl hover:bg-stone-50 transition-colors"
            >
              Incident Log
            </Link>
            <Link
              href="/admin/risk/escalation"
              className="px-3 py-2 text-sm font-medium text-stone-600 bg-white border border-stone-200 rounded-xl hover:bg-stone-50 transition-colors"
            >
              Escalation Workflow
            </Link>
          </div>
        }
      />

      {/*
        Provenance above the queue, where it is read before any alert is acted
        on. `RISK_SCANNER_DISCLOSURE` is defined next to the keyword lists so
        this wording cannot drift away from what the scanner actually does.
      */}
      <div className="flex items-start gap-3 p-4 mb-6 bg-amber-50 border border-amber-200 rounded-2xl">
        <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-amber-800 leading-relaxed">
          <span className="font-bold">How automated alerts are produced. </span>
          {RISK_SCANNER_DISCLOSURE}
        </div>
      </div>

      {/* Unresolved counts by severity. Resolved alerts are excluded — this is
          a work queue, and counting closed work makes it useless as one. */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {stats.map((m) => (
          <div key={m.label} className={`rounded-2xl border ${m.color} p-5`}>
            <p className="text-3xl font-bold text-stone-900">{m.value}</p>
            <p className="text-xs text-stone-500 mt-1">{m.label} · unresolved</p>
          </div>
        ))}
      </div>

      <RiskAlertList initialAlerts={alerts} profiles={profiles} />
    </div>
  );
}
