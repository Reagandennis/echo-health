"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Lock, Mail, MailCheck, User } from "lucide-react";

import AuthAlert from "@/app/components/AuthAlert";
import AuthInput from "@/app/components/AuthInput";
import GoogleSignInButton from "@/app/components/GoogleSignInButton";
import { capture } from "@/lib/analytics/client";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import { signUp } from "@/lib/auth/client";
import { hardNavigate } from "@/lib/auth/navigate";
import { postLoginTarget } from "@/lib/auth/safe-redirect";
import { describeMissingConfig } from "@/lib/supabase/env";

/**
 * Client-side floor, and that is all it is.
 *
 * Supabase enforces its own minimum server-side — 6 characters by default,
 * raisable under Authentication → Policies in the dashboard — so this number
 * can only ever be the stricter of the two, never the only one. Nothing here
 * checks entropy, dictionary words or breach lists, so the copy must not claim
 * a strong password: it says "at least 8 characters", which is exactly what is
 * enforced.
 */
const MIN_PASSWORD_LENGTH = 8;

/**
 * Sign-up: email + password, or Google.
 *
 * ## Two outcomes, both of which have to work
 *
 * Whether Supabase requires email confirmation is a project setting ("Confirm
 * email" under Authentication → Sign In / Providers), and it can be changed
 * after this code ships. So `signUp`'s `needsEmailConfirmation` — which is
 * just "Supabase returned no session" — is branched on rather than assumed:
 *
 *  - no confirmation needed → the account is live and signed in, go to
 *    `/post-login`.
 *  - confirmation needed → a link is on its way; show that and stop. Sending
 *    them to `/post-login` here would bounce them back to `/signin` with no
 *    explanation, which reads as "sign-up failed".
 *
 * Assuming either one is how this breaks silently the day someone flips the
 * setting.
 *
 * ## What we do NOT tell the visitor
 *
 * When confirmation is on and the address already has an account, Supabase
 * returns a *success* with a decoy user (`identities: []`) and sends a
 * "someone tried to sign up as you" email instead. That is deliberate
 * anti-enumeration behaviour, and this page keeps it: same panel, same copy,
 * either way. Reading `identities` to say "you already have an account" would
 * turn this form into a list-membership oracle for a mental-health service.
 *
 * The password itself lives in component state and reaches exactly one
 * function. It is in no analytics property, no URL and no log line; the form is
 * `method="post"` so a pre-hydration submit cannot put it in a query string.
 */
function SignUpForm() {
  const searchParams = useSearchParams();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  /** Set once the confirmation branch is taken; the form is replaced by copy. */
  const [confirmationSentTo, setConfirmationSentTo] = useState<string | null>(null);

  const missingConfig = describeMissingConfig();

  /*
   * `?plan=couples` from the pricing table has to survive all the way to
   * `/onboarding`, which means surviving a full round trip through the email
   * confirmation link or Google. `postLoginTarget` keeps it (and any `?next=`)
   * on the `/post-login` URL, which validates the plan against the real plan
   * ids before acting on it. Losing it here drops the visitor on a generic
   * dashboard and makes them choose a second time.
   */
  const target = postLoginTarget(searchParams.toString());

  const disabled = Boolean(missingConfig) || submitting;

  async function handleSubmit(formEvent: React.FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    if (submitting) return;

    // Checked here as well as via `minLength`, because the native bubble is
    // terse and easy to miss on a phone. Message names the rule, not a verdict
    // on the password.
    if (password.length < MIN_PASSWORD_LENGTH) {
      setPasswordError(`Use at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }

    setSubmitting(true);
    setError(null);
    setPasswordError(null);

    // Intent only: the method, nothing about the person.
    capture(ANALYTICS_EVENTS.SIGN_UP_STARTED, { method: "password" });

    /*
     * `next` becomes the `?next=` on the confirmation link's `/auth/callback`
     * URL, which is how a plan survives the email round trip. `fullName` is
     * written to `user_metadata` — self-writable, and therefore fine for a
     * display name and never for anything that grants access; roles live in
     * `app_metadata`. See `lib/supabase/admin.ts`.
     */
    const result = await signUp(email, password, { next: target, fullName: name.trim() });

    if (!result.ok) {
      setSubmitting(false);
      setError(result.message);
      return;
    }

    if (!result.needsEmailConfirmation) {
      // Signed in already. Full document navigation so the freshly written
      // cookies are on the request — see `hardNavigate`.
      hardNavigate(target);
      return;
    }

    setSubmitting(false);
    setConfirmationSentTo(email);
  }

  if (confirmationSentTo) {
    return (
      <div className="flex flex-col gap-7">
        <div className="flex flex-col items-center gap-5 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-100">
            <MailCheck size={26} strokeWidth={1.8} />
          </div>
          <div>
            <h1 className="font-display text-3xl tracking-tight text-stone-900">
              Check your email
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-stone-500">
              We&apos;ve sent a confirmation link to{" "}
              <span className="font-semibold break-words text-stone-800">{confirmationSentTo}</span>.
              Open it to finish setting up your account.
            </p>
          </div>
        </div>

        <AuthAlert tone="info">
          The link opens in the browser you use to click it, so use this device
          if you can. If nothing arrives in a few minutes, check your spam
          folder before trying again.
        </AuthAlert>

        <Link
          href="/signin"
          className="flex min-h-12 w-full items-center justify-center rounded-xl border border-stone-300 bg-white px-4 text-sm font-semibold text-stone-700 transition-colors hover:bg-stone-50"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-7" data-ph-mask>
      <div>
        <h1 className="font-display text-3xl tracking-tight text-stone-900">
          Create your account
        </h1>
        <p className="mt-2 text-sm text-stone-500">
          Already have an account?{" "}
          <Link
            href="/signin"
            className="font-semibold text-brand-700 underline underline-offset-2 transition-colors hover:text-brand-800"
          >
            Sign in
          </Link>
        </p>
      </div>

      {missingConfig && (
        <AuthAlert tone="error" title="Sign-up is not configured">
          {missingConfig}
        </AuthAlert>
      )}

      {!missingConfig && error && <AuthAlert tone="error">{error}</AuthAlert>}

      {/* `method="post"` and `ph-no-capture`: see the long note in
          signin/page.tsx. A default GET submit before hydration would put the
          password in the query string, and autocapture has no business
          reading anything inside a credential form. */}
      <form
        method="post"
        onSubmit={handleSubmit}
        className="ph-no-capture flex flex-col gap-4"
      >
        <AuthInput
          id="name"
          label="Full name"
          icon={User}
          required
          autoComplete="name"
          placeholder="Ada Lovelace"
          value={name}
          onChange={(event) => setName(event.target.value)}
          disabled={disabled}
        />

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
          disabled={disabled}
        />

        <AuthInput
          id="password"
          label="Password"
          type="password"
          icon={Lock}
          required
          /* `new-password` so a password manager offers to generate and save
             one instead of autofilling an existing credential. */
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
          placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            if (passwordError) setPasswordError(null);
          }}
          error={passwordError ?? undefined}
          disabled={disabled}
        />

        <label className="flex cursor-pointer select-none items-start gap-3 text-sm leading-5 text-stone-600">
          <input
            type="checkbox"
            name="terms"
            checked={agreed}
            onChange={(event) => setAgreed(event.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-stone-300 accent-brand"
          />
          {/* Relative links: /terms and /privacy are pages in this app, and the
              absolute echohealth.app URLs these used to point at sent anyone on
              a preview or local build to production. */}
          <span>
            I agree to the{" "}
            <Link
              href="/terms"
              className="font-medium text-brand-700 underline underline-offset-2 transition-colors hover:text-brand-800"
            >
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link
              href="/privacy"
              className="font-medium text-brand-700 underline underline-offset-2 transition-colors hover:text-brand-800"
            >
              Privacy Policy
            </Link>
          </span>
        </label>

        <button
          type="submit"
          disabled={disabled || !agreed}
          className="min-h-12 w-full rounded-xl bg-brand px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Creating your account…" : "Create account"}
        </button>
      </form>

      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-stone-200" />
        <span className="text-xs font-medium text-stone-400">or continue with</span>
        <span className="h-px flex-1 bg-stone-200" />
      </div>

      {/* Consent gates Google too. Signing up through an identity provider is
          still signing up, and the agreement is ours to obtain, not Google's. */}
      <GoogleSignInButton
        event={ANALYTICS_EVENTS.SIGN_UP_STARTED}
        next={target}
        disabled={disabled || !agreed}
        onError={(message) => setError(message || null)}
      />
    </div>
  );
}

export default function SignUpPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
        </div>
      }
    >
      <SignUpForm />
    </Suspense>
  );
}
