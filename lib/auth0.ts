import { Auth0Client } from "@auth0/nextjs-auth0/server";

/**
 * Auth0 SDK v4 client — the single source of truth for authentication.
 *
 * Configured entirely from env (`AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`,
 * `AUTH0_CLIENT_SECRET`, `AUTH0_SECRET`, `APP_BASE_URL`). The proxy layer in
 * `proxy.ts` mounts the SDK routes: `/auth/login`, `/auth/logout`,
 * `/auth/callback`, `/auth/profile`, `/auth/access-token`.
 */
export const auth0 = new Auth0Client();
