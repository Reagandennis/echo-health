import { getLoggedInUser } from "@/lib/appwrite/server";
import { redirect } from "next/navigation";
import AdminPageHeader from "../../_components/AdminPageHeader";
import { Save, ToggleLeft, ToggleRight, Mail, Smartphone, MessageSquare, Bell } from "lucide-react";

export default async function NotificationsConfigPage() {
  const user = await getLoggedInUser();
  if (!user || !user.labels?.includes("admin")) redirect("/dashboard");

  const GROUPS = [
    {
      title: "Email Notifications",
      icon: Mail,
      settings: [
        { label: "New user registration welcome email", enabled: true },
        { label: "Session booking confirmations", enabled: true },
        { label: "Payment receipts & invoices", enabled: true },
        { label: "Platform marketing updates", enabled: false },
        { label: "Therapist application status updates", enabled: true },
      ],
    },
    {
      title: "Push Notifications",
      icon: Smartphone,
      settings: [
        { label: "Session reminders (1 hour before)", enabled: true },
        { label: "New messages from therapist/client", enabled: true },
        { label: "Daily mood tracking prompt", enabled: false },
      ],
    },
    {
      title: "SMS Notifications",
      icon: MessageSquare,
      settings: [
        { label: "Critical risk alerts to emergency contacts", enabled: true },
        { label: "2FA login verification codes", enabled: true },
        { label: "Urgent session cancellations", enabled: true },
        { label: "Promotional offers", enabled: false },
      ],
    },
    {
      title: "Admin In-App Alerts",
      icon: Bell,
      settings: [
        { label: "New risk incidents flagged", enabled: true },
        { label: "Payout failures", enabled: true },
        { label: "Therapist KYC submissions pending", enabled: true },
        { label: "Daily system digest", enabled: false },
      ],
    },
  ];

  return (
    <div>
      <AdminPageHeader
        title="Notification Settings"
        description="Configure global notification triggers across all channels."
        breadcrumbs={[{ label: "Config", href: "/admin/config" }, { label: "Notifications" }]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {GROUPS.map((group) => (
          <div key={group.title} className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-stone-100 flex items-center gap-3 bg-stone-50/50">
              <div className="p-2 bg-white rounded-lg border border-stone-200 shadow-sm">
                <group.icon className="w-4 h-4 text-stone-600" />
              </div>
              <h3 className="text-sm font-bold text-stone-800">{group.title}</h3>
            </div>
            <div className="divide-y divide-stone-50">
              {group.settings.map((setting, i) => (
                <div key={i} className="flex items-center justify-between px-5 py-4 hover:bg-stone-50/30 transition-colors">
                  <p className="text-sm font-medium text-stone-700">{setting.label}</p>
                  <button className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${setting.enabled ? "bg-teal-100 text-teal-700 hover:bg-teal-200" : "bg-stone-100 text-stone-500 hover:bg-stone-200"}`}>
                    {setting.enabled ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                    {setting.enabled ? "Enabled" : "Disabled"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <button className="flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-xl transition-colors shadow-sm">
          <Save className="w-4 h-4" /> Save Configuration
        </button>
        <button className="px-6 py-3 text-sm font-semibold text-stone-600 bg-white border border-stone-200 hover:bg-stone-50 rounded-xl transition-colors shadow-sm">
          Reset to Defaults
        </button>
      </div>
    </div>
  );
}
