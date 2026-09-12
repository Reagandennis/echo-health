import type { SessionUser } from "./session";

/**
 * ── Local sign-in without Auth0 ────────────────────────────────────────────
 *
 * ## Why this exists
 *
 * Authentication is Auth0 Universal Login. The app never sees a password —
 * `lib/auth/client.ts` is three redirects, and there is deliberately no
 * `signIn(email, password)` anywhere. Accounts live in the Auth0 tenant, not in
 * Postgres.
 *
 * So on a fresh clone there is no way to look at `/admin`, `/therapist` or
 * `/dashboard` at all. You cannot be given a test login, because there is
 * nowhere for one to live: you would first need an Auth0 tenant, an
 * application, callback URLs, the post-login Action from
 * `scripts/auth0-roles-action.js` deployed, and roles assigned in the
 * dashboard. That is the right setup for anything real and far too much
 * ceremony to look at a page.
 *
 * This mints a synthetic session for one of three fixed personas instead.
 *
 * ## THE GUARDS — read before changing anything here
 *
 * This is an authentication bypass. Treated carelessly it is the worst
 * possible bug in the repository, so it is gated twice, independently:
 *
 *   1. `process.env.NODE_ENV === "production"` → off. Next **inlines**
 *      `NODE_ENV` at build time, so in a production build this is the literal
 *      `if ("production" === "production") return false`, and every line below
 *      is dead code the bundler drops. It is not a runtime check that could be
 *      subverted by a mis-set variable; the capability is not in the artifact.
 *
 *   2. `DEV_AUTH_ENABLED === "true"` → an explicit, exact opt-in. Not "truthy",
 *      not "1", not merely present. Absent means off.
 *
 * Both must hold. `/api/dev/login` and `/dev-login` return 404 when they do
 * not — not 403, so a probe cannot distinguish "disabled" from "not built".
 *
 * ## The one risk this does NOT eliminate
 *
 * `npm run dev` served over a public tunnel — and `cloudflared/` in this repo
 * says that happens — with `DEV_AUTH_ENABLED=true` set, means anyone who
 * reaches `/dev-login` becomes an admin. NODE_ENV is "development" there, so
 * guard 1 does not fire. Nothing in code can distinguish that from a laptop.
 *
 * If you tunnel a dev server, unset `DEV_AUTH_ENABLED` first. Every use logs a
 * warning saying so.
 */

/** The cookie holding the chosen persona. Plain, unsigned — it is dev-only. */
export const DEV_SESSION_COOKIE = "echo_dev_persona";

export function devAuthEnabled(): boolean {
  /* Order matters only for readability; both are required. */
  if (process.env.NODE_ENV === "production") return false;
  return process.env.DEV_AUTH_ENABLED === "true";
}

/**
 * The three personas.
 *
 * `$id` is shaped like a real Auth0 `sub` because it IS the `user_id` foreign
 * key throughout Postgres — `profiles.user_id`, `therapists.user_id`,
 * `journal_entries.user_id` — and RLS policies compare it against
 * `app_user_id()`. A persona whose id does not match the seeded rows would sign
 * in successfully and then show an empty portal, which looks like a broken app
 * rather than missing data.
 *
 * `dev-therapist` deliberately reuses the first seeded therapist's `user_id`
 * (`scripts/db-seed-dev.mjs`) so the therapist portal finds a real profile with
 * specialties and a bio rather than a half-built one.
 *
 * `emailVerification: true` matters: the bootstrap role hatch in `session.ts`
 * requires a verified email, and several places in the app gate on it.
 */
export const DEV_PERSONAS = {
  admin: {
    $id: "auth0|dev-admin",
    name: "Dev Admin",
    email: "dev-admin@localhost.test",
    labels: ["admin"],
    prefs: {},
    emailVerification: true,
  },
  therapist: {
    $id: "auth0|seed-therapist-1",
    name: "Dr. Wanjiru Kamau",
    email: "dev-therapist@localhost.test",
    labels: ["therapist"],
    prefs: {},
    emailVerification: true,
  },
  client: {
    $id: "auth0|dev-client",
    name: "Dev Client",
    email: "dev-client@localhost.test",
    labels: ["client"],
    prefs: {},
    emailVerification: true,
  },
} as const satisfies Record<string, SessionUser>;

export type DevPersona = keyof typeof DEV_PERSONAS;

export function isDevPersona(value: string | undefined): value is DevPersona {
  return value === "admin" || value === "therapist" || value === "client";
}

/**
 * Resolve the persona from a cookie value, or null.
 *
 * Takes the raw string rather than reading cookies itself so the same function
 * serves both a Server Component (via `next/headers`) and `proxy.ts` (via
 * `NextRequest.cookies`), which have different cookie APIs.
 */
export function devUserFromCookie(value: string | undefined): SessionUser | null {
  if (!devAuthEnabled()) return null;
  if (!isDevPersona(value)) return null;
  return DEV_PERSONAS[value];
}
