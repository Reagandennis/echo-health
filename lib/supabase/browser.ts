"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseConfig } from "./env";

/**
 * The browser client, cached for the lifetime of the tab.
 *
 * `createBrowserClient` is memoised internally by `@supabase/ssr`, but the
 * module-level cache here also lets every caller share one auth state
 * listener rather than each opening its own.
 *
 * Returns null when Supabase is unconfigured rather than throwing, so a fresh
 * clone with no keys renders the auth pages (which then say what is missing)
 * instead of crashing the React tree.
 */
let cached: SupabaseClient | null | undefined;

export function getSupabaseBrowserClient(): SupabaseClient | null {
  if (cached !== undefined) return cached;

  const config = supabaseConfig();
  cached = config ? createBrowserClient(config.url, config.anonKey) : null;
  return cached;
}
