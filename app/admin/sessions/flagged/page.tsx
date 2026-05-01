import { getLoggedInUser } from "@/lib/appwrite/server";
import { redirect } from "next/navigation";
import AdminPageHeader from "../../_components/AdminPageHeader";
import AdminBadge from "../../_components/AdminBadge";
import { Flag, Eye } from "lucide-react";

const FLAGGED = [
  { id: "1", sessionId: "sess_abc123", patient: "Daniel T.", therapist: "Dr. Müller", reason: "AI: potential crisis language detected", severity: "critical", date: "Apr 22, 2026" },
  { id: "2", sessionId: "sess_def456", patient: "Amara L.", therapist: "Dr. Osei", reason: "Manual flag: inappropriate therapist language", severity: "high", date: "Apr 20, 2026" },
  { id: "3", sessionId: "sess_ghi789", patient: "Priya V.", therapist: "Dr. Santos", reason: "AI: unusual session termination pattern", severity: "medium", date: "Apr 18, 2026" },
];

export default async function FlaggedSessionsPage() {
  const user = await getLoggedInUser();
  if (!user || !user.labels?.includes("admin")) redirect("/dashboard");

  return (
    <div>
      <AdminPageHeader
        title="Flagged Conversations Queue"
        description="Sessions flagged by AI or manually for review."
        breadcrumbs={[{ label: "Sessions", href: "/admin/sessions" }, { label: "Flagged" }]}
      />
      <div className="space-y-4">
        {FLAGGED.map((f) => (
          <div key={f.id} className={`bg-white rounded-2xl border shadow-sm p-5 ${f.severity === "critical" ? "border-rose-200" : f.severity === "high" ? "border-orange-200" : "border-stone-200"}`}>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-start gap-4">
                <div className={`p-2.5 rounded-xl flex-shrink-0 ${f.severity === "critical" ? "bg-rose-100" : f.severity === "high" ? "bg-orange-100" : "bg-amber-100"}`}>
                  <Flag className={`w-5 h-5 ${f.severity === "critical" ? "text-rose-600" : f.severity === "high" ? "text-orange-600" : "text-amber-600"}`} />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-stone-900">{f.patient}</span>
                    <span className="text-xs text-stone-400">with {f.therapist}</span>
                    <AdminBadge label={f.severity} variant={f.severity === "critical" ? "danger" : f.severity === "high" ? "danger" : "warning"} />
                  </div>
                  <p className="text-sm text-stone-700">{f.reason}</p>
                  <p className="text-xs text-stone-400 mt-1">{f.date}</p>
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <a href={`/admin/sessions/${f.sessionId}/conversation`} className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-xl transition-colors">
                  <Eye className="w-4 h-4" /> Review
                </a>
                <button className="px-3 py-2 text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors">Escalate</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
