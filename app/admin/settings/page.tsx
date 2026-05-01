import { getLoggedInUser } from "@/lib/appwrite/server";
import { redirect } from "next/navigation";
import { 
  Settings as SettingsIcon, 
  Bell, 
  Lock, 
  Database, 
  Globe, 
  Cpu,
  Save
} from "lucide-react";

export default async function AdminSettingsPage() {
  const user = await getLoggedInUser();
  if (!user || !user.labels?.includes("admin")) {
    redirect("/dashboard");
  }

  const sections = [
    {
      title: "Platform Configuration",
      description: "Global settings for the Echo Health platform.",
      icon: Globe,
      settings: [
        { label: "Platform Name", value: "Echo Health", type: "text" },
        { label: "Support Email", value: "admin@echo-health.com", type: "text" },
        { label: "Maintenance Mode", value: "Off", type: "toggle" },
      ]
    },
    {
      title: "Security & Authentication",
      description: "Manage how users access the platform.",
      icon: Lock,
      settings: [
        { label: "Allow New Signups", value: "Enabled", type: "toggle" },
        { label: "Session Timeout (hours)", value: "24", type: "number" },
        { label: "Two-Factor Auth", value: "Enforced for Admins", type: "badge" },
      ]
    },
    {
      title: "Database & Storage",
      description: "Appwrite connection and backup status.",
      icon: Database,
      settings: [
        { label: "Last Backup", value: "2 hours ago", type: "badge" },
        { label: "Storage Limit", value: "50 GB", type: "text" },
        { label: "Current Usage", value: "12.4 GB", type: "progress" },
      ]
    }
  ];

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-stone-900">System Settings</h2>
        <p className="text-stone-500 text-sm">Configure platform-wide variables and security protocols.</p>
      </div>

      <div className="space-y-6">
        {sections.map((section) => (
          <div key={section.title} className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-stone-100 flex items-center gap-4">
              <div className="p-2 bg-stone-100 rounded-lg">
                <section.icon className="w-5 h-5 text-stone-600" />
              </div>
              <div>
                <h3 className="font-bold text-stone-900">{section.title}</h3>
                <p className="text-xs text-stone-500">{section.description}</p>
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              {section.settings.map((setting) => (
                <div key={setting.label} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-stone-700">{setting.label}</span>
                  <div className="flex items-center gap-4">
                    {setting.type === 'progress' ? (
                      <div className="w-32 h-2 bg-stone-100 rounded-full overflow-hidden">
                        <div className="h-full bg-teal-500 w-[25%]" />
                      </div>
                    ) : (
                      <span className={`text-sm ${setting.type === 'badge' ? 'px-2 py-0.5 bg-stone-100 rounded text-xs font-bold' : 'text-stone-500'}`}>
                        {setting.value}
                      </span>
                    )}
                    <button className="text-xs font-bold text-teal-600 hover:underline">Edit</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <button className="px-6 py-2.5 bg-stone-100 text-stone-600 rounded-xl font-bold text-sm hover:bg-stone-200 transition-colors">
          Discard Changes
        </button>
        <button className="flex items-center gap-2 px-6 py-2.5 bg-stone-900 text-white rounded-xl font-bold text-sm hover:bg-stone-800 transition-all shadow-lg shadow-stone-200">
          <Save className="w-4 h-4" />
          Save Platform Config
        </button>
      </div>
    </div>
  );
}
