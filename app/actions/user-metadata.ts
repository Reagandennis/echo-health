"use server";

import { getLoggedInUser } from "@/lib/auth/session";
import { isManagementConfigured, updateUserMetadata } from "@/lib/supabase/management";

/**
 * Keys this action is allowed to write.
 *
 * An allowlist, not a passthrough: the patch comes from a client component and
 * `user_metadata` is carried in every access token the user is issued, so a
 * passthrough would let a caller stuff arbitrary keys — or a large payload —
 * into their own tokens.
 *
 * ## ⚠️ Only ever things that describe a preference
 *
 * Nothing here may grant access. `user_metadata` is **writable by its owner**
 * through the browser SDK, so a role or an entitlement stored here would be
 * self-assignable; roles live in `app_metadata`, which needs the service-role
 * key. Adding a key to this list is a decision about what a user may assert
 * about themselves.
 *
 * `full_name` is the session's display name — `lib/auth/session.ts` resolves
 * `name` from `user_metadata.full_name` first, and `signUp` writes it there.
 * It was **missing from this list** while `app/dashboard/settings/page.tsx`
 * sent `name` on every save, so editing your full name produced a "Saved ✓"
 * and discarded the value: the loop below only copies recognised keys, and an
 * unrecognised one is dropped in silence.
 */
const ALLOWED_KEYS = [
  "full_name",
  "plan",
  "sessionType",
  "commStyle",
  "emergencyName",
  "emergencyPhone",
] as const;

const MAX_VALUE_LENGTH = 256;

/**
 * Write to the current user's Supabase `user_metadata`.
 *
 * The read half is `user.prefs` from `getLoggedInUser()`, plus `user.name`
 * for `full_name`.
 *
 * ## The staleness caveat that used to be here no longer applies
 *
 * Under Auth0 this returned `staleUntilNextLogin: true`, and it was true: the
 * values arrived as a custom claim minted at login and cached in the session
 * cookie, so a successful write was invisible until the user logged in again.
 * Callers were told to hold their own local copy to avoid appearing to lose
 * the change.
 *
 * Supabase resolves the session with `getUser()`, which validates against the
 * Auth server and returns the metadata as it now stands — so a write here is
 * visible on the next request. Keeping the old flag would have been a false
 * contract telling callers to distrust a value that is in fact current, and
 * `app/payment/success/page.tsx` already carries a note about the damage that
 * an incorrect assumption here did once.
 *
 * `getLoggedInUser()` is React-`cache`d, so the *current* render still sees
 * the pre-write value. `applied` is returned for that reason: it is what the
 * save just persisted, for a caller updating its own state without a refetch.
 */
export async function updateUserMetadataAction(
  patch: Record<string, string>
): Promise<{ applied: Record<string, string> }> {
  const user = await getLoggedInUser();
  if (!user) throw new Error("Unauthorized");

  if (!isManagementConfigured()) {
    /* Names the variable rather than the vendor. The message said "Auth0
       Management API credentials" for a while after the move to Supabase,
       which sent at least one reader looking for an Auth0 tenant that no
       longer exists. */
    throw new Error(
      "Saving preferences is unavailable: SUPABASE_SERVICE_ROLE_KEY is not configured on the server."
    );
  }

  const applied: Record<string, string> = {};
  for (const key of ALLOWED_KEYS) {
    const value = patch[key];
    if (typeof value === "string") {
      applied[key] = value.slice(0, MAX_VALUE_LENGTH);
    }
  }

  if (Object.keys(applied).length === 0) {
    // Nothing recognised — don't spend an admin API call on a no-op.
    return { applied: {} };
  }

  // The user id comes from the session, never from the caller: this action must
  // not be able to write another user's metadata.
  await updateUserMetadata(user.$id, applied);

  return { applied };
}
