import { NextResponse } from "next/server";
import {
  DEV_SESSION_COOKIE,
  devAuthEnabled,
  isDevPersona,
} from "@/lib/auth/dev-session";

/**
 * Set or clear the local persona cookie.
 *
 *   GET /api/dev/login?role=admin       → become the admin persona
 *   GET /api/dev/login?role=none        → sign out
 *
 * A GET rather than a POST, deliberately: this is a link you click while
 * poking at the app, and adding CSRF ceremony to a route that cannot exist in
 * production buys nothing. It is not a GET that mutates shared state — it sets
 * a cookie in your own browser.
 *
 * Returns **404** when disabled, not 403. A 403 confirms the route exists and
 * tells a prober there is a bypass here to work on; a 404 is what every other
 * unrouted path returns. See `lib/auth/dev-session.ts` for the two guards.
 */
export async function GET(request: Request) {
  if (!devAuthEnabled()) {
    return new NextResponse("Not found", { status: 404 });
  }

  const role = new URL(request.url).searchParams.get("role");
  const returnTo = new URL(request.url).searchParams.get("returnTo");

  /*
   * Only ever redirect to a path on this origin. `new URL(returnTo, base)`
   * would happily accept "https://evil.example" and turn a dev convenience
   * into an open redirect — harmless here but a bad habit to leave in a file
   * someone may copy.
   */
  const safeReturn = returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//")
    ? returnTo
    : null;

  if (role === "none") {
    const response = NextResponse.redirect(new URL(safeReturn ?? "/dev-login", request.url));
    response.cookies.delete(DEV_SESSION_COOKIE);
    return response;
  }

  /* Narrow into a local const: `isDevPersona(role ?? undefined)` proves
     something about the expression, not about `role`, so TypeScript still
     sees `string | null` at the `cookies.set` below. */
  const persona = role ?? "";
  if (!isDevPersona(persona)) {
    return NextResponse.json(
      { error: "role must be one of: admin, therapist, client, none" },
      { status: 400 }
    );
  }

  /*
   * Loud on every use, because the one risk the build-time guard cannot cover
   * is a dev server on a public tunnel — and `cloudflared/` in this repo says
   * that happens. Whoever is watching the terminal should see this.
   */
  console.warn(
    `[dev-auth] Signed in as the "${persona}" persona. This bypasses Auth0 entirely. ` +
      `If this server is reachable from the internet, unset DEV_AUTH_ENABLED now.`
  );

  const destination =
    safeReturn ??
    (persona === "admin" ? "/admin" : persona === "therapist" ? "/therapist" : "/dashboard");

  const response = NextResponse.redirect(new URL(destination, request.url));
  response.cookies.set(DEV_SESSION_COOKIE, persona, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    /* Session cookie — no maxAge, so closing the browser ends it. One less
       thing left behind on a machine that later gets tunnelled. */
  });
  return response;
}
