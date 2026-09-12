"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, KeyRound, Mail, MailCheck } from "lucide-react";

import AuthAlert from "@/app/components/AuthAlert";
import AuthInput from "@/app/components/AuthInput";
import { sendPasswordReset } from "@/lib/auth/client";
import { describeMissingConfig } from "@/lib/supabase/env";

/**
 * Request a password-reset email.
 *
 * Auth0 owned this end to end, so the page was an explainer with a button that
 * left for Universal Login. Supabase puts it back in the app: `sendPasswordReset`
 * calls `resetPasswordForEmail`, and the link in the resulting email lands on
 * `/reset-password`, which sets the new password against the session that link
 * establishes. (`/auth/callback` also understands a `type=recovery` link, for
 * the email templates that send one — either shape ends up in the same place.)
 *
 * ## The panel says the same thing whether or not the account exists
 *
 * `resetPasswordForEmail` resolves successfully for an address with no account
 * — it simply sends nothing — and that is the behaviour to preserve rather than
 * work around. "No account found for that email" would confirm membership of a
 * mental-health service to anyone who can type an address into a form, which is
 * the same disclosure the sign-in page refuses to make.
 *
 * Errors that ARE shown are the ones that say nothing about the address:
 * Supabase's own per-address rate limit ("you can only request this after N
 * seconds") is the common one, and swallowing it would leave someone tapping a
 * button that has stopped doing anything.
 */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const missingConfig = describeMissingConfig();

  async function handleSubmit(formEvent: React.FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setError(null);

    /*
     * The destination is FIXED, with no `?next=` from this page. The only place
     * a recovery link may land is the form that sets a new password, and an
     * attacker-chosen redirect on the recovery flow would be the most valuable
     * open redirect on the site — the one link a victim is guaranteed to click.
     */
    const result = await sendPasswordReset(email);

    setSubmitting(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    setSentTo(email);
  }

  if (sentTo) {
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
              If <span className="font-semibold break-words text-stone-800">{sentTo}</span> has an
              Echo Health account, a link to set a new password is on its way.
            </p>
          </div>
        </div>

        <AuthAlert tone="info">
          The link works once and expires within the hour. Open it in this
          browser — a reset started here cannot be finished in another one.
        </AuthAlert>

        <Link
          href="/signin"
          className="inline-flex min-h-11 items-center justify-center gap-2 text-sm font-semibold text-stone-500 transition-colors hover:text-stone-800"
        >
          <ArrowLeft size={16} />
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-col items-center gap-5 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-100">
          <KeyRound size={26} strokeWidth={1.8} />
        </div>
        <div>
          <h1 className="font-display text-3xl tracking-tight text-stone-900">
            Reset password
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-stone-500">
            Enter the email you signed up with and we&apos;ll send you a link to
            choose a new password.
          </p>
        </div>
      </div>

      {missingConfig && (
        <AuthAlert tone="error" title="Password reset is not configured">
          {missingConfig}
        </AuthAlert>
      )}

      {!missingConfig && error && <AuthAlert tone="error">{error}</AuthAlert>}

      {/* No password on this form, but `method="post"` for the same reason as
          the others: a pre-hydration GET submit would put the email address in
          the URL, and an address is an identifier this codebase keeps out of
          logs and analytics on purpose. */}
      <form method="post" onSubmit={handleSubmit} className="flex flex-col gap-4">
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

        <button
          type="submit"
          disabled={Boolean(missingConfig) || submitting}
          className="min-h-12 w-full rounded-xl bg-brand px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Sending…" : "Email me a reset link"}
        </button>

        <Link
          href="/signin"
          className="inline-flex min-h-11 items-center justify-center gap-2 text-sm font-semibold text-stone-500 transition-colors hover:text-stone-800"
        >
          <ArrowLeft size={16} />
          Back to sign in
        </Link>
      </form>
    </div>
  );
}
