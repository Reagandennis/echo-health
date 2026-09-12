"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

/**
 * Client-side auth entry points (Supabase Auth).
 *
 * ## The posture change, stated plainly
 *
 * Under Auth0 Universal Login every function here was a browser navigation and
 * **the app never handled a password**. AGENTS.md said so, and it was a real
 * security property worth having. With Supabase the app handles credentials
 * directly, so that property is gone and the obligations it used to cover are
 * now ours:
 *
 *  - A password is never logged, never captured in analytics, and never placed
 *    in a URL. It exists in a form field and in the argument to the calls
 *    below, and nowhere else.
 *  - Sign-in errors are surfaced verbatim from Supabase, which returns a
 *    single `Invalid login credentials` for both a wrong password and an
 *    unknown address. **Do not "improve" that message.** Distinguishing the
 *    two turns the sign-in form into an account-enumeration oracle.
 *  - Every call here runs over HTTPS in any real deployment. The one exception
 *    is localhost, where there is nothing to intercept.
 *
 * These return a discriminated result rather than throwing, because every
 * caller is a form handler that needs to render the error next to the field.
 */

/**
 * Default post-authentication destination.
 *
 * Not a page anyone lingers on: `/post-login` is a Server Component that reads
 * the fresh session and forwards by role (admin / therapist / client / no role
 * yet). The role branch has to happen after the redirect rather than during
 * it, because the OAuth callback only knows the `next` it was handed.
 */
export const POST_LOGIN_RETURN_TO = "/post-login";

export type AuthResult =
  | { ok: true; needsEmailConfirmation?: boolean }
  | { ok: false; message: string };

/** Unconfigured Supabase, phrased for someone looking at a form. */
const NOT_CONFIGURED: AuthResult = {
  ok: false,
  message:
    "Sign-in is not available on this deployment: Supabase is not configured. " +
    "If you are running this locally, add NEXT_PUBLIC_SUPABASE_URL and " +
    "NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local.",
};

/**
 * Build the absolute URL the provider should send the browser back to.
 *
 * Absolute because OAuth and the email links require it. Constructed from
 * `window.location.origin` rather than an env var so a preview deployment,
 * a tunnel and localhost all work without reconfiguration — and because an
 * env-var mismatch here is a redirect to the wrong host, which is the shape
 * of an account-takeover bug.
 */
function callbackUrl(next: string): string {
  const url = new URL("/auth/callback", window.location.origin);
  /* Only ever a same-origin path. A caller passing an absolute URL would make
     this an open redirect, so anything not starting with a single "/" is
     discarded rather than sanitised. */
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : POST_LOGIN_RETURN_TO;
  url.searchParams.set("next", safeNext);
  return url.toString();
}

export async function signIn(
  email: string,
  password: string
): Promise<AuthResult> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return NOT_CONFIGURED;

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  /* Verbatim. See the note above on account enumeration. */
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

/**
 * Create an account.
 *
 * `needsEmailConfirmation` exists because the answer depends on a Supabase
 * project setting we do not control from here. With confirmations on, `signUp`
 * resolves with a user and **no session** — the caller must then say "check
 * your email" rather than redirecting to a portal the user cannot reach. With
 * them off, a session is returned and sign-in is complete. Callers must handle
 * both; assuming either one produces a dead end on somebody's deployment.
 */
export async function signUp(
  email: string,
  password: string,
  options?: { readonly next?: string; readonly fullName?: string }
): Promise<AuthResult> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return NOT_CONFIGURED;

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: callbackUrl(options?.next ?? POST_LOGIN_RETURN_TO),
      /*
       * `data` writes `user_metadata`, which the user can later change
       * themselves. That is correct for a display name and WRONG for anything
       * that grants access — roles live in `app_metadata`, writable only with
       * the service-role key. See `lib/supabase/admin.ts`.
       */
      ...(options?.fullName ? { data: { full_name: options.fullName } } : {}),
    },
  });

  if (error) return { ok: false, message: error.message };
  return { ok: true, needsEmailConfirmation: !data.session };
}

/**
 * Google OAuth.
 *
 * Redirects the browser, so this resolves only on failure — on success the
 * page is already navigating away and the promise never settles for anyone to
 * observe. Requires the Google provider to be enabled in the Supabase
 * dashboard, with this origin's `/auth/callback` in its redirect allowlist.
 */
export async function signInWithGoogle(next = POST_LOGIN_RETURN_TO): Promise<AuthResult> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return NOT_CONFIGURED;

  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: callbackUrl(next) },
  });

  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

/**
 * Sign out through the server route, by submitting a real form.
 *
 * ## Why not just call `supabase.auth.signOut()` here
 *
 * There were briefly two sign-out paths: this one, and `POST /auth/signout`.
 * The route is the better implementation and this now defers to it, so the
 * eight components using `SignOutButton` did not have to change.
 *
 * The route does one thing a browser-side `signOut()` cannot: after asking
 * Supabase to revoke the refresh token, it **unconditionally clears every
 * `sb-*` cookie**. That matters because a Supabase access token is a
 * self-contained JWT — it is not checked against a server-side session table,
 * so a cookie left behind by a failed revoke call *is* a live session until it
 * expires. Clearing cookies is the part that must not depend on a network
 * call succeeding.
 *
 * ## Why a form and not `fetch`
 *
 * The route answers 303 to `/`. A `fetch` would follow that redirect and hand
 * back an opaque response the caller then has to turn into a navigation
 * anyway, and any `Set-Cookie` handling becomes fetch-mode-dependent. A real
 * form submission is a document navigation: the browser applies the cleared
 * cookies and follows the redirect natively, and every Server Component is
 * re-rendered without the session rather than reused from a cache that still
 * has it.
 *
 * It also sends an `Origin` header, which the route checks — the route is
 * POST-only and same-origin-only because a GET sign-out is CSRF-able and
 * prefetchable.
 */
export async function signOut(): Promise<void> {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = "/auth/signout";
  /* Appended because a form must be in the document to submit. Hidden so it
     cannot flash or take layout in the frame before navigation starts. */
  form.hidden = true;
  document.body.appendChild(form);
  form.submit();
}

/** Send a password-reset email. Lands on `/reset-password`. */
export async function sendPasswordReset(email: string): Promise<AuthResult> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return NOT_CONFIGURED;

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: new URL("/reset-password", window.location.origin).toString(),
  });

  /*
   * Supabase does not reveal whether the address exists, and neither should
   * the UI. Callers show the same "check your email" either way — the
   * alternative is an enumeration oracle on the forgot-password form, which is
   * the same bug as a helpful sign-in error.
   */
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

/** Set a new password for the user arriving from a recovery link. */
export async function updatePassword(password: string): Promise<AuthResult> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return NOT_CONFIGURED;

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}
