import { createAdminClient, getLoggedInUser } from "@/lib/appwrite/server";
import { appwriteConfig } from "@/lib/appwrite/config";
import { redirect, notFound } from "next/navigation";
import AdminPageHeader from "../../../_components/AdminPageHeader";
import { Clock, LogIn, LogOut, Edit, ShieldAlert } from "lucide-react";

const ICON_MAP: Record<string, React.ElementType> = {
  login: LogIn, logout: LogOut, profile_update: Edit, kyc_submitted: ShieldAlert,
};
const MOCK_AUDIT = [
  { id: "1", event: "login", description: "Logged in from Safari on macOS", ip: "102.89.x.x", time: "2026-04-26T09:00:00Z" },
  { id: "2", event: "kyc_submitted", description: "KYC documents uploaded for review", ip: "102.89.x.x", time: "2026-04-20T14:30:00Z" },
  { id: "3", event: "profile_update", description: "Updated bio and specialties", ip: "102.89.x.x", time: "2026-04-15T11:00:00Z" },
  { id: "4", event: "logout", description: "Logged out", ip: "102.89.x.x", time: "2026-04-14T18:00:00Z" },
];

export default async function TherapistAuditLogPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const user = await getLoggedInUser();
  if (!user || !user.labels?.includes("admin")) redirect("/dashboard");
  const { id } = await params;
  const { databases } = createAdminClient();
  let t: Record<string, unknown>;
  try { t = await databases.getDocument(appwriteConfig.databaseId, appwriteConfig.collections.therapists, id) as unknown as Record<string, unknown>; } catch { notFound(); }

  return (
    <div>
      <AdminPageHeader
        title="Audit Log"
        description="Complete activity history for this therapist account."
        breadcrumbs={[{ label: "Therapists", href: "/admin/therapists" }, { label: t.name as string, href: `/admin/therapists/${id}` }, { label: "Audit Log" }]}
      />
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[500px]">
            <thead className="bg-stone-50 border-b border-stone-100">
              <tr>
                {["Event", "Description", "IP Address", "Timestamp"].map((h) => (
                  <th key={h} className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-stone-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {MOCK_AUDIT.map((entry) => {
                const Icon = ICON_MAP[entry.event] ?? Clock;
                return (
                  <tr key={entry.id} className="hover:bg-stone-50/50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-stone-100 flex items-center justify-center"><Icon className="w-3.5 h-3.5 text-stone-500" /></div>
                        <span className="text-xs font-semibold text-stone-700 capitalize">{entry.event.replace("_", " ")}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-stone-700">{entry.description}</td>
                    <td className="px-5 py-4 text-xs font-mono text-stone-500">{entry.ip}</td>
                    <td className="px-5 py-4 text-xs text-stone-500">
                      <div className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(entry.time).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
