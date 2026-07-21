import { getLoggedInUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import AdminPageHeader from "../../_components/AdminPageHeader";
import { Save, Plus } from "lucide-react";
import { listPromos } from "../../_lib/queries";
import { PLAN_PRICES, PLAN_LABELS, PLAN_SESSIONS, PLAN_CURRENCY, PLAN_PRICES_CONFIGURED, THERAPIST_REVENUE_SHARE } from "@/lib/constants";

/**
 * The commission slider and the three subscription tiers below are static UI —
 * neither is stored anywhere, and the "Save All Changes" button has no handler.
 * `lib/constants.ts` is the real source of truth for plans. The promo table IS
 * live data.
 */
export default async function PricingConfigPage() {
  const user = await getLoggedInUser();
  if (!user || !user.labels?.includes("admin")) redirect("/dashboard");

  const promoRows = await listPromos();

  /*
   * `promos` is keyed by `code` — there is no `$id`, and the Appwrite comment
   * "assuming document ID is the code for now" is now literally the schema.
   *
   * Three columns rendered as placeholders before because Appwrite never
   * declared the attributes behind them; `discount`, `redemption_limit`,
   * `expires_at` and `disabled` are real columns now. The old code also read
   * `usedBy?.length` as if it were a list of redeemers — it is a single Auth0
   * sub, and a row exists only once the code has been redeemed, so usage is 1.
   */
  const PROMOS = promoRows.map((p) => ({
    code: p.code,
    discount: p.discount !== null ? `${p.discount}%` : "—",
    usage: `${p.redemptions} / ${p.redemptionLimit ?? "∞"}`,
    expires: p.expiresAt ? p.expiresAt.toLocaleDateString() : "Never",
    active: !p.disabled,
  }));

  return (
    <div>
      <AdminPageHeader
        title="Pricing & Revenue Settings"
        description="Configure platform fees, subscription tiers, and discounts."
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Platform Fee */}
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6">
          <h3 className="text-sm font-bold text-stone-900 mb-2">Platform Commission Fee</h3>
          <p className="text-xs text-stone-500 mb-6">Percentage withheld from therapist earnings per session.</p>
          
          <div className="flex items-center gap-4 mb-4">
            <input type="range" min="0" max="30" defaultValue="10" className="w-full accent-teal-600" />
            <span className="text-2xl font-bold text-teal-700">
              {Math.round((1 - THERAPIST_REVENUE_SHARE) * 100)}%
            </span>
          </div>
          <p className="text-xs font-semibold text-stone-400 text-center">
            Therapists receive {Math.round(THERAPIST_REVENUE_SHARE * 100)}% of session revenue
          </p>
        </div>

        {/* Current Tiers Overview */}
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-stone-900">Subscription Tiers</h3>
              <p className="text-xs text-stone-500 mt-0.5">Active retail pricing</p>
            </div>
            <a href="/admin/billing/plans" className="text-xs font-semibold text-teal-600 hover:text-teal-700">Edit Plans →</a>
          </div>
          <div className="space-y-3">
            {/* Reads PLAN_PRICES — the same values the payment routes charge.
                These were hardcoded as Basic/Growth/Premium at $39/$79/$149:
                plan names and prices that existed nowhere else in the system, so
                an admin was reading fiction on an operations screen. */}
            {(["individual", "plus", "couples"] as const).map((key) => (
              <div key={key} className="flex justify-between items-center p-3 bg-stone-50 rounded-xl border border-stone-100">
                <div>
                  <span className="text-sm font-medium text-stone-700">{PLAN_LABELS[key]}</span>
                  <span className="block text-[11px] text-stone-400">
                    {PLAN_SESSIONS[key]} sessions
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold text-stone-900">
                    {new Intl.NumberFormat("en-KE", {
                      style: "currency",
                      currency: PLAN_CURRENCY,
                      maximumFractionDigits: 0,
                    }).format(PLAN_PRICES[key])}
                    <span className="font-normal text-stone-400">/mo</span>
                  </span>
                  {!PLAN_PRICES_CONFIGURED && (
                    <span className="block text-[10px] font-semibold text-amber-600">
                      placeholder — not live
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden mb-6">
        <div className="p-6 border-b border-stone-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-stone-900">Promo Codes & Discounts</h3>
            <p className="text-xs text-stone-500 mt-0.5">Manage promotional campaigns</p>
          </div>
          <button className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-teal-600 rounded-xl hover:bg-teal-700 transition-colors">
            <Plus className="w-4 h-4" /> New Code
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-stone-50 border-b border-stone-100">
              <tr>
                {["Code", "Discount", "Usage", "Expires", "Status", ""].map((h) => (
                  <th key={h} className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-stone-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {PROMOS.map((promo) => (
                <tr key={promo.code} className="hover:bg-stone-50/50">
                  <td className="px-5 py-4 text-sm font-mono font-bold text-stone-800">{promo.code}</td>
                  <td className="px-5 py-4 text-sm font-semibold text-emerald-600">{promo.discount}</td>
                  <td className="px-5 py-4 text-sm text-stone-600">{promo.usage}</td>
                  <td className="px-5 py-4 text-sm text-stone-500">{promo.expires}</td>
                  <td className="px-5 py-4">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${promo.active ? "bg-teal-100 text-teal-700" : "bg-stone-100 text-stone-500"}`}>
                      {promo.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    {promo.active && <button className="text-xs font-medium text-rose-600 hover:text-rose-700">Disable</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <button className="flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-stone-900 hover:bg-stone-800 rounded-xl transition-colors shadow-sm">
        <Save className="w-4 h-4" /> Save All Changes
      </button>
    </div>
  );
}
