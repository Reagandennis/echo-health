import { getLoggedInUser } from "@/lib/appwrite/server";
import { redirect } from "next/navigation";
import AdminPageHeader from "../../_components/AdminPageHeader";
import AdminBadge from "../../_components/AdminBadge";
import { ShieldAlert } from "lucide-react";

const DATA_TYPES = ["messages", "sessions", "billing", "full profile"] as const;
type DataType = typeof DATA_TYPES[number];

const BADGE_MAP: Record<DataType, "info" | "teal" | "warning" | "danger"> = {
  messages: "info",
  sessions: "teal",
  billing: "warning",
  "full profile": "danger",
};

const LOG: Array<{ admin: string; client: string; dataType: DataType; purpose: string; ip: string; time: string }> = [
  { admin: "Admin", client: "Daniel T.", dataType: "full profile", purpose: "Risk investigation", ip: "127.0.0.1", time: "Apr 26, 2026 · 08:30 AM" },
  { admin: "Admin", client: "Sarah M.", dataType: "messages", purpose: "Compliance review", ip: "127.0.0.1", time: "Apr 25, 2026 · 03:15 PM" },
  { admin: "Admin", client: "Amara L.", dataType: "billing", purpose: "Refund processing", ip: "127.0.0.1", time: "Apr 25, 2026 · 11:00 AM" },
  { admin: "Admin", client: "James K.", dataType: "sessions", purpose: "Quality assurance", ip: "127.0.0.1", time: "Apr 24, 2026 · 09:45 AM" },
  { admin: "Admin", client: "Priya V.", dataType: "messages", purpose: "Safety flag review", ip: "127.0.0.1", time: "Apr 23, 2026 · 02:20 PM" },
  { admin: "Admin", client: "Monica J.", dataType: "billing", purpose: "Invoice dispute", ip: "127.0.0.1", time: "Apr 22, 2026 · 10:00 AM" },
  { admin: "Admin", client: "Ethan R.", dataType: "sessions", purpose: "No-show investigation", ip: "127.0.0.1", time: "Apr 21, 2026 · 04:00 PM" },
  { admin: "Admin", client: "Liam O.", dataType: "full profile", purpose: "Account suspension review", ip: "127.0.0.1", time: "Apr 20, 2026 · 01:30 PM" },
];

export default async function DataAccessLogPage() {
  const user = await getLoggedInUser();
  if (!user || !user.labels?.includes("admin")) redirect("/dashboard");

  return (
    <div>
      <AdminPageHeader
        title="Data Access & Consent Log"
        description="Every admin access to client personal data is recorded here for GDPR compliance."
        breadcrumbs={[{ label: "Compliance", href: "/admin/compliance" }, { label: "Data Access" }]}
      />

      <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-6">
        <ShieldAlert className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-blue-700">
          All admin access to client personal data is automatically logged. This log is immutable and available for regulatory audit. Accessing data without a legitimate purpose may violate platform policy and GDPR regulations.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        <span className="text-xs font-semibold text-stone-500 py-2">Filter by type:</span>
        {["All", ...DATA_TYPES].map((f) => (
          <button key={f} className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors capitalize ${f === "All" ? "bg-teal-600 text-white border-teal-600" : "bg-white text-stone-600 border-stone-200 hover:bg-stone-50"}`}>{f}</button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[700px]">
            <thead className="bg-stone-50 border-b border-stone-100">
              <tr>
                {["Admin", "Client", "Data Accessed", "Purpose", "IP Address", "Timestamp"].map((h) => (
                  <th key={h} className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-stone-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {LOG.map((row, i) => (
                <tr key={i} className="hover:bg-stone-50/50 transition-colors">
                  <td className="px-5 py-4 text-sm font-medium text-stone-800">{row.admin}</td>
                  <td className="px-5 py-4 text-sm text-stone-700">{row.client}</td>
                  <td className="px-5 py-4">
                    <AdminBadge label={row.dataType} variant={BADGE_MAP[row.dataType]} />
                  </td>
                  <td className="px-5 py-4 text-sm text-stone-600">{row.purpose}</td>
                  <td className="px-5 py-4 text-xs font-mono text-stone-400">{row.ip}</td>
                  <td className="px-5 py-4 text-xs text-stone-500">{row.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
