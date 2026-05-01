import { getLoggedInUser } from "@/lib/appwrite/server";
import { redirect } from "next/navigation";
import AdminPageHeader from "../../_components/AdminPageHeader";
import AdminBadge from "../../_components/AdminBadge";
import Link from "next/link";
import { Plus } from "lucide-react";

const INCIDENTS = [
  { id: "inc_001", client: "Daniel T.", type: "Crisis — Suicidal Ideation", severity: "critical", reporter: "Dr. Müller", date: "Apr 25, 2026", status: "open" },
  { id: "inc_002", client: "Amara L.", type: "Safeguarding Concern", severity: "high", reporter: "Admin", date: "Apr 20, 2026", status: "under-review" },
  { id: "inc_003", client: "Priya V.", type: "Boundary Violation Reported", severity: "high", reporter: "Dr. Santos", date: "Apr 10, 2026", status: "resolved" },
  { id: "inc_004", client: "Ethan R.", type: "Non-attendance Emergency", severity: "medium", reporter: "Admin", date: "Apr 5, 2026", status: "resolved" },
];

export default async function IncidentLogPage() {
  const user = await getLoggedInUser();
  if (!user || !user.labels?.includes("admin")) redirect("/dashboard");

  return (
    <div>
      <AdminPageHeader
        title="Incident Log"
        description="All clinical and platform incidents."
        breadcrumbs={[{ label: "Risk & Crisis", href: "/admin/risk" }, { label: "Incidents" }]}
        actions={
          <Link href="/admin/risk/incidents/new" className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-rose-600 rounded-xl hover:bg-rose-700 transition-colors">
            <Plus className="w-4 h-4" /> New Incident
          </Link>
        }
      />
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[600px]">
            <thead className="bg-stone-50 border-b border-stone-100">
              <tr>{["ID", "Client", "Type", "Severity", "Reporter", "Date", "Status", ""].map((h) => <th key={h} className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-stone-500">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {INCIDENTS.map((i) => (
                <tr key={i.id} className="hover:bg-stone-50/50 transition-colors group">
                  <td className="px-5 py-4 text-xs font-mono text-stone-400">{i.id}</td>
                  <td className="px-5 py-4 text-sm font-medium text-stone-800">{i.client}</td>
                  <td className="px-5 py-4 text-sm text-stone-700">{i.type}</td>
                  <td className="px-5 py-4"><AdminBadge label={i.severity} variant={i.severity === "critical" ? "danger" : i.severity === "high" ? "danger" : "warning"} /></td>
                  <td className="px-5 py-4 text-sm text-stone-500">{i.reporter}</td>
                  <td className="px-5 py-4 text-sm text-stone-500">{i.date}</td>
                  <td className="px-5 py-4"><AdminBadge label={i.status.replace("-", " ")} variant={i.status === "resolved" ? "success" : i.status === "under-review" ? "warning" : "danger"} dot /></td>
                  <td className="px-5 py-4 text-right"><button className="text-xs text-teal-600 hover:text-teal-700 font-medium opacity-0 group-hover:opacity-100 transition-opacity">View →</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
