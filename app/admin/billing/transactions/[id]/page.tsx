import { getLoggedInUser } from "@/lib/auth/session";
import { redirect, notFound } from "next/navigation";
import AdminPageHeader from "../../../_components/AdminPageHeader";
import AdminBadge from "../../../_components/AdminBadge";
import { getPaymentByReference } from "../../../_lib/queries";
import { formatKes } from "../../../_lib/money";
import { CheckCircle, Circle } from "lucide-react";

const STATUS_STYLES: Record<string, "success" | "danger" | "warning" | "neutral"> = {
  success: "success",
  failed: "danger",
  pending: "warning",
  abandoned: "neutral",
};

/**
 * One charge from the `payments` ledger, keyed by its Paystack reference.
 *
 * The route segment used to be an opaque `txn_00N` that matched nothing; the
 * reference is what appears on the customer's statement and in Paystack's own
 * dashboard, so it is the id an operator handling a dispute actually holds.
 *
 * The timeline is derived from the row's own timestamps. It previously listed
 * four fixed steps — "Payment Processed", "Settled" — all stamped `Apr 1, 2026`
 * and all rendered complete, for any id, including ones that never existed.
 */
export default async function TransactionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getLoggedInUser();
  if (!user || !user.labels?.includes("admin")) redirect("/dashboard");
  const { id } = await params;

  const payment = await getPaymentByReference(decodeURIComponent(id));
  if (!payment) notFound();

  const settled = payment.status === "success" && payment.paidAt;

  const timeline = [
    {
      event: "Charge initiated",
      time: payment.createdAt.toLocaleString(),
      done: true,
    },
    {
      event: settled ? "Payment confirmed" : "Awaiting confirmation",
      // Only `paid_at` evidences settlement. An unpaid row shows no time rather
      // than borrowing `created_at`, which would read as a completed payment.
      time: payment.paidAt ? payment.paidAt.toLocaleString() : "Not recorded",
      done: Boolean(settled),
    },
  ];

  const details: { label: string; value: string }[] = [
    { label: "Client", value: payment.clientName ?? "Unknown client" },
    { label: "Email", value: payment.clientEmail ?? "—" },
    { label: "Plan", value: payment.plan },
    { label: "Channel", value: payment.channel ?? "—" },
    { label: "Provider status", value: payment.paystackStatus ?? "—" },
    { label: "Promo applied", value: payment.promoCode ?? "None" },
    { label: "Created", value: payment.createdAt.toLocaleString() },
    { label: "Paid", value: payment.paidAt ? payment.paidAt.toLocaleString() : "—" },
  ];

  return (
    <div>
      <AdminPageHeader
        title="Transaction"
        description={payment.reference}
        breadcrumbs={[
          { label: "Billing", href: "/admin/billing" },
          { label: "Transactions", href: "/admin/billing/transactions" },
          { label: payment.reference },
        ]}
      />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-br from-teal-600 to-teal-800 p-6 text-white">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs font-semibold opacity-70 uppercase tracking-wider">Echo Health</p>
                  <p className="text-2xl font-bold mt-1">{formatKes(payment.amountMinor)}</p>
                  {/* The ledger stores the settlement currency per row, so it is
                      read rather than assumed — a KES figure labelled from a
                      constant would silently mislabel any other currency. */}
                  <p className="text-xs opacity-60 mt-0.5">Settled in {payment.currency}</p>
                </div>
                <AdminBadge
                  label={payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                  variant={STATUS_STYLES[payment.status] ?? "neutral"}
                  dot
                />
              </div>
              <p className="text-xs opacity-60">Reference: {payment.reference}</p>
            </div>
            <div className="p-6 space-y-0 divide-y divide-stone-50">
              {details.map((row) => (
                <div key={row.label} className="flex justify-between items-center gap-4 py-3">
                  <span className="text-sm text-stone-400 flex-shrink-0">{row.label}</span>
                  <span className="text-sm font-medium text-stone-800 text-right break-all">{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5 self-start">
          <h3 className="text-sm font-bold text-stone-800 mb-5">Transaction Timeline</h3>
          <div className="relative space-y-0">
            <div className="absolute left-4 top-4 bottom-4 w-px bg-stone-200" />
            {timeline.map((step) => (
              <div key={step.event} className="relative flex gap-4 pb-5 last:pb-0">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 z-10 ${step.done ? "bg-teal-600 text-white" : "bg-stone-100 text-stone-400"}`}>
                  {step.done ? <CheckCircle className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                </div>
                <div className="pt-1">
                  <p className="text-sm font-semibold text-stone-800">{step.event}</p>
                  <p className="text-xs text-stone-400 mt-0.5">{step.time}</p>
                </div>
              </div>
            ))}
          </div>
          {/* No refund control: there is no refund pipeline behind this console,
              and a button that appears to issue one is worse than its absence. */}
          <p className="text-xs text-stone-400 mt-5 pt-4 border-t border-stone-100">
            Refunds are issued from the Paystack dashboard. This console has no
            refund pipeline.
          </p>
        </div>
      </div>
    </div>
  );
}
