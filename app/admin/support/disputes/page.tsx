import { getLoggedInUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import Link from "next/link";
import AdminPageHeader from "../../_components/AdminPageHeader";
import AdminEmptyState from "../../_components/AdminEmptyState";

/**
 * Disputes are not implemented. There is no disputes table, and `payments` has
 * no chargeback or dispute state — its status enum is pending / success /
 * failed / abandoned.
 *
 * This page previously listed five USD disputes with named clients and reasons
 * ("Unauthorized charge", "Duplicate charge") sitting under Investigate and
 * Resolve buttons that did nothing. Fabricated chargebacks are a compliance
 * problem as much as a data one — they are the sort of record that gets quoted
 * to a payment processor.
 *
 * Real charges, including failed ones, are at /admin/billing/transactions.
 */
export default async function DisputesPage() {
  const user = await getLoggedInUser();
  if (!user || !user.labels?.includes("admin")) redirect("/dashboard");

  return (
    <div>
      <AdminPageHeader
        title="Billing Disputes"
        description="Manage client billing disputes and chargebacks."
        breadcrumbs={[{ label: "Support", href: "/admin/support" }, { label: "Disputes" }]}
      />
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm">
        <AdminEmptyState
          title="Dispute tracking is not yet available"
          description="Nothing records a dispute or chargeback against a payment. Disputes raised with Paystack are handled in the Paystack dashboard; the charge behind one can be looked up in transactions."
          action={
            <Link
              href="/admin/billing/transactions"
              className="px-4 py-2 text-sm font-semibold text-white bg-teal-600 rounded-xl hover:bg-teal-700 transition-colors"
            >
              View transactions
            </Link>
          }
        />
      </div>
    </div>
  );
}
