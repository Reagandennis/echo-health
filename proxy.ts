import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth0 } from "./lib/auth0";
import {
  DEV_SESSION_COOKIE,
  devAuthEnabled,
  devUserFromCookie,
} from "./lib/auth/dev-session";

const PROTECTED_PREFIXES = ["/admin", "/therapist", "/dashboard"];

/**
 * Next 16 renamed the `middleware` convention to `proxy` (deprecated in v16.0.0).
 *
 * Two jobs here:
 *  1. Mount the Auth0 SDK routes (`/auth/login`, `/auth/callback`, `/auth/logout`,
 *     `/auth/profile`, `/auth/access-token`) and roll the session cookie forward.
 *  2. Gate the protected sections on session *presence* only.
 *
 * As before, role-based access (admin/therapist) is enforced in each section's
 * Server Component layout, not here — this stays a cheap cookie check.
 */
/**
 * Log an identity-provider failure once per process rather than per request.
 *
 * A misconfigured provider fails on every single request that reaches this
 * file, which is most of them. Logging each one turns one fact into a flood
 * that buries whatever else is in the log.
 */
let warnedAboutAuthProvider = false;

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  /*
   * ── The identity provider must not be able to 500 the whole pipeline ─────
   *
   * `auth0.middleware()` THROWS when the SDK is not configured —
   * `invalid_configuration`, or `domain_resolution_error` if the domain cannot
   * be resolved. It used to be called unguarded on the first line of this
   * function, which meant a missing `AUTH0_CLIENT_ID` took down **every path
   * this matcher covers**: all of `/api/*`, all three portals, and — least
   * obviously and most damagingly — `/ingest/*`, the reverse proxy that exists
   * so browser analytics can dodge ad-blockers. Removing the Auth0 keys from
   * `.env` produced a site where the marketing pages rendered perfectly (they
   * are excluded from the matcher) and literally everything else returned 500.
   *
   * The public surface staying up while the whole authenticated surface and
   * all telemetry is down is the worst possible shape for this failure,
   * because it looks fine from the outside.
   *
   * So: a provider that cannot answer degrades to "no session" rather than an
   * exception. Routes that need a session still refuse — see below — but
   * everything that does not need one is unaffected. This is also just correct
   * for a provider OUTAGE, not only a misconfiguration: Auth0 being down
   * should not stop analytics or the support chat.
   */
  let authResponse: NextResponse;
  let authProviderAvailable = true;

  try {
    // Serves the /auth/* routes and refreshes the session cookie.
    authResponse = await auth0.middleware(request);
  } catch (error) {
    authProviderAvailable = false;
    authResponse = NextResponse.next();

    if (!warnedAboutAuthProvider) {
      warnedAboutAuthProvider = true;
      console.error(
        "[proxy] The Auth0 SDK could not initialise, so no session can be read " +
          "or refreshed. Sign-in is unavailable and protected routes will " +
          "redirect. Check AUTH0_DOMAIN, AUTH0_CLIENT_ID, AUTH0_CLIENT_SECRET " +
          "and AUTH0_SECRET. Public pages, /api and /ingest are unaffected. " +
          `Underlying error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // The SDK owns /auth/* end to end. Note the trailing slash: a bare "/auth"
  // prefix would also swallow sibling routes like /auth-redirect and silently
  // exempt them from the session check below.
  if (pathname === "/auth" || pathname.startsWith("/auth/")) {
    /*
     * These routes ARE the SDK, so there is nothing to serve without it. A 503
     * with a readable body beats the generic 500 an unguarded throw produced —
     * this is the one place where "the identity provider is not configured" is
     * the honest answer to the request rather than an internal error.
     */
    if (!authProviderAvailable) {
      return new NextResponse(
        "Sign-in is unavailable: the identity provider is not configured on this deployment.",
        { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } }
      );
    }
    return authResponse;
  }

  const isProtectedRoute = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  if (isProtectedRoute) {
    /*
     * A local persona counts as a session.
     *
     * Without this the gate below redirects to `/auth/login`, which on a fresh
     * clone cannot work — AUTH0_CLIENT_ID and friends are unset — so every
     * portal route would bounce to a broken login even with a dev persona
     * chosen. `devUserFromCookie` returns null unless both NODE_ENV is not
     * production (inlined at build time, so this branch is dropped from a
     * production bundle) and DEV_AUTH_ENABLED is exactly "true".
     *
     * This only satisfies the *presence* check. Role enforcement is unchanged
     * and still happens in each section's layout, so a `client` persona
     * reaching `/admin` is refused there exactly as a real client would be.
     */
    if (devAuthEnabled()) {
      const persona = devUserFromCookie(request.cookies.get(DEV_SESSION_COOKIE)?.value);
      if (persona) return authResponse;
    }

    /* `getSession` throws for the same reasons `middleware` did, so it is only
       consulted when the provider actually came up. An unavailable provider
       means no session, which falls through to the redirect below. */
    const session = authProviderAvailable ? await auth0.getSession(request) : null;

    if (!session) {
      const loginUrl = new URL("/auth/login", request.url);
      // Send the user back where they were headed once they authenticate.
      loginUrl.searchParams.set("returnTo", pathname + request.nextUrl.search);

      const redirect = NextResponse.redirect(loginUrl);
      // Carry over any cookies the SDK set (e.g. a rotated session) — the auth
      // response is otherwise discarded when we short-circuit with a redirect.
      for (const cookie of authResponse.cookies.getAll()) {
        redirect.cookies.set(cookie);
      }
      return redirect;
    }
  }

  return authResponse;
}

/**
 * ── What this matcher covers, and why it is shaped like this ───────────────
 *
 * It cannot be narrowed to just the protected sections: `/auth/*` is served by
 * THIS FILE rather than by route files, so excluding it would not merely skip a
 * session check — it would delete `/auth/login`, `/auth/callback` and
 * `/auth/logout`, i.e. all of login. `/admin`, `/therapist` and `/dashboard`
 * must stay covered for the same reason they always were.
 *
 * What it now excludes is the public marketing surface, enumerated from
 * `ALL_INDEXABLE_ROUTES` in `lib/navigation.ts` (plus `/cookies`, which is
 * public but `noindex` and so deliberately absent there). Those routes render
 * static HTML and have no session to read, yet every request to one was paying
 * for `auth0.middleware()` — a cookie decrypt and a possible token refresh —
 * ahead of the response, and the presence of middleware also stops that HTML
 * being cached by a shared CDN. The image and metadata routes go with them for
 * the same reason.
 *
 * Written out as a literal rather than derived from `ALL_INDEXABLE_ROUTES`
 * because Next requires the matcher to be statically analysable — it is read
 * from the compiled module at build time, not evaluated.
 *
 * `(?:$|[/.])` after the alternation keeps each entry a whole path segment:
 * `therapists` must not swallow `/therapist/sessions/1`, and `therapist-jobs`
 * must not swallow `/therapist`. The `.` is Next's RSC transport form of the
 * same route (`/pricing.rsc`), which is matched against this pattern too. The
 * trailing `|$)` excludes the site root, whose remainder after the leading
 * slash is empty.
 *
 * IF YOU ADD A PUBLIC PAGE AND FORGET THIS FILE: nothing breaks. The route
 * still renders; it just keeps running the Auth0 middleware on every request
 * and stays uncacheable — today's behaviour, a missed optimisation rather than
 * a hole. The failure that WOULD matter is the reverse: adding an authenticated
 * route whose first segment collides with one of these prefixes would exempt it
 * from the session gate. Nothing here is a prefix of `/admin`, `/therapist` or
 * `/dashboard`, and new protected sections belong under those.
 */
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|opengraph-image|icon.png|apple-icon.png|(?:about|blog|careers|contact|cookies|couples-therapy|crisis|faq|get-started|guides|how-it-works|individual-therapy|online-therapy|organizations|press|pricing|privacy|reviews|teen-therapy|terms|therapist-jobs|therapists|therapy-for)(?:$|[/.])|$).*)",
  ],
};
