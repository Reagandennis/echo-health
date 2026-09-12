"use client";

import { useState } from "react";
import Link from "next/link";
import { signInWithGoogle, signUp } from "@/lib/auth/client";
import { capture } from "@/lib/analytics/client";

/**
 * Sign-up entry point.
 *
 * Auth0 Universal Login owns account creation (name, email, password) via
 * `screen_hint=signup`, so this page keeps only what Auth0 cannot ask on our
 * behalf: agreement to the Terms and Privacy Policy, which gates the CTA.
 *
 * New accounts come back with no role claim, so `/post-login` forwards them
 * to `/role-select` — the same destination the old Appwrite flow pushed to.
 */
/**
 * Carry a plan chosen on the landing page across the Auth0 round trip.
 *
 * The pricing CTAs link here as `/signup?plan=couples`. Without this the
 * parameter dies at the redirect to Auth0 and the visitor arrives at
 * /onboarding with the default plan selected, having to make the same choice a
 * second time.
 *
 * Read from the live URL inside the handler rather than through
 * `useSearchParams`, which would force this page behind a Suspense boundary for
 * no benefit — the handler only ever runs in the browser. `/post-login`
 * validates the value against the real plan ids before acting on it.
 */
function postLoginReturnTo(): string {
  const plan = new URLSearchParams(window.location.search).get("plan");
  return plan ? `/post-login?plan=${encodeURIComponent(plan)}` : "/post-login";
}

export default function SignUpPage() {
  const [agreed, setAgreed] = useState(false);
  const [leaving, setLeaving] = useState(false);

  function handleSignUp() {
    setLeaving(true);
    capture("sign_up_started", { method: "auth0" });
    signUp(postLoginReturnTo());
  }

  function handleGoogle() {
    setLeaving(true);
    capture("sign_up_started", { method: "google" });
    signInWithGoogle(postLoginReturnTo());
  }

  if (leaving) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 rounded-full border-2 border-brand border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Heading */}
      <div>
        <h1 className="font-display text-3xl tracking-tight text-stone-900">Create your account</h1>
        <p className="mt-2 text-sm text-stone-500">
          Already have an account?{" "}
          <Link href="/signin" className="font-semibold text-brand-700 hover:text-brand-800 transition-colors underline underline-offset-2">
            Sign in
          </Link>
        </p>
      </div>

      {/* Terms */}
      <label className="flex items-start gap-3 cursor-pointer select-none text-sm text-stone-600 leading-5">
        <input
          type="checkbox"
          name="terms"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5 w-4 h-4 rounded border-stone-300 accent-brand shrink-0"
        />
        <span>
          I agree to the{" "}
          <a href="https://echohealth.app/terms" className="text-brand-700 font-medium underline underline-offset-2 hover:text-brand-800 transition-colors">
            Terms of Service
          </a>{" "}
          and{" "}
          <a href="https://echohealth.app/privacy" className="text-brand-700 font-medium underline underline-offset-2 hover:text-brand-800 transition-colors">
            Privacy Policy
          </a>
        </span>
      </label>

      {/* Primary CTA — hands off to Auth0 Universal Login */}
      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={handleSignUp}
          disabled={!agreed}
          className="w-full rounded-xl bg-brand py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          Create account
        </button>
        <p className="text-center text-xs text-stone-500 leading-relaxed">
          You&apos;ll be taken to our secure sign-up page to choose an email and password.
        </p>
      </div>

      {/* Divider */}
      <div className="flex items-center gap-3">
        <span className="flex-1 h-px bg-stone-200" />
        <span className="text-xs text-stone-400 font-medium">or continue with</span>
        <span className="flex-1 h-px bg-stone-200" />
      </div>

      {/* OAuth */}
      <button
        type="button"
        onClick={handleGoogle}
        disabled={!agreed}
        className="flex items-center justify-center gap-3 w-full rounded-xl border border-stone-300 bg-white py-3 text-sm font-medium text-stone-700 shadow-xs hover:bg-stone-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
        Continue with Google
      </button>
    </div>
  );
}
