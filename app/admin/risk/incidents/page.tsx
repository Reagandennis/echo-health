import { getLoggedInUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import AdminPageHeader from "../../_components/AdminPageHeader";
import AdminBadge from "../../_components/AdminBadge";
import Link from "next/link";
import { Plus, Inbox } from "lucide-react";
import { listRiskAlertsAction, listProfilesAction } from "@/app/actions/database";

/**
 * The incident log, backed by `risk_alerts`.
 *
 * WHAT WAS DELETED AND WHY. This page rendered four hardcoded rows — including
 * "Daniel T. · Crisis — Suicidal Ideation · critical · reported by Dr. Müller"
 * — as a table of real incidents. They were literals in the JSX. There is no
 * incidents table in this schema and never has been, so every row was an
 * invented clinical event attributed to a named client and a named clinician.
 *
 * There is exactly one table in this database that records something an
 * incident log would record: `risk_alerts`. This page is now a view over it.
 * Consequently the columns are the columns that table actually has. The old
 * "Reporter" column is gone: `risk_alerts` stores no author, so any value in it
 * would have been fabricated, and attributing a clinical incident to the wrong
 * person is a particularly bad thing to invent.
 */
export default async function IncidentLogPage() {
  const user = await getLoggedInUser();
  if (!user || !user.labels?.includes("admin")) redirect("/dashboard");

  const [alerts, profiles] = await Promise.all([
    listRiskAlertsAction(),
    listProfilesAction(),
  ]);

  const nameFor = (patientId: string) =>
    profiles.find((p: { userId: string }) => p.userId === patientId)?.name ??
    `Unidentified account (${patientId})`;

  return (
    <div>
      <AdminPageHeader
        title="Incident Log"
        description="Risk alerts filed automatically by the message keyword scan, and incidents logged by admins."
        breadcrumbs={[{ label: "Risk & Crisis", href: "/admin/risk" }, { label: "Incidents" }]}
        actions={
          <Link href="/admin/risk/incidents/new" className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-rose-600 rounded-xl hover:bg-rose-700 transition-colors">
            <Plus className="w-4 h-4" /> New Incident
          </Link>
        }
      />

      {alerts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-stone-200 p-10 text-center">
          <Inbox size={28} className="mx-auto text-stone-300 mb-3" />
          <p className="text-stone-700 font-semibold">No incidents have been logged.</p>
          <p className="text-sm text-stone-500 mt-2 max-w-lg mx-auto leading-relaxed">
            Incidents are stored as risk alerts — there is no separate incident
            record. This log shows every alert, whether raised by the automated
            keyword scan on client messages or filed here by an admin.
          </p>
          <Link
            href="/admin/risk/incidents/new"
            className="inline-block mt-5 px-4 py-2 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors"
          >
            Log the first incident
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[600px]">
              <thead className="bg-stone-50 border-b border-stone-100">
                <tr>
                  {["Client", "Type", "Severity", "Description", "Logged", "Status"].map((h) => (
                    <th key={h} className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-stone-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-50">
                {alerts.map((a: {
                  $id: string;
                  patientId: string;
                  type: string;
                  severity: string;
                  description: string;
                  createdAt: string | Date;
                  resolved: boolean;
                }) => (
                  <tr key={a.$id} className="hover:bg-stone-50/50 transition-colors align-top">
                    <td className="px-5 py-4 text-sm font-medium text-stone-800">
                      <Link
                        href={`/admin/users/${encodeURIComponent(a.patientId)}/risk-profile`}
                        className="hover:text-teal-700 hover:underline"
                      >
                        {nameFor(a.patientId)}
                      </Link>
                    </td>
                    <td className="px-5 py-4 text-sm text-stone-700 capitalize">{a.type}</td>
                    <td className="px-5 py-4">
                      <AdminBadge
                        label={a.severity}
                        variant={a.severity === "critical" || a.severity === "high" ? "danger" : a.severity === "medium" ? "warning" : "neutral"}
                      />
                    </td>
                    <td className="px-5 py-4 text-sm text-stone-600 max-w-md">{a.description}</td>
                    <td className="px-5 py-4 text-sm text-stone-500 whitespace-nowrap">
                      {new Date(a.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                    <td className="px-5 py-4">
                      <AdminBadge
                        label={a.resolved ? "resolved" : "open"}
                        variant={a.resolved ? "success" : "danger"}
                        dot
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
