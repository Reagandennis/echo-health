import { getLoggedInUser } from "@/lib/appwrite/server";
import { redirect } from "next/navigation";
import AdminPageHeader from "../../_components/AdminPageHeader";
import AdminBadge from "../../_components/AdminBadge";
import { Send, X } from "lucide-react";

const MESSAGES = [
  { from: "user", name: "Sarah M.", content: "I cannot access my session recording from last week. I click on it but nothing loads.", time: "Apr 25 · 9:14 AM" },
  { from: "support", name: "Echo Support", content: "Hi Sarah! Thank you for reaching out. We're sorry to hear about this issue. Could you let us know which browser you're using and whether you've tried clearing your cache?", time: "Apr 25 · 10:02 AM" },
  { from: "user", name: "Sarah M.", content: "I'm using Chrome. I tried clearing the cache but it still doesn't work.", time: "Apr 25 · 10:15 AM" },
  { from: "support", name: "Echo Support", content: "Thanks for that information. We've escalated this to our technical team and they're investigating. We'll have an update for you within 24 hours.", time: "Apr 25 · 10:30 AM" },
];

export default async function SupportTicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getLoggedInUser();
  if (!user || !user.labels?.includes("admin")) redirect("/dashboard");
  const { id } = await params;

  return (
    <div>
      <AdminPageHeader
        title="Support Ticket"
        breadcrumbs={[{ label: "Support", href: "/admin/support" }, { label: id }]}
        actions={
          <select className="px-3 py-2 text-sm font-medium text-stone-700 bg-white border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500">
            <option value="open">Open</option>
            <option value="in-progress">In Progress</option>
            <option value="escalated">Escalated</option>
            <option value="resolved">Resolved</option>
          </select>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Conversation */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-stone-100">
              <h3 className="text-base font-bold text-stone-900">Cannot access session recording</h3>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <AdminBadge label="Open" variant="warning" dot />
                <AdminBadge label="Bug" variant="neutral" />
                <AdminBadge label="High" variant="danger" />
              </div>
            </div>
            <div className="p-5 space-y-4">
              {MESSAGES.map((msg, i) => (
                <div key={i} className={`flex gap-3 ${msg.from === "support" ? "flex-row-reverse" : ""}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${msg.from === "support" ? "bg-teal-600" : "bg-stone-400"}`}>
                    {msg.name.charAt(0)}
                  </div>
                  <div className={`flex-1 max-w-lg ${msg.from === "support" ? "items-end" : ""}`}>
                    <div className={`rounded-2xl p-4 ${msg.from === "support" ? "bg-teal-50 border border-teal-100" : "bg-stone-50 border border-stone-100"}`}>
                      <p className="text-sm text-stone-800">{msg.content}</p>
                    </div>
                    <p className="text-[11px] text-stone-400 mt-1 px-1">{msg.name} · {msg.time}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-5 border-t border-stone-100">
              <textarea rows={3} placeholder="Type your reply…" className="w-full px-4 py-2.5 border border-stone-200 rounded-xl text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none mb-3" />
              <div className="flex gap-2">
                <button className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-xl transition-colors">
                  <Send className="w-4 h-4" /> Send Reply
                </button>
                <button className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-xl transition-colors">
                  <X className="w-4 h-4" /> Close Ticket
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Metadata sidebar */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-4">Ticket Details</h3>
            <div className="space-y-3">
              {[
                { label: "Ticket ID", value: id },
                { label: "Submitted By", value: "Sarah M." },
                { label: "Email", value: "sarah.m@example.com" },
                { label: "Type", value: "Bug Report" },
                { label: "Priority", value: "High" },
                { label: "Assigned To", value: "Support Team" },
                { label: "Created", value: "Apr 25, 2026 · 9:14 AM" },
                { label: "Last Updated", value: "Apr 25, 2026 · 10:30 AM" },
              ].map((row) => (
                <div key={row.label} className="flex justify-between items-start gap-2">
                  <span className="text-xs text-stone-400">{row.label}</span>
                  <span className="text-xs font-medium text-stone-700 text-right">{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
