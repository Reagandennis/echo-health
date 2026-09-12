/**
 * Where a user is allowed to land after authenticating.
 *
 * ## Why this is one module rather than three copies
 *
 * Four places now decide a post-authentication destination from something the
 * caller supplied: `/auth/callback` (`?next=`), `/post-login` (`?next=`), and
 * the sign-in / sign-up pages (which forward whatever the proxy handed them).
 * Every one of them is an open-redirect site, and an open redirect on an auth
 * callback is not a nuisance — it is account takeover: a link to
 * `…/auth/callback?next=https://evil.example/signin` authenticates the visitor
 * and then hands them to a look-alike page, arriving from *our* origin with the
 * flow half-finished, which is exactly the state a credential-harvesting page
 * wants its victim in.
 *
 * A security predicate written four times is a security predicate that will
 * disagree with itself. This is the only implementation.
 */

/**
 * Parsing base. Never used as a destination — it exists so a relative path can
 * be parsed by `URL` and then checked for having stayed on that origin.
 * `.invalid` is reserved by RFC 2606 and can never resolve to a real host.
 */
const PARSE_ORIGIN = "https://echo.invalid";

/** Default landing spot: the server-side role router. */
export const POST_LOGIN_PATH = "/post-login";

/**
 * Paths that must never be a post-auth destination, because arriving at one
 * with a brand-new session is either a loop or a dead end: the sign-in and
 * sign-up forms would ask an authenticated user to authenticate, `/auth/callback`
 * has no code left to exchange, and `/auth/signout` would immediately undo the
 * thing that just happened.
 *
 * `/reset-password` is deliberately NOT here — it is the legitimate landing
 * page for a recovery link, and denying it would silently send everyone who
 * clicks "reset my password" to `/post-login` instead of the form that sets
 * one.
 */
const NEVER_REDIRECT_TO = ["/signin", "/signup", "/forgot-password", "/auth/"];

/**
 * Reduce a caller-supplied redirect target to a safe same-origin path, or fall
 * back.
 *
 * Accepts only a root-relative path, and returns `pathname + search` — never a
 * full URL, so the result cannot carry an authority component even if some
 * future caller concatenates it carelessly.
 *
 * @param raw      the untrusted value (`?next=`, `?returnTo=`, …)
 * @param fallback what to return when `raw` is absent or rejected. Pass `""`
 *                 to mean "nothing usable", which is how the callers that
 *                 build a query string distinguish absent from defaulted.
 */
export function safeRedirectPath(
  raw: string | null | undefined,
  fallback: string = POST_LOGIN_PATH
): string {
  if (!raw) return fallback;

  /*
   * `startsWith("/")` alone is the classic bypass. `//evil.example/x` and
   * `/\evil.example/x` are both PROTOCOL-RELATIVE: the browser reads them as a
   * different origin, and the second form exists because browsers normalise a
   * backslash to a forward slash while a naive string check does not.
   */
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) {
    return fallback;
  }

  /*
   * Control characters and whitespace. A raw CR/LF in a value that ends up in a
   * `Location` header is header injection; a tab or newline inside a would-be
   * authority (`/\thttps://evil.example`) is also stripped by some URL parsers
   * and not by others. A legitimate path never contains either literally —
   * percent-encoding is how a space travels.
   */
  if (/[\s\u0000-\u001f\u007f]/.test(raw)) return fallback;

  let parsed: URL;
  try {
    parsed = new URL(raw, PARSE_ORIGIN);
  } catch {
    return fallback;
  }

  // Anything that escaped the parse origin was not the relative path it looked
  // like. Belt and braces over the prefix checks above, not a substitute.
  if (parsed.origin !== PARSE_ORIGIN) return fallback;

  const path = `${parsed.pathname}${parsed.search}`;
  if (NEVER_REDIRECT_TO.some((deny) => parsed.pathname.startsWith(deny))) {
    return fallback;
  }

  return path;
}

/**
 * Build the `/post-login` URL that a sign-in or sign-up should land on.
 *
 * Everything that completes an authentication goes through `/post-login`, for
 * two reasons: it is the single server-side place that routes by role, and it
 * is the ONLY place a completed login is observable in analytics (see the note
 * on `USER_AUTHENTICATED` in `lib/analytics/events.ts`). A deep link that
 * bypassed it — which is what the old `returnTo=/dashboard` flow did — silently
 * stopped being measured.
 *
 * So a deep link is carried *through* it as `?next=`, rather than replacing it.
 *
 * `plan` is forwarded untouched; `/post-login` validates it against the real
 * plan ids before putting it in a redirect.
 *
 * Pure, and takes the search string rather than reading `window`, so it can be
 * unit-tested and called from either a client component or a route handler.
 */
export function postLoginTarget(search: string | URLSearchParams): string {
  const params = typeof search === "string" ? new URLSearchParams(search) : search;
  const out = new URLSearchParams();

  const plan = params.get("plan");
  if (plan) out.set("plan", plan);

  /*
   * `returnTo` is accepted as an alias for `next`. The Auth0-era proxy spelled
   * it that way when bouncing an unauthenticated request off `/auth/login`, and
   * a link or bookmark carrying the old spelling should not quietly lose the
   * destination.
   */
  const next = safeRedirectPath(params.get("next") ?? params.get("returnTo"), "");
  if (next) out.set("next", next);

  const query = out.toString();
  return query ? `${POST_LOGIN_PATH}?${query}` : POST_LOGIN_PATH;
}
