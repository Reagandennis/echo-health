import { getLoggedInUser } from "@/lib/appwrite/server";
import { redirect } from "next/navigation";
import AdminPageHeader from "../../_components/AdminPageHeader";
import AdminBadge from "../../_components/AdminBadge";
import { Search, Download, Send } from "lucide-react";

const INVOICES = [
  { id: "INV-2026-001", client: "Sarah M.", plan: "Growth", amount: "$79.00", period: "Apr 2026", status: "paid" },
  { id: "INV-2026-002", client: "James K.", plan: "Basic", amount: "$39.00", period: "Apr 2026", status: "paid" },
  { id: "INV-2026-003", client: "Amara L.", plan: "Growth", amount: "$79.00", period: "Apr 2026", status: "unpaid" },
  { id: "INV-2026-004", client: "Daniel T.", plan: "Premium", amount: "$149.00", period: "Mar 2026", status: "overdue" },
  { id: "INV-2026-005", client: "Monica J.", plan: "Growth", amount: "$79.00", period: "Apr 2026", status: "paid" },
  { id: "INV-2026-006", client: "Ethan R.", plan: "Basic", amount: "$39.00", period: "Apr 2026", status: "unpaid" },
];

export default async function InvoicesPage() {
  const user = await getLoggedInUser();
  if (!user || !user.labels?.includes("admin")) redirect("/dashboard");

  const totalInvoiced = INVOICES.reduce((a) => a + 79, 0);
  const paid = INVOICES.filter((i) => i.status === "paid").length;
  const overdue = INVOICES.filter((i) => i.status === "overdue").length;

  return (
    <div>
      <AdminPageHeader
        title="Invoices"
        description="View and manage all client invoices."
        breadcrumbs={[{ label: "Billing", href: "/admin/billing" }, { label: "Invoices" }]}
        actions={
          <button className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-stone-600 bg-white border border-stone-200 rounded-xl hover:bg-stone-50">
            <Download className="w-4 h-4" /> Export All
          </button>
        }
      />

      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Total Invoiced", value: "$464.00", sub: `${INVOICES.length} invoices` },
          { label: "Paid", value: `${paid}`, sub: `${Math.round((paid / INVOICES.length) * 100)}% collected` },
          { label: "Overdue", value: `${overdue}`, sub: "Requires follow-up" },
        ].map((m) => (
          <div key={m.label} className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
            <p className="text-xs text-stone-400 uppercase tracking-wider font-medium mb-1">{m.label}</p>
            <p className="text-2xl font-bold text-stone-900">{m.value}</p>
            <p className="text-xs text-stone-400 mt-1">{m.sub}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-3 mb-6">
        <div className="flex items-center gap-2 bg-white border border-stone-200 rounded-xl px-3 py-2 flex-1 max-w-sm">
          <Search className="w-4 h-4 text-stone-400" />
          <input type="text" placeholder="Search invoices…" className="text-sm outline-none text-stone-700 placeholder-stone-400 w-full bg-transparent" />
        </div>
        {["All", "Paid", "Unpaid", "Overdue"].map((f) => (
          <button key={f} className={`px-3 py-2 text-sm font-medium rounded-xl border transition-colors ${f === "All" ? "bg-teal-600 text-white border-teal-600" : "bg-white text-stone-600 border-stone-200 hover:bg-stone-50"}`}>{f}</button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[700px]">
            <thead className="bg-stone-50 border-b border-stone-100">
              <tr>
                {["Invoice #", "Client", "Plan", "Amount", "Period", "Status", "Actions"].map((h) => (
                  <th key={h} className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-stone-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {INVOICES.map((inv) => (
                <tr key={inv.id} className="hover:bg-stone-50/50 transition-colors">
                  <td className="px-5 py-4 text-xs font-mono text-stone-600 font-semibold">{inv.id}</td>
                  <td className="px-5 py-4 text-sm font-medium text-stone-800">{inv.client}</td>
                  <td className="px-5 py-4 text-sm text-stone-600">{inv.plan}</td>
                  <td className="px-5 py-4 text-sm font-semibold text-stone-900">{inv.amount}</td>
                  <td className="px-5 py-4 text-sm text-stone-600">{inv.period}</td>
                  <td className="px-5 py-4">
                    <AdminBadge
                      label={inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
                      variant={inv.status === "paid" ? "success" : inv.status === "overdue" ? "danger" : "warning"}
                      dot
                    />
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex gap-2">
                      <button className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors">
                        <Download className="w-3 h-3" /> PDF
                      </button>
                      {inv.status !== "paid" && (
                        <button className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium text-teal-600 bg-teal-100 hover:bg-teal-200 rounded-lg transition-colors">
                          <Send className="w-3 h-3" /> Remind
                        </button>
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
