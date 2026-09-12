"use client";

import { useEffect, useState } from "react";
import { useUser } from "@/app/components/UserProvider";
import { getProfileByUserIdAction, updateProfileAction } from "@/app/actions/database";
import { sendPasswordReset } from "@/lib/auth/client";
import { User, Bell, Shield, Save, ExternalLink, Loader2 } from "lucide-react";

interface Profile { $id: string; name: string; email: string; }

const TABS = ["Profile", "Notifications", "Security"] as const;
type Tab = typeof TABS[number];

export default function TherapistSettingsPage() {
  const user = useUser();
  const [tab, setTab] = useState<Tab>("Profile");
  /* Idle → sending → sent/error for the password-reset email below. */
  const [resetState, setResetState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [notifications, setNotifications] = useState({ newSession: true, sessionReminder: true, newMessage: true, weeklyReport: false });

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
          {/*
            Passwords live in Auth0 now, not Appwrite. Universal Login owns the
            whole flow — the app never sees a current or new password — so the
            three-field form was replaced with a hand-off to Auth0's own reset.
          */}
          {/*
            Now a real reset email rather than a hand-off to a hosted page.
            Under Auth0 Universal Login this button navigated away, because the
            app had no way to trigger a reset itself. Supabase does, so it
            emails the link directly and the user never leaves the settings
            page.

            Deliberately does NOT surface whether the address exists: the
            confirmation below is identical either way. `sendPasswordReset`
            returns the same result for an unknown address, and phrasing it as
            "if that address has an account" is what stops the button being an
            enumeration oracle for anyone who can reach this page.
          */}
          <p className="text-sm text-stone-500 leading-relaxed">
            We&apos;ll email you a link to set a new password. It expires after a
            short time, so use it soon after it arrives.
          </p>
          <button
            type="button"
            disabled={resetState === "sending"}
            onClick={async () => {
              if (!user?.email) return;
              setResetState("sending");
              const result = await sendPasswordReset(user.email);
              setResetState(result.ok ? "sent" : "error");
            }}
            className="flex min-h-11 items-center gap-2 rounded-xl bg-brand px-5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            <ExternalLink size={14} />
            {resetState === "sending" ? "Sending…" : "Email me a reset link"}
          </button>
          {resetState === "sent" && (
            <p aria-live="polite" className="text-sm font-medium text-brand-700">
              Sent. Check your inbox for a link to set a new password.
            </p>
          )}
          {resetState === "error" && (
            <p aria-live="polite" className="text-sm font-medium text-red-700">
              We couldn&apos;t send that just now. Try again in a moment.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
