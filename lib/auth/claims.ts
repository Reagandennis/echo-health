/**
 * Namespaced custom claims injected by the Auth0 post-login Action
 * (`scripts/auth0-roles-action.js`).
 *
 * These live in their own module because BOTH `lib/auth0.ts` (which must
 * whitelist them in `beforeSessionSaved`) and `lib/auth/session.ts` (which reads
 * them) need the values, and `session.ts` already imports `auth0.ts` — putting
 * them in either file would create a cycle.
 *
 * Auth0 silently drops custom claims that are not namespaced with a URL prefix,
 * so the prefix is required, not decorative.
 */

/** User's roles. Surfaced to the app as `user.labels`. */
export const ROLES_CLAIM = "https://echo-health.app/roles";

/** Auth0 `user_metadata`. Surfaced as `user.prefs` (the old Appwrite name). */
export const METADATA_CLAIM = "https://echo-health.app/user_metadata";
