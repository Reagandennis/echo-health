import { createAdminClient, getLoggedInUser } from "@/lib/appwrite/server";
import { redirect, notFound } from "next/navigation";
import AdminPageHeader from "../../../_components/AdminPageHeader";
import { Clock, Monitor, LogIn, LogOut, Edit, ShieldAlert, CreditCard } from "lucide-react";

const ICON_MAP: Record<string, React.ElementType> = {
  login: LogIn, logout: LogOut, profile_update: Edit,
  risk_flag: ShieldAlert, payment: CreditCard, session: Monitor,
};

const MOCK_AUDIT = [
  { id: "1", event: "login",          description: "Logged in from Chrome on macOS",    ip: "197.200.x.x", time: "2026-04-26T08:30:00Z" },
  { id: "2", event: "session",        description: "Session booked with Dr. Patel",     ip: "197.200.x.x", time: "2026-04-26T08:35:00Z" },
  { id: "3", event: "profile_update", description: "Updated email address",             ip: "197.200.x.x", time: "2026-04-24T14:10:00Z" },
  { id: "4", event: "payment",        description: "Monthly subscription renewed",      ip: "197.200.x.x", time: "2026-04-01T00:02:00Z" },
  { id: "5", event: "risk_flag",      description: "AI risk flag raised (mood drop)",   ip: "—",            time: "2026-03-28T11:00:00Z" },
  { id: "6", event: "login",          description: "Failed login attempt (wrong pwd)",  ip: "41.57.x.x",   time: "2026-03-20T07:15:00Z" },
  { id: "7", event: "logout",         description: "Logged out",                        ip: "197.200.x.x", time: "2026-03-19T18:45:00Z" },
];

export default async function AuditLogPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getLoggedInUser();
  if (!user || !user.labels?.includes("admin")) redirect("/dashboard");
  const { id } = await params;
  const { users } = createAdminClient();
  let client;
  try { client = await users.get(id); } catch { notFound(); }

  return (
    <div>
      <AdminPageHeader
        title="Audit Log"
        description="Complete activity history for this account."
        breadcrumbs={[
          { label: "Clients", href: "/admin/users" },
          { label: client.name, href: `/admin/users/${id}` },
          { label: "Audit Log" },
        ]}
      />

      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[600px]">
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
                        <div className="w-7 h-7 rounded-lg bg-stone-100 flex items-center justify-center">
                          <Icon className="w-3.5 h-3.5 text-stone-500" />
                        </div>
                        <span className="text-xs font-semibold text-stone-700 capitalize">{entry.event.replace("_", " ")}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-stone-700">{entry.description}</td>
                    <td className="px-5 py-4 text-xs font-mono text-stone-500">{entry.ip}</td>
                    <td className="px-5 py-4 text-xs text-stone-500">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(entry.time).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </div>
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
