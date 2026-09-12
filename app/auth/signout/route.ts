import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Sign out. **POST only, and that is not a style choice.**
 *
 * The Auth0 equivalent was `/auth/logout`, reached by a plain `window.location`
 * navigation — i.e. a GET. A GET sign-out is a hole in two directions:
 *
 *  1. **CSRF.** Any page anywhere can embed `<img src="…/auth/logout">` and
 *     sign our users out. Harmless-sounding until it happens to a therapist
 *     mid-session, or is used to interrupt someone repeatedly.
 *  2. **Prefetch.** Next's router prefetches links, and so do browsers, mail
 *     clients and link scanners. A GET endpoint that mutates state can be
 *     fired by something merely *looking* at a link to it.
 *
 * Unlisted methods get a 405 from Next automatically, so GET fails closed.
 * Callers must submit a form or `fetch(…, { method: "POST" })`.
 */

/**
 * Reject a cross-site POST. Browsers send `Origin` on every POST, so a mismatch
 * is a genuine cross-site submission; an ABSENT header is allowed because
 * non-browser clients (and some older ones) omit it, and refusing those would
 * break sign-out for them without closing anything a browser can exploit.
 */
function isCrossSite(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host !== request.nextUrl.host;
  } catch {
    // An unparseable Origin is not a same-origin one.
    return true;
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (isCrossSite(request)) {
    return NextResponse.json({ error: "Cross-site sign-out refused." }, { status: 403 });
  }

  const supabase = await createSupabaseServerClient();

  if (supabase) {
    try {
      /*
       * Default scope (`local`) — this session only. `global` would revoke every
       * refresh token on the account, which sounds tidier and is wrong here: a
       * client signing out of their phone must not be kicked out of the laptop
       * they left a session open on. The place a global revoke DOES belong is a
       * password reset, and `/reset-password` does it there.
       */
      const { error } = await supabase.auth.signOut();
      if (error) {
        /*
         * Not fatal, and the cookie clearing below is why. An expired or
         * already-revoked refresh token makes this call fail while the browser
         * still holds cookies — returning an error there would leave the user
         * looking signed in with no way to fix it.
         */
        console.warn("[auth] Supabase sign-out reported:", error.message);
      }
    } catch (error) {
      console.warn(
        "[auth] Supabase sign-out threw; clearing cookies anyway:",
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /*
   * Clear the session cookies unconditionally.
   *
   * `signOut()` normally removes them through the adapter, but it cannot when
   * it failed above or when Supabase is unconfigured — and the state that
   * actually keeps someone signed in is the cookie, not the row in Supabase's
   * session table. Access tokens are self-contained JWTs, so a leftover cookie
   * is a live session until it expires.
   *
   * Every Supabase cookie is prefixed `sb-`, including the numbered chunks a
   * large token is split across (`sb-…-auth-token.0`, `.1`) and the PKCE
   * verifier, so the prefix is the correct sweep rather than a guess at names.
   */
  const cookieStore = await cookies();
  for (const cookie of cookieStore.getAll()) {
    if (cookie.name.startsWith("sb-")) cookieStore.delete(cookie.name);
  }

  /*
   * 303, not the default 307. A 307 preserves the method, so the browser would
   * POST to `/` and get a 405 from the page route. 303 is the status that means
   * "your POST is done, now GET this instead".
   */
  return NextResponse.redirect(new URL("/", request.nextUrl.origin), 303);
}
