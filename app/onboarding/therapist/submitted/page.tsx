import Link from "next/link";
import { ShieldCheck, Clock, Mail } from "lucide-react";
import SignOutButton from "@/app/components/SignOutButton";

/**
 * Terminal state of the therapist application.
 *
 * A therapist applicant deliberately holds no role at this point: `therapist`
 * grants access to clinical data, so it is never self-serve. Their submission
 * sits in the admin verification queue until reviewed.
 *
 * This page exists because the alternative is worse — sending them to
 * `/therapist` would hit that section's role gate and bounce them to the client
 * dashboard, making a successful submission look like a rejection.
 */
export default function TherapistApplicationSubmittedPage() {
  return (
    <div className="min-h-screen bg-cream flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-brand/10">
        <span className="text-xl font-bold text-brand tracking-tight">echo health</span>
        <SignOutButton />
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-14">
        <div className="w-full max-w-lg bg-white rounded-2xl shadow-sm border border-brand/10 p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-brand/10 flex items-center justify-center mx-auto mb-5">
            <ShieldCheck size={30} className="text-brand" />
          </div>

          <h1 className="text-2xl font-bold text-brand">Application submitted</h1>
          <p className="mt-3 text-sm text-stone-500 leading-relaxed">
            Thanks — your credentials are with our verification team. We review
            every clinician before granting access to client data, so this step
            is manual by design.
          </p>

          <div className="mt-7 space-y-3 text-left">
            <div className="flex gap-3 items-start bg-cream rounded-xl px-4 py-3">
              <Clock size={17} className="text-brand mt-0.5 shrink-0" />
              <p className="text-sm text-stone-600">
                Reviews typically complete within 1–2 business days.
              </p>
            </div>
            <div className="flex gap-3 items-start bg-cream rounded-xl px-4 py-3">
              <Mail size={17} className="text-brand mt-0.5 shrink-0" />
              <p className="text-sm text-stone-600">
                You&apos;ll be notified once approved. <strong>Sign out and back
                in</strong> afterwards — your access is issued when you log in.
              </p>
            </div>
          </div>

          {/*
            Was "Update my submission", which is no longer true and was never
            quite honest: documents are frozen once an application is with a
            reviewer, so following this link shows the read-only "under review"
            view. Promising an edit the next screen refuses is how a flow loses
            someone's trust in the first ten seconds.
          */}
          <Link
            href="/onboarding/therapist"
            className="inline-block mt-7 text-sm font-semibold text-brand underline underline-offset-4"
          >
            Check my application status
          </Link>
        </div>
      </main>
    </div>
  );
}
