import { getLoggedInUser } from "@/lib/appwrite/server";
import { redirect } from "next/navigation";
import AdminPageHeader from "../../_components/AdminPageHeader";
import AdminBadge from "../../_components/AdminBadge";
import { AlertOctagon } from "lucide-react";

const REPORTED = [
  { id: "1", reporter: "Sarah M.", against: "Dr. Patel", type: "Inappropriate conduct", detail: "Therapist made unsolicited personal comments during session.", status: "under-review", date: "Apr 23, 2026" },
  { id: "2", reporter: "Ethan R.", against: "Dr. Lee", type: "Missed session", detail: "Therapist did not show up to confirmed session.", status: "resolved", date: "Apr 19, 2026" },
];

export default async function ReportedContentPage() {
  const user = await getLoggedInUser();
  if (!user || !user.labels?.includes("admin")) redirect("/dashboard");

  return (
    <div>
      <AdminPageHeader
        title="Reported Content Review"
        description="User-submitted abuse and misconduct reports."
        breadcrumbs={[{ label: "Sessions", href: "/admin/sessions" }, { label: "Reported" }]}
      />
      <div className="space-y-4">
        {REPORTED.map((r) => (
          <div key={r.id} className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6">
            <div className="flex items-start gap-4">
              <div className="p-2.5 bg-rose-100 rounded-xl flex-shrink-0">
                <AlertOctagon className="w-5 h-5 text-rose-600" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-sm font-bold text-stone-900">{r.type}</span>
                  <AdminBadge label={r.status === "resolved" ? "Resolved" : "Under Review"} variant={r.status === "resolved" ? "success" : "warning"} dot />
                </div>
                <p className="text-xs text-stone-500 mb-2">Reported by <strong>{r.reporter}</strong> against <strong>{r.against}</strong> · {r.date}</p>
                <p className="text-sm text-stone-700">{r.detail}</p>
              </div>
              <div className="flex flex-col gap-2">
                <button className="px-3 py-1.5 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors">Investigate</button>
                {r.status !== "resolved" && <button className="px-3 py-1.5 text-xs font-semibold text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors">Dismiss</button>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
