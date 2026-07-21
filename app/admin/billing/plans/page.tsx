import { getLoggedInUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import Link from "next/link";
import AdminPageHeader from "../../_components/AdminPageHeader";
import { listPlanRevenue } from "../../_lib/queries";
import { formatKes } from "../../_lib/money";
import {
  PLAN_LABELS,
  PLAN_PERIOD_LABELS,
  PLAN_PRICES,
  PLAN_SESSIONS,
} from "@/lib/constants";
import { Users, Check } from "lucide-react";

/**
 * The plans the platform actually sells, from `lib/constants.ts`, with real
 * purchase counts and revenue from the `payments` ledger.
 *
 * This page used to describe a different product: Basic / Growth / Premium at
 * $39 / $79 / $149 a month, with subscriber counts and an MRR total
 * ($23,388) invented outright. None of those plans exist, nothing is billed
 * monthly — plans are one-time session bundles — and the platform settles in
 * KES. The "Add Plan" and per-plan "Edit" controls are gone with the fiction:
 * plans are code constants, not rows, so there is nothing here to edit. Pricing
 * is reviewed at /admin/config/pricing.
 */
const CATALOGUE = [
  { key: "individual", color: "from-stone-500 to-stone-700" },
  { key: "plus", color: "from-teal-500 to-teal-700" },
  { key: "couples", color: "from-purple-500 to-indigo-600" },
] as const;

export default async function PlansPage() {
  const user = await getLoggedInUser();
  if (!user || !user.labels?.includes("admin")) redirect("/dashboard");

  const revenue = await listPlanRevenue();
  const byPlan = new Map(revenue.map((r) => [r.plan, r]));

  const plans = CATALOGUE.map((entry) => ({
    ...entry,
    label: PLAN_LABELS[entry.key],
    price: PLAN_PRICES[entry.key],
    period: PLAN_PERIOD_LABELS[entry.key],
    sessions: PLAN_SESSIONS[entry.key],
    purchases: byPlan.get(entry.key)?.purchases ?? 0,
    buyers: byPlan.get(entry.key)?.buyers ?? 0,
    grossMinor: byPlan.get(entry.key)?.grossMinor ?? 0,
  }));

  /**
   * Revenue booked against a plan key that is no longer in the catalogue — a
   * renamed or retired bundle. Surfaced rather than dropped, so the per-plan
   * figures and the platform total cannot disagree without saying why.
   */
  const retired = revenue.filter(
    (r) => !CATALOGUE.some((c) => c.key === r.plan) && r.grossMinor > 0
  );

  const totalPurchases = revenue.reduce((sum, r) => sum + r.purchases, 0);
  const totalGrossMinor = revenue.reduce((sum, r) => sum + r.grossMinor, 0);
  const maxPurchases = Math.max(...plans.map((p) => p.purchases), 1);

  return (
    <div>
      <AdminPageHeader
        title="Plans"
        description="Session bundles the platform sells, with revenue to date."
        breadcrumbs={[{ label: "Billing", href: "/admin/billing" }, { label: "Plans" }]}
        actions={
          <Link
            href="/admin/config/pricing"
            className="px-3 py-2 text-sm font-medium text-stone-600 bg-white border border-stone-200 rounded-xl hover:bg-stone-50 transition-colors"
          >
            Pricing settings
          </Link>
        }
      />

      {/* Plan cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        {plans.map((plan) => (
          <div key={plan.key} className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
            <div className={`bg-gradient-to-br ${plan.color} p-6 text-white`}>
              <p className="text-xs font-semibold opacity-80 uppercase tracking-wider">{plan.label}</p>
              <p className="text-4xl font-bold mt-1">
                {formatKes(plan.price * 100)}
                <span className="text-sm font-normal opacity-80"> {plan.period}</span>
              </p>
            </div>
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-stone-400" />
                  <span className="text-sm font-semibold text-stone-800">
                    {plan.purchases} {plan.purchases === 1 ? "purchase" : "purchases"}
                  </span>
                </div>
                <span className="text-sm font-semibold text-emerald-700">{formatKes(plan.grossMinor)}</span>
              </div>
              <ul className="space-y-2">
                {[
                  `${plan.sessions} ${plan.sessions === 1 ? "session" : "sessions"} included`,
                  `${plan.buyers} ${plan.buyers === 1 ? "client has" : "clients have"} bought this`,
                  "Video sessions with a matched therapist",
                ].map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-stone-600">
                    <Check className="w-3.5 h-3.5 text-teal-500 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>

      {/* Purchase distribution */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6">
        <h3 className="text-sm font-bold text-stone-800 mb-6">Purchase Distribution</h3>
        <div className="space-y-4">
          {plans.map((plan) => (
            <div key={plan.key}>
              <div className="flex justify-between text-sm mb-2">
                <span className="font-medium text-stone-700">{plan.label}</span>
                <span className="text-stone-500">
                  {plan.purchases} {plan.purchases === 1 ? "purchase" : "purchases"} · {formatKes(plan.grossMinor)}
                </span>
              </div>
              <div className="h-3 bg-stone-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${plan.color}`}
                  style={{ width: `${(plan.purchases / maxPurchases) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        {retired.length > 0 && (
          <p className="mt-6 text-xs text-amber-700">
            {formatKes(retired.reduce((sum, r) => sum + r.grossMinor, 0))} was booked
            against plans no longer in the catalogue ({retired.map((r) => r.plan).join(", ")}),
            and is included in the total below but not in the bars above.
          </p>
        )}

        <div className="mt-6 pt-4 border-t border-stone-100 flex items-center justify-between text-sm">
          <span className="text-stone-500">Total purchases: <strong className="text-stone-900">{totalPurchases}</strong></span>
          <span className="text-stone-500">Gross revenue: <strong className="text-emerald-700">{formatKes(totalGrossMinor)}</strong></span>
        </div>
      </div>
    </div>
  );
}
