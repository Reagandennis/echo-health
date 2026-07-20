import { getLoggedInUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import Link from "next/link";
import AdminPageHeader from "../_components/AdminPageHeader";
import AdminBadge from "../_components/AdminBadge";
import { Search, UserPlus, Download, Clock } from "lucide-react";
import { listAllSessions, listProfiles, listTherapists } from "../_lib/queries";

/**
 * The client roster.
 *
 * `profiles` replaces the Appwrite `users.list()` enumeration — Appwrite holds
 * no users since the Auth0 migration, so that call returned an empty list and
 * this table rendered blank. `profiles.user_id` is the Auth0 sub and is what
 * every row link and session lookup keys on.
 *
 * The Status column no longer shows Appwrite's account-enabled flag (an Auth0
 * concern now, with no server-side query available) and instead shows whether
 * the client has been matched to a therapist — real data from the same row.
 */
export default async function UsersListPage() {
  const user = await getLoggedInUser();
  if (!user || !user.labels?.includes("admin")) redirect("/dashboard");

  const [profiles, therapists, sessions] = await Promise.all([
    listProfiles(),
    listTherapists(),
    listAllSessions(),
  ]);

  const therapistNameById = new Map(therapists.map((t) => [t.id, t.name]));

  // Pre-aggregate instead of re-scanning every session inside the render loop.
  const sessionCountByPatient = new Map<string, number>();
  for (const s of sessions) {
    sessionCountByPatient.set(
      s.patientId,
      (sessionCountByPatient.get(s.patientId) ?? 0) + 1
    );
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
                {["Client", "Joined", "Match", "Therapist", "Sessions", "Risk", ""].map((h) => (
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
              {profiles.length === 0 ? (
                <tr><td colSpan={7} className="py-16 text-center text-sm text-stone-400">No clients found.</td></tr>
              ) : profiles.map((p) => (
                <tr key={p.$id} className="hover:bg-teal-50/30 transition-colors group">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-teal-400 to-blue-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                        {p.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-stone-900">{p.name}</p>
                        <p className="text-xs text-stone-400">{p.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1 text-xs text-stone-500">
                      <Clock className="w-3 h-3" />
                      {p.createdAt.toLocaleDateString("en-US", {
                        month: "short", day: "numeric", year: "numeric",
                      })}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <AdminBadge
                      label={p.therapistId ? "Matched" : "Unmatched"}
                      variant={p.therapistId ? "success" : "neutral"}
                      dot
                    />
                  </td>
                  <td className="px-5 py-4 text-sm text-stone-700">
                    {p.therapistId ? therapistNameById.get(p.therapistId) ?? "—" : "—"}
                  </td>
                  <td className="px-5 py-4 text-sm text-stone-700">
                    {sessionCountByPatient.get(p.userId) ?? 0}
                  </td>
                  <td className="px-5 py-4">
                    <AdminBadge label="None" variant="neutral" />
                  </td>
                  <td className="px-5 py-4 text-right">
                    <Link
                      href={`/admin/users/${encodeURIComponent(p.userId)}`}
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
            Showing {profiles.length} client{profiles.length === 1 ? "" : "s"}
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
