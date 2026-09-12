import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  DEV_SESSION_COOKIE,
  devAuthEnabled,
  devUserFromCookie,
} from "./lib/auth/dev-session";
import { refreshSupabaseSession } from "./lib/supabase/proxy-session";
import { supabaseConfigured, describeMissingConfig } from "./lib/supabase/env";

const PROTECTED_PREFIXES = ["/admin", "/therapist", "/dashboard"];

/**
 * Next 16 renamed the `middleware` convention to `proxy` (deprecated in v16.0.0).
 *
 * Two jobs:
 *  1. **Refresh the Supabase session** and write the rotated cookies. This is
 *     not optional — see the note in `lib/supabase/proxy-session.ts`. A Server
 *     Component cannot write cookies, so if this does not run, sessions expire
 *     silently about an hour after sign-in.
 *  2. Gate the protected sections on session *presence*.
 *
 * Role-based access is enforced in each section's Server Component layout, not
 * here. This stays a cheap presence check.
 *
 * ## What replaced what
 *
 * This used to call `auth0.middleware(request)` on its first line, unguarded.
 * Two things came out of that and both are fixed here:
 *
 *  - The Auth0 SDK owned the `/auth/*` routes, so the matcher could never be
 *    narrowed past them. Supabase has no SDK-served routes: `/auth/callback`
 *    and `/auth/signout` are ordinary route handlers in `app/`. The matcher no
 *    longer has to protect a phantom.
 *  - An unconfigured provider **threw**, and because the thrown error escaped
 *    this function it returned 500 for every path the matcher covers: all of
 *    `/api/*`, all three portals, and `/ingest/*` — the reverse proxy browser
 *    analytics goes through. The marketing pages kept working because they are
 *    excluded, which made the site look healthy from outside while everything
 *    behind it was down. Nothing in this file throws now.
 */

/** One line per process. A misconfigured provider fails on every request. */
let warnedAboutProvider = false;

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const { response, hasSession, available } = await refreshSupabaseSession(request);

  if (!available && !warnedAboutProvider) {
    warnedAboutProvider = true;
    console.error(
      `[proxy] No session can be read or refreshed. Sign-in is unavailable and ` +
        `protected routes will redirect. Public pages, /api and /ingest are ` +
        `unaffected. ${supabaseConfigured() ? "Supabase was unreachable." : describeMissingConfig()}`
    );
  }

  const isProtectedRoute = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  if (isProtectedRoute) {
    /*
     * A local dev persona counts as a session. `devUserFromCookie` returns null
     * unless NODE_ENV is not production — inlined by Next, so this branch is
     * dropped from a production bundle — AND `DEV_AUTH_ENABLED` is exactly
     * "true". It satisfies presence only; the role gates in each layout are
     * untouched. See `lib/auth/dev-session.ts`.
     */
    if (devAuthEnabled() && devUserFromCookie(request.cookies.get(DEV_SESSION_COOKIE)?.value)) {
      return response;
    }

    if (!hasSession) {
      const loginUrl = new URL("/signin", request.url);
      /* Send them back where they were headed once authenticated. The value is
         a path from `nextUrl`, so it cannot carry another origin. */
      loginUrl.searchParams.set("next", pathname + request.nextUrl.search);

      const redirect = NextResponse.redirect(loginUrl);
      /* Carry over any cookies the refresh set — the response we are
         discarding is the one holding the rotated session. */
      for (const cookie of response.cookies.getAll()) {
        redirect.cookies.set(cookie);
      }
      return redirect;
    }
  }

  return response;
}

/**
 * ── What this matcher covers, and why ──────────────────────────────────────
 *
 * Everything except the public marketing surface, the static assets and the
 * metadata routes. The protected sections must stay covered for the session
 * gate; everything else that remains is covered so the session gets REFRESHED
 * on ordinary navigation — a user browsing `/api`-backed pages for an hour
 * without ever hitting a protected route still needs their token rotated.
 *
 * The public routes are enumerated from `ALL_INDEXABLE_ROUTES` in
 * `lib/navigation.ts` (plus `/cookies`, which is public but `noindex` and so
 * deliberately absent there). They render static HTML with no session to read,
 * and running middleware on them both costs a round trip and stops that HTML
 * being cached by a shared CDN.
 *
 * Written as a literal rather than derived, because Next reads the matcher
 * from the compiled module at build time and it must be statically analysable.
 *
 * `(?:$|[/.])` keeps each entry a whole path segment: `therapists` must not
 * swallow `/therapist/sessions/1`, and `therapist-jobs` must not swallow
 * `/therapist`. The `.` is Next's RSC transport form (`/pricing.rsc`). The
 * trailing `|$)` excludes the site root.
 *
 * IF YOU ADD A PUBLIC PAGE AND FORGET THIS FILE: nothing breaks — the route
 * renders, it just keeps running the session refresh and stays uncacheable.
 * The failure that WOULD matter is the reverse: a new authenticated route
 * whose first segment collides with one of these prefixes would be exempt from
 * the gate. Nothing here is a prefix of `/admin`, `/therapist` or `/dashboard`,
 * and new protected sections belong under those.
 */
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|opengraph-image|icon.png|apple-icon.png|(?:about|blog|careers|contact|cookies|couples-therapy|crisis|faq|get-started|guides|how-it-works|individual-therapy|online-therapy|organizations|press|pricing|privacy|reviews|teen-therapy|terms|therapist-jobs|therapists|therapy-for)(?:$|[/.])|$).*)",
  ],
};
