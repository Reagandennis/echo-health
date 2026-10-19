import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseConfig } from "./env";

/**
 * Refresh the Supabase session and write the rotated cookies onto the response.
 *
 * ## This is one half of a pair. Do not remove it.
 *
 * Supabase access tokens are short-lived and refreshed by exchanging a refresh
 * token for a new pair. Next.js only permits cookie writes from a Server
 * Action, a route handler, or middleware — **a Server Component rendering
 * cannot set cookies**. So `lib/supabase/server.ts` swallows write failures,
 * and this function is why that is safe: it runs on every request the proxy
 * matcher covers and does the writing.
 *
 * Delete this and sessions appear to work perfectly until the first access
 * token expires — roughly an hour in — and then everyone is signed out with no
 * error logged anywhere. That is a bad afternoon.
 *
 * ## Why `getClaims()` here, while `getLoggedInUser()` keeps `getUser()`
 *
 * This function answers one question — "is there a session to refresh and
 * gate on?" — and it runs on EVERY covered request: every portal navigation,
 * every Server Action POST, every `/api/*` call. It used to call `getUser()`,
 * a ~100 ms network round trip to the Auth server, and then the layout or
 * action that handled the request called `getUser()` AGAIN through
 * `getLoggedInUser()`. Two round trips for one answer.
 *
 * `getClaims()` verifies the JWT's signature locally against the project's
 * published JWKS (fetched once and cached ten minutes per process) and checks
 * its expiry, so a forged or tampered cookie is still rejected here. It loads
 * the session the same way `getUser()` does, so an expiring token is still
 * refreshed and the rotated cookies still written — the pair described above
 * is intact.
 *
 * What it does NOT do is ask the Auth server whether the session has been
 * revoked since the token was issued. That is deliberate and safe HERE
 * because this is a presence gate, not an authorization decision: every
 * authorization decision still goes through `getLoggedInUser()`, which still
 * calls `getUser()` and still fails closed. A revoked-but-unexpired token
 * passes this gate and is then refused by the layout or action behind it,
 * exactly as before. `getSession()` would be wrong here for the reason the
 * session helper gives: it believes the cookie without checking anything.
 *
 * Precondition: the project signs tokens with an asymmetric key (ES256 is
 * published at `/auth/v1/.well-known/jwks.json`). With a legacy HS256 key the
 * SDK silently falls back to a `getUser()` round trip — correct, just no
 * faster.
 */
export async function refreshSupabaseSession(
  request: NextRequest
): Promise<{ response: NextResponse; hasSession: boolean; available: boolean }> {
  const config = supabaseConfig();

  /* Unconfigured is not an error here. It means no session, and the caller
     decides what to do about a protected route. */
  if (!config) {
    return { response: NextResponse.next({ request }), hasSession: false, available: false };
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(config.url, config.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(toSet) {
        /*
         * Written to BOTH the request and the response, which looks redundant
         * and is not. The request copy is what a Server Component rendering
         * later in this same request will read — without it, the component
         * sees the stale pre-refresh cookie and resolves a session that has
         * just been rotated out. The response copy is what reaches the
         * browser for the next request.
         */
        for (const { name, value } of toSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of toSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  try {
    const { data, error } = await supabase.auth.getClaims();
    return { response, hasSession: Boolean(data?.claims) && !error, available: true };
  } catch {
    /*
     * Supabase unreachable. Reported as available:false so the caller can tell
     * "nobody is signed in" from "we cannot currently tell" — the protected
     * routes treat both as no access, but only one of them is worth a log line.
     */
    return { response, hasSession: false, available: false };
  }
}
