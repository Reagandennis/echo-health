import { getLoggedInUser } from "@/lib/appwrite/server";
import { redirect } from "next/navigation";
import AdminPageHeader from "../../_components/AdminPageHeader";
import AdminBadge from "../../_components/AdminBadge";
import { CreditCard, MessageSquare, Mail, Video, Database, PieChart, Key } from "lucide-react";

export default async function IntegrationsConfigPage() {
  const user = await getLoggedInUser();
  if (!user || !user.labels?.includes("admin")) redirect("/dashboard");

  const INTEGRATIONS = [
    { name: "Stripe", type: "Payments", desc: "Process client subscriptions, refunds, and payouts.", status: "connected", icon: CreditCard, color: "text-indigo-600", bg: "bg-indigo-100" },
    { name: "Twilio", type: "SMS", desc: "Send 2FA codes and text message alerts.", status: "connected", icon: MessageSquare, color: "text-rose-600", bg: "bg-rose-100" },
    { name: "SendGrid", type: "Email", desc: "Transactional and marketing email delivery.", status: "connected", icon: Mail, color: "text-blue-600", bg: "bg-blue-100" },
    { name: "Zoom", type: "Video Conferencing", desc: "Power live 1:1 therapy sessions.", status: "connected", icon: Video, color: "text-sky-600", bg: "bg-sky-100" },
    { name: "Appwrite", type: "Backend & Auth", desc: "Database, real-time sync, and user auth.", status: "connected", icon: Database, color: "text-pink-600", bg: "bg-pink-100" },
    { name: "Segment", type: "Analytics", desc: "Event tracking and product analytics.", status: "not-connected", icon: PieChart, color: "text-emerald-600", bg: "bg-emerald-100" },
  ];

  return (
    <div>
      <AdminPageHeader
        title="Third-Party Integrations"
        description="Manage external API connections and credentials."
        breadcrumbs={[{ label: "Config", href: "/admin/config" }, { label: "Integrations" }]}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
        {INTEGRATIONS.map((int) => (
          <div key={int.name} className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6 flex flex-col">
            <div className="flex items-start justify-between mb-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${int.bg}`}>
                <int.icon className={`w-6 h-6 ${int.color}`} />
              </div>
              <AdminBadge label={int.status === "connected" ? "Connected" : "Not Connected"} variant={int.status === "connected" ? "success" : "neutral"} dot />
            </div>
            <h3 className="text-base font-bold text-stone-900">{int.name}</h3>
            <p className="text-xs font-semibold uppercase tracking-wider text-stone-400 mt-1 mb-3">{int.type}</p>
            <p className="text-sm text-stone-600 mb-6 flex-1">{int.desc}</p>
            <button className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-colors ${int.status === "connected" ? "bg-stone-100 text-stone-600 hover:bg-stone-200" : "bg-teal-600 text-white hover:bg-teal-700"}`}>
              {int.status === "connected" ? "Configure" : "Connect"}
            </button>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-stone-100 flex items-center gap-3">
          <div className="p-2 bg-stone-100 rounded-lg">
            <Key className="w-5 h-5 text-stone-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-stone-900">API Keys & Secrets</h3>
            <p className="text-xs text-stone-500 mt-0.5">Manage environment variables. Values are encrypted at rest.</p>
          </div>
        </div>
        <div className="p-6 space-y-5">
          {["STRIPE_SECRET_KEY", "TWILIO_AUTH_TOKEN", "SENDGRID_API_KEY"].map((key) => (
            <div key={key} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <label className="text-sm font-mono font-semibold text-stone-700 w-64">{key}</label>
              <div className="flex-1 flex gap-2">
                <input type="password" defaultValue="sk_test_123456789" disabled className="flex-1 px-4 py-2 border border-stone-200 rounded-xl text-sm bg-stone-50 text-stone-500 font-mono" />
                <button className="px-4 py-2 text-sm font-semibold text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-xl transition-colors">Rotate</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
