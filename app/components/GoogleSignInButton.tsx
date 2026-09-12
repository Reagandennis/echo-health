"use client";

import { useState } from "react";

import { capture } from "@/lib/analytics/client";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import { signInWithGoogle } from "@/lib/auth/client";

/**
 * "Continue with Google", for both sign-in and sign-up.
 *
 * ## Why this is a component rather than two copies of a button
 *
 * The call itself is `signInWithGoogle` in `lib/auth/client.ts`, which owns the
 * `redirectTo` — a security-relevant argument, since it is the URL Google
 * returns the browser to. What this component adds is the parts that must not
 * differ between sign-in and sign-up: the intent event, the disabled state
 * while the consent gate is unticked, and where the error goes. The deep-link
 * destination travels as `?next=`, which `/auth/callback` re-validates with
 * `safeRedirectPath` before using it.
 *
 * Google is also the only provider where the account may already exist under a
 * password identity. Supabase links them when the email matches and is
 * verified, so the outcome is one account either way — but that behaviour is a
 * project setting, not a guarantee this button can make.
 */
export default function GoogleSignInButton({
  event,
  next,
  disabled = false,
  label = "Continue with Google",
  onError,
}: {
  /** Intent event. Named from the taxonomy — never hand-written. */
  readonly event:
    | typeof ANALYTICS_EVENTS.SIGN_IN_STARTED
    | typeof ANALYTICS_EVENTS.SIGN_UP_STARTED;
  /** Same-origin path to land on after the callback exchanges the code. */
  readonly next: string;
  readonly disabled?: boolean;
  readonly label?: string;
  readonly onError: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    setBusy(true);
    onError("");

    /*
     * Intent only, and it carries no identity: the provider name and nothing
     * else. It fires before the browser leaves for Google, so it cannot tell a
     * completed sign-in from an abandoned one — `user_authenticated`, captured
     * server-side in `/post-login`, is what closes that funnel.
     */
    capture(event, { method: "google" });

    const result = await signInWithGoogle(next);

    /*
     * Reached only when the redirect could not be started (Supabase
     * unconfigured, the provider disabled in the dashboard, network gone). On
     * success the browser has already left, so there is nothing after this
     * line to reset.
     */
    if (!result.ok) {
      setBusy(false);
      onError(result.message);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || busy}
      className="flex min-h-12 w-full items-center justify-center gap-3 rounded-xl border border-stone-300 bg-white px-4 text-sm font-medium text-stone-700 shadow-xs transition-colors hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
      </svg>
      {busy ? "Redirecting to Google…" : label}
    </button>
  );
}
