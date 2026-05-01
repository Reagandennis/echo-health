import { getLoggedInUser } from "@/lib/appwrite/server";
import { redirect } from "next/navigation";
import AdminPageHeader from "../../_components/AdminPageHeader";
import { Download, FileText, Clock } from "lucide-react";

const REPORTS = [
  { title: "Session Summary", desc: "Sessions, status, therapist, client, and duration.", formats: ["PDF", "CSV"] },
  { title: "Client Report", desc: "Registration, activity, and risk summary.", formats: ["PDF", "CSV"] },
  { title: "Therapist Performance", desc: "Ratings, sessions, and earnings.", formats: ["PDF", "Excel"] },
  { title: "Revenue Summary", desc: "MRR, ARR, plan breakdown, refunds.", formats: ["CSV", "Excel"] },
  { title: "Risk Incidents", desc: "All risk flags and escalation outcomes.", formats: ["PDF"] },
  { title: "Compliance Audit", desc: "Data access and GDPR records.", formats: ["PDF", "CSV"] },
];

const FORMAT_COLORS: Record<string, string> = {
  PDF: "bg-rose-100 text-rose-700",
  CSV: "bg-teal-100 text-teal-700",
  Excel: "bg-emerald-100 text-emerald-700",
};

const RECENT = [
  { name: "Session Summary — Apr 2026", format: "PDF", date: "Apr 25, 2026" },
  { name: "Revenue Summary — Q1 2026", format: "Excel", date: "Apr 20, 2026" },
  { name: "Client Report — Mar 2026", format: "CSV", date: "Mar 31, 2026" },
  { name: "Compliance Audit — Mar 2026", format: "PDF", date: "Mar 28, 2026" },
  { name: "Therapist Performance — Feb 2026", format: "PDF", date: "Feb 28, 2026" },
];

export default async function ExportPage() {
  const user = await getLoggedInUser();
  if (!user || !user.labels?.includes("admin")) redirect("/dashboard");

  return (
    <div>
      <AdminPageHeader
        title="Export Reports"
        description="Generate and download platform reports."
        breadcrumbs={[{ label: "Analytics", href: "/admin/analytics" }, { label: "Export" }]}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {REPORTS.map((r) => (
          <div key={r.title} className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5 flex flex-col">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 bg-stone-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <FileText className="w-5 h-5 text-stone-500" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-stone-800">{r.title}</h3>
                <p className="text-xs text-stone-400 mt-0.5">{r.desc}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 mt-auto">
              {r.formats.map((f) => (
                <span key={f} className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${FORMAT_COLORS[f]}`}>{f}</span>
              ))}
              <button className="ml-auto flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors">
                <Download className="w-3 h-3" /> Export
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6 mb-6">
        <h3 className="text-sm font-bold text-stone-800 mb-5">Custom Report Builder</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wider">Date Range</label>
            <div className="flex gap-2">
              <input type="date" className="flex-1 px-3 py-2 border border-stone-200 rounded-xl text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-teal-500" />
              <input type="date" className="flex-1 px-3 py-2 border border-stone-200 rounded-xl text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-teal-500" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wider">Format</label>
            <select className="w-full px-3 py-2 border border-stone-200 rounded-xl text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-teal-500">
              <option>PDF</option>
              <option>CSV</option>
              <option>Excel</option>
            </select>
          </div>
        </div>
        <div className="mb-5">
          <label className="block text-xs font-semibold text-stone-600 mb-2 uppercase tracking-wider">Include Metrics</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {["Session Data", "Client Activity", "Therapist Stats", "Revenue Data", "Risk Alerts", "Compliance Log"].map((m) => (
              <label key={m} className="flex items-center gap-2 p-3 bg-stone-50 rounded-xl cursor-pointer hover:bg-teal-50 transition-colors">
                <input type="checkbox" className="accent-teal-600" defaultChecked={m === "Session Data"} />
                <span className="text-sm text-stone-700">{m}</span>
              </label>
            ))}
          </div>
        </div>
        <button className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-xl transition-colors">
          <Download className="w-4 h-4" /> Generate Report
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-stone-100">
          <h3 className="text-sm font-bold text-stone-800">Recent Exports</h3>
        </div>
        <div className="divide-y divide-stone-50">
          {RECENT.map((r) => (
            <div key={r.name} className="flex items-center gap-4 px-5 py-4">
              <FileText className="w-4 h-4 text-stone-400 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-stone-800">{r.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${FORMAT_COLORS[r.format]}`}>{r.format}</span>
                  <div className="flex items-center gap-1 text-xs text-stone-400">
                    <Clock className="w-3 h-3" />{r.date}
                  </div>
                </div>
              </div>
              <button className="text-xs text-teal-600 hover:text-teal-700 font-medium">Download</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
