import { cache } from "react";
import { auth0 } from "@/lib/auth0";
import { METADATA_CLAIM, ROLES_CLAIM } from "@/lib/auth/claims";

// Claim names live in their own module so `lib/auth0.ts` can whitelist them in
// `beforeSessionSaved` without importing this file (which imports it).
export { ROLES_CLAIM, METADATA_CLAIM } from "@/lib/auth/claims";

/**
 * Bootstrap roles by email address, from `ADMIN_EMAILS`, `THERAPIST_EMAILS` and
 * `CLIENT_EMAILS` (each comma-separated).
 *
 * WHY THIS EXISTS. Roles normally arrive in the `ROLES_CLAIM` above, which needs
 * the post-login Action deployed and a role assigned in the Auth0 dashboard.
 * That is a chicken-and-egg problem on a fresh tenant: you cannot reach `/admin`
 * to administer anything until someone is already an admin. The self-serve paths
 * that would otherwise grant `client` (`/api/user/set-role`) and `therapist`
 * (KYC approval) both require Management API credentials that are not configured
 * yet, so without this there is no way to obtain any role at all.
 *
 * SECURITY NOTES — read before changing:
 *  • `email_verified` is required. Without it, anyone could sign up through a
 *    connection that does not verify email, claim one of these addresses, and
 *    inherit the role. That check is what makes this safe rather than a backdoor.
 *  • Comparison is case-insensitive and trimmed; Auth0 does not normalise email
 *    casing across connections.
 *  • Additive only — it never removes a role that came from the real claim.
 *
 * This is a development and bootstrap mechanism. Unset these once real roles are
 * assigned in Auth0: an env var that grants `admin` is not something to leave
 * sitting in a production environment.
 */
const BOOTSTRAP_ROLE_ENV: ReadonlyArray<[string, string]> = [
  ["admin", "ADMIN_EMAILS"],
  ["therapist", "THERAPIST_EMAILS"],
  ["client", "CLIENT_EMAILS"],
];

function bootstrapRolesFor(email: string): string[] {
  if (!email) return [];

  return BOOTSTRAP_ROLE_ENV.filter(([, envVar]) =>
    (process.env[envVar] ?? "")
      .split(",")
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean)
      .includes(email)
  ).map(([role]) => role);
}

/**
 * The application's user shape.
 *
 * Deliberately mirrors the Appwrite `Models.User` fields the codebase already
 * relies on (`$id`, `name`, `email`, `labels`) so that the ~89 existing
 * `getLoggedInUser()` call sites and the role guards spelled
 * `user.labels?.includes("admin")` keep working unchanged after the Auth0
 * migration.
 *
 * `$id` is the Auth0 `sub` (e.g. `auth0|68f…`, `google-oauth2|1179…`) and is the
 * canonical user identifier written into Appwrite documents as `userId`.
 */
export interface SessionUser {
  /** Auth0 `sub`. Canonical user ID / foreign key into Appwrite documents. */
  $id: string;
  name: string;
  email: string;
  /** Roles from the Auth0 custom claim. Named `labels` for Appwrite parity. */
  labels: string[];
  /** Auth0 `user_metadata`, surfaced under the Appwrite-era name `prefs`. */
  prefs: Record<string, string>;
  picture?: string;
  emailVerification: boolean;
}

/**
 * Returns the logged-in user, or `null` when there is no valid session.
 *
 * Cached per-request via React `cache()` so repeated calls within one render
 * pass are free. Unlike the Appwrite implementation this replaced, resolving a
 * session is a local cookie decrypt with no network round-trip — so a `null`
 * here means "no valid session", never "the auth provider was unreachable".
 */
export const getLoggedInUser = cache(async (): Promise<SessionUser | null> => {
  const session = await auth0.getSession();
  const user = session?.user;

  if (!user?.sub) return null;

  const claim = user[ROLES_CLAIM];
  const labels = Array.isArray(claim)
    ? claim
        .filter((role): role is string => typeof role === "string")
        // Normalised to lowercase. Auth0 returns role names exactly as typed in
        // the dashboard, so a role created as "Admin" arrives as "Admin" and
        // silently fails every `labels.includes("admin")` guard in the app —
        // which looks identical to having no role at all. Normalising here means
        // the dashboard's capitalisation stops being load-bearing.
        .map((role) => role.trim().toLowerCase())
        .filter(Boolean)
    : [];

  // Bootstrap escape hatch — see `bootstrapRolesFor` above. Verified email only,
  // so a listed address cannot be claimed by someone who does not own it.
  const email = ((user.email as string) ?? "").trim().toLowerCase();
  if (user.email_verified) {
    for (const role of bootstrapRolesFor(email)) {
      if (!labels.includes(role)) labels.push(role);
    }
  }

  const metadata = user[METADATA_CLAIM];
  const prefs =
    metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? (metadata as Record<string, string>)
      : {};

  return {
    $id: user.sub,
    name: (user.name as string) ?? (user.nickname as string) ?? (user.email as string) ?? "",
    email: (user.email as string) ?? "",
    labels,
    prefs,
    picture: user.picture as string | undefined,
    emailVerification: Boolean(user.email_verified),
  };
});

/** True when the user holds the given role. */
export function hasRole(user: SessionUser | null, role: string): boolean {
  return Boolean(user?.labels.includes(role));
}
