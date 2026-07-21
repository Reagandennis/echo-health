import { getLoggedInUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import Link from "next/link";
import AdminPageHeader from "../../_components/AdminPageHeader";
import AdminEmptyState from "../../_components/AdminEmptyState";

/**
 * Payouts are not implemented. There is no payouts table, no disbursement
 * pipeline and no record anywhere of money having been sent to a therapist.
 *
 * This page previously listed four therapists with periods, session counts,
 * USD net amounts and paid/pending statuses, above three summary tiles
 * culminating in "$38,400 Total Disbursed" — none of which corresponded to
 * anything. An operator could approve a payout that did not exist, for a
 * therapist who did not exist, and see no error.
 *
 * What a therapist has EARNED is real and derivable, and is shown per therapist
 * at `/admin/therapists/[id]/earnings`. Earned is not paid, so it is not
 * restated here as a payout queue.
 */
export default async function PayoutsDashboardPage() {
  const user = await getLoggedInUser();
  if (!user || !user.labels?.includes("admin")) redirect("/dashboard");

  return (
    <div>
      <AdminPageHeader
        title="Therapist Payouts"
        description="Review and approve therapist earnings payouts."
        breadcrumbs={[{ label: "Billing", href: "/admin/billing" }, { label: "Payouts" }]}
      />
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm">
        <AdminEmptyState
          title="Payouts are not yet available"
          description="Disbursement is not implemented — nothing records money sent to a therapist. Earnings accrued per therapist can be reviewed on their earnings page."
          action={
            <Link
              href="/admin/therapists"
              className="px-4 py-2 text-sm font-semibold text-white bg-teal-600 rounded-xl hover:bg-teal-700 transition-colors"
            >
              View therapists
            </Link>
          }
        />
      </div>
    </div>
  );
}
