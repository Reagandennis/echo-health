import { getLoggedInUser } from "@/lib/appwrite/server";
import { redirect } from "next/navigation";
import AdminPageHeader from "../../_components/AdminPageHeader";
import { Plus, Edit2, Trash2 } from "lucide-react";

const CATEGORIES = [
  { id: "cat_1", name: "Anxiety & Stress", count: 14, icon: "🌩️", desc: "Resources for managing panic, worry, and general anxiety." },
  { id: "cat_2", name: "Depression", count: 12, icon: "🌧️", desc: "Tools for coping with low mood and depressive episodes." },
  { id: "cat_3", name: "Mindfulness", count: 8, icon: "🧘", desc: "Meditation guides, breathing exercises, and grounding." },
  { id: "cat_4", name: "Relationships", count: 6, icon: "🤝", desc: "Communication skills, boundaries, and attachment." },
  { id: "cat_5", name: "Trauma & PTSD", count: 5, icon: "❤️‍🩹", desc: "Specialized resources for trauma recovery." },
  { id: "cat_6", name: "Sleep Health", count: 3, icon: "🌙", desc: "Sleep hygiene and insomnia management." },
];

export default async function CategoriesPage() {
  const user = await getLoggedInUser();
  if (!user || !user.labels?.includes("admin")) redirect("/dashboard");

  return (
    <div>
      <AdminPageHeader
        title="Content Categories"
        description="Organize the content library with categories."
        breadcrumbs={[{ label: "Content Library", href: "/admin/content" }, { label: "Categories" }]}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {CATEGORIES.map((cat) => (
          <div key={cat.id} className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5 flex flex-col group hover:border-teal-300 transition-colors">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-stone-100 flex items-center justify-center text-xl">
                {cat.icon}
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button className="p-1.5 text-stone-400 hover:text-teal-600 rounded-lg hover:bg-stone-100"><Edit2 className="w-3.5 h-3.5" /></button>
                <button className="p-1.5 text-stone-400 hover:text-rose-600 rounded-lg hover:bg-stone-100"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
            <h3 className="text-sm font-bold text-stone-900">{cat.name}</h3>
            <p className="text-[11px] font-semibold text-teal-600 mb-2">{cat.count} items</p>
            <p className="text-xs text-stone-500 leading-relaxed mt-auto">{cat.desc}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6 max-w-2xl">
        <h3 className="text-sm font-bold text-stone-800 mb-5 flex items-center gap-2">
          <Plus className="w-4 h-4 text-stone-400" /> Add New Category
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wider">Category Name</label>
            <input type="text" placeholder="e.g. Grief & Loss" className="w-full px-4 py-2 border border-stone-200 rounded-xl text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-teal-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wider">Emoji Icon</label>
            <input type="text" placeholder="e.g. 🕊️" className="w-full px-4 py-2 border border-stone-200 rounded-xl text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-teal-500" />
          </div>
        </div>
        <div className="mb-5">
          <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wider">Description</label>
          <textarea rows={2} className="w-full px-4 py-2 border border-stone-200 rounded-xl text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none" />
        </div>
        <button className="px-5 py-2 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-xl transition-colors">
          Save Category
        </button>
      </div>
    </div>
  );
}
