import { getLoggedInUser } from "@/lib/appwrite/server";
import { redirect } from "next/navigation";
import AdminPageHeader from "../../_components/AdminPageHeader";
import AdminBadge from "../../_components/AdminBadge";
import { ShieldAlert, Download, Clock } from "lucide-react";

const REQUESTS = [
  { id: "req_001", client: "Liam O.", type: "data_access", status: "pending", submitted: "Apr 25, 2026", deadline: "May 25, 2026" },
  { id: "req_002", client: "Amara L.", type: "erasure", status: "pending", submitted: "Apr 24, 2026", deadline: "May 24, 2026" },
  { id: "req_003", client: "Sarah M.", type: "portability", status: "pending", submitted: "Apr 20, 2026", deadline: "May 20, 2026" },
  { id: "req_004", client: "James K.", type: "data_access", status: "completed", submitted: "Apr 10, 2026", deadline: "May 10, 2026" },
];

export default async function GDPRPage() {
  const user = await getLoggedInUser();
  if (!user || !user.labels?.includes("admin")) redirect("/dashboard");

  return (
    <div>
      <AdminPageHeader
        title="GDPR & Privacy Requests"
        description="Manage Data Subject Access Requests (DSAR) and privacy controls."
        breadcrumbs={[{ label: "Compliance", href: "/admin/compliance" }, { label: "GDPR" }]}
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Pending Requests", value: "3" },
          { label: "Erasure Requests", value: "1" },
          { label: "Consent Rate", value: "94%" },
          { label: "DPA Agreements", value: "Signed" },
        ].map((m) => (
          <div key={m.label} className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
            <p className="text-xs text-stone-400 uppercase tracking-wider font-medium mb-1">{m.label}</p>
            <p className="text-2xl font-bold text-stone-900">{m.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-stone-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-stone-800">Data Subject Requests</h3>
          <span className="text-xs text-stone-500">Legal deadline: 30 days</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[700px]">
            <thead className="bg-stone-50 border-b border-stone-100">
              <tr>
                {["Request ID", "Client", "Request Type", "Status", "Submitted", "Deadline", "Actions"].map((h) => (
                  <th key={h} className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-stone-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {REQUESTS.map((r) => (
                <tr key={r.id} className="hover:bg-stone-50/50 transition-colors">
                  <td className="px-5 py-4 text-xs font-mono text-stone-400">{r.id}</td>
                  <td className="px-5 py-4 text-sm font-medium text-stone-800">{r.client}</td>
                  <td className="px-5 py-4">
                    <span className="text-sm text-stone-700 capitalize">{r.type.replace("_", " ")}</span>
                  </td>
                  <td className="px-5 py-4">
                    <AdminBadge label={r.status.charAt(0).toUpperCase() + r.status.slice(1)} variant={r.status === "completed" ? "success" : "warning"} dot />
                  </td>
                  <td className="px-5 py-4 text-sm text-stone-600">{r.submitted}</td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1.5 text-sm font-medium text-amber-600">
                      <Clock className="w-3.5 h-3.5" />
                      {r.deadline}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex gap-2">
                      {r.status === "pending" ? (
                        <>
                          <button className="px-3 py-1.5 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors">Process</button>
                          {r.type !== "erasure" && (
                            <button className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors">
                              <Download className="w-3 h-3" /> Package
                            </button>
                          )}
                        </>
                      ) : (
                        <span className="text-xs text-stone-400 font-medium">Completed</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
