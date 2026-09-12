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
 * ## Why `getUser()` and not `getSession()`
 *
 * Calling `getUser()` is what actually triggers the refresh, because it
 * validates the token against the Auth server and the client rotates it when
 * it is close to expiry. `getSession()` only decodes the cookie locally, so it
 * would never refresh anything.
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
    const { data, error } = await supabase.auth.getUser();
    return { response, hasSession: Boolean(data.user) && !error, available: true };
  } catch {
    /*
     * Supabase unreachable. Reported as available:false so the caller can tell
     * "nobody is signed in" from "we cannot currently tell" — the protected
     * routes treat both as no access, but only one of them is worth a log line.
     */
    return { response, hasSession: false, available: false };
  }
}
