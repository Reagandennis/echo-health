/**
 * Supabase configuration, resolved once and validated loudly.
 *
 * ## Why this is its own module
 *
 * Three different clients need the same two or three variables, and the
 * failure mode of getting them wrong is the one this codebase keeps being
 * bitten by: the app comes up, looks fine, and silently does not work. That
 * has now happened with `NEXT_PUBLIC_POSTHOG_KEY` (analytics off for a project
 * whose token was set under a different name) and with the Auth0 keys being
 * removed (every route behind the proxy returning 500).
 *
 * So the variables are named in one place, read in one place, and a missing
 * one produces a message that says which variable and where to find it.
 */

export interface SupabaseConfig {
  readonly url: string;
  readonly anonKey: string;
}

/**
 * The public pair, safe to ship to the browser.
 *
 * `NEXT_PUBLIC_SUPABASE_ANON_KEY` is *designed* to be public — it identifies
 * the project and carries no privilege of its own. Every authority decision is
 * made by row-level security against the caller's JWT. Do not add the
 * service-role key to this function or to anything a client component imports.
 */
export function supabaseConfig(): SupabaseConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  /* Supabase renamed this in newer dashboards; both spellings are accepted so
     that copying from either the current or the legacy settings page works.
     The alternative is the silent-misconfiguration failure described above. */
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !anonKey) return null;
  return { url, anonKey };
}

export function supabaseConfigured(): boolean {
  return supabaseConfig() !== null;
}

/**
 * The service-role key. **Server only, and it bypasses row-level security.**
 *
 * It is the Supabase equivalent of `echo_admin`: holding it means every policy
 * stops applying. The same rule as `docker/postgres/init/01-roles.sql` applies
 * — never reach for it to make a permission error go away, because the error
 * is telling you a policy is wrong.
 *
 * Used for exactly one thing in this app: writing `app_metadata.roles`, which
 * a user must not be able to write for themselves. See `lib/supabase/admin.ts`.
 */
export function supabaseServiceRoleKey(): string | null {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SECRET_KEY ??
    null
  );
}

/** One message, listing every variable that is missing and where it lives. */
export function describeMissingConfig(): string {
  const missing: string[] = [];
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ) {
    missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  if (missing.length === 0) return "";
  return (
    `Supabase is not configured: ${missing.join(", ")} ${missing.length === 1 ? "is" : "are"} unset. ` +
    `Find them in your Supabase dashboard under Project Settings → API. ` +
    `Add them to .env.local.`
  );
}
