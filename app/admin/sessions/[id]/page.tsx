import { getLoggedInUser } from "@/lib/auth/session";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import AdminPageHeader from "../../_components/AdminPageHeader";
import { sessionStatusBadge } from "../../_components/AdminBadge";
import { User, MessageSquare, Star } from "lucide-react";
import { getProfileByUserId, getTherapist, isUuid } from "../../_lib/queries";
import { getSessionAction } from "@/app/actions/database";

export default async function SessionDetailPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const user = await getLoggedInUser();
  if (!user || !user.labels?.includes("admin")) redirect("/dashboard");
  const { id } = await params;

  // Unlike `/admin/users/[id]`, this `[id]` IS a uuid (`therapy_sessions.id`).
  // Screen it first: Postgres raises `invalid input syntax for type uuid` on a
  // malformed value, which would be a 500 where the page wants a 404.
  if (!isUuid(id)) notFound();

  let session;
  try {
    session = await getSessionAction(id);
  } catch {
    notFound();
  }

  // Resolve the two participants to names. Both were rendered as raw ids before.
  const [patient, therapist] = await Promise.all([
    getProfileByUserId(session.patientId),
    getTherapist(session.therapistId),
  ]);

  return (
    <div>
      <AdminPageHeader
        title="Session Detail"
        breadcrumbs={[{ label: "Sessions", href: "/admin/sessions" }, { label: id.slice(0, 10) + "…" }]}
        actions={
          <div className="flex gap-2">
            <Link href={`/admin/sessions/${id}/conversation`} className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-stone-600 bg-white border border-stone-200 rounded-xl hover:bg-stone-50">
              <MessageSquare className="w-4 h-4" /> View Conversation
            </Link>
            <Link href={`/admin/sessions/${id}/quality`} className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-stone-600 bg-white border border-stone-200 rounded-xl hover:bg-stone-50">
              <Star className="w-4 h-4" /> Quality Metrics
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6">
            <h3 className="text-sm font-bold text-stone-800 mb-5">Session Information</h3>
            <div className="grid grid-cols-2 gap-5">
              {[
                { label: "Session ID", value: session.$id },
                { label: "Status", value: session.status as string },
                { label: "Scheduled At", value: (session.scheduledAt as Date).toLocaleString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }) },
                { label: "Patient", value: patient?.name ?? (session.patientId as string) },
                { label: "Therapist", value: therapist?.name ?? (session.therapistId as string) },
                { label: "Notes", value: (session.notes as string) || "None" },
              ].map((row) => (
                <div key={row.label}>
                  <p className="text-xs text-stone-400 font-medium uppercase tracking-wider mb-1">{row.label}</p>
                  {row.label === "Status" ? (
                    sessionStatusBadge(row.value)
                  ) : (
                    <p className="text-sm text-stone-800 font-medium">{row.value}</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6">
            <h3 className="text-sm font-bold text-stone-800 mb-4">Admin Actions</h3>
            <div className="flex flex-wrap gap-3">
              {["Mark Completed", "Mark Cancelled", "Flag for Review", "Export Record"].map((a) => (
                <button key={a} className="px-4 py-2 text-sm font-medium text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-xl transition-colors">{a}</button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-3">Participants</h3>
            {[{ label: "Patient", name: patient?.name, id: session.patientId as string, href: `/admin/users/${encodeURIComponent(session.patientId as string)}` },
              { label: "Therapist", name: therapist?.name, id: session.therapistId as string, href: `/admin/therapists/${session.therapistId}` }].map((p) => (
              <div key={p.label} className="flex items-center justify-between py-3 border-b border-stone-50 last:border-0">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-stone-200 flex items-center justify-center">
                    <User className="w-4 h-4 text-stone-500" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-stone-700">{p.name ?? p.label}</p>
                    <p className="text-[11px] text-stone-400 font-mono">{p.id.slice(0, 12)}…</p>
                  </div>
                </div>
                <Link href={p.href} className="text-xs text-teal-600 hover:text-teal-700 font-medium">View →</Link>
              </div>
            ))}
          </div>
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-3">Quality Score</h3>
            <p className="text-3xl font-bold text-teal-600 mb-1">92<span className="text-sm text-stone-400">/100</span></p>
            <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
              <div className="h-full bg-teal-500 rounded-full w-[92%]" />
            </div>
            <p className="text-xs text-stone-400 mt-2">No latency issues detected</p>
          </div>
        </div>
      </div>
    </div>
  );
}
