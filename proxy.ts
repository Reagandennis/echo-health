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

export const config = {
  // Broad by necessity: /auth/* is served by this proxy rather than by route
  // files, so it cannot be narrowed to just the protected sections.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
