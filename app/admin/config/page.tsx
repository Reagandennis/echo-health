import { getLoggedInUser } from "@/lib/appwrite/server";
import { redirect } from "next/navigation";
import AdminPageHeader from "../_components/AdminPageHeader";
import { Settings, ToggleLeft, ToggleRight, Save } from "lucide-react";

export default async function PlatformConfigPage() {
  const user = await getLoggedInUser();
  if (!user || !user.labels?.includes("admin")) redirect("/dashboard");

  const flags = [
    { key: "new_registrations", label: "Allow New Registrations", enabled: true, desc: "Enable or disable new user sign-ups globally." },
    { key: "ai_matching", label: "AI Auto-Matching", enabled: true, desc: "Use AI to automatically suggest therapist matches." },
    { key: "video_sessions", label: "Video Sessions", enabled: true, desc: "Allow video-based therapy sessions." },
    { key: "maintenance_mode", label: "Maintenance Mode", enabled: false, desc: "Take the platform offline for maintenance." },
    { key: "beta_features", label: "Beta Features", enabled: false, desc: "Enable experimental features for admins." },
    { key: "content_moderation", label: "AI Content Moderation", enabled: true, desc: "Enable AI scanning of session messages for safety." },
  ];

  const configs = [
    { key: "session_duration", label: "Default Session Duration (mins)", value: "50" },
    { key: "max_clients", label: "Max Clients per Therapist", value: "25" },
    { key: "match_timeout", label: "Match Timeout (hours)", value: "24" },
    { key: "refund_window", label: "Refund Window (hours)", value: "48" },
  ];

  return (
    <div>
      <AdminPageHeader
        title="Platform Configuration"
        description="Global settings, feature flags and environment controls."
        breadcrumbs={[{ label: "Config" }]}
      />

      {/* Feature flags */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden mb-6">
        <div className="p-5 border-b border-stone-100 flex items-center gap-2">
          <Settings className="w-4 h-4 text-stone-500" />
          <h3 className="text-sm font-bold text-stone-800">Feature Flags</h3>
        </div>
        <div className="divide-y divide-stone-50">
          {flags.map((flag) => (
            <div key={flag.key} className="flex items-center justify-between gap-4 px-5 py-4">
              <div>
                <p className="text-sm font-semibold text-stone-800">{flag.label}</p>
                <p className="text-xs text-stone-400 mt-0.5">{flag.desc}</p>
              </div>
              <button className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${flag.enabled ? "bg-teal-100 text-teal-700 hover:bg-teal-200" : "bg-stone-100 text-stone-500 hover:bg-stone-200"}`}>
                {flag.enabled ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                {flag.enabled ? "Enabled" : "Disabled"}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Config values */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6">
        <h3 className="text-sm font-bold text-stone-800 mb-5">Platform Parameters</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {configs.map((c) => (
            <div key={c.key}>
              <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wider">{c.label}</label>
              <input type="text" defaultValue={c.value} className="w-full px-4 py-2.5 border border-stone-200 rounded-xl text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-teal-500" />
            </div>
          ))}
        </div>
        <div className="flex gap-3 mt-6">
          <button className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-xl transition-colors">
            <Save className="w-4 h-4" /> Save Changes
          </button>
          <button className="px-5 py-2.5 text-sm font-semibold text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-xl transition-colors">Reset Defaults</button>
        </div>
      </div>
    </div>
  );
}
