/**
 * Auth0 Management API client.
 *
 * Roles and `user_metadata` live in Auth0, not in Postgres, so anything that
 * *writes* them has to go through this. Reads do not: they arrive on the session
 * as claims (see `lib/auth/session.ts`), which is far cheaper than an API call
 * per request.
 *
 * Requires an M2M application with the scopes `read:users`, `update:users`,
 * `read:roles`, `read:role_members`, `create:role_members`, `delete:role_members`.
 *
 * IMPORTANT — role changes are not visible until the user's next login. The
 * roles claim is minted into the ID token at login and then lives in the session
 * cookie; assigning a role does not retroactively alter an issued token. Callers
 * must send the user back through `/auth/login` afterwards. Auth0's SSO session
 * makes that a silent redirect — no credential re-entry — but it is not optional,
 * and skipping it makes a successful assignment look like a failure.
 */

const DOMAIN = process.env.AUTH0_DOMAIN;
const CLIENT_ID = process.env.AUTH0_M2M_CLIENT_ID;
const CLIENT_SECRET = process.env.AUTH0_M2M_CLIENT_SECRET;

/** Thrown when the M2M credentials are absent, so callers can 501 rather than 500. */
export class ManagementNotConfiguredError extends Error {
  constructor() {
    super(
      "Auth0 Management API is not configured. Set AUTH0_M2M_CLIENT_ID and " +
        "AUTH0_M2M_CLIENT_SECRET from a machine-to-machine application authorized " +
        "for the Management API."
    );
    this.name = "ManagementNotConfiguredError";
  }
}

export function isManagementConfigured(): boolean {
  return Boolean(DOMAIN && CLIENT_ID && CLIENT_SECRET);
}

function apiBase(): string {
  return `https://${DOMAIN}/api/v2`;
}

// ─── Token cache ─────────────────────────────────────────────────────────────

let cachedToken: { value: string; expiresAt: number } | null = null;

/**
 * Client-credentials token, cached in module scope.
 *
 * These are valid for 24h and Auth0 meters how many you may mint, so requesting
 * one per call would hit a rate limit under any real traffic. Refreshed a minute
 * early to avoid racing the expiry.
 */
async function getManagementToken(): Promise<string> {
  if (!isManagementConfigured()) throw new ManagementNotConfiguredError();

  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value;
  }

  const res = await fetch(`https://${DOMAIN}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      audience: `${apiBase()}/`,
      grant_type: "client_credentials",
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Auth0 token request failed (${res.status}): ${detail}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    value: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return data.access_token;
}

async function managementFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getManagementToken();
  const res = await fetch(`${apiBase()}${path}`, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Auth0 Management API ${init.method ?? "GET"} ${path} failed (${res.status}): ${detail}`);
  }
  return res;
}

// ─── Roles ───────────────────────────────────────────────────────────────────

interface Auth0Role {
  id: string;
  name: string;
}

let cachedRoles: { value: Auth0Role[]; expiresAt: number } | null = null;

/** Role list, cached for 5 minutes — roles change rarely, users change often. */
async function listRoles(): Promise<Auth0Role[]> {
  if (cachedRoles && cachedRoles.expiresAt > Date.now()) return cachedRoles.value;

  const res = await managementFetch("/roles?per_page=100");
  const body = (await res.json()) as Auth0Role[] | { roles: Auth0Role[] };
  const roles = Array.isArray(body) ? body : body.roles;

  cachedRoles = { value: roles, expiresAt: Date.now() + 5 * 60_000 };
  return roles;
}

/**
 * Resolve a role name to its Auth0 id, case-insensitively.
 *
 * The comparison is deliberately loose: this tenant has a role named `Admin`
 * while the application checks for `admin`, and `lib/auth/session.ts` lowercases
 * incoming role names for exactly that reason. Matching exactly here would mean
 * a role that reads correctly in the dashboard silently fails to resolve.
 */
async function resolveRoleId(roleName: string): Promise<string> {
  const target = roleName.trim().toLowerCase();
  const match = (await listRoles()).find((r) => r.name.trim().toLowerCase() === target);

  if (!match) {
    throw new Error(
      `Auth0 role "${roleName}" does not exist. Create it under User Management → Roles.`
    );
  }
  return match.id;
}

/** Roles currently held by a user, lowercased to match the app's convention. */
export async function getUserRoles(userSub: string): Promise<string[]> {
  const res = await managementFetch(`/users/${encodeURIComponent(userSub)}/roles`);
  const body = (await res.json()) as Auth0Role[] | { roles: Auth0Role[] };
  const roles = Array.isArray(body) ? body : body.roles;
  return roles.map((r) => r.name.trim().toLowerCase());
}

/** Grant a role. Idempotent — Auth0 ignores a role the user already holds. */
export async function assignRole(userSub: string, roleName: string): Promise<void> {
  const roleId = await resolveRoleId(roleName);
  await managementFetch(`/users/${encodeURIComponent(userSub)}/roles`, {
    method: "POST",
    body: JSON.stringify({ roles: [roleId] }),
  });
}

/** Revoke a role. */
export async function removeRole(userSub: string, roleName: string): Promise<void> {
  const roleId = await resolveRoleId(roleName);
  await managementFetch(`/users/${encodeURIComponent(userSub)}/roles`, {
    method: "DELETE",
    body: JSON.stringify({ roles: [roleId] }),
  });
}

// ─── user_metadata ───────────────────────────────────────────────────────────

/**
 * Merge keys into a user's `user_metadata` (surfaced as `user.prefs`).
 *
 * Auth0 shallow-merges the object on PATCH, so keys not mentioned survive — but
 * a key set to `null` is deleted. That is the only way to remove one.
 */
export async function updateUserMetadata(
  userSub: string,
  patch: Record<string, string | null>
): Promise<void> {
  await managementFetch(`/users/${encodeURIComponent(userSub)}`, {
    method: "PATCH",
    body: JSON.stringify({ user_metadata: patch }),
  });
}

/** Read a user's `user_metadata` straight from Auth0, bypassing the session claim. */
export async function getUserMetadata(userSub: string): Promise<Record<string, string>> {
  const res = await managementFetch(
    `/users/${encodeURIComponent(userSub)}?fields=user_metadata&include_fields=true`
  );
  const body = (await res.json()) as { user_metadata?: Record<string, string> };
  return body.user_metadata ?? {};
}
