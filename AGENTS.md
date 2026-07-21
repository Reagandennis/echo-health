<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Echo Health — agent guide

This file is the single source of truth for AI agents working in this repo. `CLAUDE.md` transcludes it via `@AGENTS.md`.

## Critical: Next.js version

This project runs **Next.js 16.2.6 with React 19.2.4** — APIs and conventions differ from older versions you may have been trained on. Before writing any non-trivial Next.js code (routing, server actions, instrumentation, caching, headers/cookies APIs), read the relevant guide under `node_modules/next/dist/docs/` and heed deprecation notices.

Note in particular that **`middleware.ts` was deprecated in v16.0.0 and renamed to `proxy.ts`** — this repo uses `proxy.ts`, and the exported function is `proxy`, not `middleware`.

## Commands

```bash
npm run dev              # next dev --webpack, with NODE_OPTIONS raising the heap to 6 GB
npm run dev:turbo        # next dev (turbopack) — faster, but the project defaults to webpack
npm run build            # next build
npm run start            # next start (production)
npm run lint             # eslint (flat config, eslint-config-next)
npm test                 # jest (jsdom)
npm run test:watch
npm run test:coverage
npx jest path/to/file    # run a single test file
npx jest -t "name"       # run tests matching a name

# Database (Drizzle + Postgres on Azure)
npm run db:generate      # generate a migration from lib/db/schema.ts
npm run db:migrate       # apply pending migrations
npm run db:studio        # browse the database

# `db:generate` is --custom on purpose. See the warning below before using
# `db:generate:auto`.
npm run db:generate -- --name=<name>
```

TypeScript path alias: `@/*` → repo root (e.g. `@/lib/db/schema`).

## Architecture

Echo Health is a teletherapy platform with three user surfaces — **clients** (`app/dashboard/`), **therapists** (`app/therapist/`), and **admins** (`app/admin/`) — built on the App Router. Auth is Auth0; the database is Postgres (Azure) via Drizzle; analytics is PostHog; video is self-managed WebRTC over Cloudflare Calls (SFU) + Cloudflare TURN; transactional email is Resend (`lib/email.ts`).

### Auth & authorization (Auth0 Universal Login, role-in-layout)

**Authentication is Auth0.** `@auth0/nextjs-auth0` v4 — note v4 is a rewrite of v3, and its routes live at `/auth/*`, not `/api/auth/*`.

- `lib/auth0.ts` exports the `Auth0Client`, configured from `AUTH0_DOMAIN` / `AUTH0_CLIENT_ID` / `AUTH0_CLIENT_SECRET` / `AUTH0_SECRET` / `APP_BASE_URL`.
- `proxy.ts` (**not** `middleware.ts` — Next 16 deprecated and renamed that convention) mounts the SDK routes `/auth/login`, `/auth/logout`, `/auth/callback`, `/auth/profile`, `/auth/access-token`, and gates `/admin`, `/therapist`, `/dashboard` on session *presence* only. Its matcher must stay broad, because `/auth/*` is served by the proxy rather than by route files.
- **Role-based access is still enforced inside each section's Server Component layout** (e.g. `app/admin/layout.tsx` checks `user.labels?.includes("admin")`). Add new role gates at the layout, not the proxy.
- `lib/auth/session.ts` is the auth core:
  - `getLoggedInUser()` — React-`cache`d, returns a `SessionUser` or `null`. Resolving a session is a local cookie decrypt with **no network call**, so `null` always means "no valid session", never "provider unreachable".
  - `SessionUser` uses the field names `$id` / `name` / `email` / `labels` / `prefs`. The `$`-prefix is a holdover from the Appwrite era, kept so ~89 call sites and ~76 `labels?.includes(...)` role guards did not have to change. **`$id` is the Auth0 `sub`** (`auth0|…`, `google-oauth2|…`) and is the canonical `user_id` foreign key in Postgres — a `text` column, never uuid.
  - `labels` ← the namespaced claim `https://echo-health.app/roles`; `prefs` ← `https://echo-health.app/user_metadata`. Claim names are defined once in `lib/auth/claims.ts`.

#### ⚠️ Roles require BOTH halves. Breaking either fails silently.

1. **The post-login Action sets the claims** — source at `scripts/auth0-roles-action.js`, deployed by `npx tsx scripts/auth0-deploy-actions.ts`. Order matters: `account-linking` must run before `auth`.
2. **`lib/auth0.ts` must re-admit them via `beforeSessionSaved`.** SDK v4 runs `session.user = filterDefaultIdTokenClaims(session.user)` and keeps ONLY `sub, name, nickname, given_name, family_name, picture, email, email_verified, org_id, act`. Every custom claim is discarded unless that hook is supplied. (v3 kept them — this is a v4 change.)

This cost real debugging time: the Action reported success, the Auth0 execution log showed no errors, the roles were correctly assigned in the tenant — and `user.labels` was still empty, so every `labels.includes("admin")` returned false and admins were locked out with nothing to point at. **If roles stop working, check `beforeSessionSaved` first.**

Note also that Auth0 returns role names exactly as typed in the dashboard (`Admin`, not `admin`), so `lib/auth/session.ts` lowercases them on read. Don't rely on dashboard capitalisation.

- Roles are stamped into the session at login. Assigning one to a signed-in user does nothing until they log in again — `/api/user/set-role` returns `requiresReauth: true` and `/role-select` acts on it.
- `ADMIN_EMAILS` / `THERAPIST_EMAILS` / `CLIENT_EMAILS` are a bootstrap escape hatch in `lib/auth/session.ts`, matched against **verified** emails only. They exist to solve the chicken-and-egg of granting the first role. Unset them in production: they match on email, which means they will also mask identity bugs (they hid a duplicate-account defect for hours).
- `lib/auth/client.ts` holds the browser-side entry points (`signIn`, `signUp`, `signInWithGoogle`, `signOut`). They are plain redirects — Universal Login means the app never handles credentials, so there is no `signIn(email, password)`.

### Data layer (Drizzle + Postgres, with RLS)

#### ⚠️ The drizzle snapshot is stale. Do not run `db:generate:auto`.

`drizzle-kit generate --custom` copies the previous snapshot **without reading
`schema.ts`**, so every table created by a hand-written migration is missing from
`lib/db/migrations/meta/*_snapshot.json` — currently `payments`,
`promo_redemptions`, `avatars` and `payout_ledger`.

A plain `drizzle-kit generate` diffs `schema.ts` against that stale snapshot,
concludes those four tables are new, and emits `CREATE TABLE` for all of them.
Against the live database that fails; against a fresh one it would create them
**without the RLS policies**, which live only in the custom migrations. Attempting
it currently crashes on an interactive column-conflict prompt rather than
producing anything, which is the safer failure, but do not rely on that.

Until the snapshot is reconciled: **write schema changes as custom SQL** and keep
`lib/db/schema.ts` updated by hand so Drizzle's types match the database. The
migrations, not the snapshot, are the source of truth.

- `lib/db/schema.ts` mirrors the database for Drizzle's types. Because of the snapshot drift above, keep it in sync BY HAND and express the actual change as custom SQL: `npm run db:generate -- --name=<name>`, then `npm run db:migrate`.
- `lib/db/index.ts` exports `db` and the raw `sql` client. **The app connects as `echo_app`, not the migration admin** — this is load-bearing: `echo_admin` owns the tables and has `rolbypassrls = true`, so connecting as it silently disables every policy.
- **Every query must run inside `withUser()` / `withCurrentUser()` / `withAnonymous()` from `lib/db/session.ts`, using the `tx` handle — never the bare `db` export.** These open a transaction and set `app.user_id` / `app.user_roles`, which is what the RLS policies read. A query issued outside one carries no identity, so every ownership predicate fails closed and returns zero rows. Transaction-local (`set_config(..., true)`) is mandatory, because pooled connections are reused across requests and a session-scoped setting would leak one user's identity into the next.
- `lib/types/documents.ts` derives the UI row types from the Drizzle schema. Don't hand-write row interfaces.
- Timestamps are real `timestamptz` and come back as `Date`. They were ISO strings under Appwrite, so watch for `.localeCompare` and `JSON.parse` on what are now `Date` and `jsonb` values.

#### Authorization is enforced twice, and both layers matter

1. **Postgres RLS** (`lib/db/migrations/0001_row_level_security.sql`) — the datastore refuses rows the caller may not see. This replaced the Appwrite ACLs, which died with the auth migration.
2. **Application checks** in `app/actions/database.ts` (`requirePatientAccess`, `ownsTherapistDoc`, …) — RLS fails a request *quietly* by returning nothing; these fail it *loudly* with "Forbidden", which is what the UI and audit trail need.

Keep both when adding an action. Some app checks are strictly redundant with a policy and are annotated as such — that redundancy is deliberate.

Notable policy decisions: `journal_entries` is author-only (no therapist or admin read path); `clinical_notes` is readable by the authoring therapist and admins, never the patient; the `therapists` directory is world-readable because visitors browse it before signing in; `chat_*` are permissive because anonymous visitors have no identity to bind to, so those two tables rely on application checks alone.

### Realtime

Postgres `LISTEN`/`NOTIFY` over SSE — replaced Appwrite's realtime subscriptions.

- Triggers (`0002`, `0004`) emit `pg_notify` on the `echo_changes` channel with **identifiers only, never row contents**. Subscribers refetch through normal RLS-protected queries, so this channel cannot leak unauthorized data and can never exceed the 8 kB `pg_notify` payload cap.
- `lib/db/events.ts` holds **one shared LISTEN connection per process** and fans out in memory. This is not an optimisation: the Azure tier allows ~24 app connections, so a connection-per-subscriber design would exhaust the server at ~24 concurrent users.
- Client side is `hooks/useRealtime.ts`; the stream is `app/api/events/route.ts`.
- **Requires a long-lived Node process** (Azure App Service / Container Apps). On serverless the listener dies between invocations. **Do not put PgBouncer in front of it** — transaction pooling multiplexes backends and notifications are silently lost.
- Trigger audience specs: a bare column name, `therapist:<column>` (resolves a `therapists.id` to its owner's Auth0 sub), or `const:<literal>` (e.g. `const:staff`, which staff subscribe to for the support-chat inbox).

### File uploads

Bytes live in Postgres `bytea`, not object storage.

- `avatars` — profile photos, world-readable, served by `/api/avatar/[id]`. Public because they render in the therapist directory.
- `kyc_documents` — identity documents, restricted to owner and admins, served by `/api/kyc/[id]` with `Content-Disposition: attachment` (serving user uploads inline would be a stored-XSS vector).
- These are separate tables on purpose: one table would force a single RLS policy across two very different sensitivity levels.
- Uploads are capped at 10 MB with a MIME allowlist — the bytes go into your database, so an unbounded upload is a storage problem as well as a security one.

### Video sessions

Video runs on **Cloudflare Calls (the SFU) with Cloudflare's TURN service for ICE relay** — a self-managed WebRTC stack where the browser *does* run `RTCPeerConnection` and SDP offer/answer. (An earlier branch migrated this to managed Realtime Kit; that was reverted because deployment only has the Calls + TURN keys.) The flow lives in **`hooks/useVideoSession.ts`**, consumed by `app/components/video/VideoRoom.tsx`:

1. `app/api/video/session/route.ts` (POST) is an **authenticated, allowlisted proxy** to the Cloudflare Calls REST API (`https://rtc.live.cloudflare.com/v1/apps/<APP_ID>`). It requires a logged-in user, validates `{ endpoint, method, data }` against `videoSessionSchema` (no arbitrary endpoints — it was previously an open proxy, see the security note in the route), and is rate-limited per user. Credentials (`NEXT_PUBLIC_CLOUDFLARE_CALLS_APP_ID`, `CLOUDFLARE_CALLS_API_TOKEN`) stay server-side.
2. `app/api/video/ice-servers/route.ts` (POST) mints **short-lived TURN ICE credentials** (1-hour TTL) from `https://rtc.live.cloudflare.com/v1/turn/keys/<TOKEN_ID>/credentials/generate-ice-servers`, using `CLOUDFLARE_TURN_TOKEN_ID` / `CLOUDFLARE_TURN_API_TOKEN`. The hook fetches these and passes them to `new RTCPeerConnection({ iceServers })`.
3. `useVideoSession` does the full WebRTC dance against the SFU: create a Calls session, publish local tracks via `/sessions/<id>/tracks/new` (offer → answer), then subscribe to the remote participant's tracks via `/tracks/request` + `/renegotiate`. All Cloudflare calls go through the proxy route in step 1.

There is **no** managed-meeting wrapper, join-token route, or `@cloudflare/realtimekit-*` dependency anymore — don't reintroduce them unless the deployment gets Realtime Kit credentials.

### Analytics (PostHog)

PostHog is initialised in **two** places by design:
1. `instrumentation-client.ts` — Next.js client-instrumentation hook, sets `capture_exceptions: true`.
2. `app/components/PostHogProvider.tsx` — wraps the React tree and provides `usePostHog()`; also runs `posthog.identify()` from the server-fetched user on mount.

Both use `api_host: "/ingest"` which is reverse-proxied to PostHog US in `next.config.ts` (`/ingest/static/*`, `/ingest/array/*`, `/ingest/*`). **Don't change the host to `us.i.posthog.com` directly** — the proxy is there to dodge ad-blockers. Server-side events use the factory in `lib/posthog-server.ts` (`flushAt: 1`, `flushInterval: 0` — events flush per-call because route handlers are short-lived). See `posthog-setup-report.md` for the full list of tracked events.

### Clinical risk

`lib/clinical/risk.ts` is `analyzeRisk(text) -> "low" | "moderate" | "high"`. **It is substring matching against a fixed word list — that is the entire implementation.** It is not a validated instrument, nobody has measured its sensitivity or specificity on this population, and there is no AI anywhere in it. It fires on quoted and historical speech ("my brother said he wanted to kill himself"), fires on ordinary words that happen to be listed (`goodbye` is on the high-risk list), and misses anything phrased obliquely — which is most of how distress is phrased. Render `RISK_SCANNER_DISCLOSURE` wherever a level is shown to a human.

> An earlier version of this file said the scanner was "used in chat (`app/api/chat/`) and admin risk views". **That was false in both halves** and stood for months: it was never called in `app/api/chat/`, and the admin risk pages queried nothing at all — they rendered hardcoded scores and flags under real clients' names. Treat this paragraph as the thing most likely to rot next.

**The pipeline, as of migration 0017:**
- `sendMessageAction` scans message content server-side and files a `risk_alerts` row on `high` only. `moderate` is deliberately not persisted: a scanner emitting low-confidence alerts trains a reviewer to dismiss all of them.
- **Staff-authored messages are not scanned.** A therapist writing "she told me she wanted to end it all" is the likeliest source of a high-risk keyword here, and attributing it would file a crisis alert against the clinician's record.
- The insert runs under `withSystem("risk-scanner")` in a **separate transaction, after the message commits**. This ordering is load-bearing: an RLS-refused insert aborts the whole transaction, so a try/catch around an insert placed inside the message transaction would swallow the JS error and still lose the message at COMMIT.
- `risk_alerts` policies admit system context for SELECT and INSERT only — not UPDATE or DELETE. Senders are deliberately NOT granted INSERT: `patient_id` is free text with no FK, so that would let any client file a `crisis` alert against any other user's id.
- `disposition` (`open` / `actioned` / `false_positive` / `duplicate`) exists because `resolved` alone cannot distinguish "we read it, it was a cheerful sign-off" from "this person was in crisis". Without it the table accumulates as a crisis history that is mostly string matches. A non-`open` disposition must be attributed — enforced by CHECK.

Keep `HIGH_RISK_KEYWORDS` / `MODERATE_RISK_KEYWORDS` as the source of truth; the unit test is `__tests__/clinical-risk.test.ts`. The RLS and CHECK guarantees above are **not** covered by jest — it mocks `lib/db/session.ts`, so every policy could be dropped and all 93 tests would still pass. Run `npx tsx scripts/verify-risk-pipeline.ts` after touching these tables or policies (and `scripts/verify-kyc-security.ts` for credentialing). Both are safe against production: every case rolls back.

### Support chat widget

`app/api/chat/` is an anonymous-friendly support chat (distinct from in-session therapy messaging). Key invariants in `route.ts`:
- **Identity is derived server-side, never trusted from the body.** Authenticated users get their real `name`/`email` via `getLoggedInUser()`; anonymous visitors get the (untrusted) values they typed on the gate form, ACL-scoped to admin-only reads.
- Messages are written with the **admin client** (the browser SDK has no session) and stored across `chatMessages` / `chatSessions` collections. A `text === "heartbeat"` message is an online-presence ping, not a real message (`role: "system"`).
- Sibling routes: `history/` (fetch a thread), `offline/` (capture a message when no agent is online), `reply/` (agent → visitor). Risk scanning runs here via `analyzeRisk`.

### Cross-cutting request helpers

- **Validation** — `lib/validation.ts` holds the zod schemas for every API-route body and a `parseOrError(schema, body)` helper returning `{ ok, data } | { ok: false, message }`. Add a schema here and validate at the top of new route handlers rather than hand-rolling checks.
- **Rate limiting** — `lib/rate-limit.ts` is an in-memory token bucket (`rateLimit(key, opts)` + `clientIp(req)`). It's per-instance defense-in-depth only, **not** a hard cross-instance guarantee — don't rely on it for security-critical limits.
- **Email** — `lib/email.ts` wraps Resend; `getResend()` returns `null` when `RESEND_API_KEY` is unset, so callers must no-op gracefully (email is optional in dev). HTML-escape interpolated user input.
- **Plans/currency** — `lib/constants.ts` is the source of truth for plan session allowances and labels; `lib/useCurrency.ts` is a client hook for locale/currency display.

## Operational scripts (`scripts/`)

- `auth0-roles-action.js` — **not application code and not imported anywhere.** It is the source of the Auth0 post-login Action that injects the roles and `user_metadata` claims, and it must be pasted into the Auth0 dashboard by hand. Without it deployed, every role check evaluates to `false` and admins are locked out.

## Repo-root noise

The Appwrite-era scratch files (`test_appwrite*.js`, `test_node_appwrite.js`) and operator scripts have been removed along with the SDK.

## Testing

- Jest config: `jest.config.js` (uses `next/jest` preset, jsdom env, `@/` alias). Setup in `jest.setup.js` polyfills `TextEncoder`, `matchMedia`, `IntersectionObserver`.
- Coverage scope: `app/**`, `hooks/**`, `lib/**`.
- API-route tests (`__tests__/api-*.test.ts`) exercise route handlers directly — follow the existing mocking pattern for `@/lib/db/session`, `@/lib/auth/session` and `posthog-node` when adding new ones.
- `test-utils/session.ts` builds a `SessionUser` fixture. It lives outside `__tests__/` deliberately: `next/jest`'s default `testMatch` treats every file under `__tests__/` as a suite.

## Environment

Required env vars (see `.env.local`):
- `APP_DATABASE_URL` — **what the application connects with.** Role `echo_app`, which is subject to RLS. Requires `?sslmode=require` (Azure rejects unencrypted connections).
- `DATABASE_URL` — admin role `echo_admin`, used **only** by drizzle-kit for migrations. It has `rolbypassrls = true`, so never point the app at it.
- `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET` — Auth0 application credentials (server-only).
- `AUTH0_SECRET` — 32-byte hex, encrypts the session cookie. Rotate with `openssl rand -hex 32`.
- `APP_BASE_URL` — the app's own origin; Auth0 builds callback URLs from it. Must match a **Allowed Callback URL** on the Auth0 application (`<origin>/auth/callback`) or login fails.
- `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`
- `NEXT_PUBLIC_SITE_URL` — used for OAuth redirect URLs in SSR contexts
- `NEXT_PUBLIC_CLOUDFLARE_CALLS_APP_ID`, `CLOUDFLARE_CALLS_API_TOKEN` — Cloudflare Calls (SFU). Used by `app/api/video/session/route.ts`; the API token stays server-side.
- `CLOUDFLARE_TURN_TOKEN_ID`, `CLOUDFLARE_TURN_API_TOKEN` — server-only, used by `app/api/video/ice-servers/route.ts` to mint short-lived TURN ICE credentials.
