import { cache } from "react";
import { cookies } from "next/headers";
import {
  DEV_SESSION_COOKIE,
  devAuthEnabled,
  devUserFromCookie,
} from "@/lib/auth/dev-session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { describeMissingConfig } from "@/lib/supabase/env";

/*
 * The namespaced-claim indirection is gone with Auth0.
 *
 * `lib/auth/claims.ts` existed because the Auth0 SDK's `beforeSessionSaved`
 * hook had to whitelist the custom claim names, and it could not import this
 * file (this file imported it). Supabase puts roles in `app_metadata` on the
 * user object directly, so there is no claim namespace to agree on and no
 * circular import to break — one fewer moving part in the half of the auth
 * setup that used to fail silently.
 */

/**
 * Bootstrap roles by email address, from `ADMIN_EMAILS`, `THERAPIST_EMAILS` and
 * `CLIENT_EMAILS` (each comma-separated).
 *
 * WHY THIS EXISTS. Roles normally arrive in `app_metadata.roles`, which can
 * only be written with the Supabase service-role key.
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
 * `$id` is now the **Supabase user id** — a uuid, e.g.
 * `9f1c…-…`. It remains the canonical `user_id` foreign key in Postgres, which
 * is a `text` column precisely so the identifier's shape is not load-bearing:
 * it held `auth0|…` before this migration and holds a uuid after, and the RLS
 * policies compare it as text either way. Rows written under an Auth0 id stay
 * readable by nothing, because no Supabase user will ever present that id —
 * which is the correct outcome, not a bug to paper over.
 */
export interface SessionUser {
  /** Supabase user id (uuid). Canonical `user_id` foreign key in Postgres. */
  $id: string;
  name: string;
  email: string;
  /** From `app_metadata.roles`. Named `labels` for Appwrite-era parity. */
  labels: string[];
  /** Supabase `user_metadata`, surfaced under the Appwrite-era name `prefs`. */
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
/**
 * One line per process, not one per request.
 *
 * An unconfigured provider fails on every call, and `getLoggedInUser` is
 * called many times per page render — `cache()` dedupes within a request but
 * not across them. Logging each would bury everything else.
 */
let warnedAboutProvider = false;

function logAuthProviderFailure(detail: string): void {
  if (warnedAboutProvider) return;
  warnedAboutProvider = true;
  console.error(
    `[auth] Could not read a session, so every request is being treated as ` +
      `signed out. ${detail}`
  );
}

export const getLoggedInUser = cache(async (): Promise<SessionUser | null> => {
  /*
   * Local personas, checked before Auth0.
   *
   * `devUserFromCookie` returns null unless BOTH `NODE_ENV !== "production"`
   * and `DEV_AUTH_ENABLED === "true"`. The first is inlined by Next at build
   * time, so in a production build this whole branch is dead code the bundler
   * removes — the bypass is not in the artifact, not merely switched off in it.
   * See `lib/auth/dev-session.ts` for the full reasoning.
   *
   * It comes first so that a dev session does not require Auth0 to be
   * configured at all: `auth0.getSession()` below needs AUTH0_CLIENT_ID,
   * AUTH0_CLIENT_SECRET and AUTH0_SECRET, and on a fresh clone none are set.
   */
  if (devAuthEnabled()) {
    const cookieStore = await cookies();
    const devUser = devUserFromCookie(cookieStore.get(DEV_SESSION_COOKIE)?.value);
    if (devUser) return devUser;
  }

  /*
   * ── Reading the session ───────────────────────────────────────────────────
   *
   * `getUser()`, not `getSession()`. The distinction matters: `getSession()`
   * decodes the cookie and hands back whatever it contains, which is fine for
   * "is someone probably signed in" and NOT fine for an authorisation
   * decision — the cookie is attacker-supplied. `getUser()` validates the JWT
   * against the Supabase Auth server.
   *
   * Every role guard in this app hangs off the `labels` returned here, so this
   * has to be the validating call. The cost is a network round trip, which is
   * a real change from Auth0 (a local cookie decrypt) and is why the note on
   * this function no longer claims `null` can never mean "provider
   * unreachable". It can, and that is handled below.
   */
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    logAuthProviderFailure(describeMissingConfig());
    return null;
  }

  /*
   * Failing CLOSED on an unreachable provider.
   *
   * Returning null means "signed out", and because every guard is
   * `labels?.includes(...)`, signed out means no access. So a Supabase outage
   * degrades to everyone being locked out of the portals rather than anyone
   * being let into the wrong one. That is the correct direction for this
   * trade: a therapist seeing an error beats a client seeing a therapist's
   * caseload.
   *
   * What must NOT happen is a throw. This function has ~89 call sites
   * including `/api/me`, which `UserProvider` probes on every page load, so an
   * unguarded rejection turns a provider blip into a 500 on every route —
   * which is exactly what removing the Auth0 keys did before this migration.
   */
  let authUser;
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      /*
       * An expired or absent session is the ordinary case, not a failure, and
       * must not be logged as one — every anonymous visitor to the home page
       * hits this branch.
       *
       * Two signals are needed, because Supabase does not use one
       * consistently. A rejected token comes back with an HTTP 401/403. But
       * simply having NO session at all raises `AuthSessionMissingError` with
       * **no status field**, so a status-only check logged
       * "Could not read a session … Auth session missing!" on ordinary
       * anonymous traffic — the exact log noise this guard exists to prevent,
       * and worse than silence because it reads like a misconfiguration.
       */
      const status = (error as { status?: number }).status;
      const isOrdinaryNoSession =
        status === 401 ||
        status === 403 ||
        error.name === "AuthSessionMissingError" ||
        /session (missing|not found)|missing sub claim/i.test(error.message);

      if (!isOrdinaryNoSession) {
        logAuthProviderFailure(`Supabase returned: ${error.message}`);
      }
      return null;
    }
    authUser = data.user;
  } catch (error) {
    logAuthProviderFailure(
      `Supabase was unreachable: ${error instanceof Error ? error.message : String(error)}`
    );
    return null;
  }

  if (!authUser) return null;

  /*
   * ── Roles come from `app_metadata`, never `user_metadata` ────────────────
   *
   * This is the authorisation model in one line, and getting it wrong is a
   * privilege-escalation bug rather than a style choice:
   *
   *   • `user_metadata` is writable by its owner. A client could call
   *     `updateUser({ data: { roles: ["admin"] } })` from the browser console
   *     and grant themselves the admin portal.
   *   • `app_metadata` is writable only with the service-role key, which never
   *     leaves the server. See `lib/supabase/admin.ts`.
   *
   * So `labels` reads `app_metadata.roles` and `prefs` reads `user_metadata`.
   * Never swap them. Never merge them.
   */
  const appMetadata = (authUser.app_metadata ?? {}) as Record<string, unknown>;
  const rawRoles = appMetadata.roles;

  const labels = Array.isArray(rawRoles)
    ? rawRoles
        .filter((role): role is string => typeof role === "string")
        /* Lowercased on read, for the same reason the Auth0 version did it:
           a role typed "Admin" in a dashboard arrives as "Admin" and silently
           fails every `labels.includes("admin")` guard, which is
           indistinguishable from having no role at all. */
        .map((role) => role.trim().toLowerCase())
        .filter(Boolean)
    : [];

  const userMetadata = (authUser.user_metadata ?? {}) as Record<string, unknown>;

  const email = (typeof userMetadata.email === "string" ? userMetadata.email : authUser.email) ?? "";
  const emailVerified = Boolean(authUser.email_confirmed_at);

  /*
   * Bootstrap escape hatch — unchanged in spirit, and still gated on a
   * VERIFIED email. That check is what keeps it from being a backdoor: without
   * it, anyone signing up through a connection that does not verify email
   * could claim a listed address and inherit the role.
   */
  if (emailVerified) {
    for (const role of bootstrapRolesFor(email.trim().toLowerCase())) {
      if (!labels.includes(role)) labels.push(role);
    }
  }

  const name =
    (typeof userMetadata.full_name === "string" && userMetadata.full_name) ||
    (typeof userMetadata.name === "string" && userMetadata.name) ||
    email ||
    "";

  /* `prefs` is declared `Record<string, string>`, and `user_metadata` is
     arbitrary JSON — so non-string values are dropped rather than cast, which
     would put objects behind a `string` type and break callers at runtime. */
  const prefs: Record<string, string> = {};
  for (const [key, value] of Object.entries(userMetadata)) {
    if (typeof value === "string") prefs[key] = value;
  }

  return {
    $id: authUser.id,
    name,
    email,
    labels,
    prefs,
    picture:
      typeof userMetadata.avatar_url === "string"
        ? userMetadata.avatar_url
        : typeof userMetadata.picture === "string"
          ? userMetadata.picture
          : undefined,
    emailVerification: emailVerified,
  };
});

export function hasRole(user: SessionUser | null, role: string): boolean {
  return Boolean(user?.labels.includes(role));
}
