import { getLoggedInUser } from "@/lib/auth/session";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import AdminPageHeader from "../../../_components/AdminPageHeader";
import AdminBadge from "../../../_components/AdminBadge";
import AdminEmptyState from "../../../_components/AdminEmptyState";
import { getProfileByUserId, listPaymentsForUser } from "../../../_lib/queries";
import { formatKes } from "../../../_lib/money";
import { PLAN_LABELS, PLAN_SESSIONS } from "@/lib/constants";

const STATUS_STYLES: Record<string, "success" | "danger" | "warning" | "neutral"> = {
  success: "success",
  failed: "danger",
  pending: "warning",
  abandoned: "neutral",
};

/**
 * This client's charges, from the `payments` ledger.
 *
 * The page previously rendered five fixed USD transactions — monthly Growth Plan
 * subscriptions, a refunded crisis session — under the real client's real name.
 * A fabricated charge history attached to an identifiable person is the worst
 * version of this problem: it reads as evidence, and an operator answering
 * "was I charged twice?" would have answered from it.
 */
export default async function ClientBillingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getLoggedInUser();
  if (!user || !user.labels?.includes("admin")) redirect("/dashboard");
  const { id } = await params;

  const [client, charges] = await Promise.all([
    getProfileByUserId(id),
    listPaymentsForUser(id),
  ]);
  if (!client) notFound();

  const successful = charges.filter((c) => c.status === "success");
  const totalPaidMinor = successful.reduce((sum, c) => sum + c.amountMinor, 0);
  // Entitlement is bundles bought, not a subscription tier — plans are one-time
  // session bundles, so "current plan" is simply the most recent purchase.
  const latest = successful[0];
  const sessionsPurchased = successful.reduce(
    (sum, c) => sum + (PLAN_SESSIONS[c.plan] ?? 0),
    0
  );

  return (
    <div>
      <AdminPageHeader
        title="Billing Summary"
        breadcrumbs={[
          { label: "Clients", href: "/admin/users" },
          { label: client.name, href: `/admin/users/${id}` },
          { label: "Billing" },
        ]}
      />

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[
          {
            label: "Total Paid",
            value: formatKes(totalPaidMinor),
            sub: `${successful.length} successful ${successful.length === 1 ? "charge" : "charges"}`,
          },
          {
            label: "Latest Purchase",
            value: latest ? (PLAN_LABELS[latest.plan] ?? latest.plan) : "—",
            sub: latest ? formatKes(latest.amountMinor) : "No purchases",
          },
          {
            label: "Last Payment",
            value: latest?.paidAt ? latest.paidAt.toLocaleDateString() : "—",
            sub: latest ? "Successful" : "None recorded",
          },
          {
            label: "Sessions Purchased",
            value: sessionsPurchased.toString(),
            sub: "Across all bundles",
          },
        ].map((m) => (
          <div key={m.label} className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
            <p className="text-xs text-stone-400 uppercase tracking-wider font-medium mb-1">{m.label}</p>
            <p className="text-xl font-bold text-stone-900">{m.value}</p>
            <p className="text-xs text-stone-400 mt-0.5">{m.sub}</p>
          </div>
        ))}
      </div>

      {/* Charge history */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-stone-100">
          <h3 className="text-sm font-bold text-stone-800">Charge History</h3>
        </div>
        {charges.length === 0 ? (
          <AdminEmptyState
            title="No charges"
            description="This client has no payment records. Charges appear here once they complete a checkout."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[600px]">
              <thead className="bg-stone-50 border-b border-stone-100">
                <tr>
                  {["Date", "Plan", "Reference", "Amount", "Status", ""].map((h) => (
                    <th key={h} className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-stone-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-50">
                {charges.map((c) => (
                  <tr key={c.$id} className="hover:bg-stone-50/50 transition-colors">
                    <td className="px-5 py-4 text-xs text-stone-500">{(c.paidAt ?? c.createdAt).toLocaleDateString()}</td>
                    <td className="px-5 py-4 text-sm text-stone-800">{PLAN_LABELS[c.plan] ?? c.plan}</td>
                    <td className="px-5 py-4 text-xs font-mono text-stone-400">{c.reference}</td>
                    <td className="px-5 py-4 text-sm font-semibold text-stone-900">{formatKes(c.amountMinor)}</td>
                    <td className="px-5 py-4">
                      <AdminBadge
                        label={c.status.charAt(0).toUpperCase() + c.status.slice(1)}
                        variant={STATUS_STYLES[c.status] ?? "neutral"}
                        dot
                      />
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link
                        href={`/admin/billing/transactions/${encodeURIComponent(c.reference)}`}
                        className="text-xs text-teal-600 hover:text-teal-700 font-medium"
                      >
                        View →
                      </Link>
                    </td>
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
