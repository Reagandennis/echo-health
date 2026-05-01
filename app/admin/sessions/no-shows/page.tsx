import { getLoggedInUser } from "@/lib/appwrite/server";
import { redirect } from "next/navigation";
import AdminPageHeader from "../../_components/AdminPageHeader";
import AdminBadge from "../../_components/AdminBadge";
import { AlertTriangle, TrendingDown } from "lucide-react";

const NO_SHOWS = [
  { id: "1", patient: "James K.", therapist: "Dr. Patel", date: "Apr 24, 2026", type: "no-show", count: 2 },
  { id: "2", patient: "Amara L.", therapist: "Dr. Osei", date: "Apr 22, 2026", type: "late-cancel", count: 1 },
  { id: "3", patient: "Daniel T.", therapist: "Dr. Müller", date: "Apr 20, 2026", type: "no-show", count: 3 },
  { id: "4", patient: "Monica J.", therapist: "Dr. Lee", date: "Apr 18, 2026", type: "late-cancel", count: 1 },
];

export default async function NoShowsPage() {
  const user = await getLoggedInUser();
  if (!user || !user.labels?.includes("admin")) redirect("/dashboard");

  return (
    <div>
      <AdminPageHeader
        title="No-Show & Cancellation Tracker"
        description="Clients with repeated non-attendance patterns."
        breadcrumbs={[{ label: "Sessions", href: "/admin/sessions" }, { label: "No-Shows" }]}
      />
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: "No-Shows This Month", value: "8", icon: AlertTriangle, color: "bg-rose-100 text-rose-700" },
          { label: "Late Cancellations", value: "12", icon: TrendingDown, color: "bg-amber-100 text-amber-700" },
          { label: "Repeat Offenders", value: "3", icon: AlertTriangle, color: "bg-orange-100 text-orange-700" },
        ].map((m) => (
          <div key={m.label} className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
            <div className={`w-9 h-9 rounded-xl ${m.color} flex items-center justify-center mb-3`}><m.icon className="w-4 h-4" /></div>
            <p className="text-xs text-stone-400 uppercase tracking-wider">{m.label}</p>
            <p className="text-2xl font-bold text-stone-900 mt-1">{m.value}</p>
          </div>
        ))}
      </div>
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[600px]">
            <thead className="bg-stone-50 border-b border-stone-100">
              <tr>{["Patient", "Therapist", "Date", "Type", "Total Occurrences", "Action"].map((h) => <th key={h} className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-stone-500">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {NO_SHOWS.map((r) => (
                <tr key={r.id} className="hover:bg-stone-50/50">
                  <td className="px-5 py-4 text-sm font-medium text-stone-800">{r.patient}</td>
                  <td className="px-5 py-4 text-sm text-stone-600">{r.therapist}</td>
                  <td className="px-5 py-4 text-sm text-stone-600">{r.date}</td>
                  <td className="px-5 py-4"><AdminBadge label={r.type === "no-show" ? "No-Show" : "Late Cancel"} variant={r.type === "no-show" ? "danger" : "warning"} dot /></td>
                  <td className="px-5 py-4 text-sm text-stone-700">{r.count}</td>
                  <td className="px-5 py-4"><button className="text-xs text-amber-600 font-semibold hover:text-amber-700">Send Warning</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
