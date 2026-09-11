"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { signIn, signInWithGoogle } from "@/lib/auth/client";
import posthog from "posthog-js";

/** Turn Auth0's `?error=…&error_description=…` bounce-back into display copy. */
function readAuthError(params: URLSearchParams): string | null {
  const description = params.get("error_description");
  if (description) return description;

  const err = params.get("error");
  if (err === "access_denied") return "Access denied. Please try signing in again.";
  return err;
}

/**
 * Sign-in entry point.
 *
 * Under Appwrite this page collected the email and password itself. Auth0
 * Universal Login hosts that form now, so the page is reduced to a launchpad:
 * both buttons are browser navigations to `/auth/login`, and the app never sees
 * a credential. Role-based routing after login lives in `/post-login`, which
 * is the `returnTo` target the Auth0 callback lands on.
 */
function SignInLaunch() {
  const searchParams = useSearchParams();
  const [leaving, setLeaving] = useState(false);

  // Auth0 reports failures by bouncing back with `error` / `error_description`.
  // Derived during render rather than mirrored into state via an effect — the
  // message is a pure function of the URL and never changes on its own.
  const error = readAuthError(searchParams);

  function handleSignIn() {
    setLeaving(true);
    posthog.capture("sign_in_started", { method: "auth0" });
    signIn();
  }

  function handleGoogle() {
    setLeaving(true);
    posthog.capture("sign_in_started", { method: "google" });
    signInWithGoogle();
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
        <h1 className="font-display text-3xl tracking-tight text-stone-900">Welcome back</h1>
        <p className="mt-2 text-sm text-stone-500">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="font-semibold text-brand-700 hover:text-brand-800 transition-colors underline underline-offset-2">
            Sign up free
          </Link>
        </p>
      </div>

      {/* Error banner */}
      {error && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </div>
      )}

      {/* Primary CTA — hands off to Auth0 Universal Login */}
      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={handleSignIn}
          className="w-full rounded-xl bg-brand py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          Sign in
        </button>
        <p className="text-center text-xs text-stone-500 leading-relaxed">
          You&apos;ll be taken to our secure sign-in page to enter your email and password.
        </p>
      </div>

      {/* Divider */}
      <div className="flex items-center gap-3">
        <span className="flex-1 h-px bg-stone-200" />
        <span className="text-xs text-stone-400 font-medium">or continue with</span>
        <span className="flex-1 h-px bg-stone-200" />
      </div>

      {/* OAuth */}
      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={handleGoogle}
          className="flex items-center justify-center gap-3 w-full rounded-xl border border-stone-300 bg-white py-3 text-sm font-medium text-stone-700 shadow-xs hover:bg-stone-50 transition-colors"
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

      {/* Password help */}
      <div className="flex items-center justify-center text-sm">
        <Link
          href="/forgot-password"
          className="text-stone-500 font-medium hover:text-stone-800 transition-colors underline underline-offset-2"
        >
          Forgot password?
        </Link>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 rounded-full border-2 border-brand border-t-transparent animate-spin" />
      </div>
    }>
      <SignInLaunch />
    </Suspense>
  );
}
