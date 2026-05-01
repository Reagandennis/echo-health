import { createAdminClient, getLoggedInUser } from "@/lib/appwrite/server";
import { appwriteConfig } from "@/lib/appwrite/config";
import { redirect } from "next/navigation";
import Link from "next/link";
import AdminPageHeader from "../_components/AdminPageHeader";
import AdminBadge from "../_components/AdminBadge";
import { Search, UserPlus, Download, Clock } from "lucide-react";
import { listProfilesAction, listTherapistsAction } from "@/app/actions/database";
import { Query } from "node-appwrite";

export default async function UsersListPage() {
  const user = await getLoggedInUser();
  if (!user || !user.labels?.includes("admin")) redirect("/dashboard");

  const { users, databases } = createAdminClient();
  const [userList, profiles, therapists, sessions] = await Promise.all([
    users.list(),
    listProfilesAction(),
    listTherapistsAction(),
    databases.listDocuments(appwriteConfig.databaseId, appwriteConfig.collections.sessions, [Query.limit(100)]),
  ]);

  function getTherapistName(userId: string) {
    const profile = profiles.find((p: any) => p.userId === userId);
    if (!profile?.therapistId) return "—";
    return therapists.find((t: any) => t.$id === profile.therapistId)?.name || "—";
  }

  function getSessionCount(userId: string) {
    return sessions.documents.filter((s: any) => s.patientId === userId).length;
  }

  return (
    <div>
      <AdminPageHeader
        title="Client Management"
        description="View, manage and action all registered clients on the platform."
        breadcrumbs={[{ label: "Clients" }]}
        actions={
          <div className="flex gap-2">
            <button className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-stone-600 bg-white border border-stone-200 rounded-xl hover:bg-stone-50 transition-colors">
              <Download className="w-4 h-4" /> Export
            </button>
            <button className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-teal-600 rounded-xl hover:bg-teal-700 transition-colors">
              <UserPlus className="w-4 h-4" /> Invite Client
            </button>
          </div>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex items-center gap-2 bg-white border border-stone-200 rounded-xl px-3 py-2 flex-1 min-w-[220px] max-w-xs">
          <Search className="w-4 h-4 text-stone-400" />
          <input
            type="text"
            placeholder="Search name or email…"
            className="text-sm outline-none text-stone-700 placeholder-stone-400 w-full bg-transparent"
          />
        </div>
        {["All", "Active", "Inactive", "High Risk", "Suspended"].map((f) => (
          <button
            key={f}
            className={`px-3 py-2 text-sm font-medium rounded-xl border transition-colors ${
              f === "All"
                ? "bg-teal-600 text-white border-teal-600"
                : "bg-white text-stone-600 border-stone-200 hover:bg-stone-50"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[700px]">
            <thead className="bg-stone-50 border-b border-stone-100">
              <tr>
                {["Client", "Joined", "Status", "Therapist", "Sessions", "Risk", ""].map((h) => (
                  <th
                    key={h}
                    className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-stone-500"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {userList.users.map((u) => (
                <tr key={u.$id} className="hover:bg-teal-50/30 transition-colors group">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-teal-400 to-blue-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                        {u.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-stone-900">{u.name}</p>
                        <p className="text-xs text-stone-400">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1 text-xs text-stone-500">
                      <Clock className="w-3 h-3" />
                      {new Date(u.registration).toLocaleDateString("en-US", {
                        month: "short", day: "numeric", year: "numeric",
                      })}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <AdminBadge
                      label={u.status ? "Active" : "Inactive"}
                      variant={u.status ? "success" : "neutral"}
                      dot
                    />
                  </td>
                  <td className="px-5 py-4 text-sm text-stone-700">{getTherapistName(u.$id)}</td>
                  <td className="px-5 py-4 text-sm text-stone-700">{getSessionCount(u.$id)}</td>
                  <td className="px-5 py-4">
                    <AdminBadge label="None" variant="neutral" />
                  </td>
                  <td className="px-5 py-4 text-right">
                    <Link
                      href={`/admin/users/${u.$id}`}
                      className="text-xs text-teal-600 hover:text-teal-700 font-semibold opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3.5 border-t border-stone-100 flex items-center justify-between">
          <p className="text-xs text-stone-500">
            Showing {userList.users.length} of {userList.total} clients
          </p>
          <div className="flex gap-1">
            {["←", "1", "2", "3", "→"].map((p) => (
              <button
                key={p}
                className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${
                  p === "1"
                    ? "bg-teal-600 text-white"
                    : "text-stone-500 hover:bg-stone-100"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
