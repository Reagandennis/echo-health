import { getLoggedInUser } from "@/lib/appwrite/server";
import { redirect } from "next/navigation";
import AdminPageHeader from "../../_components/AdminPageHeader";
import { Save, Send } from "lucide-react";

export default async function NewContentPage() {
  const user = await getLoggedInUser();
  if (!user || !user.labels?.includes("admin")) redirect("/dashboard");

  return (
    <div>
      <AdminPageHeader
        title="Create New Content"
        description="Add a new article, video, or worksheet to the library."
        breadcrumbs={[{ label: "Content Library", href: "/admin/content" }, { label: "New Content" }]}
      />

      <div className="max-w-4xl bg-white rounded-2xl border border-stone-200 shadow-sm p-6 space-y-6">
        <div>
          <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wider">Title</label>
          <input type="text" placeholder="e.g. 5 Grounding Techniques for Anxiety" className="w-full px-4 py-2.5 border border-stone-200 rounded-xl text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-teal-500" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wider">Category</label>
            <select className="w-full px-4 py-2.5 border border-stone-200 rounded-xl text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white">
              <option>Anxiety & Stress</option>
              <option>Depression</option>
              <option>Mindfulness</option>
              <option>Relationships</option>
              <option>Trauma & PTSD</option>
              <option>General Wellness</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wider">Content Type</label>
            <select className="w-full px-4 py-2.5 border border-stone-200 rounded-xl text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white">
              <option>Article</option>
              <option>Video Link</option>
              <option>Worksheet (PDF)</option>
              <option>Exercise</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wider">Author</label>
            <select className="w-full px-4 py-2.5 border border-stone-200 rounded-xl text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white">
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
          <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wider">Short Description (Summary)</label>
          <textarea rows={2} placeholder="A brief summary for the content card..." className="w-full px-4 py-2.5 border border-stone-200 rounded-xl text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none" />
        </div>

        <div>
          <div className="flex justify-between items-end mb-1.5">
            <label className="block text-xs font-semibold text-stone-600 uppercase tracking-wider">Main Content</label>
            <span className="text-[11px] font-mono text-stone-400 bg-stone-100 px-2 py-0.5 rounded-full">Markdown Supported</span>
          </div>
          <textarea rows={12} placeholder="Write your content here..." className="w-full px-4 py-3 border border-stone-200 rounded-xl text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono resize-y" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wider">Tags</label>
            <input type="text" placeholder="e.g. self-care, breathing, sleep" className="w-full px-4 py-2.5 border border-stone-200 rounded-xl text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-teal-500" />
            <p className="text-[11px] text-stone-400 mt-1">Comma-separated</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wider">Thumbnail Image URL</label>
            <input type="text" placeholder="https://..." className="w-full px-4 py-2.5 border border-stone-200 rounded-xl text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-teal-500" />
          </div>
        </div>

        <div className="pt-4 flex gap-3 border-t border-stone-100">
          <button className="flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-xl transition-colors">
            <Send className="w-4 h-4" /> Publish Now
          </button>
          <button className="flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-xl transition-colors">
            <Save className="w-4 h-4" /> Save as Draft
          </button>
        </div>
      </div>
    </div>
  );
}
