import { createAdminClient, getLoggedInUser } from "@/lib/appwrite/server";
import { appwriteConfig } from "@/lib/appwrite/config";
import { redirect, notFound } from "next/navigation";
import AdminPageHeader from "../../../_components/AdminPageHeader";
import AdminBadge from "../../../_components/AdminBadge";
import AdminEmptyState from "../../../_components/AdminEmptyState";
import Link from "next/link";

export default async function TherapyHistoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getLoggedInUser();
  if (!user || !user.labels?.includes("admin")) redirect("/dashboard");

  const { id } = await params;
  const { users, databases } = createAdminClient();

  let client;
  try { client = await users.get(id); } catch { notFound(); }

  const sessionList = await databases.listDocuments(
    appwriteConfig.databaseId,
    appwriteConfig.collections.sessions,
  );
  const sessions = sessionList.documents.filter((s) => s.patientId === id);

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
                    <td className="px-5 py-4 text-sm text-stone-700">—</td>
                    <td className="px-5 py-4 text-sm text-stone-600">
                      {new Date(s.scheduledAt).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="px-5 py-4">
                      <AdminBadge
                        label={s.status as string}
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
