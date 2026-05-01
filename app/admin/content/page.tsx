import { getLoggedInUser } from "@/lib/appwrite/server";
import { redirect } from "next/navigation";
import AdminPageHeader from "../_components/AdminPageHeader";
import AdminBadge from "../_components/AdminBadge";
import Link from "next/link";
import { Plus, Folder } from "lucide-react";

const CONTENT = [
  { id: "c_001", title: "Managing Panic Attacks in Public", category: "Anxiety", author: "Dr. Patel", type: "Article", status: "published", views: 1240, date: "Apr 20, 2026" },
  { id: "c_002", title: "Cognitive Restructuring Worksheet", category: "CBT", author: "Dr. Lee", type: "Worksheet", status: "published", views: 856, date: "Apr 15, 2026" },
  { id: "c_003", title: "Guided Body Scan Meditation", category: "Mindfulness", author: "Dr. Santos", type: "Video", status: "draft", views: 0, date: "Apr 25, 2026" },
  { id: "c_004", title: "Understanding Attachment Styles", category: "Relationships", author: "Echo Health", type: "Article", status: "published", views: 2104, date: "Mar 10, 2026" },
  { id: "c_005", title: "Sleep Hygiene Checklist", category: "General", author: "Dr. Osei", type: "Worksheet", status: "archived", views: 420, date: "Jan 12, 2026" },
];

export default async function ContentLibraryPage() {
  const user = await getLoggedInUser();
  if (!user || !user.labels?.includes("admin")) redirect("/dashboard");

  return (
    <div>
      <AdminPageHeader
        title="Content Library"
        description="Manage educational articles, worksheets, and media for clients."
        breadcrumbs={[{ label: "Content Library" }]}
        actions={
          <div className="flex gap-2">
            <Link href="/admin/content/categories" className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-stone-600 bg-white border border-stone-200 rounded-xl hover:bg-stone-50">
              <Folder className="w-4 h-4" /> Categories
            </Link>
            <Link href="/admin/content/new" className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-teal-600 rounded-xl hover:bg-teal-700">
              <Plus className="w-4 h-4" /> New Content
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Items", value: "48" },
          { label: "Published", value: "36" },
          { label: "Drafts", value: "8" },
          { label: "Archived", value: "4" },
        ].map((m) => (
          <div key={m.label} className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
            <p className="text-xs text-stone-400 uppercase tracking-wider font-medium mb-1">{m.label}</p>
            <p className="text-2xl font-bold text-stone-900">{m.value}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {["All", "Articles", "Videos", "Worksheets", "Exercises"].map((t) => (
          <button key={t} className={`px-4 py-2 text-sm font-medium rounded-xl border whitespace-nowrap transition-colors ${t === "All" ? "bg-stone-800 text-white border-stone-800" : "bg-white text-stone-600 border-stone-200 hover:bg-stone-50"}`}>
            {t}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[800px]">
            <thead className="bg-stone-50 border-b border-stone-100">
              <tr>
                {["Title", "Category", "Author", "Type", "Status", "Views", "Date", ""].map((h) => (
                  <th key={h} className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-stone-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {CONTENT.map((c) => (
                <tr key={c.id} className="hover:bg-stone-50/50 transition-colors group">
                  <td className="px-5 py-4 text-sm font-medium text-stone-800 max-w-[200px] truncate">{c.title}</td>
                  <td className="px-5 py-4 text-sm text-stone-600">{c.category}</td>
                  <td className="px-5 py-4 text-sm text-stone-600">{c.author}</td>
                  <td className="px-5 py-4"><AdminBadge label={c.type} variant="neutral" /></td>
                  <td className="px-5 py-4">
                    <AdminBadge label={c.status.charAt(0).toUpperCase() + c.status.slice(1)} variant={c.status === "published" ? "success" : c.status === "draft" ? "warning" : "neutral"} dot />
                  </td>
                  <td className="px-5 py-4 text-sm text-stone-600">{c.views.toLocaleString()}</td>
                  <td className="px-5 py-4 text-xs text-stone-500">{c.date}</td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Link href={`/admin/content/${c.id}/edit`} className="text-xs font-semibold text-teal-600 hover:text-teal-700">Edit</Link>
                      <button className="text-xs font-semibold text-stone-400 hover:text-rose-600">Archive</button>
                    </div>
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
