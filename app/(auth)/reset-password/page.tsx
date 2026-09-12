"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, LinkIcon, Lock } from "lucide-react";

import AuthAlert from "@/app/components/AuthAlert";
import AuthInput from "@/app/components/AuthInput";
import { updatePassword } from "@/lib/auth/client";
import { hardNavigate } from "@/lib/auth/navigate";
import { POST_LOGIN_PATH } from "@/lib/auth/safe-redirect";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { describeMissingConfig } from "@/lib/supabase/env";

/** Matches the floor on `/signup`. Supabase's own minimum still applies. */
const MIN_PASSWORD_LENGTH = 8;

type Status = "checking" | "ready" | "invalid" | "saved";

/**
 * Where a recovery link lands, and where a new password is set.
 *
 * This page existed under Appwrite (consuming `?userId=&secret=`), was deleted
 * when Auth0 took recovery over, and is back because Supabase hands the flow
 * to the application again.
 *
 * ## It has no token of its own — it needs a session
 *
 * The recovery link establishes one before this form is usable — either the
 * Supabase client consumes the code from the URL on load, or `/auth/callback`
 * has already exchanged it server-side and forwarded here. Either way the
 * recovery has happened by the time the form submits, and `updatePassword`
 * works because the caller is authenticated.
 *
 * There is nothing in this page's URL for us to validate, which is why "no
 * session" is the only failure state it can have: a link that was already
 * used, has expired, or was opened in a different browser from the one that
 * requested it (the PKCE verifier is a cookie, and it does not travel).
 *
 * That also means a recovery link IS a sign-in. Anyone holding it has the
 * account, which is why the emails are short-lived and single-use.
 */
export default function ResetPasswordPage() {
  const [status, setStatus] = useState<Status>("checking");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const missingConfig = describeMissingConfig();

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    // Unconfigured deployment: the banner below already says what is missing,
    // and there is no client to ask about a session.
    if (!supabase) return;

    let active = true;

    /*
     * Two ways the session can arrive, and both are needed.
     *
     * `getSession()` awaits the client's own initialisation — including the
     * URL-detection step that consumes a token from the address bar — so it is
     * the answer for the normal case of cookies already set by
     * `/auth/callback`. The listener covers a `PASSWORD_RECOVERY` event that
     * resolves after that first read, which happens when the link form puts
     * the token in the fragment rather than as a code.
     *
     * Without the listener this page can flash "link expired" at someone whose
     * link was perfectly good.
     */
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active && session) setStatus("ready");
    });

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      // Only ever resolves the initial "checking" state, so a session found by
      // the listener first is never overwritten with "invalid".
      setStatus((previous) =>
        previous === "checking" ? (data.session ? "ready" : "invalid") : previous
      );
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(formEvent: React.FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    if (submitting) return;

    if (password.length < MIN_PASSWORD_LENGTH) {
      setPasswordError(`Use at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }

    setSubmitting(true);
    setError(null);
    setPasswordError(null);

    /*
     * No analytics on this call, deliberately. A `password_reset_completed`
     * event against a stable person id records that this individual lost
     * access to their mental-health account, which fails the test in AGENTS.md:
     * it is not something we would want to read in a breach notification.
     */
    const result = await updatePassword(password);

    if (!result.ok) {
      setSubmitting(false);
      // Supabase's own message: too short, or the same as the current password.
      setError(result.message);
      return;
    }

    /*
     * Revoke every OTHER session on this account.
     *
     * A password reset is the one moment where "someone else may be signed in
     * as me" is the most likely reason the user is here. Supabase does not
     * revoke other refresh tokens on a password change by default, so without
     * this an attacker's existing session outlives the reset — the user has
     * done the one thing they know to do about a compromise, and it did not
     * work. `scope: "others"` keeps the session this tab is using.
     *
     * Failure is not fatal: the password IS changed by this point, so the
     * honest move is to carry on rather than show an error that suggests
     * otherwise.
     */
    const supabase = getSupabaseBrowserClient();
    if (supabase) {
      const { error: revokeError } = await supabase.auth.signOut({ scope: "others" });
      if (revokeError) {
        console.warn(
          "[auth] Password updated, but other sessions could not be revoked:",
          revokeError.message
        );
      }
    }

    setStatus("saved");
    // Signed in with the new password already — straight to the role router.
    hardNavigate(POST_LOGIN_PATH);
  }

  if (missingConfig) {
    return (
      <div className="flex flex-col gap-7">
        <h1 className="font-display text-3xl tracking-tight text-stone-900">
          Set a new password
        </h1>
        <AuthAlert tone="error" title="Password reset is not configured">
          {missingConfig}
        </AuthAlert>
      </div>
    );
  }

  if (status === "checking") {
    return (
      <div className="flex min-h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
      </div>
    );
  }

  if (status === "invalid") {
    return (
      <div className="flex flex-col gap-7">
        <div className="flex flex-col items-center gap-5 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-100">
            <LinkIcon size={24} strokeWidth={1.8} />
          </div>
          <div>
            <h1 className="font-display text-3xl tracking-tight text-stone-900">
              This link has expired
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-stone-500">
              Reset links work once, expire quickly, and have to be opened in
              the browser that asked for them. Request a fresh one and it will
              work.
            </p>
          </div>
        </div>

        <Link
          href="/forgot-password"
          className="flex min-h-12 w-full items-center justify-center rounded-xl bg-brand px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700"
        >
          Send a new link
        </Link>
        <Link
          href="/signin"
          className="inline-flex min-h-11 items-center justify-center text-sm font-semibold text-stone-500 transition-colors hover:text-stone-800"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  if (status === "saved") {
    return (
      <div className="flex flex-col items-center gap-5 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-100">
          <CheckCircle2 size={26} strokeWidth={1.8} />
        </div>
        <div>
          <h1 className="font-display text-3xl tracking-tight text-stone-900">
            Password updated
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-stone-500">
            Signing you in with your new password…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-7" data-ph-mask>
      <div>
        <h1 className="font-display text-3xl tracking-tight text-stone-900">
          Set a new password
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-stone-500">
          Choose a password you don&apos;t use anywhere else. Signing in on your
          other devices will need the new one.
        </p>
      </div>

      {error && <AuthAlert tone="error">{error}</AuthAlert>}

      {/* `method="post"` and `ph-no-capture`: see the note in signin/page.tsx.
          A default GET submit before hydration would put the new password in
          the URL. */}
      <form
        method="post"
        onSubmit={handleSubmit}
        className="ph-no-capture flex flex-col gap-4"
      >
        <AuthInput
          id="password"
          label="New password"
          type="password"
          icon={Lock}
          required
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
          placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            if (passwordError) setPasswordError(null);
          }}
          error={passwordError ?? undefined}
          disabled={submitting}
        />

        <button
          type="submit"
          disabled={submitting}
          className="min-h-12 w-full rounded-xl bg-brand px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Saving…" : "Save new password"}
        </button>
      </form>
    </div>
  );
}
