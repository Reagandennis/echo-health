import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth0 } from "./lib/auth0";

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
export async function proxy(request: NextRequest) {
  // Must run first: it both serves the /auth/* routes and refreshes the session.
  const authResponse = await auth0.middleware(request);

  const { pathname } = request.nextUrl;

  // The SDK owns /auth/* end to end. Note the trailing slash: a bare "/auth"
  // prefix would also swallow sibling routes like /auth-redirect and silently
  // exempt them from the session check below.
  if (pathname === "/auth" || pathname.startsWith("/auth/")) {
    return authResponse;
  }

  const isProtectedRoute = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  if (isProtectedRoute) {
    const session = await auth0.getSession(request);

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
