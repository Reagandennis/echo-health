"use client";

import { useEffect, useState } from "react";
import { User, Bell, Shield, ChevronRight, AlertTriangle } from "lucide-react";
import { updateProfile, updatePrefs } from "@/lib/appwrite/auth";
import { useUser } from "@/app/components/UserProvider";

interface UserPrefs {
  plan?: string;
  sessionType?: string;
  commStyle?: string;
  emergencyName?: string;
  emergencyPhone?: string;
}

export default function SettingsPage() {
  const user = useUser();
  const [name,           setName]           = useState("");
  const [email,         setEmail]           = useState("");
  const [sessionType,   setSessionType]     = useState("video");
  const [commStyle,     setCommStyle]       = useState("direct");
  const [emergencyName, setEmergencyName]   = useState("");
  const [emergencyPhone,setEmergencyPhone]  = useState("");
  const [saving,        setSaving]          = useState(false);
  const [saved,         setSaved]           = useState(false);
  const [confirmDelete, setConfirmDelete]   = useState(false);

  useEffect(() => {
    if (!user) return;
    setName(user.name ?? "");
    setEmail(user.email ?? "");
    const prefs = user.prefs as UserPrefs | undefined;
    if (prefs?.sessionType) setSessionType(prefs.sessionType);
    if (prefs?.commStyle)   setCommStyle(prefs.commStyle);
    if (prefs?.emergencyName)  setEmergencyName(prefs.emergencyName);
    if (prefs?.emergencyPhone) setEmergencyPhone(prefs.emergencyPhone);
  }, [user]);

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="w-7 h-7 rounded-full border-2 border-brand border-t-transparent animate-spin" />
      </div>
    );
  }

  async function handleSaveProfile() {
    setSaving(true);
    await updateProfile({ name });
    await updatePrefs({ sessionType, commStyle, emergencyName, emergencyPhone });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-xl font-bold text-brand">Settings</h1>
        <p className="text-sm text-brand/45 mt-0.5">Manage your profile, preferences, and privacy.</p>
      </div>

      {/* Profile */}
      <Section icon={User} title="Profile">
        <Field label="Full name">
          <input value={name} onChange={(e) => setName(e.target.value)}
            className="w-full bg-cream/40 rounded-xl border border-brand/15 px-4 py-2.5 text-sm text-brand focus:outline-none focus:ring-2 focus:ring-brand/20" />
        </Field>
        <Field label="Email address">
          <input value={email} disabled
            className="w-full bg-cream/20 rounded-xl border border-brand/10 px-4 py-2.5 text-sm text-brand/40 cursor-not-allowed" />
          <p className="text-[11px] text-brand/30 mt-1">Email cannot be changed here.</p>
        </Field>
      </Section>

      {/* Emergency contact */}
      <Section icon={AlertTriangle} title="Emergency contact">
        <Field label="Contact name">
          <input value={emergencyName} onChange={(e) => setEmergencyName(e.target.value)} placeholder="e.g. Jane Doe"
            className="w-full bg-cream/40 rounded-xl border border-brand/15 px-4 py-2.5 text-sm text-brand focus:outline-none focus:ring-2 focus:ring-brand/20 placeholder:text-brand/30" />
        </Field>
        <Field label="Phone number">
          <input value={emergencyPhone} onChange={(e) => setEmergencyPhone(e.target.value)} placeholder="+1 (555) 000-0000"
            className="w-full bg-cream/40 rounded-xl border border-brand/15 px-4 py-2.5 text-sm text-brand focus:outline-none focus:ring-2 focus:ring-brand/20 placeholder:text-brand/30" />
        </Field>
      </Section>

      {/* Preferences */}
      <Section icon={Bell} title="Preferences">
        <Field label="Preferred session type">
          <div className="flex gap-2">
            {["video", "audio", "chat"].map((t) => (
              <button key={t} onClick={() => setSessionType(t)}
                className={`flex-1 py-2 rounded-xl text-xs font-semibold capitalize border transition-colors ${sessionType === t ? "bg-brand text-white border-brand" : "bg-white border-brand/15 text-brand/50 hover:border-brand/30"}`}>
                {t}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Communication style">
          <div className="flex gap-2">
            {["direct", "gentle", "structured"].map((c) => (
              <button key={c} onClick={() => setCommStyle(c)}
                className={`flex-1 py-2 rounded-xl text-xs font-semibold capitalize border transition-colors ${commStyle === c ? "bg-brand text-white border-brand" : "bg-white border-brand/15 text-brand/50 hover:border-brand/30"}`}>
                {c}
              </button>
            ))}
          </div>
        </Field>
      </Section>

      {/* Save button */}
      <button onClick={handleSaveProfile} disabled={saving}
        className="w-full bg-brand hover:bg-brand/90 disabled:opacity-60 text-white font-semibold py-3 rounded-2xl transition-colors text-sm mb-6">
        {saving ? "Saving…" : saved ? "Saved ✓" : "Save changes"}
      </button>

      {/* Privacy */}
      <Section icon={Shield} title="Privacy & data">
        <button className="w-full flex items-center justify-between py-3 text-sm text-brand hover:text-brand/70 transition-colors group">
          <span>Export my data</span>
          <ChevronRight size={14} className="text-brand/30 group-hover:text-brand/60 transition-colors" />
        </button>
        <hr className="border-brand/8" />
        {confirmDelete ? (
          <div className="py-3">
            <p className="text-sm text-red-600 font-semibold mb-3">Are you sure? This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(false)}
                className="flex-1 py-2 rounded-xl border border-brand/15 text-xs font-semibold text-brand/50 hover:border-brand/30 transition-colors">
                Cancel
              </button>
              <button className="flex-1 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-semibold transition-colors">
                Delete account
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setConfirmDelete(true)}
            className="w-full flex items-center justify-between py-3 text-sm text-red-500 hover:text-red-600 transition-colors group">
            <span>Delete account</span>
            <ChevronRight size={14} className="text-red-300 group-hover:text-red-400 transition-colors" />
          </button>
        )}
      </Section>
    </div>
  );
}

type SectionProps = {
  readonly icon: React.ElementType;
  readonly title: string;
  readonly children: React.ReactNode;
};

function Section({ icon: Icon, title, children }: SectionProps) {
  return (
    <div className="bg-white rounded-2xl border border-brand/10 p-5 mb-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-lg bg-brand/8 flex items-center justify-center">
          <Icon size={13} className="text-brand" />
        </div>
        <p className="text-sm font-semibold text-brand">{title}</p>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

type FieldProps = {
  readonly label: string;
  readonly children: React.ReactNode;
};

function Field({ label, children }: FieldProps) {
  return (
    <div>
      <label className="block text-xs font-semibold text-brand/50 mb-1.5">{label}</label>
      {children}
    </div>
  );
}
