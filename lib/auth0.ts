import { Auth0Client, filterDefaultIdTokenClaims } from "@auth0/nextjs-auth0/server";
import { METADATA_CLAIM, ROLES_CLAIM } from "@/lib/auth/claims";

/**
 * Auth0 SDK v4 client — the single source of truth for authentication.
 *
 * Configured from env (`AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`,
 * `AUTH0_SECRET`, `APP_BASE_URL`). The proxy layer in `proxy.ts` mounts the SDK
 * routes: `/auth/login`, `/auth/logout`, `/auth/callback`, `/auth/profile`,
 * `/auth/access-token`.
 */
export const auth0 = new Auth0Client({
  /**
   * REQUIRED for roles to work. Do not remove.
   *
   * SDK v4 discards every non-standard claim before writing the session:
   *
   *   // dist/server/auth-client.js
   *   session.user = filterDefaultIdTokenClaims(session.user);
   *
   * That filter keeps only sub, name, nickname, given_name, family_name,
   * picture, email, email_verified, org_id and act. Our namespaced roles and
   * user_metadata claims were being set correctly by the post-login Action and
   * then silently dropped here — so `user.labels` was always empty, every
   * `labels.includes("admin")` returned false, and admins were locked out with
   * no error anywhere to explain it.
   *
   * Supplying this hook replaces the default filter entirely, so the standard
   * claims must be re-applied explicitly via `filterDefaultIdTokenClaims`.
   *
   * (v3 preserved all claims; this is a v4 behaviour change.)
   */
  async beforeSessionSaved(session) {
    return {
      ...session,
      user: {
        ...filterDefaultIdTokenClaims(session.user),
        // Defaulted so downstream code sees a consistent shape even when the
        // Action has not run — e.g. a user with no roles yet.
        [ROLES_CLAIM]: session.user[ROLES_CLAIM] ?? [],
        [METADATA_CLAIM]: session.user[METADATA_CLAIM] ?? {},
      },
    };
  },
});
