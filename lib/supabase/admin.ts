import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseConfig, supabaseServiceRoleKey } from "./env";

/**
 * The service-role client. **Bypasses row-level security entirely.**
 *
 * This is the Supabase counterpart of connecting as `echo_admin`, and the
 * warning in `docker/postgres/init/01-roles.sql` applies word for word: a
 * client holding this key is not subject to any policy, so reaching for it to
 * clear a permission error hides the bug rather than fixing it.
 *
 * ## It exists for one job
 *
 * Writing `app_metadata`, which is where roles live. That placement is the
 * whole security model for authorisation:
 *
 *   - `user_metadata` is writable by the user who owns it. Roles there would
 *     be self-grantable — any client could make themselves an admin with one
 *     call from the browser console.
 *   - `app_metadata` is writable **only** with this key, which never leaves
 *     the server.
 *
 * So: roles are read from `app_metadata.roles` and written only here. If you
 * find yourself putting a role in `user_metadata`, stop.
 *
 * `persistSession: false` because this client has no user and no cookies to
 * keep; it is a privileged API caller, not a session.
 */
export function createSupabaseAdminClient(): SupabaseClient | null {
  const config = supabaseConfig();
  const serviceKey = supabaseServiceRoleKey();
  if (!config || !serviceKey) return null;

  return createClient(config.url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
