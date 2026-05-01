import { createAdminClient, getLoggedInUser } from "@/lib/appwrite/server";
import { appwriteConfig } from "@/lib/appwrite/config";
import { redirect, notFound } from "next/navigation";
import AdminPageHeader from "../../../_components/AdminPageHeader";
import { Star, Quote } from "lucide-react";

const MOCK_FEEDBACK = [
  { id: "1", client: "Sarah M.", rating: 5, comment: "Dr. Patel has been incredibly supportive. I feel heard and understood.", date: "2026-04-20" },
  { id: "2", client: "James K.", rating: 4, comment: "Very professional and knowledgeable. Sessions are always productive.", date: "2026-04-15" },
  { id: "3", client: "Priya V.", rating: 5, comment: "Life-changing sessions. I've made so much progress.", date: "2026-04-10" },
  { id: "4", client: "Daniel T.", rating: 3, comment: "Good therapist but sometimes sessions run late.", date: "2026-04-05" },
];

export default async function TherapistFeedbackPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const user = await getLoggedInUser();
  if (!user || !user.labels?.includes("admin")) redirect("/dashboard");
  const { id } = await params;
  const { databases } = createAdminClient();
  let t: Record<string, unknown>;
  try { t = await databases.getDocument(appwriteConfig.databaseId, appwriteConfig.collections.therapists, id) as unknown as Record<string, unknown>; } catch { notFound(); }

  const avgRating = MOCK_FEEDBACK.reduce((a, f) => a + f.rating, 0) / MOCK_FEEDBACK.length;
  const dist = [5, 4, 3, 2, 1].map((r) => ({ rating: r, count: MOCK_FEEDBACK.filter((f) => f.rating === r).length }));

  return (
    <div>
      <AdminPageHeader
        title="Feedback & Ratings"
        breadcrumbs={[{ label: "Therapists", href: "/admin/therapists" }, { label: t.name as string, href: `/admin/therapists/${id}` }, { label: "Feedback" }]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Score summary */}
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6 text-center">
          <p className="text-5xl font-bold text-stone-900 mb-1">{avgRating.toFixed(1)}</p>
          <div className="flex justify-center gap-0.5 mb-2">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star key={s} className={`w-4 h-4 ${s <= Math.round(avgRating) ? "text-amber-400 fill-amber-400" : "text-stone-200"}`} />
            ))}
          </div>
          <p className="text-xs text-stone-400">{MOCK_FEEDBACK.length} reviews</p>
        </div>

        {/* Distribution */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-stone-200 shadow-sm p-6">
          <h3 className="text-sm font-bold text-stone-800 mb-4">Rating Distribution</h3>
          <div className="space-y-2.5">
            {dist.map((d) => (
              <div key={d.rating} className="flex items-center gap-3">
                <div className="flex items-center gap-0.5 w-20 flex-shrink-0">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star key={s} className={`w-3 h-3 ${s <= d.rating ? "text-amber-400 fill-amber-400" : "text-stone-200"}`} />
                  ))}
                </div>
                <div className="flex-1 h-2 bg-stone-100 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-400 rounded-full" style={{ width: `${(d.count / MOCK_FEEDBACK.length) * 100}%` }} />
                </div>
                <span className="text-xs text-stone-400 w-4 text-right">{d.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Reviews */}
      <div className="space-y-4">
        {MOCK_FEEDBACK.map((f) => (
          <div key={f.id} className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-teal-400 to-blue-500 flex items-center justify-center text-white text-xs font-bold">
                  {f.client.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-semibold text-stone-900">{f.client}</p>
                  <p className="text-xs text-stone-400">{f.date}</p>
                </div>
              </div>
              <div className="flex gap-0.5">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star key={s} className={`w-3.5 h-3.5 ${s <= f.rating ? "text-amber-400 fill-amber-400" : "text-stone-200"}`} />
                ))}
              </div>
            </div>
            <div className="flex items-start gap-2 bg-stone-50 rounded-xl p-3">
              <Quote className="w-4 h-4 text-stone-300 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-stone-700">{f.comment}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
