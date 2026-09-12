import "server-only";

import { createSupabaseAdminClient } from "./admin";
import { supabaseServiceRoleKey, supabaseConfig } from "./env";

/**
 * Privileged user administration: roles and metadata.
 *
 * ## A deliberate drop-in for `lib/auth0-management.ts`
 *
 * Same export names, same signatures, same error type. Four call sites depend
 * on this interface — `app/api/user/set-role`, `app/api/admin/therapist-kyc`,
 * `app/api/payments/webhook` and `app/actions/user-metadata` — and every one
 * has non-trivial logic around it that is not worth re-deriving to swap an
 * identity provider. The port is an import change.
 *
 * ## Where roles live, and why it is not negotiable
 *
 * `app_metadata.roles`. Not `user_metadata`.
 *
 * `user_metadata` is writable by its owner: a signed-in client can call
 * `supabase.auth.updateUser({ data: { … } })` from the browser console. Roles
 * there would be self-grantable, and `/admin` is one line of JavaScript away
 * for anyone with an account. `app_metadata` is writable only with the
 * service-role key, which never leaves the server.
 *
 * `lib/auth/session.ts` reads `app_metadata.roles` into `labels`, which is
 * what all ~76 `labels?.includes("admin")` guards consult. That chain — admin
 * client writes `app_metadata`, session reads it, guards check it — is the
 * whole authorisation model.
 *
 * ## Reads are not atomic, and for roles that matters
 *
 * The Auth0 Management API had role endpoints that added and removed
 * individually. Supabase has one `updateUserById`, so adding a role means
 * read-modify-write, which can lose a concurrent change. `assignRole` and
 * `removeRole` therefore re-read immediately before writing and keep the
 * window as small as possible. Two admins granting two different roles to the
 * same user in the same instant could still drop one; role changes are rare
 * and operator-driven, so that is an acceptable trade rather than an
 * unnoticed one. If it ever stops being acceptable, move roles into a table
 * in our own Postgres and read them in `getLoggedInUser`.
 */

export class ManagementNotConfiguredError extends Error {
  constructor() {
    super(
      "Supabase user administration is not configured. Set SUPABASE_SERVICE_ROLE_KEY " +
        "(Project Settings → API → service_role) so roles and user metadata can be " +
        "written. It bypasses row-level security, so it must never be exposed to a " +
        "browser or prefixed NEXT_PUBLIC_."
    );
    this.name = "ManagementNotConfiguredError";
  }
}

/** Whether privileged user writes are possible at all. */
export function isManagementConfigured(): boolean {
  return Boolean(supabaseConfig()) && Boolean(supabaseServiceRoleKey());
}

function requireAdmin() {
  const client = createSupabaseAdminClient();
  if (!client) throw new ManagementNotConfiguredError();
  return client;
}

/** Fetch the raw auth user, or throw. */
async function fetchUser(userId: string) {
  const admin = requireAdmin();
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error) throw new Error(`Could not read user ${userId}: ${error.message}`);
  if (!data.user) throw new Error(`No such user: ${userId}`);
  return data.user;
}

function rolesOf(appMetadata: unknown): string[] {
  const raw = (appMetadata as { roles?: unknown } | null)?.roles;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((r): r is string => typeof r === "string")
    /* Normalised on the way out for the same reason `session.ts` normalises on
       the way in: a role stored as "Admin" fails every lowercase guard and is
       indistinguishable from no role at all. */
    .map((r) => r.trim().toLowerCase())
    .filter(Boolean);
}

export async function getUserRoles(userId: string): Promise<string[]> {
  const user = await fetchUser(userId);
  return rolesOf(user.app_metadata);
}

/** Add `roleName` if absent. Idempotent. */
export async function assignRole(userId: string, roleName: string): Promise<void> {
  const admin = requireAdmin();
  const role = roleName.trim().toLowerCase();

  const user = await fetchUser(userId);
  const roles = rolesOf(user.app_metadata);
  if (roles.includes(role)) return;

  const { error } = await admin.auth.admin.updateUserById(userId, {
    /* Spread the existing `app_metadata`: `updateUserById` REPLACES the object
       it is given rather than merging into it, so omitting the spread would
       silently delete every other key — including any provider bookkeeping
       Supabase keeps there. */
    app_metadata: { ...user.app_metadata, roles: [...roles, role] },
  });
  if (error) throw new Error(`Could not assign role "${role}" to ${userId}: ${error.message}`);
}

/** Remove `roleName` if present. Idempotent. */
export async function removeRole(userId: string, roleName: string): Promise<void> {
  const admin = requireAdmin();
  const role = roleName.trim().toLowerCase();

  const user = await fetchUser(userId);
  const roles = rolesOf(user.app_metadata);
  if (!roles.includes(role)) return;

  const { error } = await admin.auth.admin.updateUserById(userId, {
    app_metadata: { ...user.app_metadata, roles: roles.filter((r) => r !== role) },
  });
  if (error) throw new Error(`Could not remove role "${role}" from ${userId}: ${error.message}`);
}

export async function getUserEmail(userId: string): Promise<string | null> {
  const user = await fetchUser(userId);
  return user.email ?? null;
}

/**
 * Merge into `user_metadata`.
 *
 * Merged rather than replaced, matching the Auth0 Management API's
 * `user_metadata` PATCH semantics that the callers were written against — and
 * because `updateUserById` replaces, so the spread is doing the merging.
 *
 * This is the SELF-WRITABLE store. Never put anything here that grants
 * access; see the note at the top of this file.
 */
export async function updateUserMetadata(
  userId: string,
  metadata: Record<string, string>
): Promise<void> {
  const admin = requireAdmin();
  const user = await fetchUser(userId);

  const { error } = await admin.auth.admin.updateUserById(userId, {
    user_metadata: { ...user.user_metadata, ...metadata },
  });
  if (error) throw new Error(`Could not update metadata for ${userId}: ${error.message}`);
}

export async function getUserMetadata(userId: string): Promise<Record<string, string>> {
  const user = await fetchUser(userId);
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(user.user_metadata ?? {})) {
    /* Declared `Record<string, string>`, and `user_metadata` is arbitrary
       JSON — non-strings are dropped rather than cast, which would put an
       object behind a `string` type and break the caller at runtime. */
    if (typeof value === "string") out[key] = value;
  }
  return out;
}
