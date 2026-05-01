"use client";

import { useEffect, useState } from "react";
import { useUser } from "@/app/components/UserProvider";
import { getProfileByUserIdAction, updateProfileAction } from "@/app/actions/database";
import { account } from "@/lib/appwrite/client";
import { User, Bell, Shield, Save, Eye, EyeOff, Loader2 } from "lucide-react";

interface Profile { $id: string; name: string; email: string; }

const TABS = ["Profile", "Notifications", "Security"] as const;
type Tab = typeof TABS[number];

export default function TherapistSettingsPage() {
  const user = useUser();
  const [tab, setTab] = useState<Tab>("Profile");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [notifications, setNotifications] = useState({ newSession: true, sessionReminder: true, newMessage: true, weeklyReport: false });
  const [pwForm, setPwForm] = useState({ current: "", next: "", confirm: "" });
  const [showPw, setShowPw] = useState(false);
  const [pwError, setPwError] = useState("");
  const [pwSaved, setPwSaved] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const p = await getProfileByUserIdAction(user.$id);
        if (p) {
          setProfile(p as unknown as Profile);
          setName(p.name ?? user.name);
        }
      } catch { /* empty */ }
    })();
  }, [user]);

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin text-brand" size={32} />
      </div>
    );
  }

  async function saveProfile() {
    if (!profile) return;
    setSaving(true);
    try {
      await updateProfileAction(profile.$id, { name });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch { /* empty */ }
    setSaving(false);
  }

  async function changePassword() {
    setPwError("");
    if (pwForm.next !== pwForm.confirm) { setPwError("Passwords do not match."); return; }
    if (pwForm.next.length < 8) { setPwError("Password must be at least 8 characters."); return; }
    try {
      await account.updatePassword(pwForm.next, pwForm.current);
      setPwSaved(true);
      setPwForm({ current: "", next: "", confirm: "" });
      setTimeout(() => setPwSaved(false), 2500);
    } catch (e) {
      setPwError((e as Error).message ?? "Failed to update password.");
    }
  }

  function toggleNotif(key: keyof typeof notifications) {
    setNotifications((n) => ({ ...n, [key]: !n[key] }));
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-stone-900">Settings</h1>

      {/* Tabs */}
      <div className="flex gap-1 bg-stone-100 p-1 rounded-xl w-fit">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all ${tab === t ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-700"}`}>
            {t === "Profile" && <User size={13} />}
            {t === "Notifications" && <Bell size={13} />}
            {t === "Security" && <Shield size={13} />}
            {t}
          </button>
        ))}
      </div>

      {tab === "Profile" && (
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6 space-y-5">
          <h2 className="font-semibold text-stone-800">Profile Information</h2>
          <div className="space-y-1.5">
            <label htmlFor="therapist-name" className="text-sm font-medium text-stone-700">Display Name</label>
            <input id="therapist-name" value={name} onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-stone-200 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15" />
          </div>
          {profile?.email && (
            <div className="space-y-1.5">
              <p className="text-sm font-medium text-stone-700">Email</p>
              <p className="px-4 py-3 rounded-xl bg-stone-50 border border-stone-200 text-sm text-stone-500">{profile.email}</p>
            </div>
          )}
          <button onClick={() => void saveProfile()} disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand text-white text-sm font-semibold hover:opacity-90 disabled:opacity-60 transition-opacity">
            <Save size={14} /> {saving ? "Saving…" : saved ? "Saved ✓" : "Save changes"}
          </button>
        </div>
      )}

      {tab === "Notifications" && (
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-stone-800">Notification Preferences</h2>
          {(Object.entries(notifications) as [keyof typeof notifications, boolean][]).map(([key, val]) => {
            const labels: Record<keyof typeof notifications, string> = {
              newSession: "New session booked",
              sessionReminder: "Session reminder (1 hour before)",
              newMessage: "New client message",
              weeklyReport: "Weekly summary report",
            };
            return (
              <div key={key} className="flex items-center justify-between py-2 border-b border-stone-100 last:border-0">
                <span className="text-sm text-stone-800">{labels[key]}</span>
                <button type="button" onClick={() => toggleNotif(key)} aria-label={`Toggle ${labels[key]}`}
                  className={`w-10 h-5 rounded-full transition-colors relative ${val ? "bg-brand" : "bg-stone-200"}`}>
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${val ? "translate-x-5" : ""}`} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {tab === "Security" && (
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6 space-y-5">
          <h2 className="font-semibold text-stone-800">Change Password</h2>
          {pwError && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2">{pwError}</p>}
          {pwSaved && <p className="text-sm text-green-600 bg-green-50 border border-green-200 rounded-xl px-4 py-2">Password updated successfully.</p>}
          {(["current", "next", "confirm"] as const).map((field) => (
            <div key={field} className="space-y-1.5">
              <label htmlFor={`pw-${field}`} className="text-sm font-medium text-stone-700 capitalize">
                {field === "current" ? "Current password" : field === "next" ? "New password" : "Confirm new password"}
              </label>
              <div className="relative">
                <input id={`pw-${field}`} type={showPw ? "text" : "password"} value={pwForm[field]}
                  onChange={(e) => setPwForm((f) => ({ ...f, [field]: e.target.value }))}
                  className="w-full px-4 py-3 pr-10 rounded-xl border border-stone-200 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15" />
                {field === "next" && (
                  <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600">
                    {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                )}
              </div>
            </div>
          ))}
          <button onClick={() => void changePassword()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand text-white text-sm font-semibold hover:opacity-90 transition-opacity">
            <Shield size={14} /> Update password
          </button>
        </div>
      )}
    </div>
  );
}
