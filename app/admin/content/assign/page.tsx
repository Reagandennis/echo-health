import { getLoggedInUser } from "@/lib/appwrite/server";
import { redirect } from "next/navigation";
import AdminPageHeader from "../../_components/AdminPageHeader";
import AdminBadge from "../../_components/AdminBadge";
import { Search, Send, Clock } from "lucide-react";

const CONTENT = [
  { id: "c1", title: "Managing Panic Attacks", type: "Article" },
  { id: "c2", title: "CBT Restructuring Worksheet", type: "Worksheet" },
  { id: "c3", title: "Body Scan Meditation", type: "Video" },
  { id: "c4", title: "Understanding Attachment", type: "Article" },
];

const RECENT = [
  { content: "CBT Restructuring Worksheet", target: "Daniel T.", by: "Dr. Müller", date: "Apr 25, 2026", status: "completed" },
  { content: "Managing Panic Attacks", target: "All High-Risk Clients", by: "Admin", date: "Apr 24, 2026", status: "sent" },
  { content: "Body Scan Meditation", target: "Amara L.", by: "Dr. Osei", date: "Apr 22, 2026", status: "viewed" },
];

export default async function ContentAssignmentPage() {
  const user = await getLoggedInUser();
  if (!user || !user.labels?.includes("admin")) redirect("/dashboard");

  return (
    <div>
      <AdminPageHeader
        title="Assign Content"
        description="Distribute resources directly to clients or therapists."
        breadcrumbs={[{ label: "Content Library", href: "/admin/content" }, { label: "Assign" }]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Left: Content Selection */}
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden flex flex-col h-[500px]">
          <div className="p-5 border-b border-stone-100">
            <h3 className="text-sm font-bold text-stone-800 mb-3">1. Select Content</h3>
            <div className="flex items-center gap-2 bg-stone-50 border border-stone-200 rounded-xl px-3 py-2">
              <Search className="w-4 h-4 text-stone-400" />
              <input type="text" placeholder="Search library…" className="text-sm outline-none bg-transparent text-stone-700 placeholder-stone-400 w-full" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {CONTENT.map((c) => (
              <label key={c.id} className="flex items-center gap-3 p-3 hover:bg-teal-50 rounded-xl cursor-pointer transition-colors">
                <input type="checkbox" className="accent-teal-600" />
                <div>
                  <p className="text-sm font-semibold text-stone-800">{c.title}</p>
                  <p className="text-xs text-stone-500">{c.type}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Right: Target Selection */}
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden flex flex-col h-[500px]">
          <div className="p-5 border-b border-stone-100">
            <h3 className="text-sm font-bold text-stone-800">2. Select Target & Send</h3>
          </div>
          <div className="p-5 space-y-5 flex-1 overflow-y-auto">
            <div>
              <label className="block text-xs font-semibold text-stone-600 mb-2 uppercase tracking-wider">Assign To</label>
              <div className="space-y-2">
                {["Specific Client", "Specific Therapist (to assign)", "All High-Risk Clients", "All Active Clients"].map((opt) => (
                  <label key={opt} className="flex items-center gap-2 p-2.5 border border-stone-100 rounded-xl cursor-pointer hover:border-teal-300 transition-colors">
                    <input type="radio" name="target" className="accent-teal-600" defaultChecked={opt === "Specific Client"} />
                    <span className="text-sm font-medium text-stone-700">{opt}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wider">Search Target</label>
              <input type="text" placeholder="Start typing name..." className="w-full px-4 py-2.5 border border-stone-200 rounded-xl text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-teal-500" />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wider">Accompanying Note (Optional)</label>
              <textarea rows={3} placeholder="Add a message..." className="w-full px-4 py-2.5 border border-stone-200 rounded-xl text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none" />
            </div>
          </div>
          <div className="p-5 border-t border-stone-100 bg-stone-50">
            <button className="w-full flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-xl transition-colors shadow-sm">
              <Send className="w-4 h-4" /> Send Assignment
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-stone-100">
          <h3 className="text-sm font-bold text-stone-800">Recent Assignments</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-stone-50 border-b border-stone-100">
              <tr>
                {["Content", "Assigned To", "Assigned By", "Date", "Status"].map((h) => (
                  <th key={h} className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-stone-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {RECENT.map((r, i) => (
                <tr key={i} className="hover:bg-stone-50/50">
                  <td className="px-5 py-4 text-sm font-medium text-stone-800">{r.content}</td>
                  <td className="px-5 py-4 text-sm font-semibold text-stone-700">{r.target}</td>
                  <td className="px-5 py-4 text-xs text-stone-500">{r.by}</td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1.5 text-xs text-stone-500"><Clock className="w-3 h-3" />{r.date}</div>
                  </td>
                  <td className="px-5 py-4">
                    <AdminBadge label={r.status.charAt(0).toUpperCase() + r.status.slice(1)} variant={r.status === "completed" ? "success" : r.status === "viewed" ? "teal" : "neutral"} dot />
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
