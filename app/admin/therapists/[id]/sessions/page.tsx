import { getLoggedInUser } from "@/lib/auth/session";
import { redirect, notFound } from "next/navigation";
import AdminPageHeader from "../../../_components/AdminPageHeader";
import AdminBadge from "../../../_components/AdminBadge";
import { getTherapist, listProfiles } from "../../../_lib/queries";
import { listTherapistSessionsAction } from "@/app/actions/database";

export default async function TherapistSessionsPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const user = await getLoggedInUser();
  if (!user || !user.labels?.includes("admin")) redirect("/dashboard");
  const { id } = await params;

  const t = await getTherapist(id);
  if (!t) notFound();

  // Indexed `therapist_id` lookup, replacing a fetch-everything-then-filter scan.
  const [sessions, profiles] = await Promise.all([
    listTherapistSessionsAction(id),
    listProfiles(),
  ]);

  // The Patient column printed a raw Auth0 sub before.
  const nameByUserId = new Map(profiles.map((p) => [p.userId, p.name]));

  return (
    <div>
      <AdminPageHeader
        title="Session History"
        breadcrumbs={[{ label: "Therapists", href: "/admin/therapists" }, { label: t.name, href: `/admin/therapists/${id}` }, { label: "Sessions" }]}
      />
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[600px]">
            <thead className="bg-stone-50 border-b border-stone-100">
              <tr>
                {["Patient", "Scheduled At", "Status", "Notes", ""].map((h) => (
                  <th key={h} className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-stone-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {sessions.length === 0
                ? <tr><td colSpan={5} className="py-16 text-center text-sm text-stone-400">No sessions found for this therapist.</td></tr>
                : sessions.map((s: { $id: string; patientId: string; scheduledAt: Date; status: string; notes: string | null }) => (
                  <tr key={s.$id} className="hover:bg-stone-50/50 transition-colors">
                    <td className="px-5 py-4 text-sm text-stone-700">{nameByUserId.get(s.patientId) ?? s.patientId}</td>
                    <td className="px-5 py-4 text-sm text-stone-600">{s.scheduledAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td>
                    <td className="px-5 py-4"><AdminBadge label={s.status} variant={s.status === "completed" ? "teal" : s.status === "confirmed" ? "success" : s.status === "cancelled" ? "danger" : "warning"} dot /></td>
                    <td className="px-5 py-4 text-xs text-stone-500 max-w-xs truncate">{s.notes || "—"}</td>
                    <td className="px-5 py-4 text-right"><a href={`/admin/sessions/${s.$id}`} className="text-xs text-teal-600 hover:text-teal-700 font-medium">View →</a></td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
