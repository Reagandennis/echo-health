import { getLoggedInUser } from "@/lib/appwrite/server";
import { redirect } from "next/navigation";
import AdminPageHeader from "../_components/AdminPageHeader";
import AdminBadge from "../_components/AdminBadge";
import { MessageSquare, Clock } from "lucide-react";
import Link from "next/link";

const TICKETS = [
  { id: "tkt_001", subject: "Cannot access session recording", user: "Sarah M.", type: "bug", priority: "high", status: "open", date: "Apr 25, 2026" },
  { id: "tkt_002", subject: "Therapist didn't show up", user: "James K.", type: "complaint", priority: "high", status: "in-progress", date: "Apr 24, 2026" },
  { id: "tkt_003", subject: "How do I change my therapist?", user: "Priya V.", type: "question", priority: "medium", status: "open", date: "Apr 23, 2026" },
  { id: "tkt_004", subject: "Billing charge not recognized", user: "Daniel T.", type: "billing", priority: "high", status: "open", date: "Apr 23, 2026" },
  { id: "tkt_005", subject: "App crashes on session start", user: "Amara L.", type: "bug", priority: "critical", status: "escalated", date: "Apr 22, 2026" },
  { id: "tkt_006", subject: "Feedback on new matching feature", user: "Monica J.", type: "feedback", priority: "low", status: "resolved", date: "Apr 20, 2026" },
];

export default async function SupportTicketsPage() {
  const user = await getLoggedInUser();
  if (!user || !user.labels?.includes("admin")) redirect("/dashboard");

  return (
    <div>
      <AdminPageHeader
        title="Support & Help Desk"
        description="Manage all user support tickets and escalations."
        breadcrumbs={[{ label: "Support" }]}
        actions={
          <div className="flex gap-2">
            <Link href="/admin/support/escalations" className="px-3 py-2 text-sm font-medium text-stone-600 bg-white border border-stone-200 rounded-xl hover:bg-stone-50">Escalations</Link>
            <Link href="/admin/support/new" className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-teal-600 rounded-xl hover:bg-teal-700">
              <MessageSquare className="w-4 h-4" /> New Ticket
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: "Open", value: TICKETS.filter(t => t.status === "open").length, color: "bg-rose-50 text-rose-700" },
          { label: "In Progress", value: TICKETS.filter(t => t.status === "in-progress").length, color: "bg-amber-50 text-amber-700" },
          { label: "Escalated", value: TICKETS.filter(t => t.status === "escalated").length, color: "bg-orange-50 text-orange-700" },
          { label: "Resolved", value: TICKETS.filter(t => t.status === "resolved").length, color: "bg-emerald-50 text-emerald-700" },
        ].map((m) => (
          <div key={m.label} className={`${m.color} rounded-2xl p-4 text-center`}>
            <p className="text-2xl font-bold">{m.value}</p>
            <p className="text-xs font-medium mt-0.5">{m.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[700px]">
            <thead className="bg-stone-50 border-b border-stone-100">
              <tr>{["ID", "Subject", "User", "Type", "Priority", "Status", "Date", ""].map((h) => <th key={h} className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-stone-500">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {TICKETS.map((t) => (
                <tr key={t.id} className="hover:bg-stone-50/50 transition-colors group">
                  <td className="px-5 py-4 text-xs font-mono text-stone-400">{t.id}</td>
                  <td className="px-5 py-4 text-sm font-medium text-stone-800 max-w-[200px] truncate">{t.subject}</td>
                  <td className="px-5 py-4 text-sm text-stone-600">{t.user}</td>
                  <td className="px-5 py-4"><AdminBadge label={t.type} variant="neutral" /></td>
                  <td className="px-5 py-4"><AdminBadge label={t.priority} variant={t.priority === "critical" ? "danger" : t.priority === "high" ? "danger" : t.priority === "medium" ? "warning" : "neutral"} /></td>
                  <td className="px-5 py-4"><AdminBadge label={t.status.replace("-", " ")} variant={t.status === "resolved" ? "success" : t.status === "escalated" ? "danger" : t.status === "in-progress" ? "teal" : "warning"} dot /></td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1 text-xs text-stone-400"><Clock className="w-3 h-3" />{t.date}</div>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <Link href={`/admin/support/${t.id}`} className="text-xs text-teal-600 hover:text-teal-700 font-medium opacity-0 group-hover:opacity-100 transition-opacity">View →</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
