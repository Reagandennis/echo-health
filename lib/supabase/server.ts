import "server-only";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseConfig } from "./env";

/**
 * The request-scoped Supabase client for Server Components and route handlers.
 *
 * ## Cookies, and why the write path can throw
 *
 * `@supabase/ssr` keeps the session in cookies and refreshes an expiring
 * access token by writing new ones. Next.js only permits cookie writes from a
 * Server Action or a route handler — a Server Component **rendering** cannot
 * set them, and attempting it throws.
 *
 * That is not a problem to solve here, it is a division of labour: `proxy.ts`
 * refreshes the session on every request and writes the rotated cookies, so by
 * the time a Server Component renders there is a valid token to read. The
 * try/catch below therefore swallows exactly the case where a component tried
 * to write and could not, which is safe *because* the proxy already did it.
 *
 * Remove the proxy's refresh and sessions will appear to work until the first
 * access token expires, then log everyone out with no error anywhere. The two
 * halves are a pair.
 */
export async function createSupabaseServerClient(): Promise<SupabaseClient | null> {
  const config = supabaseConfig();
  if (!config) return null;

  const cookieStore = await cookies();

  return createServerClient(config.url, config.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(toSet) {
        try {
          for (const { name, value, options } of toSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          /* Called from a Server Component render, where Next forbids cookie
             writes. `proxy.ts` has already refreshed and written them — see
             the note above. */
        }
      },
    },
  });
}
