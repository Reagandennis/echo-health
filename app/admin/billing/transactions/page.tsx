import { getLoggedInUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import Link from "next/link";
import AdminPageHeader from "../../_components/AdminPageHeader";
import AdminBadge from "../../_components/AdminBadge";
import AdminEmptyState from "../../_components/AdminEmptyState";
import { listPayments, type PaymentStatus } from "../../_lib/queries";
import { formatKes } from "../../_lib/money";
import { Search } from "lucide-react";

/**
 * The real `payments` ledger. Previously five hardcoded rows of USD card
 * charges — plans, card brands and clients that have never existed in this
 * system — shown to operators as the platform's transaction history.
 *
 * Statuses are Paystack's own vocabulary rather than friendlier labels: an
 * operator reconciling against the Paystack dashboard needs the same words on
 * both screens, and "Paid" would quietly blur `success` with `pending`.
 */
const STATUS_STYLES: Record<PaymentStatus, "success" | "danger" | "warning" | "neutral"> = {
  success: "success",
  failed: "danger",
  pending: "warning",
  abandoned: "neutral",
};

const FILTERS: { label: string; status?: PaymentStatus }[] = [
  { label: "All" },
  { label: "Success", status: "success" },
  { label: "Pending", status: "pending" },
  { label: "Failed", status: "failed" },
  { label: "Abandoned", status: "abandoned" },
];

function isStatus(value: string | undefined): value is PaymentStatus {
  return value === "success" || value === "failed" || value === "pending" || value === "abandoned";
}

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const user = await getLoggedInUser();
  if (!user || !user.labels?.includes("admin")) redirect("/dashboard");

  // The filter row and search box used to be decoration — styled controls with
  // no handler, on a page whose data was fixed anyway. Both drive the query now,
  // over plain links and a GET form, so neither needs client JS.
  const { status: rawStatus, q } = await searchParams;
  const status = isStatus(rawStatus) ? rawStatus : undefined;
  const search = q?.trim() || undefined;

  const transactions = await listPayments({ status, search });

  return (
    <div>
      <AdminPageHeader
        title="Transactions"
        description="Every charge recorded against the platform, newest first."
        breadcrumbs={[{ label: "Billing", href: "/admin/billing" }, { label: "Transactions" }]}
      />
      <div className="flex flex-wrap gap-3 mb-6">
        <form method="get" className="flex items-center gap-2 bg-white border border-stone-200 rounded-xl px-3 py-2 flex-1 min-w-[200px] max-w-sm">
          {status && <input type="hidden" name="status" value={status} />}
          <Search className="w-4 h-4 text-stone-400" />
          <input
            type="text"
            name="q"
            defaultValue={search ?? ""}
            placeholder="Reference, client or plan…"
            className="text-sm outline-none text-stone-700 placeholder-stone-400 w-full bg-transparent"
          />
        </form>
        {FILTERS.map((f) => {
          const active = f.status === status;
          const params = new URLSearchParams();
          if (f.status) params.set("status", f.status);
          if (search) params.set("q", search);
          const query = params.toString();
          return (
            <Link
              key={f.label}
              href={query ? `/admin/billing/transactions?${query}` : "/admin/billing/transactions"}
              className={`px-3 py-2 text-sm font-medium rounded-xl border transition-colors ${active ? "bg-teal-600 text-white border-teal-600" : "bg-white text-stone-600 border-stone-200 hover:bg-stone-50"}`}
            >
              {f.label}
            </Link>
          );
        })}
      </div>
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        {transactions.length === 0 ? (
          <AdminEmptyState
            title="No transactions"
            description={
              status || search
                ? "No charges match this filter."
                : "No payments have been recorded yet. Charges appear here once a client completes checkout."
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[700px]">
              <thead className="bg-stone-50 border-b border-stone-100">
                <tr>{["Reference", "Client", "Plan", "Amount", "Date", "Channel", "Status", ""].map((h) => <th key={h} className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-stone-500">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-stone-50">
                {transactions.map((t) => (
                  <tr key={t.$id} className="hover:bg-stone-50/50 transition-colors group">
                    <td className="px-5 py-4 text-xs font-mono text-stone-400">{t.reference}</td>
                    <td className="px-5 py-4 text-sm font-medium text-stone-800">{t.clientName ?? "Unknown client"}</td>
                    <td className="px-5 py-4 text-sm text-stone-600 capitalize">{t.plan}</td>
                    <td className="px-5 py-4 text-sm font-semibold text-stone-900">{formatKes(t.amountMinor)}</td>
                    <td className="px-5 py-4 text-sm text-stone-600">{(t.paidAt ?? t.createdAt).toLocaleDateString()}</td>
                    <td className="px-5 py-4 text-xs text-stone-500">{t.channel ?? "—"}</td>
                    <td className="px-5 py-4"><AdminBadge label={t.status.charAt(0).toUpperCase() + t.status.slice(1)} variant={STATUS_STYLES[t.status]} dot /></td>
                    <td className="px-5 py-4 text-right"><Link href={`/admin/billing/transactions/${encodeURIComponent(t.reference)}`} className="text-xs text-teal-600 hover:text-teal-700 font-medium opacity-0 group-hover:opacity-100 transition-opacity">View →</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
