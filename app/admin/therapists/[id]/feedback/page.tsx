import { getLoggedInUser } from "@/lib/auth/session";
import { redirect, notFound } from "next/navigation";
import AdminPageHeader from "../../../_components/AdminPageHeader";
import { getTherapist, listTherapistFeedback } from "../../../_lib/queries";
import { Star, Quote } from "lucide-react";

/**
 * Backed by real data. The mock array this used to render was a stand-in for
 * `session_feedback`, which exists and carries the rating, comment, author and
 * timestamp the layout needs — see `listTherapistFeedback` for the join.
 */
export default async function TherapistFeedbackPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const user = await getLoggedInUser();
  if (!user || !user.labels?.includes("admin")) redirect("/dashboard");
  const { id } = await params;

  const t = await getTherapist(id);
  if (!t) notFound();

  const feedback = await listTherapistFeedback(id);

  const avgRating = feedback.length
    ? feedback.reduce((a, f) => a + f.rating, 0) / feedback.length
    : 0;
  const dist = [5, 4, 3, 2, 1].map((r) => ({
    rating: r,
    count: feedback.filter((f) => f.rating === r).length,
  }));

  return (
    <div>
      <AdminPageHeader
        title="Feedback & Ratings"
        breadcrumbs={[{ label: "Therapists", href: "/admin/therapists" }, { label: t.name, href: `/admin/therapists/${id}` }, { label: "Feedback" }]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Score summary */}
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6 text-center">
          <p className="text-5xl font-bold text-stone-900 mb-1">
            {feedback.length ? avgRating.toFixed(1) : "—"}
          </p>
          <div className="flex justify-center gap-0.5 mb-2">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star key={s} className={`w-4 h-4 ${s <= Math.round(avgRating) ? "text-amber-400 fill-amber-400" : "text-stone-200"}`} />
            ))}
          </div>
          <p className="text-xs text-stone-400">{feedback.length} review{feedback.length === 1 ? "" : "s"}</p>
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
                  <div
                    className="h-full bg-amber-400 rounded-full"
                    style={{ width: feedback.length ? `${(d.count / feedback.length) * 100}%` : "0%" }}
                  />
                </div>
                <span className="text-xs text-stone-400 w-4 text-right">{d.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Reviews */}
      {feedback.length === 0 ? (
        <div className="text-center py-20 text-stone-400 text-sm">
          No feedback has been submitted for this therapist yet.
        </div>
      ) : (
        <div className="space-y-4">
          {feedback.map((f) => (
            <div key={f.id} className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-teal-400 to-blue-500 flex items-center justify-center text-white text-xs font-bold">
                    {f.clientName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-stone-900">{f.clientName}</p>
                    <p className="text-xs text-stone-400">
                      {f.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                  </div>
                </div>
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star key={s} className={`w-3.5 h-3.5 ${s <= f.rating ? "text-amber-400 fill-amber-400" : "text-stone-200"}`} />
                  ))}
                </div>
              </div>
              {f.comment && (
                <div className="flex items-start gap-2 bg-stone-50 rounded-xl p-3">
                  <Quote className="w-4 h-4 text-stone-300 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-stone-700">{f.comment}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
