"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { User, BookOpen, Upload, CheckCircle, ArrowRight, ArrowLeft, Loader2 } from "lucide-react";
import { useUser } from "@/app/components/UserProvider";
import { uploadFileAction, upsertTherapistProfileAction } from "@/app/actions/database";
import { appwriteConfig } from "@/lib/appwrite/config";

const SPECIALTIES = [
  "Anxiety & Stress", "Depression", "Trauma & PTSD", "Couples Therapy",
  "Family Therapy", "Child & Adolescent", "Grief & Loss", "Addiction",
  "OCD", "Bipolar Disorder", "Eating Disorders", "ADHD", "Autism Spectrum",
  "LGBTQ+ Affirming", "Career & Life Transitions", "Relationship Issues",
];

const STEPS = ["Profile", "Specialties", "License", "Complete"];

export default function TherapistOnboardingPage() {
  const user = useUser();
  const router = useRouter();

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin text-brand" size={32} />
      </div>
    );
  }

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Step 0 — Profile
  const [bio, setBio] = useState("");
  const [experience, setExperience] = useState("1");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  // Step 1 — Specialties
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([]);

  // Step 2 — License
  const [licenseFile, setLicenseFile] = useState<File | null>(null);
  const [licenseNumber, setLicenseNumber] = useState("");

  function toggleSpecialty(s: string) {
    setSelectedSpecialties((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  async function handleFinish() {
    setSaving(true);
    setError(null);
    try {
      if (!user) throw new Error("Not authenticated");

      let avatarUrl: string | undefined;
      if (photoFile) {
        const formData = new FormData();
        formData.append("file", photoFile);
        const uploaded = await uploadFileAction(formData);
        avatarUrl = uploaded.url;
      }

      let licenseUrl: string | undefined;
      if (licenseFile) {
        const formData = new FormData();
        formData.append("file", licenseFile);
        const uploaded = await uploadFileAction(formData);
        licenseUrl = uploaded.url;
      }

      const profileData = {
        userId: user.$id,
        name: user.name,
        bio,
        specialties: selectedSpecialties,
        experience: Number.parseInt(experience, 10),
        avatarUrl,
        licenseUrl,
        licenseNumber,
      };

      await upsertTherapistProfileAction(user.$id, profileData);

      router.push("/therapist");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save profile.");
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center px-4 py-12">
      {/* Progress */}
      <div className="w-full max-w-lg mb-8">
        <div className="flex items-center justify-between mb-2">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold transition-colors
                ${i < step ? "bg-brand text-white" : i === step ? "bg-brand text-white ring-4 ring-brand/20" : "bg-stone-200 text-stone-400"}`}>
                {i < step ? <CheckCircle size={14} /> : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div className={`h-0.5 w-16 sm:w-24 mx-1 rounded-full transition-colors ${i < step ? "bg-brand" : "bg-stone-200"}`} />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-between text-xs text-stone-400 px-0">
          {STEPS.map((label) => <span key={label}>{label}</span>)}
        </div>
      </div>

      <div className="w-full max-w-lg bg-white rounded-2xl shadow-sm border border-stone-200 p-8">
        {/* Step 0 — Profile */}
        {step === 0 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-stone-900 flex items-center gap-2"><User size={20} className="text-brand" /> Profile Setup</h2>
              <p className="text-sm text-stone-500 mt-1">Tell clients a bit about yourself.</p>
            </div>
            {/* Photo */}
            <div className="flex items-center gap-4">
              <div className="relative w-20 h-20 rounded-full bg-stone-100 overflow-hidden flex items-center justify-center shrink-0">
                {photoPreview
                  ? <Image src={photoPreview} alt="Preview" fill className="object-cover" />
                  : <User size={28} className="text-stone-400" />}
              </div>
              <div>
                <button type="button" onClick={() => fileRef.current?.click()}
                  className="text-sm font-medium text-brand underline underline-offset-2">
                  Upload photo
                </button>
                <p className="text-xs text-stone-400 mt-0.5">JPG or PNG, max 5 MB</p>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
              </div>
            </div>
            {/* Bio */}
            <div>
              <label htmlFor="bio" className="block text-sm font-medium text-stone-700 mb-1.5">Bio <span className="text-stone-400 font-normal">(required)</span></label>
              <textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} rows={4}
                placeholder="Tell clients about your approach, experience, and what you specialise in…"
                className="w-full rounded-xl border border-stone-200 px-4 py-3 text-sm text-stone-800 resize-none outline-none focus:border-brand focus:ring-2 focus:ring-brand/15" />
            </div>
            {/* Experience */}
            <div>
              <label htmlFor="experience" className="block text-sm font-medium text-stone-700 mb-1.5">Years of experience</label>
              <input id="experience" type="number" min="0" max="50" value={experience} onChange={(e) => setExperience(e.target.value)}
                className="w-32 rounded-xl border border-stone-200 px-4 py-3 text-sm text-stone-800 outline-none focus:border-brand focus:ring-2 focus:ring-brand/15" />
            </div>
            <button disabled={!bio.trim()} onClick={() => setStep(1)}
              className="w-full flex items-center justify-center gap-2 bg-brand text-white py-3 rounded-xl font-semibold text-sm disabled:opacity-40 hover:bg-brand/90 transition-colors">
              Continue <ArrowRight size={15} />
            </button>
          </div>
        )}

        {/* Step 1 — Specialties */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-stone-900 flex items-center gap-2"><BookOpen size={20} className="text-brand" /> Specializations</h2>
              <p className="text-sm text-stone-500 mt-1">Select all that apply (at least one).</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {SPECIALTIES.map((s) => {
                const on = selectedSpecialties.includes(s);
                return (
                  <button key={s} type="button" onClick={() => toggleSpecialty(s)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors
                      ${on ? "bg-brand text-white border-brand" : "bg-white text-stone-600 border-stone-200 hover:border-brand/40"}`}>
                    {s}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep(0)} className="flex items-center gap-2 px-4 py-3 rounded-xl border border-stone-200 text-sm font-medium text-stone-600 hover:bg-stone-50 transition-colors">
                <ArrowLeft size={14} /> Back
              </button>
              <button disabled={selectedSpecialties.length === 0} onClick={() => setStep(2)}
                className="flex-1 flex items-center justify-center gap-2 bg-brand text-white py-3 rounded-xl font-semibold text-sm disabled:opacity-40 hover:bg-brand/90 transition-colors">
                Continue <ArrowRight size={15} />
              </button>
            </div>
          </div>
        )}

        {/* Step 2 — License */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-stone-900 flex items-center gap-2"><Upload size={20} className="text-brand" /> License & Verification</h2>
              <p className="text-sm text-stone-500 mt-1">Upload your professional license for verification.</p>
            </div>
            <div>
              <label htmlFor="licenseNumber" className="block text-sm font-medium text-stone-700 mb-1.5">License number</label>
              <input id="licenseNumber" value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)}
                placeholder="e.g. LPC-12345"
                className="w-full rounded-xl border border-stone-200 px-4 py-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15" />
            </div>
            <div>
              <label htmlFor="licenseFile" className="block text-sm font-medium text-stone-700 mb-1.5">License document</label>
              <label htmlFor="licenseFile" className="flex flex-col items-center justify-center border-2 border-dashed border-stone-200 rounded-xl py-10 cursor-pointer hover:border-brand/40 transition-colors">
                <Upload size={24} className={licenseFile ? "text-brand" : "text-stone-300"} />
                <p className="mt-2 text-sm text-stone-500">
                  {licenseFile ? licenseFile.name : "Click or drag to upload PDF/PNG"}
                </p>
                <input id="licenseFile" type="file" accept=".pdf,.png,.jpg" className="hidden" onChange={(e) => setLicenseFile(e.target.files?.[0] ?? null)} />
              </label>
            </div>
            <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-xs text-amber-700">
              ⏳ Verification typically takes 1–2 business days. You can use the platform while we review.
            </div>
            {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{error}</p>}
            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="flex items-center gap-2 px-4 py-3 rounded-xl border border-stone-200 text-sm font-medium text-stone-600 hover:bg-stone-50 transition-colors">
                <ArrowLeft size={14} /> Back
              </button>
              <button onClick={handleFinish} disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 bg-brand text-white py-3 rounded-xl font-semibold text-sm disabled:opacity-40 hover:bg-brand/90 transition-colors">
                {saving ? <><Loader2 size={15} className="animate-spin" /> Saving…</> : <>Finish Setup <ArrowRight size={15} /></>}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
