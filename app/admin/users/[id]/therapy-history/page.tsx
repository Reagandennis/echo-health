import { getLoggedInUser } from "@/lib/auth/session";
import { redirect, notFound } from "next/navigation";
import AdminPageHeader from "../../../_components/AdminPageHeader";
import AdminBadge from "../../../_components/AdminBadge";
import AdminEmptyState from "../../../_components/AdminEmptyState";
import Link from "next/link";
import { getProfileByUserId, listTherapists } from "../../../_lib/queries";
import { listPatientSessionsAction } from "@/app/actions/database";

export default async function TherapyHistoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getLoggedInUser();
  if (!user || !user.labels?.includes("admin")) redirect("/dashboard");

  const { id } = await params;

  const client = await getProfileByUserId(id);
  if (!client) notFound();

  // Replaces a fetch-every-session-then-filter-in-JS scan with an indexed
  // `patient_id` lookup (`therapy_sessions_patient_id_idx`).
  const [sessions, therapists] = await Promise.all([
    listPatientSessionsAction(id),
    listTherapists(),
  ]);

  // `therapy_sessions.therapist_id` is a `therapists.id`, not a user id. The
  // Therapist column rendered a hardcoded "—" before; it can be resolved now.
  const therapistNameById = new Map(therapists.map((t) => [t.id, t.name]));

  return (
    <div>
      <AdminPageHeader
        title="Therapy History"
        breadcrumbs={[
          { label: "Clients", href: "/admin/users" },
          { label: client.name, href: `/admin/users/${id}` },
          { label: "Therapy History" },
        ]}
      />

      {sessions.length === 0 ? (
        <AdminEmptyState
          title="No sessions yet"
          description="This client hasn't had any therapy sessions recorded."
        />
      ) : (
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[600px]">
              <thead className="bg-stone-50 border-b border-stone-100">
                <tr>
                  {["Session ID", "Therapist", "Scheduled At", "Status", "Notes", ""].map((h) => (
                    <th key={h} className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-stone-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-50">
                {sessions.map((s) => (
                  <tr key={s.$id} className="hover:bg-stone-50/50 transition-colors">
                    <td className="px-5 py-4 text-xs text-stone-400 font-mono">{s.$id.slice(0, 10)}…</td>
                    <td className="px-5 py-4 text-sm text-stone-700">{therapistNameById.get(s.therapistId) ?? "—"}</td>
                    <td className="px-5 py-4 text-sm text-stone-600">
                      {s.scheduledAt.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="px-5 py-4">
                      <AdminBadge
                        label={s.status}
                        variant={s.status === "completed" ? "teal" : s.status === "confirmed" ? "success" : s.status === "cancelled" ? "danger" : "warning"}
                        dot
                      />
                    </td>
                    <td className="px-5 py-4 text-sm text-stone-500 max-w-[200px] truncate">{s.notes || "—"}</td>
                    <td className="px-5 py-4 text-right">
                      <Link href={`/admin/sessions/${s.$id}`} className="text-xs text-teal-600 hover:text-teal-700 font-medium">View →</Link>
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
