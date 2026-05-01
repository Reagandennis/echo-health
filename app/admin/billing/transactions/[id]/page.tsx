import { getLoggedInUser } from "@/lib/appwrite/server";
import { redirect } from "next/navigation";
import AdminPageHeader from "../../../_components/AdminPageHeader";
import AdminBadge from "../../../_components/AdminBadge";
import { Download, RefreshCw, CheckCircle } from "lucide-react";

const TIMELINE = [
  { event: "Transaction Created", time: "Apr 1, 2026 · 00:01:03", done: true },
  { event: "Payment Initiated", time: "Apr 1, 2026 · 00:01:05", done: true },
  { event: "Payment Processed", time: "Apr 1, 2026 · 00:01:08", done: true },
  { event: "Settled", time: "Apr 1, 2026 · 00:02:15", done: true },
];

export default async function TransactionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getLoggedInUser();
  if (!user || !user.labels?.includes("admin")) redirect("/dashboard");
  const { id } = await params;

  return (
    <div>
      <AdminPageHeader
        title={`Transaction ${id}`}
        breadcrumbs={[
          { label: "Billing", href: "/admin/billing" },
          { label: "Transactions", href: "/admin/billing/transactions" },
          { label: id },
        ]}
        actions={
          <div className="flex gap-2">
            <button className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-stone-600 bg-white border border-stone-200 rounded-xl hover:bg-stone-50">
              <Download className="w-4 h-4" /> Receipt
            </button>
            <button className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-amber-600 rounded-xl hover:bg-amber-700">
              <RefreshCw className="w-4 h-4" /> Issue Refund
            </button>
          </div>
        }
      />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-br from-teal-600 to-teal-800 p-6 text-white">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs font-semibold opacity-70 uppercase tracking-wider">Echo Health</p>
                  <p className="text-2xl font-bold mt-1">$79.00</p>
                </div>
                <AdminBadge label="Paid" variant="success" dot />
              </div>
              <p className="text-xs opacity-60">Transaction ID: {id}</p>
            </div>
            <div className="p-6 space-y-0 divide-y divide-stone-50">
              {[
                { label: "Client", value: "Sarah Mitchell" },
                { label: "Email", value: "sarah.m@example.com" },
                { label: "Plan", value: "Growth Plan" },
                { label: "Billing Period", value: "April 1 – April 30, 2026" },
                { label: "Payment Method", value: "Visa ending in 4242" },
                { label: "Processor Ref", value: "ch_3OzXx2LkdIwHu7ix0abc" },
                { label: "Date", value: "April 1, 2026 · 12:01 AM UTC" },
              ].map((row) => (
                <div key={row.label} className="flex justify-between items-center py-3">
                  <span className="text-sm text-stone-400">{row.label}</span>
                  <span className="text-sm font-medium text-stone-800">{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
          <h3 className="text-sm font-bold text-stone-800 mb-5">Transaction Timeline</h3>
          <div className="relative space-y-0">
            <div className="absolute left-4 top-4 bottom-4 w-px bg-stone-200" />
            {TIMELINE.map((step, i) => (
              <div key={i} className="relative flex gap-4 pb-5 last:pb-0">
                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 z-10 bg-teal-600 text-white">
                  <CheckCircle className="w-4 h-4" />
                </div>
                <div className="pt-1">
                  <p className="text-sm font-semibold text-stone-800">{step.event}</p>
                  <p className="text-xs text-stone-400 mt-0.5">{step.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
