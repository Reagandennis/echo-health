<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

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

## Running it locally (Docker Postgres + Redis)

```bash
docker compose up -d      # Postgres 17 + Redis 7, both bound to 127.0.0.1 only
npm run db:setup          # waits for health, then applies migrations
npm run db:seed           # optional: 4 local therapists so /therapists renders
npm run dev
```

`.env.local` (gitignored) points `APP_DATABASE_URL` / `DATABASE_URL` / `REDIS_URL` at the stack and overrides `.env`, which Next loads first. `npm run db:reset` destroys the volume and starts clean; `npm run db:psql` opens a shell; `npm run redis:cli` the same for Redis.

### Signing in locally: `/dev-login`

There are **no test accounts to hand out.** Authentication is Auth0 Universal Login — `lib/auth/client.ts` is three redirects, there is deliberately no `signIn(email, password)`, and accounts live in the Auth0 tenant rather than in Postgres. Seeing `/admin`, `/therapist` or `/dashboard` otherwise requires a tenant, an application, callback URLs, the post-login Action from `scripts/auth0-roles-action.js` deployed, and roles assigned in the dashboard.

So `/dev-login` mints a synthetic session for one of three personas (`lib/auth/dev-session.ts`). Set `DEV_AUTH_ENABLED=true` in `.env.local` and run `npm run db:seed` so the portals have data.

**It is an authentication bypass, gated twice and independently:**

1. `NODE_ENV === "production"` → off. Next **inlines** `NODE_ENV`, so in a production build the check is a literal and every line below it is dead code the bundler drops. The capability is not in the artifact — verified: `/dev-login` and `/api/dev/login` both return **404** against a production build *with `DEV_AUTH_ENABLED=true` still set*, and a stale persona cookie redirects to `/auth/login` rather than granting anything.
2. `DEV_AUTH_ENABLED === "true"` → an exact opt-in. Not truthy, not `"1"`.

Both return **404** rather than 403 when disabled, so a probe cannot tell "disabled" from "not built".

**It satisfies session *presence* only.** Role enforcement is untouched and still lives in each section's layout, so the personas behave exactly as real sessions with those labels: `client` and `therapist` are both refused at `/admin`; `admin` reaches `/therapist` because `app/therapist/layout.tsx` explicitly admits `therapist` *or* `admin`; everyone reaches `/dashboard` because that layout checks presence only.

**The one risk the build cannot rule out** is `npm run dev` behind a public tunnel — and `cloudflared/` in this repo says that happens — with the flag set. `NODE_ENV` is `development` there, so guard 1 does not fire, and nothing in code can distinguish a tunnel from a laptop. Unset `DEV_AUTH_ENABLED` before exposing a dev server; every sign-in logs a warning saying so.

### ⚠️ The two Postgres roles are the whole security model

`docker/postgres/init/01-roles.sql` creates them, and its comment is the long version. In short: `echo_admin` owns the tables and **has BYPASSRLS**; `echo_app` owns nothing and does not. Point the app at `echo_admin` and every policy in migration 0001 silently stops applying — every query returns every row and the UI looks identical.

The migrations `GRANT` to `echo_app` but never `CREATE` it (on Azure the roles were provisioned by hand first), and they grant explicitly only for tables added after 0001. The init script closes both gaps with `ALTER DEFAULT PRIVILEGES FOR ROLE echo_admin`, so a table created by a *future* migration is readable by the app without anyone remembering a GRANT line. **A plain `GRANT ON ALL TABLES` there would be a silent no-op** — it applies only to tables that already exist, and at init time none do.

Verified working on the local stack: with `app.user_id` unset, `echo_app` sees **0** journal entries; set to the author, **1**; set to another user, **0**; and set to another user *claiming the admin role*, still **0** — because `journal_entries` is author-only with no admin read path. `echo_admin` sees all of them, which is why it is not the app's role.

### `db:migrate` is broken; use `npm run db:apply`

`drizzle.config.ts` uses the drizzle-kit 0.21+ API (`dialect: "postgresql"`) while `package.json` pins `^0.18.1`, which wants `driver: "pg"`. So both drizzle-kit commands fail to read their own config, and `tsconfig.json` excludes the file so the mismatch does not also break `next build`.

`scripts/db-migrate.mjs` sidesteps it entirely by using **drizzle-orm's runtime migrator**, a separate code path on a current version (0.45.2). It reads the same `meta/_journal.json`, splits on the same `--> statement-breakpoint`, and writes byte-compatible `drizzle.__drizzle_migrations` rows — so whenever drizzle-kit is fixed it will see these as already applied rather than re-running them. Migrations run as `echo_admin`, which is also what makes the default-privileges grant apply.

#### ⚠️ A new `.sql` file does nothing until it is in `meta/_journal.json`

The migrator applies the journal, **not the directory**. Because `db:generate` is broken (above), a hand-written migration has to be added to `meta/_journal.json` by hand as well — `{ "idx", "version": "7", "when", "tag": "<filename without .sql>", "breakpoints": true }`, appended in order.

Skip that and the run reports success while doing nothing. Worse, it reports a *plausible* success: the script's closing line counts the rows in `drizzle.__drizzle_migrations`, so adding file 0019 and running `db:apply` printed `Done. 19 migrations recorded as applied.` — a number that looks like it includes the new one and is in fact the old total. Migration 0019 was then "verified" against a database that had never run it, and the security cases written to prove it passed for the wrong reason on the mutations and failed on the fixtures.

**Check the effect, never the exit code.** After applying anything, ask Postgres directly for the thing the migration was supposed to change:

```bash
docker exec echo-postgres psql -U echo_admin -d echo -tA -c \
  "SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname='therapist_licences_unique'"
```

### `npm run db:seed` writes people who do not exist

It therefore **refuses to run against any host that is not loopback** — not a warning, an exit. Seed rows carry `license_number = 'LOCAL-SEED'` (never exposed publicly, since `lib/directory.ts` selects columns explicitly) so `--clear` removes exactly those. It seeds inside a transaction carrying `app.user_roles = 'admin'` because migration 0015's trigger refuses a therapist row created already `verified` — that is the admin-review path, not a workaround, and `echo_admin`'s BYPASSRLS skips policies but **not triggers**.

### Redis is optional everywhere

`REDIS_URL` unset is a fully supported state: `lib/rate-limit.ts` falls back to the in-memory bucket that production ran on before. Redis makes the limiter a cross-instance guarantee instead of a per-process one — its own doc comment had been asking for that. Do **not** move the realtime fan-out onto it: `lib/db/events.ts` uses Postgres LISTEN/NOTIFY with one shared connection per process, and the reasoning for that design (the ~24-connection Azure ceiling) is documented there.

## Architecture

Echo Health is a teletherapy platform with three user surfaces — **clients** (`app/dashboard/`), **therapists** (`app/therapist/`), and **admins** (`app/admin/`) — built on the App Router. Auth is Auth0; the database is Postgres (Azure) via Drizzle; analytics is PostHog; video is self-managed WebRTC over Cloudflare Calls (SFU) + Cloudflare TURN; transactional email is Resend (`lib/email.ts`).

### Auth & authorization (Supabase Auth, role-in-layout)

**Authentication is Supabase Auth.** It replaced Auth0 Universal Login; the database did NOT move — app data is still the Postgres in `docker-compose.yml` / Azure, and all 69 RLS policies are untouched.

- `lib/supabase/env.ts` — the only place the variables are named. `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and server-only `SUPABASE_SERVICE_ROLE_KEY`.
- `lib/supabase/server.ts` — request-scoped client for Server Components and route handlers.
- `lib/supabase/browser.ts` — the browser client.
- `lib/supabase/proxy-session.ts` — session refresh, called from `proxy.ts`.
- `lib/supabase/admin.ts` / `management.ts` — service-role client and the privileged user-admin API.
- `lib/auth/session.ts` — still the auth core, still exports the same `SessionUser` (`$id` / `name` / `email` / `labels` / `prefs`), so the ~89 call sites and ~76 `labels?.includes(...)` guards were unchanged by the migration. `$id` is now the Supabase user id (a uuid) rather than an Auth0 `sub`; `user_id` columns are `text`, so the shape was never load-bearing.
- **Role gates stay in each section's layout** (`app/admin/layout.tsx` etc.), not in the proxy. Unchanged.

#### ⚠️ Roles live in `app_metadata`. Never `user_metadata`.

This is the entire authorisation model and getting it backwards is privilege escalation, not a style choice:

- `user_metadata` is **writable by its owner**. A signed-in client can call `supabase.auth.updateUser({ data: { roles: ["admin"] } })` from the browser console.
- `app_metadata` is writable **only** with the service-role key, which never leaves the server.

So `getLoggedInUser()` reads `app_metadata.roles` into `labels`, `lib/supabase/management.ts` is the only thing that writes it, and `prefs` maps to `user_metadata` (display name and similar — nothing that grants access). Role names are lowercased on both read and write, because a role stored as `"Admin"` fails every guard and looks identical to having no role.

#### ⚠️ `getUser()`, not `getSession()`

`getSession()` decodes the cookie and returns whatever is in it — fine for "probably signed in", **not** fine for an authorisation decision, because the cookie is attacker-supplied. `getLoggedInUser()` and the proxy both call `getUser()`, which validates the JWT against the Auth server. The cost is a network round trip, which is a real change from Auth0's local cookie decrypt — so unlike before, `null` *can* mean "provider unreachable". It fails closed: no session means no `labels` means no access.

#### ⚠️ The proxy's session refresh is half of a pair

Supabase access tokens are short-lived. Next only allows cookie writes from a Server Action, route handler or middleware — **a Server Component rendering cannot set them**. So `lib/supabase/server.ts` swallows write failures and `proxy.ts` does the writing on every covered request. Remove the refresh and sessions work perfectly until the first token expires, then log everyone out with nothing in any log.

`proxy.ts` also **never throws**. `auth0.middleware()` used to be called unguarded on its first line, and when the Auth0 keys were removed from `.env` it returned 500 for every path the matcher covered — all of `/api/*`, all three portals, and `/ingest/*`, the reverse proxy browser analytics goes through. The marketing pages kept working because they are excluded, so the site looked healthy from outside while everything behind it was down. Keep it non-throwing.

Unlike Auth0, Supabase has **no SDK-served routes**: `/auth/callback` and `/auth/signout` are ordinary route handlers under `app/`.

#### The app now handles passwords, and Auth0 did not

AGENTS.md used to say "Universal Login means the app never handles credentials". That property is gone. The obligations it covered are now ours, and they are written down in `lib/auth/client.ts`: no password in a log, a URL or an analytics event; sign-in errors surfaced **verbatim** from Supabase, which returns one `Invalid login credentials` for both a wrong password and an unknown address — do not "improve" that message into an account-enumeration oracle.

`ADMIN_EMAILS` / `THERAPIST_EMAILS` / `CLIENT_EMAILS` survive as the bootstrap hatch in `lib/auth/session.ts`, still matched against **verified** emails only, and still to be unset in production.

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

Video runs on the **Echo video backend** (`video.echopsychology.com`) — a self-hosted, multi-tenant **1:1 signaling** service. Our app is a *tenant*: the server holds an `sk_live_…` API key, the two browsers do WebRTC peer-to-peer, and the service only relays call setup (it never sees or stores media). This **replaced the Cloudflare Calls SFU + Cloudflare TURN** stack (and the DB-based track signaling that went with it). The flow lives in **`hooks/useVideoSession.ts`**, consumed by `app/components/video/VideoRoom.tsx`:

1. **Minting is a server action, not a route.** `createVideoSessionAction(sessionId, role)` in `app/actions/database.ts` authorizes the caller against the therapy session (client → must be `patient_id`; therapist → `ownsTherapistDoc`, and RLS also constrains the SELECT), then calls `lib/video.ts` → `POST https://video.echopsychology.com/sessions` with the API key, `{ room: <sessionId> }`. It returns `{ wsUrl, iceServers }` to the browser. The `sk_live_` key (`ECHO_VIDEO_API_KEY`, server-only) NEVER reaches the client. `room = the therapy session id`, so both participants join the same room; rooms are tenant-namespaced.
2. **The browser signals directly** over `wss://video.echopsychology.com/ws?token=…` and runs the offer/answer/ICE handshake against the *other browser*. Because it's cross-origin, `video.echopsychology.com` (https + wss) is allowlisted in the `next.config.ts` `connect-src` CSP.
3. **Signaling protocol** (server assigns roles): the FIRST human in a room is `callee` (waits); the SECOND is `caller` (sends the offer). Two correctness guards in the hook, both cause black video if dropped: (a) **idempotent peer discovery** — the server announces each peer twice (in `role.peers` and as `peer-joined`), so `discoverPeer` dedups per peerId; (b) **ICE candidate buffering** — candidates can arrive before the offer, so they're buffered per peer and flushed after `setRemoteDescription`.

Env: `ECHO_VIDEO_API_URL`, `ECHO_VIDEO_API_KEY` (both server-only; no `NEXT_PUBLIC_`). The old `NEXT_PUBLIC_CLOUDFLARE_CALLS_APP_ID` / `CLOUDFLARE_CALLS_API_TOKEN` / `CLOUDFLARE_TURN_*` vars are dead — remove them from deployment. The `therapy_sessions.patient_tracks` / `therapist_tracks` jsonb columns are now **vestigial** (a future migration may drop them). Recording/screen-share/chat are service features not yet wired into this client — treat them as follow-ups, don't assume they're live.

### Pricing (three KES bands, chosen server-side)

`lib/constants.ts` holds the **published** prices; `lib/pricing.ts` is the only place a *charged* amount is decided. Clients are in thirteen countries and pay one of three KES amounts. Read that module's header comment before touching anything priced — it carries the margin table.

Four invariants, each of which is a money bug when broken:

- **A band is a different KES amount, never a different currency.** Paystack settles in KES and `lib/paystack.ts` converts to minor units exactly once. `lib/useCurrency.ts` + `PriceTag` still do the display-only local conversion; nothing there was duplicated.
- **The country comes from a request header, never from the client.** `resolveMarket(req)` reads `cf-ipcountry` / `x-vercel-ip-country` and nothing else — not the body, not `Accept-Language`, and *not* `lib/useCurrency.ts`, whose browser-side `ipapi.co` call is a display courtesy and trivially forged. Next removed `NextRequest.geo` in v15, so there is no framework geo object to use instead. The header is only as good as "requests cannot reach the origin except through our edge", so it is believed **only** when `TRUST_EDGE_COUNTRY_HEADER === "true"`; otherwise everyone gets the standard price.
- **⚠️ A band may only LOWER a price, never raise one** — validated, and enforced again where the amount is computed. `/pricing` is statically rendered (same HTML, same prices, for everyone), so the published figure is a ceiling. Charging high-income markets *more* is therefore not possible without making `/pricing` per-request or adding a `Vary`, and a forgotten `Vary` serves one country's prices to everybody.
- **⚠️ Therapist pay does not move with the client's country.** `listPriceMinorPerSession(plan)` feeds `payout_ledger` and takes a plan and nothing else; adding a tier/country/charged-amount parameter is exactly how a Nairobi clinician would start earning less for a client in Kampala. A test pins its arity. Same reasoning as `THERAPIST_PAID_ON_LIST_PRICE`, and it costs 17–33 points of contribution margin at the discounted bands — at both of them the platform already clears less per session than the clinician.

A promo and a band **do not stack**: `amountToChargeKes` charges the lower of the two, which caps the worst case at the promo-on-list case already accepted rather than charging below the therapist's accrual. `assertPricingConfigured()` is what the payment path calls — it runs `assertPricesConfigured()` and then validates the bands. Prices vary by country, so `/pricing` and `/terms` §5 both say so, from one shared sentence (`describeRegionalBands`).

### Analytics (PostHog)

PostHog has **one** init and one provider — keep it that way:
1. `instrumentation-client.ts` — the Next.js client-instrumentation hook, and the **only** `posthog.init()` in the app. Sets `capture_exceptions` (prod only) and opts out of capturing on localhost.
2. `app/components/PostHogProvider.tsx` — wraps the React tree and provides `usePostHog()`; also runs `posthog.identify()` from the server-fetched user on mount. It does **not** init.

> This file previously said PostHog was initialised in two places "by design". It was initialised in two places, but not by design and not effectively: the provider's init was guarded by `!posthog.__loaded`, and the instrumentation hook runs first, so the guard was always false and the provider's whole options object was dead code. The casualty was its dev opt-out — meaning nothing stopped a local `npm run dev` from reporting into the production project as real traffic. **If you add a second `init()`, whichever one loses is silent.**

#### The taxonomy is `lib/analytics/events.ts`. Do not hand-write event names.

`ANALYTICS_EVENTS` is the source of truth for every event name, and `captureServer()` (`lib/analytics/server.ts`) is the only server-side capture path — it can never throw, so a PostHog outage cannot turn a booking, a role assignment or a payment webhook into a 500.

Events tagged `@unwired` are **declared but not emitted**. Never build a saved insight on one. That is exactly how the previous instrumentation failed: the wizard's dashboards measured `user_signed_up`, `user_role_selected` and `therapist_onboarding_completed` while the code emitted none of them, so three of five charts rendered a flat zero — which reads as "nobody signed up" rather than "this chart is broken".

**Universal Login means the client cannot see a successful login.** `sign_up_started` / `sign_in_started` fire before the browser leaves for Auth0 and measure intent only. `user_authenticated`, captured server-side in `app/post-login/page.tsx`, is the only event that closes that funnel. Compute the redirect destination *before* redirecting — `redirect()` works by throwing, so a capture placed after one never runs.

**Capture after the transaction commits, never inside `withUser`.** `captureServer` makes a network call and waits up to 3s for the flush; inside a transaction that holds a pooled Postgres connection for the duration, and the Azure tier allows roughly 24 in total. Same ordering rule as the risk scanner.

#### ⚠️ Analytics privacy rules — this is a mental-health platform

The *content* of what a person writes or feels never leaves for a third-party analytics vendor. Not the text, not a score, not a category.

- **Identification is pseudonymous.** Auth0 `sub` plus a coarse `role`; no email, no name. Every person profile used to carry both, which made the analytics project a list of identifiable people using a mental-health service. Those properties were purged.
- **Session replay is off behind the login wall.** `disable_session_recording: true` at init; `PostHogProvider` starts recording only after confirming there is *no* session, and stops it on sign-in. Replay was previously recording authenticated `/therapist` screens on 30-day retention — posthog-js masks form inputs but *not* rendered DOM text, so recordings captured client names, note bodies and message threads.
- **URLs are scrubbed** by `lib/analytics/sanitize.ts` via `sanitize_properties`, which runs on every event including autocapture. Record ids in dynamic routes reach `$current_url` verbatim — `/admin/therapists/<uuid>/credentials` was captured 10 times before this existed. Autocaptured element text is dropped wholesale.
- **Risk-scanner outcomes are never captured.** A `risk_alert` against a stable person id would put "this individual was flagged as in crisis" in an analytics store. It stays in Postgres behind RLS.
- `therapist_id` **is** allowed (a provider is a business entity, and directory conversion is unmeasurable without it). Patient identifiers are not.

The test for a new property: would this be acceptable in a breach notification? If not, aggregate it or drop it. Sanitiser behaviour is covered by `__tests__/analytics-sanitize.test.ts`.

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

### Public marketing surface (route group + one nav source)

Every public page lives in the **`app/(marketing)/`** route group. It is a group, so no URL changed: `/about` is still `/about`. `app/(marketing)/layout.tsx` renders `SiteHeader`, a single `<main id="main">` and `SiteFooter` — **a page in this group must not render its own `<header>`, `<footer>` or `<main>`.**

Before this existed, each of the thirteen marketing pages inlined its own `<header>` containing a back-arrow to `/` and nothing else. Twelve had no navigation at all, so `/faq` and `/guides` had no crawlable link between them, and the home page's own nav pointed at `#how`, `#therapists` and `#pricing` — three in-page anchors that cannot rank, cannot carry a title or description, and cannot be a search result. Those three now have real URLs (`/how-it-works`, `/therapists`, `/pricing`).

#### ⚠️ Kenya is where the SUPPLY is. It is not the market.

Get this the wrong way round and you will rewrite twenty files, as happened once already:

- **Clinicians are licensed in Kenya.** True, and a material disclosure.
- **Clients are worldwide.** `lib/constants.ts`, on the crisis directory: *"Where to send anyone outside the regions listed below — which, on a global platform, is most people."* `lib/useCurrency.ts` exists specifically as "a courtesy for international visitors".
- **Prices settle in KES** because that is what the Paystack account settles in — a payment fact, not a statement of who may buy.
- **Therapist availability is East Africa Time (GMT+3).** A real scheduling constraint for most clients, and one that must be stated rather than discovered.

A brief that says "this is a Kenyan platform" produced a home page titled "online therapy … in Kenya", five Kenyan *city* pages, `areaServed: Country/Kenya` in the structured data, and a footer that told every visitor on earth to dial 999. Every Kenya reference on a public page must be either **a disclosure** (licensure, currency, time zone — keep these, lead with them) or **deleted** (Kenya as the audience or the only place served). Removing the disclosures is the opposite error: a client in Toronto needs to know their therapist is not Ontario-registered and their card is charged in shillings.

`lib/markets.ts` holds the thirteen client markets and what differs in each — IANA zone, local currency, whether M-Pesa applies, and `locallyLicensed`, which is `true` for Kenya and `false` for the other twelve. **Time-zone offsets are computed from the IANA zone at render time, never written as literals**: the UK, US and Canada observe DST and Kenya does not, so the gap to Nairobi changes twice a year and a literal is silently wrong for months.

#### ⚠️ Never print an emergency number outside `/crisis`

`CRISIS_REGIONS` verifies numbers for two countries. The site serves thirteen markets. Anywhere else, route to `/crisis` and `CRISIS_DIRECTORY_URL` (findahelpline.com, which geolocates) — never name a number. The footer banner and ten pages once read "call 999 or 112", which reaches nothing from the United States, and `lib/constants.ts` already warned that "publishing an unverified emergency number is the specific failure this rewrite exists to fix". A person reads that line while deciding what to do next.

#### `lib/navigation.ts` is the IA, and `sitemap.ts` derives from it

Header, footer, breadcrumbs and `app/sitemap.ts` all read that one file. **Adding a public page means adding it to `ALL_INDEXABLE_ROUTES` there**, or it is not submitted to search engines. The previous sitemap was a hand-kept literal list that had already drifted in both directions: `/organizations` shipped, was footer-linked, and was never submitted; `/cookies` was submitted while carrying `index: false`, which Search Console reports as an error.

`CONDITIONS` and `LOCATIONS` in the same file drive `/therapy-for/[condition]` and `/online-therapy/[city]` through `generateStaticParams`. Changing a slug there changes a live URL — they accrue links, so treat them as stable.

#### Compose pages from `app/components/marketing/sections.tsx`

`Section`, `SectionHeading`, `CtaButton`, `Steps`, `FeatureGrid`, `CheckList`, `FaqList`, `CtaBand`, `RelatedLinks`. None of it is `"use client"` and it should stay that way — `FaqList` uses native `<details>` specifically so an accordion costs no hydration boundary and its answers stay in the server HTML where a crawler and Ctrl-F can both find them.

Render an FAQ with `FaqList(faqs)` **and** `faqJsonLd(faqs)` from the same array. Hand-writing the JSON-LD separately is how structured data ends up disagreeing with the page, which Google treats as a markup violation rather than a nicety.

Every JSON-LD block goes through `app/components/marketing/JsonLd.tsx`, which escapes `<`. That is not cosmetic: therapist profiles serialise database values, and an unescaped `<` closes the script element early.

#### ⚠️ Do not put a canonical, or a session read, in a layout

- **`app/layout.tsx` must not set `alternates.canonical`.** Next's metadata inheritance hands a layout canonical to every page that does not override it, so any page whose author forgets `pageMetadata` silently declares itself a duplicate of the home page. That had already happened to `/organizations` — the highest commercial-intent page on the site — and to all three auth pages. Each page declares its own via `pageMetadata({ path })`.
- **`app/(marketing)/layout.tsx` must not call `getLoggedInUser()`.** Nothing in it reads cookies, headers or the session, and that is what keeps every marketing route statically rendered. Personalising the header would opt all of them into a server round-trip. Client components in a layout do *not* have this effect — `UserProvider` fetches `/api/me` from the browser precisely so they don't.

#### Honesty rules that apply to every public page

This surface has twice accumulated claims nothing could back up, and both sweeps are documented in the files that were fixed. The standing rules:

- **No statistic that is not read from `lib/constants.ts` or enforced in code.** A band of counters ("10,000+ people helped", "94% report improvement") and a chart of outcome percentages footnoted to a survey that does not exist were removed from the home page as a misleading representation under the Consumer Protection Act 2012 (Kenya) s.12–13. `/organizations` kept an unswept version ("4x ROI", "32% reduction in turnover") until later.
- **No HIPAA, CCPA or SOC 2 claims.** HIPAA is a United States statute with no application to a Kenyan service; the governing instrument is the **Kenya Data Protection Act 2019**. The claim has been removed three times now — from the home page, from `/organizations`, and from `app/opengraph-image.tsx`, which is the asset that travels furthest because it renders every time anyone pastes an Echo link anywhere.
- **No stock photography presented as a real person.** The home page carried three invented clinicians with Unsplash portraits, and one of those portraits also appeared on `/about` under a different name and job title. `/therapists` now reads real rows; the home page renders nothing if the directory is empty.
- **No testimonials.** See the long note at the top of `app/(marketing)/reviews/page.tsx`. Beyond having nothing real to publish, session feedback is written to a therapist, not for publication, and consent obtained from someone currently in your care is not freely given.
- **No control that does nothing.** `/cookies` shipped four toggles and a Save button with no handler and no storage; `/blog` and `/guides` shipped cards whose every link was `href="#"`. A dead control is worse than an absent one, and a consent control that discards consent is a misrepresentation.

#### `/privacy` and `/terms` are written from the code, and still need counsel

Both render through `app/components/marketing/LegalDoc.tsx` (shared shell, tiny `**bold**` + `[link](/href)` grammar) and both carry a file-header comment listing **what a Kenyan lawyer still has to confirm**. Read that comment before editing either one.

The reason they live in the repo rather than in a template is that most of a privacy policy is a description of processing, and only the code knows what the processing is. Three things were found by reading it and had been disclosed nowhere:

- **`lib/useCurrency.ts` sends the visitor's IP to `ipapi.co`** to guess their currency, on public pages, with or without an account. It is now named as a processor.
- **The risk scanner is automated processing of message content.** `sendMessageAction` runs `analyzeRisk` and files a `risk_alerts` row on `high`. Privacy §3 describes it *including* how crude it is.
- **There is no account-deletion mechanism anywhere**, and `app/admin/compliance/gdpr/page.tsx` is a hardcoded list of four invented data-subject requests — the same failure as the old admin risk pages. So privacy §4 describes a manual email process and states the two erasure limits that are real, both enforced by `ON DELETE RESTRICT`: clinical notes and financial records.

Retention (§7) mirrors the actual foreign keys; commercial terms (§5) read every figure from `lib/constants.ts` via `formatKes`. **Do not type a price into either document.**

Terms §12 is the governing-law clause, which previously **did not exist at all** — the biggest gap in either file. §9/§10 deliberately do not purport to exclude non-excludable consumer rights, and contain no liability cap, indemnity or arbitration clause, because inventing those is drafting a legal position rather than describing a product.

#### The intake funnel

`/get-started` renders `IntakeQuiz` — one question per screen, answers held in component state and `sessionStorage`, nothing submitted until sign-up. The home page's three hero cards are the quiz's first question and pass `?for=self|couple|teen`, which the quiz validates and uses to skip question one.

**Its analytics carry a step number and nothing else.** `INTAKE_STEP_COMPLETED` with an answer attached would put "this individual reported depression" into a third-party analytics store about someone who becomes identifiable two screens later. See the note on `INTAKE_*` in `lib/analytics/events.ts`. `lib/clinical/risk.ts` is deliberately **not** called on quiz answers — a substring scanner firing on a dropdown label would file crisis alerts against everyone who ticked "grief".

### UI & design tokens

The palette, fonts and shared surfaces live in `app/globals.css` — read its header comment before changing a colour.

- **`stone-*` and `slate-*` are not Tailwind's.** Both are remapped to one neutral ("ink"), tinted slightly toward the brand hue, so the portals (stone) and marketing pages (slate) read as one product. They are identical; use either. **`teal-*` is remapped to the brand scale.**
- **`brand` is `brand-600`** — 5:1 on white, safe for text and for white-on-brand buttons. `brand-50…950` exist for tints and hovers. Don't set text in faded brand (`text-brand/50` is ~2:1); use `text-stone-500`/`-600` for secondary copy.
- `font-display` (Fraunces) is for marketing headlines and greetings only; UI text stays in Geist. **It no longer has an italic face** — `style: ["normal", "italic"]` was pulling a second 145.8 KB variable font, preloaded on every route, for a single two-word `<em>`. Never pair `font-display` with `italic`; you will get a synthesised oblique. `Geist_Mono` is also no longer preloaded: outside the admin portal it is used only by the two error screens.
- The page ground is a **warm off-white** (`--background`), not `#fff`; cards paint `bg-surface`, which is pure white. Hierarchy comes from the card sitting on the ground rather than from a border. `curve-down` draws an arced section boundary (set `--curve-to` to the next section's colour) and `bg-hero-soft` is the quieter hero wash.
- Surfaces: `bg-app-surface` (portal background), `bg-brand-gradient` (brand panels), `bg-aurora` (marketing hero). There is no dark theme; `color-scheme: light` is deliberate.
- **Portal chrome:** each section's `layout.tsx` is only the auth/role gate; the chrome is `ClientShell` / `TherapistShell` / `AdminShell`. Shared pieces are in `app/components/portal/` (`BrandMark`, `Avatar`, `NavList`, `MobileDrawer`). Nav configs live in client modules because lucide icons are functions and cannot cross the server→client boundary as props.
- **Logos:** `public/echo-logo.png` is the original and has an opaque white background. `public/echo-butterfly.png` (full) and `public/echo-logo-mark.png` (tight crop) are transparent derivatives — use those anywhere the background is not white.

### Cross-cutting request helpers

- **Validation** — `lib/validation.ts` holds the zod schemas for every API-route body and a `parseOrError(schema, body)` helper returning `{ ok, data } | { ok: false, message }`. Add a schema here and validate at the top of new route handlers rather than hand-rolling checks.
- **Rate limiting** — `lib/rate-limit.ts` exports `rateLimit(key, opts)` (**async** — every call site awaits it) and `clientIp(req)`. With `REDIS_URL` set it is a shared fixed window via one atomic Lua `EVAL`; without it, the original in-memory token bucket. Two properties worth knowing before you touch it: it **fails open** (a Redis error falls back to the bucket rather than 429-ing payments and the support chat), and the Redis path is a **fixed** window, so it admits up to 2× the limit across a boundary. A route where that burst matters needs a different algorithm, not a smaller number. Still defense-in-depth — put a WAF in front of anything security-critical.
- **Email** — `lib/email.ts` wraps Resend; `getResend()` returns `null` when `RESEND_API_KEY` is unset, so callers must no-op gracefully (email is optional in dev). HTML-escape interpolated user input.
- **Plans/currency** — `lib/constants.ts` is the source of truth for plan session allowances, labels and the **published** prices; `lib/pricing.ts` decides the **charged** amount (see "Pricing" above); `lib/useCurrency.ts` is a client hook for locale/currency display only.

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

This list had rotted in the direction that wastes the most time: it still
required the five `AUTH0_*` variables and the four `CLOUDFLARE_*` ones, none of
which the code reads any more — Auth0 was replaced by Supabase Auth and
Cloudflare Calls by the Echo video backend — while naming the Supabase
variables nowhere. Setting everything listed here would have produced a
deployment that still could not sign anyone in.

**Required:**
- `APP_DATABASE_URL` — **what the application connects with.** Role `echo_app`, which is subject to RLS. Requires `?sslmode=require` (Azure rejects unencrypted connections).
- `DATABASE_URL` — admin role `echo_admin`, used **only** by the migration runner. It has `rolbypassrls = true`, so never point the app at it.
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — the browser and server clients. Named in one place, `lib/supabase/env.ts`.
- `SUPABASE_SERVICE_ROLE_KEY` — **server-only.** Writes `app_metadata`, which is where roles live; anything holding this key can grant admin. It is also what `updateUserMetadataAction` needs, so without it a user cannot change their own display name.
- `NEXT_PUBLIC_SITE_URL` — the app's own origin, used for redirect URLs in SSR contexts.

**Required for video:**
- `ECHO_VIDEO_API_URL`, `ECHO_VIDEO_API_KEY` — both server-only, no `NEXT_PUBLIC_`. The `sk_live_…` key must never reach the client. Without these, `createVideoSessionAction` cannot mint a session and video does not work.

**Optional, each with a defined unset behaviour:**
- `NEXT_PUBLIC_POSTHOG_KEY` *or* `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` — either name is accepted; analytics is simply off when neither is set. `NEXT_PUBLIC_POSTHOG_HOST` defaults sensibly.
- `RESEND_API_KEY` — unset means `getResend()` returns null and callers no-op. Email is optional in dev.
- `REDIS_URL` — unset falls back to the in-memory rate limiter.
- `TRUST_EDGE_COUNTRY_HEADER` — set to exactly `"true"` **only** when the deployment is behind an edge that sets `cf-ipcountry` / `x-vercel-ip-country` and origin requests cannot bypass it. Unset means every visitor pays the standard price, which is the safe default.
- `DEV_AUTH_ENABLED` — the `/dev-login` opt-in. Never set it on anything reachable from the internet.
- `APP_BASE_URL` — **survived the Auth0 removal and still matters.** It no longer builds callback URLs for an identity provider, but it is the Paystack callback origin in `app/api/payments/initialize/route.ts` and the base for every link in a transactional email (`lib/email.ts`, which falls back to `NEXT_PUBLIC_SITE_URL` and then to `https://echohealth.app`). Unset in production and payment callbacks follow the request origin, which is wrong behind a proxy, and email links can point at the wrong host.

**Dead — remove them from any deployment that still carries them:** every
`AUTH0_*` variable, `NEXT_PUBLIC_CLOUDFLARE_CALLS_APP_ID`,
`CLOUDFLARE_CALLS_API_TOKEN`, `CLOUDFLARE_TURN_TOKEN_ID`,
`CLOUDFLARE_TURN_API_TOKEN`.
