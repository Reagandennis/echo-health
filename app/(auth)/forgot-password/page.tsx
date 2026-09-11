"use client";

import { KeyRound, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { goToPasswordReset } from "@/lib/auth/client";

/**
 * Password reset explainer.
 *
 * Auth0 owns password recovery end to end: the "Forgot password?" link on the
 * Universal Login screen sends the reset email and hosts the page where the new
 * password is chosen. There is nothing for this app to collect, so the former
 * email form (which called Appwrite's `createRecovery`) is gone and the page now
 * just points users at the right place.
 *
 * The companion `/reset-password` page was deleted outright — it existed to
 * consume Appwrite's `?userId=&secret=` recovery link, which is never issued now.
 */
export default function ForgotPasswordPage() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-6 text-center">
        <div className="flex justify-center">
          <div className="w-12 h-12 rounded-2xl bg-brand-50 ring-1 ring-inset ring-brand-100 flex items-center justify-center text-brand-700">
            <KeyRound size={26} />
          </div>
        </div>
        <div>
          <h1 className="font-display text-3xl tracking-tight text-stone-900">Reset password</h1>
          <p className="mt-2 text-sm text-stone-500 leading-relaxed">
            Password resets happen on our secure sign-in page. Choose{" "}
            <span className="font-semibold text-stone-800">Forgot password?</span> there
            and we&apos;ll email you a link to set a new one.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-5">
        <button
          type="button"
          onClick={() => goToPasswordReset()}
          className="w-full rounded-xl bg-brand py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700"
        >
          Go to sign-in page
        </button>

        <Link
          href="/signin"
          className="inline-flex items-center justify-center gap-2 text-sm font-semibold text-stone-500 hover:text-stone-800 transition-colors"
        >
          <ArrowLeft size={16} />
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
