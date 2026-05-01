import { createAdminClient, getLoggedInUser } from "@/lib/appwrite/server";
import { appwriteConfig } from "@/lib/appwrite/config";
import { redirect } from "next/navigation";
import Link from "next/link";
import AdminPageHeader from "../_components/AdminPageHeader";
import AdminBadge from "../_components/AdminBadge";
import { Search, Filter, Calendar } from "lucide-react";
import { listProfilesAction, listTherapistsAction } from "@/app/actions/database";

export default async function AllSessionsPage() {
  const user = await getLoggedInUser();
  if (!user || !user.labels?.includes("admin")) redirect("/dashboard");
  
  const { databases } = createAdminClient();
  const [res, profiles, therapists] = await Promise.all([
    databases.listDocuments(appwriteConfig.databaseId, appwriteConfig.collections.sessions),
    listProfilesAction(),
    listTherapistsAction(),
  ]);
  
  const sessions = res.documents;

  function getPatientName(id: string) {
    return profiles.find((p: any) => p.userId === id || p.$id === id)?.name || id;
  }

  function getTherapistName(id: string) {
    return therapists.find((t: any) => t.$id === id)?.name || id;
  }

  return (
    <div>
      <AdminPageHeader
        title="Sessions & Communication"
        description="Monitor all therapy sessions, conversations and quality metrics."
        breadcrumbs={[{ label: "Sessions" }]}
        actions={
          <div className="flex gap-2">
            <Link href="/admin/sessions/no-shows" className="px-3 py-2 text-sm font-medium text-stone-600 bg-white border border-stone-200 rounded-xl hover:bg-stone-50 transition-colors">No-Shows</Link>
            <Link href="/admin/sessions/flagged" className="px-3 py-2 text-sm font-medium text-white bg-rose-600 rounded-xl hover:bg-rose-700 transition-colors">Flagged</Link>
          </div>
        }
      />

      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex items-center gap-2 bg-white border border-stone-200 rounded-xl px-3 py-2 flex-1 min-w-[200px] max-w-xs">
          <Search className="w-4 h-4 text-stone-400" />
          <input type="text" placeholder="Search sessions…" className="text-sm outline-none text-stone-700 placeholder-stone-400 w-full bg-transparent" />
        </div>
        {["All", "Confirmed", "Completed", "Cancelled", "Pending"].map((f) => (
          <button key={f} className={`px-3 py-2 text-sm font-medium rounded-xl border transition-colors ${f === "All" ? "bg-teal-600 text-white border-teal-600" : "bg-white text-stone-600 border-stone-200 hover:bg-stone-50"}`}>{f}</button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[700px]">
            <thead className="bg-stone-50 border-b border-stone-100">
              <tr>
                {["Session ID", "Patient", "Therapist", "Scheduled", "Status", "Quality", ""].map((h) => (
                  <th key={h} className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-stone-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {sessions.length === 0 ? (
                <tr><td colSpan={7} className="py-16 text-center text-sm text-stone-400">No sessions found.</td></tr>
              ) : sessions.map((s) => (
                <tr key={s.$id} className="hover:bg-teal-50/30 transition-colors group">
                  <td className="px-5 py-4 text-xs font-mono text-stone-400">{s.$id.slice(0, 10)}…</td>
                  <td className="px-5 py-4 text-sm font-semibold text-stone-900">{getPatientName(s.patientId)}</td>
                  <td className="px-5 py-4 text-sm text-stone-700">{getTherapistName(s.therapistId)}</td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1 text-xs text-stone-500">
                      <Calendar className="w-3 h-3" />
                      {new Date(s.scheduledAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <AdminBadge label={s.status as string} variant={s.status === "completed" ? "teal" : s.status === "confirmed" ? "success" : s.status === "cancelled" ? "danger" : "warning"} dot />
                  </td>
                  <td className="px-5 py-4"><AdminBadge label="Good" variant="success" /></td>
                  <td className="px-5 py-4 text-right">
                    <Link href={`/admin/sessions/${s.$id}`} className="text-xs text-teal-600 hover:text-teal-700 font-semibold opacity-0 group-hover:opacity-100 transition-opacity">View →</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
