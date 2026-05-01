import { getLoggedInUser } from "@/lib/appwrite/server";
import { redirect } from "next/navigation";
import AdminPageHeader from "../../../../_components/AdminPageHeader";
import { Save } from "lucide-react";

export default async function PlanEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getLoggedInUser();
  if (!user || !user.labels?.includes("admin")) redirect("/dashboard");
  const { id } = await params;

  const MOCK = {
    basic: { name: "Basic", price: "39", desc: "Essential therapy access for individuals.", features: "2 sessions/month\nText messaging\nResource library\nBasic matching\nEmail support", maxSessions: "2", trial: "7" },
    growth: { name: "Growth", price: "79", desc: "Our most popular plan for consistent progress.", features: "4 sessions/month\nVideo + text sessions\nPriority matching\nProgress tracking\nChat support\nMood tracking", maxSessions: "4", trial: "14" },
    premium: { name: "Premium", price: "149", desc: "Unlimited access for comprehensive care.", features: "Unlimited sessions\n24/7 text access\nDedicated therapist\nCrisis support\nFamily plan (2 users)\nPriority queue", maxSessions: "999", trial: "0" },
  };
  const plan = MOCK[id as keyof typeof MOCK] ?? MOCK.basic;

  return (
    <div>
      <AdminPageHeader
        title={`Edit Plan — ${plan.name}`}
        breadcrumbs={[{ label: "Billing", href: "/admin/billing" }, { label: "Plans", href: "/admin/billing/plans" }, { label: `Edit ${plan.name}` }]}
      />
      <div className="max-w-2xl bg-white rounded-2xl border border-stone-200 shadow-sm p-6 space-y-5">
        {[
          { label: "Plan Name", id: "name", type: "text", value: plan.name },
          { label: "Price ($/month)", id: "price", type: "number", value: plan.price },
          { label: "Max Sessions / Month", id: "maxSessions", type: "number", value: plan.maxSessions },
          { label: "Trial Period (days)", id: "trial", type: "number", value: plan.trial },
        ].map((f) => (
          <div key={f.id}>
            <label htmlFor={f.id} className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wider">{f.label}</label>
            <input id={f.id} type={f.type} defaultValue={f.value} className="w-full px-4 py-2.5 border border-stone-200 rounded-xl text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-teal-500" />
          </div>
        ))}
        <div>
          <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wider">Description</label>
          <textarea rows={2} defaultValue={plan.desc} className="w-full px-4 py-2.5 border border-stone-200 rounded-xl text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wider">Features (one per line)</label>
          <textarea rows={6} defaultValue={plan.features} className="w-full px-4 py-2.5 border border-stone-200 rounded-xl text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none font-mono" />
        </div>
        <div className="flex items-center justify-between p-4 bg-stone-50 rounded-xl">
          <div>
            <p className="text-sm font-semibold text-stone-800">Plan Active</p>
            <p className="text-xs text-stone-400">Toggle to enable or disable this plan for new signups</p>
          </div>
          <button className="px-4 py-2 text-sm font-semibold text-white bg-teal-600 rounded-xl">Enabled</button>
        </div>
        <div className="flex gap-3 pt-2">
          <button className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-xl transition-colors">
            <Save className="w-4 h-4" /> Save Changes
          </button>
          <button className="px-5 py-2.5 text-sm font-semibold text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-xl transition-colors">Cancel</button>
        </div>
      </div>
    </div>
  );
}
