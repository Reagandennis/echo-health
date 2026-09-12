"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Lock, Mail } from "lucide-react";

import AuthAlert from "@/app/components/AuthAlert";
import AuthInput from "@/app/components/AuthInput";
import GoogleSignInButton from "@/app/components/GoogleSignInButton";
import { capture } from "@/lib/analytics/client";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import { signIn } from "@/lib/auth/client";
import { hardNavigate } from "@/lib/auth/navigate";
import { postLoginTarget } from "@/lib/auth/safe-redirect";
import { describeMissingConfig } from "@/lib/supabase/env";

/**
 * Failure codes `/auth/callback` may bounce back with, and what we say about
 * them.
 *
 * The callback sends a CODE, never the provider's own `error_description`. That
 * text is attacker-influenceable and lands in a banner on our own origin, which
 * is a free phishing slot ("Your account is locked, call …") on the page where
 * a user is about to type a password. A fixed map cannot be used that way.
 */
const CALLBACK_ERRORS: Record<string, string> = {
  link_expired: "That link has expired. Request a new one and try again.",
  link_invalid:
    "We couldn't finish signing you in with that link. It may already have been used, or it was opened in a different browser from the one that asked for it.",
  oauth_failed: "Google sign-in didn't complete. Please try again.",
  access_denied: "Sign-in was cancelled.",
  not_configured: "Sign-in is unavailable on this deployment.",
};

/**
 * Sign-in: email + password, or Google.
 *
 * ## This page handles credentials. The previous one did not.
 *
 * Auth0 Universal Login hosted the form, so the app never saw a password. With
 * Supabase it does, and the rules that follow from that are written where they
 * apply rather than in a header comment:
 *
 *  - the `<form>` is `method="post"` (see below) so a pre-hydration submit
 *    cannot put the password in a query string;
 *  - the value lives in component state and goes to exactly one place,
 *    `signIn` in `lib/auth/client.ts`, which hands it straight to Supabase. It
 *    is in no analytics property, no console line and no error message;
 *  - the error from Supabase is shown verbatim. `Invalid login credentials` is
 *    deliberately ambiguous between "no such account" and "wrong password", and
 *    clarifying it would turn this form into an account-existence oracle.
 *
 * Session replay is a real consideration here, because this page is in front of
 * the login wall and `PostHogProvider` starts recording once it confirms there
 * is no session. `instrumentation-client.ts` sets `maskAllInputs: true`, so
 * field values are never in a recording; `data-ph-mask` on the form covers
 * rendered TEXT inside it as well, which is the part masking does not handle.
 */
function SignInForm() {
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /*
   * Config is checked at render, not on submit: a deployment with no Supabase
   * keys should say so before someone types a password into a form that cannot
   * work. `describeMissingConfig()` names the variables and where to find them.
   */
  const missingConfig = describeMissingConfig();

  /*
   * Derived during render rather than mirrored into state by an effect — the
   * banner is a pure function of the URL and never changes on its own.
   */
  const callbackError = searchParams.get("error");
  const urlError = callbackError
    ? (CALLBACK_ERRORS[callbackError] ?? CALLBACK_ERRORS.link_invalid)
    : null;

  /*
   * Where a successful sign-in lands. `/post-login` routes by role on the
   * server and is the only place a completed login is measurable; a `?next=`
   * from the proxy travels through it rather than round it. Validated in
   * `postLoginTarget`, because this value becomes a navigation.
   */
  const target = postLoginTarget(searchParams.toString());

  async function handleSubmit(formEvent: React.FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setError(null);

    // Intent only, and deliberately property-poor: the method, no email. An
    // email here would put "this address uses a mental-health service" into a
    // third-party analytics store. See the privacy rules in AGENTS.md.
    capture(ANALYTICS_EVENTS.SIGN_IN_STARTED, { method: "password" });

    const result = await signIn(email, password);

    if (!result.ok) {
      // Surfaced as-is. See the note above on not clarifying it.
      setSubmitting(false);
      setError(result.message);
      return;
    }

    /*
     * A full document navigation — see `hardNavigate` for why the router's
     * push would be wrong here.
     *
     * `submitting` is left true: the browser is leaving, and resetting it would
     * only re-enable a button for the moment before it does.
     */
    hardNavigate(target);
  }

  return (
    <div className="flex flex-col gap-7" data-ph-mask>
      <div>
        <h1 className="font-display text-3xl tracking-tight text-stone-900">Welcome back</h1>
        <p className="mt-2 text-sm text-stone-500">
          Don&apos;t have an account?{" "}
          <Link
            href="/signup"
            className="font-semibold text-brand-700 underline underline-offset-2 transition-colors hover:text-brand-800"
          >
            Sign up free
          </Link>
        </p>
      </div>

      {missingConfig && (
        <AuthAlert tone="error" title="Sign-in is not configured">
          {missingConfig}
        </AuthAlert>
      )}

      {!missingConfig && (error ?? urlError) && (
        <AuthAlert tone="error">{error ?? urlError}</AuthAlert>
      )}

      {/*
        `method="post"` with no action, and it is load-bearing.

        A `<form>` with no method defaults to GET. If this form is submitted
        before React hydrates — a slow phone, a failed chunk — the browser does
        that default submit itself, and a GET would put `?email=…&password=…`
        in the address bar, the browser history, the access log of whatever sits
        in front of Next, and any referrer sent from the resulting page. POST
        cannot: a page route does not accept it, so the submission is simply
        refused. Losing a submit is recoverable; logging a password is not.

        `ph-no-capture` switches posthog-js autocapture OFF for everything
        inside this form, element properties included. Autocapture does not
        read an input's value — but `AuthInput`'s reveal toggle flips the field
        to `type="text"`, and "the one input type autocapture treats specially
        is one we deliberately stop using" is not a margin worth living on.
      */}
      <form
        method="post"
        onSubmit={handleSubmit}
        className="ph-no-capture flex flex-col gap-4"
      >
        <AuthInput
          id="email"
          label="Email"
          type="email"
          icon={Mail}
          required
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="you@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={Boolean(missingConfig) || submitting}
        />

        <AuthInput
          id="password"
          label="Password"
          type="password"
          icon={Lock}
          required
          /* `current-password`, so a password manager offers the saved one and
             does not offer to generate a new one. */
          autoComplete="current-password"
          placeholder="Your password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={Boolean(missingConfig) || submitting}
        />

        <div className="flex justify-end">
          <Link
            href="/forgot-password"
            className="text-sm font-medium text-stone-500 underline underline-offset-2 transition-colors hover:text-stone-800"
          >
            Forgot password?
          </Link>
        </div>

        <button
          type="submit"
          disabled={Boolean(missingConfig) || submitting}
          className="min-h-12 w-full rounded-xl bg-brand px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-stone-200" />
        <span className="text-xs font-medium text-stone-400">or continue with</span>
        <span className="h-px flex-1 bg-stone-200" />
      </div>

      <GoogleSignInButton
        event={ANALYTICS_EVENTS.SIGN_IN_STARTED}
        next={target}
        disabled={Boolean(missingConfig) || submitting}
        onError={(message) => setError(message || null)}
      />
    </div>
  );
}

/**
 * `useSearchParams` opts the page into request-time rendering, so the Suspense
 * boundary is required rather than defensive.
 */
export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
        </div>
      }
    >
      <SignInForm />
    </Suspense>
  );
}
