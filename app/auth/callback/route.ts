import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

import { POST_LOGIN_PATH, safeRedirectPath } from "@/lib/auth/safe-redirect";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * The one place a Supabase auth link turns into a session.
 *
 * Three flows land here, and they are the same exchange with different names:
 *  - Google (and any future OAuth provider) returning from the consent screen;
 *  - the "confirm your email" link from sign-up;
 *  - the "set a new password" link from `/forgot-password`.
 *
 * Under Auth0 this path was served by `auth0.middleware()` from `proxy.ts`
 * rather than by a route file. It is a real route now, which is why `proxy.ts`
 * must not claim `/auth/*` for itself any more — if it does, this handler never
 * runs and every sign-in ends on a blank page.
 *
 * ## Cookies
 *
 * `exchangeCodeForSession` writes the session cookies through the adapter in
 * `lib/supabase/server.ts`. Writing them is only legal in a Server Function or
 * a Route Handler — this is the Route Handler — and Next merges those
 * `Set-Cookie` headers into whatever response we return, including a redirect.
 */

/** The `type` values a Supabase email link may carry. */
const EMAIL_OTP_TYPES = [
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
] as const satisfies readonly EmailOtpType[];

/**
 * Failures are reported to `/signin` as a SHORT CODE, never as the provider's
 * own `error_description`.
 *
 * That text is attacker-influenceable and would be rendered in a banner on our
 * own origin, on the page where the next thing the visitor does is type a
 * password — a free slot for "your account is locked, call this number". The
 * sign-in page maps these codes to its own copy.
 */
type FailureCode =
  | "link_invalid"
  | "link_expired"
  | "oauth_failed"
  | "access_denied"
  | "not_configured";

function failed(request: NextRequest, code: FailureCode): NextResponse {
  const url = new URL("/signin", request.nextUrl.origin);
  url.searchParams.set("error", code);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const params = request.nextUrl.searchParams;

  /*
   * ── The open-redirect guard ──────────────────────────────────────────────
   *
   * `next` is attacker-supplied: this URL is emailed, and a crafted one is a
   * link that authenticates the visitor on the real site and then hands them
   * to a look-alike, arriving from our own origin mid-flow. That is account
   * takeover, not a nuisance redirect.
   *
   * `safeRedirectPath` accepts only a root-relative path — rejecting `//host`
   * and `/\host`, which browsers read as another origin — and returns
   * `pathname + search`, so the value used below can never carry an authority
   * even by accident. Anything else becomes `/post-login`.
   */
  const next = safeRedirectPath(params.get("next"), POST_LOGIN_PATH);

  /*
   * Supabase reports a refused or expired link by redirecting here with its own
   * error params. Mapped before anything else, because there is no code to
   * exchange in that case and falling through would report the wrong thing.
   *
   * (Only the PKCE flow puts these in the query string. The implicit flow puts
   * them in the fragment, which never reaches a server — that case surfaces as
   * "this link has expired" on `/reset-password`, which finds no session.)
   */
  const errorCode = params.get("error_code");
  const providerError = params.get("error") ?? errorCode;
  if (providerError) {
    // An expired one-time link arrives as `access_denied` + `otp_expired`, so
    // the specific code has to be read before the generic one.
    if (errorCode === "otp_expired") return failed(request, "link_expired");
    if (providerError === "access_denied") return failed(request, "access_denied");
    return failed(request, "oauth_failed");
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    // No keys on this deployment. `/signin` renders `describeMissingConfig()`,
    // which names the variables — better than a 500 nobody can act on.
    return failed(request, "not_configured");
  }

  const code = params.get("code");
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    /*
     * The usual cause is not an attack: the PKCE code verifier lives in a
     * cookie belonging to the browser that STARTED the flow, so a link opened
     * in a different browser (or after the cookie was cleared) cannot complete.
     * `/signin` says exactly that rather than "something went wrong".
     */
    if (error) return failed(request, "link_invalid");
    return NextResponse.redirect(new URL(next, request.nextUrl.origin));
  }

  /*
   * The other email-link shape: `?token_hash=&type=`, which Supabase's newer
   * templates emit in place of a code. Handled because which one arrives
   * depends on the email templates configured in the dashboard, not on
   * anything in this repo — and a callback that only understands one of them
   * breaks the day someone edits a template.
   */
  const tokenHash = params.get("token_hash");
  const type = params.get("type");
  if (tokenHash && type) {
    // Validated against the allowlist: `EmailOtpType` widens to `string`, so
    // the type checker will not do this for us.
    if (!(EMAIL_OTP_TYPES as readonly string[]).includes(type)) {
      return failed(request, "link_invalid");
    }

    const { error } = await supabase.auth.verifyOtp({
      type: type as EmailOtpType,
      token_hash: tokenHash,
    });
    if (error) return failed(request, "link_invalid");
    return NextResponse.redirect(new URL(next, request.nextUrl.origin));
  }

  // Nothing to exchange — a bare visit, a bookmarked callback, or a link that
  // lost its query string somewhere in an email client.
  return failed(request, "link_invalid");
}
