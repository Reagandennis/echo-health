import { createAdminClient, getLoggedInUser } from "@/lib/appwrite/server";
import { appwriteConfig } from "@/lib/appwrite/config";
import { redirect } from "next/navigation";
import Link from "next/link";
import AdminPageHeader from "../_components/AdminPageHeader";
import AdminBadge, { kycBadge } from "../_components/AdminBadge";
import { Search, Download, UserPlus, Star } from "lucide-react";

export default async function TherapistsListPage() {
  const user = await getLoggedInUser();
  if (!user || !user.labels?.includes("admin")) redirect("/dashboard");

  const { databases } = createAdminClient();
  const res = await databases.listDocuments(
    appwriteConfig.databaseId,
    appwriteConfig.collections.therapists,
  );
  const therapists = res.documents;

  return (
    <div>
      <AdminPageHeader
        title="Therapist Management"
        description="Manage, verify and monitor all clinicians on the platform."
        breadcrumbs={[{ label: "Therapists" }]}
        actions={
          <div className="flex gap-2">
            <button className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-stone-600 bg-white border border-stone-200 rounded-xl hover:bg-stone-50 transition-colors">
              <Download className="w-4 h-4" /> Export
            </button>
            <Link
              href="/admin/therapists/verification-queue"
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-teal-600 rounded-xl hover:bg-teal-700 transition-colors"
            >
              <UserPlus className="w-4 h-4" /> Verification Queue
            </Link>
          </div>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex items-center gap-2 bg-white border border-stone-200 rounded-xl px-3 py-2 flex-1 min-w-[220px] max-w-xs">
          <Search className="w-4 h-4 text-stone-400" />
          <input type="text" placeholder="Search therapists…" className="text-sm outline-none text-stone-700 placeholder-stone-400 w-full bg-transparent" />
        </div>
        {["All", "Verified", "Pending", "Rejected", "Suspended"].map((f) => (
          <button key={f} className={`px-3 py-2 text-sm font-medium rounded-xl border transition-colors ${f === "All" ? "bg-teal-600 text-white border-teal-600" : "bg-white text-stone-600 border-stone-200 hover:bg-stone-50"}`}>{f}</button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[700px]">
            <thead className="bg-stone-50 border-b border-stone-100">
              <tr>
                {["Therapist", "Specialties", "KYC Status", "Rating", "Sessions", "Earnings", ""].map((h) => (
                  <th key={h} className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-stone-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {therapists.length === 0 ? (
                <tr><td colSpan={7} className="py-16 text-center text-sm text-stone-400">No therapists found.</td></tr>
              ) : (
                therapists.map((t) => (
                  <tr key={t.$id} className="hover:bg-teal-50/30 transition-colors group">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-400 to-indigo-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                          {(t.name as string).charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-stone-900">{t.name}</p>
                          <p className="text-xs text-stone-400">{t.experience} yrs exp</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-1">
                        {((t.specialties as string[]) ?? []).slice(0, 2).map((s) => (
                          <AdminBadge key={s} label={s} variant="neutral" />
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-4">{kycBadge(t.kycStatus ?? "incomplete")}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1">
                        <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                        <span className="text-sm text-stone-700">{t.rating ?? "—"}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-stone-600">—</td>
                    <td className="px-5 py-4 text-sm text-stone-600">—</td>
                    <td className="px-5 py-4 text-right">
                      <Link href={`/admin/therapists/${t.$id}`} className="text-xs text-teal-600 hover:text-teal-700 font-semibold opacity-0 group-hover:opacity-100 transition-opacity">View →</Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
