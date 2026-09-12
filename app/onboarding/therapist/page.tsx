"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  User,
  BookOpen,
  ShieldCheck,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Loader2,
  AlertTriangle,
  Clock,
  Send,
  RotateCw,
} from "lucide-react";
import { useSession } from "@/app/components/UserProvider";
import {
  uploadAvatarAction,
  upsertTherapistProfileAction,
  listMyKycDocumentsAction,
  getMyKycStatusAction,
  submitKycForReviewAction,
} from "@/app/actions/database";
import {
  listMyLicencesAction,
  submitLicenceForReviewAction,
  type MyLicence,
} from "@/app/actions/licensing";
import {
  KYC_STATUS_COPY,
  canSubmitForReview,
  kycDocumentLabel,
  missingRequiredTypes,
  type KycStatus,
} from "@/lib/kyc";
import KycDocumentUploader, { type KycDocumentView } from "./KycDocumentUploader";
import JurisdictionStep from "./JurisdictionStep";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import { capture, captureException } from "@/lib/analytics/client";

const SPECIALTIES = [
  "Anxiety & Stress", "Depression", "Trauma & PTSD", "Couples Therapy",
  "Family Therapy", "Child & Adolescent", "Grief & Loss", "Addiction",
  "OCD", "Bipolar Disorder", "Eating Disorders", "ADHD", "Autism Spectrum",
  "LGBTQ+ Affirming", "Career & Life Transitions", "Relationship Issues",
];

/**
 * `Jurisdictions` sits AFTER `Specialties` for the same reason `Documents` does:
 * `therapist_licences.therapist_id` is NOT NULL and
 * `therapist_licences_insert` is `app_owns_therapist(therapist_id)`, so there
 * is no row to attach a licence to until the profile save has created one.
 * Moving it earlier makes every licence write fail closed.
 */
const STEPS = ["Profile", "Specialties", "Jurisdictions", "Documents"];

/** Index of the documents step — read in several places, so it is named once. */
const DOCUMENTS_STEP = 3;
const JURISDICTIONS_STEP = 2;

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

const TONE_STYLES: Record<
  "neutral" | "warning" | "success" | "danger",
  { wrap: string; title: string; body: string; iconWrap: string; icon: string }
> = {
  neutral: {
    wrap: "bg-stone-50 border-stone-200",
    title: "text-stone-900",
    body: "text-stone-600",
    iconWrap: "bg-stone-200",
    icon: "text-stone-600",
  },
  warning: {
    wrap: "bg-amber-50 border-amber-200",
    title: "text-amber-900",
    body: "text-amber-700",
    iconWrap: "bg-amber-100",
    icon: "text-amber-600",
  },
  success: {
    wrap: "bg-emerald-50 border-emerald-200",
    title: "text-emerald-900",
    body: "text-emerald-700",
    iconWrap: "bg-emerald-100",
    icon: "text-emerald-600",
  },
  danger: {
    wrap: "bg-red-50 border-red-200",
    title: "text-red-900",
    body: "text-red-700",
    iconWrap: "bg-red-100",
    icon: "text-red-600",
  },
};

const TONE_ICON = {
  neutral: ShieldCheck,
  warning: Clock,
  success: ShieldCheck,
  danger: AlertTriangle,
} as const;

/**
 * The therapist-facing status header. Wording comes from `KYC_STATUS_COPY` so
 * that the onboarding flow, the dashboard banner and any future surface all say
 * the same thing about the same state — the previous copy was written three
 * times and disagreed with itself.
 */
function KycStatusPanel({
  status,
  children,
}: {
  status: KycStatus;
  children?: React.ReactNode;
}) {
  const copy = KYC_STATUS_COPY[status];
  const s = TONE_STYLES[copy.tone];
  const Icon = TONE_ICON[copy.tone];

  return (
    <div className={`rounded-2xl border p-5 flex items-start gap-4 ${s.wrap}`}>
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${s.iconWrap}`}
      >
        <Icon size={20} className={s.icon} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`font-semibold ${s.title}`}>{copy.title}</p>
        <p className={`text-sm mt-0.5 leading-relaxed ${s.body}`}>{copy.body}</p>
        {children}
      </div>
    </div>
  );
}

export default function TherapistOnboardingPage() {
  const { user, loading: userLoading } = useSession();
  const router = useRouter();

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  /**
   * `undefined` = not established yet, `null` = the caller has no therapist row
   * and is a first-time applicant.
   *
   * Same discipline as the dashboard banner: there is no safe default. Guessing
   * "incomplete" would hand an editable form to someone whose application is
   * mid-review; guessing anything else would hide the form from someone who
   * needs it. So it does not guess — see `loadFailed`.
   */
  const [status, setStatus] = useState<KycStatus | null | undefined>(undefined);
  const [loadFailed, setLoadFailed] = useState(false);
  const [documents, setDocuments] = useState<KycDocumentView[]>([]);
  const [licences, setLicences] = useState<MyLicence[]>([]);
  const [reviewNote, setReviewNote] = useState<string | null>(null);

  // Step 0 — Profile
  const [bio, setBio] = useState("");
  const [experience, setExperience] = useState("1");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  // Step 1 — Specialties
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([]);

  // Step 2 — Documents
  const [licenseNumber, setLicenseNumber] = useState("");

  const refreshDocuments = useCallback(async () => {
    setDocuments(await listMyKycDocumentsAction());
  }, []);

  const refreshLicences = useCallback(async () => {
    setLicences(await listMyLicencesAction());
  }, []);

  // Every setState here sits AFTER the first await, deliberately. A synchronous
  // setState in a function invoked from an effect body triggers a cascading
  // render, which `react-hooks/set-state-in-effect` rejects.
  const load = useCallback(async () => {
    try {
      /*
       * Both reads issued together. They are independent — one transaction each
       * either way — and sequencing them would put two RLS setup round-trips
       * (~230ms each against the Azure instance, per `lib/db/session.ts`) in
       * series before the wizard renders anything.
       */
      const [snapshot, myLicences] = await Promise.all([
        getMyKycStatusAction(),
        listMyLicencesAction(),
      ]);
      setLoadFailed(false);
      setLicences(myLicences);
      if (!snapshot) {
        // No therapist row yet — a genuine first-time applicant walks the whole
        // wizard, because `kyc_documents.therapist_id` and
        // `therapist_licences.therapist_id` are both NOT NULL and both RLS
        // insert policies are `app_owns_therapist(...)`. The profile MUST exist
        // before any document upload or licence can succeed.
        setStatus(null);
        setDocuments([]);
        setReviewNote(null);
        return;
      }
      setStatus(snapshot.kycStatus);
      setDocuments(snapshot.documents);
      setReviewNote(snapshot.kycReviewNote);
      // A returning applicant already has a profile. Drop them on the
      // jurisdictions step: the profile fields cannot be prefilled from this
      // snapshot, so walking them back through an empty bio box would overwrite
      // the bio they already wrote with nothing.
      setStep(JURISDICTIONS_STEP);
    } catch (err) {
      console.error("failed to load KYC status", err);
      setLoadFailed(true);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    // Async IIFE rather than a bare `load()` — matches the therapist dashboard's
    // idiom and keeps the effect body free of a synchronous state update.
    (async () => {
      await load();
    })();
  }, [user, load]);

  function toggleSpecialty(s: string) {
    setSelectedSpecialties((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  }

  // Checked here as well as server-side so an oversized file is rejected before
  // it is uploaded at all — otherwise the request dies in the Next.js Server
  // Action body limit and surfaces as a raw framework error with no context.
  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_PHOTO_BYTES) {
      setError(
        `That photo is ${(file.size / 1024 / 1024).toFixed(1)} MB — please choose one under 5 MB.`
      );
      e.target.value = "";
      return;
    }
    setError(null);
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  /**
   * Saves the profile and moves to the documents step.
   *
   * This is NOT the submission. It exists to create the therapist row that the
   * document uploads hang off; the application is sent only by
   * `submitKycForReviewAction` on the next step.
   */
  async function handleSaveProfile() {
    setSaving(true);
    setError(null);
    try {
      if (!user) throw new Error("Not authenticated");

      let avatarUrl: string | undefined;
      if (photoFile) {
        const formData = new FormData();
        formData.append("file", photoFile);
        const uploaded = await uploadAvatarAction(formData);
        avatarUrl = uploaded.url;
      }

      // `userId` is deliberately not passed — the action derives it from the
      // session, and accepting it would let a caller overwrite another
      // therapist's profile.
      await upsertTherapistProfileAction({
        name: user.name,
        bio,
        specialties: selectedSpecialties,
        experience: Number.parseInt(experience, 10),
        licenseNumber,
        ...(avatarUrl ? { avatarUrl } : {}),
      });

      // The therapist row now exists, so licences and documents can be written.
      await Promise.all([refreshDocuments(), refreshLicences()]);
      setStep(JURISDICTIONS_STEP);
    } catch (err: unknown) {
      captureException(err);
      setError(err instanceof Error ? err.message : "Failed to save profile.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmitForReview() {
    setSubmitting(true);
    setError(null);
    try {
      /*
       * LICENCES FIRST, and deliberately not in parallel.
       *
       * `submitLicenceForReviewAction()` with no argument moves every
       * `incomplete`/`rejected` licence to `pending` in one transaction, and
       * REFUSES when the therapist has claimed no jurisdiction at all. That
       * refusal is the server-side gate on "a clinician listed to clients in
       * thirteen countries with nothing on file about where they may practise"
       * — the exact state this feature exists to end — so it has to run before
       * the application is handed to the queue, not alongside it.
       *
       * `submitKycForReviewAction` does NOT check for a licence itself, so a
       * caller invoking it directly still bypasses this. Moving the check into
       * that action is the follow-up; it is left alone here because it is
       * shared with surfaces this change does not cover.
       */
      await submitLicenceForReviewAction();
      await submitKycForReviewAction();

      capture(ANALYTICS_EVENTS.THERAPIST_KYC_SUBMITTED, {
        document_count: documents.length,
        document_types: documents.map((d) => d.docType),
        specialties: selectedSpecialties,
        /* Count and slugs only. `therapist_licence_submitted` is captured
           server-side per licence with the jurisdiction — never the number. */
        jurisdiction_count: licences.length,
        jurisdictions: licences.map((l) => l.jurisdiction),
      });

      // Navigation happens ONLY after the action resolves. The previous flow
      // pushed to /submitted unconditionally, so an application that was never
      // stored still showed the applicant a success page.
      router.push("/onboarding/therapist/submitted");
    } catch (err: unknown) {
      captureException(err);
      setError(
        err instanceof Error ? err.message : "Could not submit your application."
      );
      setSubmitting(false);
      // The refusal may be because the status moved underneath us (a reviewer
      // picking it up mid-edit). Re-read rather than leaving a stale form.
      void load();
    }
  }

  /**
   * A rejected document does not count towards its requirement. Resubmitting the
   * same file the reviewer already turned down wastes a review cycle, so the
   * gate names that type as still outstanding until it is replaced.
   *
   * This is deliberately stricter than the server's own check. Erring strict is
   * safe — the worst case is an applicant is asked for something the server
   * would have accepted; erring loose would let the button promise a submission
   * the server then refuses.
   */
  const providedTypes = documents
    .filter((d) => d.reviewStatus !== "rejected")
    .map((d) => d.docType);
  const missing = missingRequiredTypes(providedTypes);
  /*
   * A jurisdiction is as required as the documents. Not a courtesy either:
   * `submitLicenceForReviewAction()` refuses an applicant with none, and
   * `handleSubmitForReview` calls it first — so this disabled button and the
   * server agree rather than the button being the only thing enforcing it.
   */
  const hasJurisdiction = licences.length > 0;
  const canSubmit = missing.length === 0 && hasJurisdiction;

  const editable =
    status === null || (status !== undefined && canSubmitForReview(status));

  /* ---------------------------------------------------------------- gates */

  if (userLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin text-brand" size={32} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-stone-200 p-8 text-center">
          <h1 className="text-lg font-bold text-stone-900">Sign in to continue</h1>
          <p className="text-sm text-stone-500 mt-2">
            Your therapist application is tied to your account.
          </p>
          <Link
            href="/auth/login"
            className="inline-flex items-center gap-2 mt-5 bg-brand text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-brand/90 transition-colors"
          >
            Sign in <ArrowRight size={15} />
          </Link>
        </div>
      </div>
    );
  }

  if (loadFailed) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-stone-200 p-8 text-center">
          <AlertTriangle size={28} className="text-amber-500 mx-auto" />
          <h1 className="text-lg font-bold text-stone-900 mt-3">
            We couldn&apos;t load your application
          </h1>
          {/*
            No form is rendered here on purpose. Showing an editable form after a
            failed status read would let someone under review swap their
            documents, and would tell a verified clinician to start over.
          */}
          <p className="text-sm text-stone-500 mt-2">
            Nothing has changed. Try again in a moment.
          </p>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-2 mt-5 bg-brand text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-brand/90 transition-colors"
          >
            <RotateCw size={15} /> Retry
          </button>
        </div>
      </div>
    );
  }

  if (status === undefined) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin text-brand" size={32} />
      </div>
    );
  }

  /* ------------------------------------------------- read-only end states */

  // `pending` and `verified` are not editable. A reviewer part-way through a
  // set of documents must not have them change underneath, and an approved
  // clinician must not be able to re-open their own application and keep
  // access while sitting unreviewed in the queue (see `canSubmitForReview`).
  if (status === "pending" || status === "verified") {
    return (
      <div className="min-h-screen bg-stone-50 px-4 py-12">
        <div className="w-full max-w-lg mx-auto space-y-5">
          <KycStatusPanel status={status}>
            {status === "verified" && (
              <Link
                href="/therapist"
                className="inline-flex items-center gap-1.5 mt-3 text-sm font-semibold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 px-4 py-2 rounded-xl transition-colors"
              >
                Go to my dashboard <ArrowRight size={14} />
              </Link>
            )}
          </KycStatusPanel>

          {/*
            The jurisdictions panel is rendered in the read-only end states
            too, and is EDITABLE for a verified clinician.

            That is the point of the feature rather than an oversight: a
            therapist verified in Kenya who later qualifies to practise in the
            UK needs somewhere to claim it, and locking the whole screen after
            approval would leave "add a second jurisdiction" with no home in the
            product. Each individual licence is still locked by its own status —
            `upsertTherapistLicenceAction` refuses an edit to a `verified` or
            `pending` one — so this widens what can be ADDED, never what can be
            rewritten. While the application itself is `pending` it stays
            read-only: a reviewer may be part-way through these exact claims.
          */}
          <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6">
            <JurisdictionStep
              licences={licences}
              onChanged={refreshLicences}
              onError={setError}
              editable={status === "verified"}
            />
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6">
            <h2 className="text-sm font-bold text-stone-900 uppercase tracking-wider">
              Documents on file
            </h2>
            <p className="text-xs text-stone-500 mt-1 mb-4">
              {status === "pending"
                ? "These are locked while your application is being reviewed."
                : "These were reviewed and approved."}
            </p>
            <KycDocumentUploader
              documents={documents}
              editable={false}
              onChanged={refreshDocuments}
              onError={setError}
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              {error}
            </p>
          )}
        </div>
      </div>
    );
  }

  /* ----------------------------------------------------------- the wizard */

  const showProfileSteps = status === null;

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col items-center px-4 py-12">
      {/* Progress */}
      <div className="w-full max-w-lg mb-8">
        <div className="flex items-center justify-between mb-2">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center">
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold transition-colors
                ${
                  i < step
                    ? "bg-brand text-white"
                    : i === step
                      ? "bg-brand text-white ring-4 ring-brand/20"
                      : "bg-stone-200 text-stone-400"
                }`}
              >
                {i < step ? <CheckCircle size={14} /> : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                /*
                 * Narrowed from `w-16 sm:w-24` when Jurisdictions made this a
                 * FOUR-step wizard. At 360px the container gives 328px, and
                 * four 32px circles plus three 64px connectors (+8px margins)
                 * came to 344px — a horizontally scrolling progress bar on the
                 * narrowest phones. 40px keeps it at 272px.
                 */
                <div
                  className={`h-0.5 w-10 sm:w-20 mx-1 rounded-full transition-colors ${i < step ? "bg-brand" : "bg-stone-200"}`}
                />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-between text-xs text-stone-400 px-0">
          {STEPS.map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
      </div>

      <div className="w-full max-w-lg space-y-5">
        {/*
          A rejected applicant sees the reviewer's decision FIRST, above the
          form. Requirement 3: they need to know why before they start changing
          things, not after.
        */}
        {status === "rejected" && step === DOCUMENTS_STEP && (
          <KycStatusPanel status="rejected">
            {reviewNote && (
              <div className="mt-3 rounded-xl bg-white/70 border border-red-200 px-4 py-3">
                <p className="text-xs font-bold uppercase tracking-wider text-red-800">
                  Reviewer&apos;s note
                </p>
                <p className="text-sm text-red-800 mt-1 leading-relaxed whitespace-pre-line">
                  {reviewNote}
                </p>
              </div>
            )}
            <p className="text-xs text-red-700 mt-3">
              Documents already marked <strong>Accepted</strong> are kept — you only
              need to replace the ones flagged below.
            </p>
          </KycStatusPanel>
        )}

        <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-8">
          {/* Step 0 — Profile */}
          {step === 0 && showProfileSteps && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-stone-900 flex items-center gap-2">
                  <User size={20} className="text-brand" /> Profile Setup
                </h2>
                <p className="text-sm text-stone-500 mt-1">
                  Tell clients a bit about yourself.
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="relative w-20 h-20 rounded-full bg-stone-100 overflow-hidden flex items-center justify-center shrink-0">
                  {photoPreview ? (
                    <Image src={photoPreview} alt="Preview" fill className="object-cover" />
                  ) : (
                    <User size={28} className="text-stone-400" />
                  )}
                </div>
                <div>
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="text-sm font-medium text-brand underline underline-offset-2"
                  >
                    Upload photo
                  </button>
                  <p className="text-xs text-stone-400 mt-0.5">JPG or PNG, max 5 MB</p>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoChange}
                  />
                </div>
              </div>
              <div>
                <label
                  htmlFor="bio"
                  className="block text-sm font-medium text-stone-700 mb-1.5"
                >
                  Bio <span className="text-stone-400 font-normal">(required)</span>
                </label>
                <textarea
                  id="bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={4}
                  placeholder="Tell clients about your approach, experience, and what you specialise in…"
                  className="w-full rounded-xl border border-stone-200 px-4 py-3 text-sm text-stone-800 resize-none outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
                />
              </div>
              <div>
                <label
                  htmlFor="experience"
                  className="block text-sm font-medium text-stone-700 mb-1.5"
                >
                  Years of experience
                </label>
                <input
                  id="experience"
                  type="number"
                  min="0"
                  max="50"
                  value={experience}
                  onChange={(e) => setExperience(e.target.value)}
                  className="w-32 rounded-xl border border-stone-200 px-4 py-3 text-sm text-stone-800 outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
                />
              </div>
              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                  {error}
                </p>
              )}
              <button
                disabled={!bio.trim()}
                onClick={() => setStep(1)}
                className="w-full flex items-center justify-center gap-2 bg-brand text-white py-3 rounded-xl font-semibold text-sm disabled:opacity-40 hover:bg-brand/90 transition-colors"
              >
                Continue <ArrowRight size={15} />
              </button>
            </div>
          )}

          {/* Step 1 — Specialties */}
          {step === 1 && showProfileSteps && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-stone-900 flex items-center gap-2">
                  <BookOpen size={20} className="text-brand" /> Specializations
                </h2>
                <p className="text-sm text-stone-500 mt-1">
                  Select all that apply (at least one).
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {SPECIALTIES.map((s) => {
                  const on = selectedSpecialties.includes(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggleSpecialty(s)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors
                        ${on ? "bg-brand text-white border-brand" : "bg-white text-stone-600 border-stone-200 hover:border-brand/40"}`}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
              <div>
                <label
                  htmlFor="licenseNumber"
                  className="block text-sm font-medium text-stone-700 mb-1.5"
                >
                  Licence number
                </label>
                <input
                  id="licenseNumber"
                  value={licenseNumber}
                  onChange={(e) => setLicenseNumber(e.target.value)}
                  placeholder="e.g. LPC-12345"
                  className="w-full rounded-xl border border-stone-200 px-4 py-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
                />
                {/* The pre-0018 single, jurisdiction-less licence column. Kept
                    because `therapists.license_number` is still written and
                    read; the per-jurisdiction detail is collected on the next
                    step, which is what a reviewer actually checks. */}
                <p className="text-xs text-stone-400 mt-1.5">
                  Your main registration number. You&apos;ll tell us where each
                  of your licences was issued on the next step.
                </p>
              </div>
              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                  {error}
                </p>
              )}
              <div className="flex gap-3">
                <button
                  onClick={() => setStep(0)}
                  className="flex items-center gap-2 px-4 py-3 rounded-xl border border-stone-200 text-sm font-medium text-stone-600 hover:bg-stone-50 transition-colors"
                >
                  <ArrowLeft size={14} /> Back
                </button>
                <button
                  disabled={selectedSpecialties.length === 0 || saving}
                  onClick={handleSaveProfile}
                  className="flex-1 flex items-center justify-center gap-2 bg-brand text-white py-3 rounded-xl font-semibold text-sm disabled:opacity-40 hover:bg-brand/90 transition-colors"
                >
                  {saving ? (
                    <>
                      <Loader2 size={15} className="animate-spin" /> Saving…
                    </>
                  ) : (
                    <>
                      Continue <ArrowRight size={15} />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Step 2 — Jurisdictions */}
          {step === JURISDICTIONS_STEP && (
            <div className="space-y-6">
              <JurisdictionStep
                licences={licences}
                onChanged={refreshLicences}
                onError={setError}
                editable={editable}
              />

              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                  {error}
                </p>
              )}

              <div className="flex gap-3">
                {showProfileSteps && (
                  <button
                    onClick={() => setStep(1)}
                    className="flex items-center gap-2 px-4 py-3 rounded-xl border border-stone-200 text-sm font-medium text-stone-600 hover:bg-stone-50 transition-colors"
                  >
                    <ArrowLeft size={14} /> Back
                  </button>
                )}
                <button
                  onClick={() => {
                    setError(null);
                    setStep(DOCUMENTS_STEP);
                  }}
                  disabled={!hasJurisdiction}
                  title={
                    hasJurisdiction
                      ? undefined
                      : "Add at least one jurisdiction you are licensed in"
                  }
                  className="flex-1 flex items-center justify-center gap-2 bg-brand text-white py-3 rounded-xl font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-brand/90 transition-colors"
                >
                  Continue <ArrowRight size={15} />
                </button>
              </div>
            </div>
          )}

          {/* Step 3 — Documents */}
          {step === DOCUMENTS_STEP && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-stone-900 flex items-center gap-2">
                  <ShieldCheck size={20} className="text-brand" /> Credentials
                </h2>
                <p className="text-sm text-stone-500 mt-1">
                  We verify every clinician before granting access to client data.
                  Upload each document below.
                </p>
              </div>

              <KycDocumentUploader
                documents={documents}
                editable={editable}
                onChanged={refreshDocuments}
                onError={setError}
              />

              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                  {error}
                </p>
              )}

              {/*
                Requirement 2: the gate says what is still outstanding by NAME.
                "Complete the required fields" is the message that makes people
                hunt; naming the documents is the message that makes them finish.
              */}
              {!canSubmit && (
                <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
                  <p className="text-sm font-semibold text-amber-900">
                    Still needed before you can submit
                  </p>
                  <ul className="mt-1.5 space-y-1">
                    {/* The jurisdiction gap is named in the same list as the
                        documents, because to the applicant they are the same
                        question: what is still stopping me submitting. */}
                    {!hasJurisdiction && (
                      <li className="text-sm text-amber-700 flex items-start gap-2">
                        <span className="w-1 h-1 rounded-full bg-amber-500 shrink-0 mt-2" />
                        <span>
                          At least one jurisdiction you are licensed in —{" "}
                          <button
                            type="button"
                            onClick={() => setStep(JURISDICTIONS_STEP)}
                            className="underline underline-offset-2 font-semibold"
                          >
                            add one
                          </button>
                        </span>
                      </li>
                    )}
                    {missing.map((t) => (
                      <li key={t} className="text-sm text-amber-700 flex items-center gap-2">
                        <span className="w-1 h-1 rounded-full bg-amber-500 shrink-0" />
                        {kycDocumentLabel(t)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="bg-cream border border-brand/10 rounded-xl px-4 py-3 text-xs text-stone-600">
                Reviews typically complete within 1–2 business days. You&apos;ll be
                emailed as soon as there is a decision.
              </div>

              <div className="flex gap-3">
                {/* Back always goes to Jurisdictions, whether or not the profile
                    steps are in play — it is the step immediately before this
                    one and the one an applicant most often returns to. */}
                <button
                  onClick={() => setStep(JURISDICTIONS_STEP)}
                  disabled={submitting}
                  className="flex items-center gap-2 px-4 py-3 rounded-xl border border-stone-200 text-sm font-medium text-stone-600 hover:bg-stone-50 transition-colors disabled:opacity-40"
                >
                  <ArrowLeft size={14} /> Back
                </button>
                <button
                  onClick={handleSubmitForReview}
                  disabled={!canSubmit || submitting}
                  title={
                    canSubmit
                      ? undefined
                      : `Still needed: ${[
                          ...(hasJurisdiction ? [] : ["a jurisdiction you are licensed in"]),
                          ...missing.map(kycDocumentLabel),
                        ].join(", ")}`
                  }
                  className="flex-1 flex items-center justify-center gap-2 bg-brand text-white py-3 rounded-xl font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-brand/90 transition-colors"
                >
                  {submitting ? (
                    <>
                      <Loader2 size={15} className="animate-spin" /> Submitting…
                    </>
                  ) : (
                    <>
                      <Send size={15} />
                      {status === "rejected" ? "Resubmit application" : "Submit for review"}
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
