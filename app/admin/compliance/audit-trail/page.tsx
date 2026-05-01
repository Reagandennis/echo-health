import { getLoggedInUser } from "@/lib/appwrite/server";
import { redirect } from "next/navigation";
import AdminPageHeader from "../../_components/AdminPageHeader";
import AdminBadge from "../../_components/AdminBadge";
import { Download } from "lucide-react";

const TRAIL = [
  { ts: "Apr 26 · 08:30", actor: "Admin", role: "admin", event: "Data Access", resource: "Client Profile", ip: "127.0.0.1", detail: "Accessed Daniel T. full profile" },
  { ts: "Apr 26 · 08:15", actor: "Admin", role: "admin", event: "Config Change", resource: "Feature Flags", ip: "127.0.0.1", detail: "Enabled AI Content Moderation" },
  { ts: "Apr 25 · 17:00", actor: "Dr. Patel", role: "therapist", event: "Note Created", resource: "Session Note", ip: "102.89.x.x", detail: "SOAP note added for session sess_abc" },
  { ts: "Apr 25 · 14:00", actor: "Admin", role: "admin", event: "Payout Approved", resource: "Payout po_001", ip: "127.0.0.1", detail: "Approved $1,584 payout for Dr. Patel" },
  { ts: "Apr 25 · 11:30", actor: "Sarah M.", role: "client", event: "Login", resource: "Auth", ip: "197.200.x.x", detail: "Successful login from Chrome/macOS" },
  { ts: "Apr 24 · 10:00", actor: "Admin", role: "admin", event: "User Suspension", resource: "Client Account", ip: "127.0.0.1", detail: "Suspended account for Liam O." },
  { ts: "Apr 23 · 16:45", actor: "Admin", role: "admin", event: "KYC Approved", resource: "Therapist KYC", ip: "127.0.0.1", detail: "Approved Dr. Kim's verification" },
  { ts: "Apr 22 · 09:00", actor: "James K.", role: "client", event: "Logout", resource: "Auth", ip: "197.200.x.x", detail: "Session ended" },
  { ts: "Apr 21 · 15:30", actor: "Admin", role: "admin", event: "Refund Issued", resource: "Transaction txn_004", ip: "127.0.0.1", detail: "Refund approved for Daniel T." },
  { ts: "Apr 20 · 08:00", actor: "Admin", role: "admin", event: "Data Export", resource: "Report", ip: "127.0.0.1", detail: "Session Summary report exported" },
];

export default async function AuditTrailPage() {
  const user = await getLoggedInUser();
  if (!user || !user.labels?.includes("admin")) redirect("/dashboard");

  return (
    <div>
      <AdminPageHeader
        title="Platform Audit Trail"
        description="Immutable log of all significant platform actions."
        breadcrumbs={[{ label: "Compliance", href: "/admin/compliance" }, { label: "Audit Trail" }]}
        actions={
          <button className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-stone-600 bg-white border border-stone-200 rounded-xl hover:bg-stone-50">
            <Download className="w-4 h-4" /> Export
          </button>
        }
      />

      <div className="flex flex-wrap gap-3 mb-6">
        {[
          { label: "User Type", options: ["All Roles", "Admin", "Therapist", "Client"] },
          { label: "Event", options: ["All Events", "Login", "Data Access", "Config Change", "Payout", "Suspension"] },
        ].map((f) => (
          <div key={f.label}>
            <select className="px-3 py-2 border border-stone-200 rounded-xl text-sm text-stone-700 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500">
              {f.options.map((o) => <option key={o}>{o}</option>)}
            </select>
          </div>
        ))}
        <div className="flex gap-2">
          <input type="date" className="px-3 py-2 border border-stone-200 rounded-xl text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-teal-500" />
          <input type="date" className="px-3 py-2 border border-stone-200 rounded-xl text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-teal-500" />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[800px]">
            <thead className="bg-stone-50 border-b border-stone-100">
              <tr>
                {["Timestamp", "Actor", "Role", "Event", "Resource", "IP", "Detail"].map((h) => (
                  <th key={h} className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-stone-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {TRAIL.map((row, i) => (
                <tr key={i} className="hover:bg-stone-50/50 transition-colors">
                  <td className="px-5 py-4 text-xs text-stone-500 whitespace-nowrap">{row.ts}</td>
                  <td className="px-5 py-4 text-sm font-medium text-stone-800">{row.actor}</td>
                  <td className="px-5 py-4">
                    <AdminBadge label={row.role} variant={row.role === "admin" ? "teal" : row.role === "therapist" ? "purple" : "neutral"} />
                  </td>
                  <td className="px-5 py-4 text-sm text-stone-700">{row.event}</td>
                  <td className="px-5 py-4 text-xs text-stone-500">{row.resource}</td>
                  <td className="px-5 py-4 text-xs font-mono text-stone-400">{row.ip}</td>
                  <td className="px-5 py-4 text-xs text-stone-500 max-w-[180px] truncate">{row.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
