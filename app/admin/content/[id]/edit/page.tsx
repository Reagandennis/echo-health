import { getLoggedInUser } from "@/lib/appwrite/server";
import { redirect } from "next/navigation";
import AdminPageHeader from "../../../_components/AdminPageHeader";
import { Save, Send, Trash2 } from "lucide-react";

export default async function EditContentPage({
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
        title="Edit Content"
        description="Modify an existing article or resource."
        breadcrumbs={[
          { label: "Content Library", href: "/admin/content" },
          { label: "Edit" },
        ]}
      />

      <div className="max-w-4xl bg-white rounded-2xl border border-stone-200 shadow-sm p-6 space-y-6 relative">
        <div className="absolute top-6 right-6">
          <span className="text-xs text-stone-400">Last saved: Today, 10:45 AM</span>
        </div>

        <div>
          <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wider">Title</label>
          <input type="text" defaultValue="Managing Panic Attacks in Public" className="w-full px-4 py-2.5 border border-stone-200 rounded-xl text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-teal-500" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wider">Category</label>
            <select defaultValue="Anxiety & Stress" className="w-full px-4 py-2.5 border border-stone-200 rounded-xl text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white">
              <option>Anxiety & Stress</option>
              <option>Depression</option>
              <option>Mindfulness</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wider">Content Type</label>
            <select defaultValue="Article" className="w-full px-4 py-2.5 border border-stone-200 rounded-xl text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white">
              <option>Article</option>
              <option>Video Link</option>
              <option>Worksheet (PDF)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wider">Author</label>
            <select defaultValue="Dr. Patel" className="w-full px-4 py-2.5 border border-stone-200 rounded-xl text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white">
              <option>Echo Health Staff</option>
              <option>Dr. Patel</option>
              <option>Dr. Lee</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-stone-600 mb-2 uppercase tracking-wider">Target Audience</label>
          <div className="flex gap-4">
            {["Clients", "Therapists", "Public"].map((aud) => (
              <label key={aud} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="accent-teal-600" defaultChecked={aud === "Clients"} />
                <span className="text-sm text-stone-700">{aud}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wider">Short Description</label>
          <textarea rows={2} defaultValue="Learn practical grounding techniques to help manage and de-escalate panic attacks when you are out in public spaces." className="w-full px-4 py-2.5 border border-stone-200 rounded-xl text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none" />
        </div>

        <div>
          <div className="flex justify-between items-end mb-1.5">
            <label className="block text-xs font-semibold text-stone-600 uppercase tracking-wider">Main Content</label>
            <span className="text-[11px] font-mono text-stone-400 bg-stone-100 px-2 py-0.5 rounded-full">Markdown Supported</span>
          </div>
          <textarea rows={10} defaultValue="## Recognizing the Signs\n\nPanic attacks can happen suddenly. The first step is..." className="w-full px-4 py-3 border border-stone-200 rounded-xl text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono resize-y" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wider">Tags</label>
            <input type="text" defaultValue="anxiety, panic, public, grounding" className="w-full px-4 py-2.5 border border-stone-200 rounded-xl text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-teal-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wider">Thumbnail Image URL</label>
            <input type="text" defaultValue="https://images.unsplash.com/photo-1234..." className="w-full px-4 py-2.5 border border-stone-200 rounded-xl text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-teal-500" />
          </div>
        </div>

        <div className="pt-4 flex items-center justify-between border-t border-stone-100">
          <div className="flex gap-3">
            <button className="flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-xl transition-colors">
              <Send className="w-4 h-4" /> Publish Changes
            </button>
            <button className="flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-xl transition-colors">
              <Save className="w-4 h-4" /> Save Draft
            </button>
          </div>
          <button className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors">
            <Trash2 className="w-4 h-4" /> Delete
          </button>
        </div>
      </div>
    </div>
  );
}
