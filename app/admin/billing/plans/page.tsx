import { getLoggedInUser } from "@/lib/appwrite/server";
import { redirect } from "next/navigation";
import AdminPageHeader from "../../_components/AdminPageHeader";
import { Edit, Users, DollarSign, Check } from "lucide-react";

const PLANS = [
  {
    id: "basic",
    name: "Basic",
    price: "$39",
    color: "from-stone-500 to-stone-700",
    accent: "bg-stone-100 text-stone-700",
    subscribers: 98,
    revenue: "$3,822",
    features: ["2 sessions/month", "Text messaging", "Resource library", "Basic matching", "Email support"],
  },
  {
    id: "growth",
    name: "Growth",
    price: "$79",
    color: "from-teal-500 to-teal-700",
    accent: "bg-teal-100 text-teal-700",
    subscribers: 176,
    revenue: "$13,904",
    features: ["4 sessions/month", "Video + text sessions", "Priority matching", "Progress tracking", "Chat support", "Mood tracking"],
  },
  {
    id: "premium",
    name: "Premium",
    price: "$149",
    color: "from-purple-500 to-indigo-600",
    accent: "bg-purple-100 text-purple-700",
    subscribers: 38,
    revenue: "$5,662",
    features: ["Unlimited sessions", "24/7 text access", "Dedicated therapist", "Crisis support", "Family plan (2 users)", "Priority queue", "Monthly reports"],
  },
];

const maxSubs = Math.max(...PLANS.map((p) => p.subscribers));

export default async function PlansPage() {
  const user = await getLoggedInUser();
  if (!user || !user.labels?.includes("admin")) redirect("/dashboard");

  return (
    <div>
      <AdminPageHeader
        title="Subscription Plans"
        description="Manage platform pricing tiers and features."
        breadcrumbs={[{ label: "Billing", href: "/admin/billing" }, { label: "Plans" }]}
        actions={
          <button className="px-3 py-2 text-sm font-medium text-white bg-teal-600 rounded-xl hover:bg-teal-700 transition-colors">
            + Add Plan
          </button>
        }
      />

      {/* Plan cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        {PLANS.map((plan) => (
          <div key={plan.id} className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
            <div className={`bg-gradient-to-br ${plan.color} p-6 text-white`}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold opacity-80 uppercase tracking-wider">{plan.name}</p>
                  <p className="text-4xl font-bold mt-1">{plan.price}<span className="text-sm font-normal opacity-80">/mo</span></p>
                </div>
                <a href={`/admin/billing/plans/${plan.id}/edit`} className="p-2 bg-white/20 hover:bg-white/30 rounded-xl transition-colors">
                  <Edit className="w-4 h-4" />
                </a>
              </div>
            </div>
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-stone-400" />
                  <span className="text-sm font-semibold text-stone-800">{plan.subscribers} subscribers</span>
                </div>
                <div className="flex items-center gap-1">
                  <DollarSign className="w-4 h-4 text-emerald-500" />
                  <span className="text-sm font-semibold text-emerald-700">{plan.revenue}/mo</span>
                </div>
              </div>
              <ul className="space-y-2">
                {plan.features.map((f) => (
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

      {/* Subscriber distribution bar chart */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6">
        <h3 className="text-sm font-bold text-stone-800 mb-6">Subscriber Distribution</h3>
        <div className="space-y-4">
          {PLANS.map((plan) => (
            <div key={plan.id}>
              <div className="flex justify-between text-sm mb-2">
                <span className="font-medium text-stone-700">{plan.name}</span>
                <span className="text-stone-500">{plan.subscribers} subscribers · {plan.revenue}/mo</span>
              </div>
              <div className="h-3 bg-stone-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${plan.color}`}
                  style={{ width: `${(plan.subscribers / maxSubs) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-6 pt-4 border-t border-stone-100 flex items-center justify-between text-sm">
          <span className="text-stone-500">Total subscribers: <strong className="text-stone-900">312</strong></span>
          <span className="text-stone-500">Total MRR: <strong className="text-emerald-700">$23,388</strong></span>
        </div>
      </div>
    </div>
  );
}
