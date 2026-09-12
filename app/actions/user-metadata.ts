"use server";

import { getLoggedInUser } from "@/lib/auth/session";
import { isManagementConfigured, updateUserMetadata } from "@/lib/supabase/management";

/**
 * Keys this action is allowed to write.
 *
 * An allowlist, not a passthrough: the patch comes from a client component, and
 * `user_metadata` is echoed into the ID token by the post-login Action. Without
 * this, a caller could stuff arbitrary keys — or a large payload — into every
 * token the user is subsequently issued.
 */
const ALLOWED_KEYS = [
  "plan",
  "sessionType",
  "commStyle",
  "emergencyName",
  "emergencyPhone",
] as const;

const MAX_VALUE_LENGTH = 256;

/**
 * Write to the current user's Auth0 `user_metadata` — the replacement for
 * Appwrite's `account.updatePrefs()`.
 *
 * The read half is the `METADATA_CLAIM` custom claim, surfaced as `user.prefs`
 * by `getLoggedInUser()`.
 *
 * STALENESS: that claim is minted at login and cached in the session cookie, so
 * a successful write here is NOT reflected in `user.prefs` until the user's next
 * login. Callers that display the value should use their own local state for the
 * remainder of the session rather than re-reading `user.prefs` and appearing to
 * lose the change. Returns the applied patch so callers can do exactly that.
 */
export async function updateUserMetadataAction(
  patch: Record<string, string>
): Promise<{ applied: Record<string, string>; staleUntilNextLogin: true }> {
  const user = await getLoggedInUser();
  if (!user) throw new Error("Unauthorized");

  if (!isManagementConfigured()) {
    throw new Error(
      "Saving preferences is unavailable: Auth0 Management API credentials are not configured."
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
    // Nothing recognised — don't spend a Management API call on a no-op.
    return { applied: {}, staleUntilNextLogin: true };
  }

  // The user id comes from the session, never from the caller: this action must
  // not be able to write another user's metadata.
  await updateUserMetadata(user.$id, applied);

  return { applied, staleUntilNextLogin: true };
}
