import { getLoggedInUser } from "@/lib/appwrite/server";
import { redirect } from "next/navigation";
import AdminPageHeader from "../../../_components/AdminPageHeader";
import { Save } from "lucide-react";

export default async function NewIncidentPage() {
  const user = await getLoggedInUser();
  if (!user || !user.labels?.includes("admin")) redirect("/dashboard");

  return (
    <div>
      <AdminPageHeader
        title="New Incident Report"
        description="Document a clinical or platform incident."
        breadcrumbs={[{ label: "Risk & Crisis", href: "/admin/risk" }, { label: "Incidents", href: "/admin/risk/incidents" }, { label: "New" }]}
      />
      <div className="max-w-2xl bg-white rounded-2xl border border-stone-200 shadow-sm p-6 space-y-5">
        {[{ label: "Client Name / ID", id: "client", type: "text", placeholder: "Search client…" },
          { label: "Reporting Party", id: "reporter", type: "text", placeholder: "Your name or therapist name" }].map((f) => (
          <div key={f.id}>
            <label htmlFor={f.id} className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wider">{f.label}</label>
            <input id={f.id} type={f.type} placeholder={f.placeholder} className="w-full px-4 py-2.5 border border-stone-200 rounded-xl text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-teal-500" />
          </div>
        ))}
        <div>
          <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wider">Incident Type</label>
          <select className="w-full px-4 py-2.5 border border-stone-200 rounded-xl text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-teal-500">
            <option>Crisis — Suicidal Ideation</option>
            <option>Safeguarding Concern</option>
            <option>Boundary Violation</option>
            <option>Non-attendance Emergency</option>
            <option>Other</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wider">Severity</label>
          <div className="flex gap-3">
            {["critical", "high", "medium", "low"].map((s) => (
              <label key={s} className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="severity" value={s} className="accent-teal-600" />
                <span className="text-sm capitalize text-stone-700">{s}</span>
              </label>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wider">Description (SOAP)</label>
          <textarea rows={5} placeholder="Subjective, Objective, Assessment, Plan…" className="w-full px-4 py-2.5 border border-stone-200 rounded-xl text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wider">Actions Taken</label>
          <textarea rows={3} placeholder="Document immediate actions…" className="w-full px-4 py-2.5 border border-stone-200 rounded-xl text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none" />
        </div>
        <div className="flex gap-3 pt-2">
          <button className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors">
            <Save className="w-4 h-4" /> Submit Incident Report
          </button>
          <button className="px-5 py-2.5 text-sm font-semibold text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-xl transition-colors">Cancel</button>
        </div>
      </div>
    </div>
  );
}
