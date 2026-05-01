import { createAdminClient, getLoggedInUser } from "@/lib/appwrite/server";
import { appwriteConfig } from "@/lib/appwrite/config";
import { redirect, notFound } from "next/navigation";
import AdminPageHeader from "../../../_components/AdminPageHeader";
import AdminBadge from "../../../_components/AdminBadge";

export default async function SessionTimelinePage({
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
  const sessions = sessionList.documents
    .filter((s) => s.patientId === id)
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());

  return (
    <div>
      <AdminPageHeader
        title="Session Timeline"
        breadcrumbs={[
          { label: "Clients", href: "/admin/users" },
          { label: client.name, href: `/admin/users/${id}` },
          { label: "Session Timeline" },
        ]}
      />

      {sessions.length === 0 ? (
        <div className="text-center py-20 text-stone-400 text-sm">No sessions to display.</div>
      ) : (
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-6 top-0 bottom-0 w-px bg-stone-200" />
          <div className="space-y-6 pl-16">
            {sessions.map((s) => {
              const date = new Date(s.scheduledAt);
              const color =
                s.status === "completed" ? "bg-teal-500"
                : s.status === "confirmed" ? "bg-emerald-500"
                : s.status === "cancelled" ? "bg-rose-500"
                : "bg-amber-400";
              return (
                <div key={s.$id} className="relative">
                  {/* Dot */}
                  <div className={`absolute -left-[42px] top-3 w-4 h-4 rounded-full border-2 border-white ${color}`} />
                  <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <p className="text-xs text-stone-400 font-medium mb-1">
                          {date.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </p>
                        <p className="text-sm font-semibold text-stone-800">
                          Therapy Session
                        </p>
                        {s.notes && (
                          <p className="text-xs text-stone-500 mt-1 max-w-md">{s.notes}</p>
                        )}
                      </div>
                      <AdminBadge
                        label={s.status as string}
                        variant={s.status === "completed" ? "teal" : s.status === "confirmed" ? "success" : s.status === "cancelled" ? "danger" : "warning"}
                        dot
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
