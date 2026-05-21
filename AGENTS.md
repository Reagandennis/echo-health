<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Echo Health — agent guide

This file is the single source of truth for AI agents working in this repo. `CLAUDE.md` transcludes it via `@AGENTS.md`.

## Critical: Next.js / Appwrite versions

This project runs **Next.js 16.2.4 with React 19.2.4** — APIs and conventions differ from older versions you may have been trained on. Before writing any non-trivial Next.js code (routing, server actions, instrumentation, caching, headers/cookies APIs), read the relevant guide under `node_modules/next/dist/docs/` and heed deprecation notices. The Appwrite SDK is v24 — its old `Databases` API is also flagged deprecated in favour of `TablesDB` (see `lib/appwrite/database.ts:1`), but is still in use throughout the codebase.

## Commands

```bash
npm run dev              # next dev
npm run build            # next build
npm run start            # next start (production)
npm run lint             # eslint (flat config, eslint-config-next)
npm test                 # jest (jsdom)
npm run test:watch
npm run test:coverage
npx jest path/to/file    # run a single test file
npx jest -t "name"       # run tests matching a name

# One-time Appwrite collection bootstrap (requires APPWRITE_API_KEY env)
APPWRITE_API_KEY=<key> npx tsx scripts/setup-appwrite.ts
```

TypeScript path alias: `@/*` → repo root (e.g. `@/lib/appwrite/server`).

## Architecture

Echo Health is a teletherapy platform with three user surfaces — **clients** (`app/dashboard/`), **therapists** (`app/therapist/`), and **admins** (`app/admin/`) — built on the App Router. Backend is Appwrite; analytics is PostHog; video is Cloudflare Calls.

### Auth & authorization (cookie-session, role-in-layout)

- Sessions are an Appwrite session secret stored in an **httpOnly cookie `appwrite-session`** set by Server Actions in `lib/appwrite/actions.ts` (`createSession`, `signUpAction`, `deleteSession`).
- `middleware.ts` only checks for cookie *presence* on `/admin`, `/therapist`, `/dashboard` — it intentionally does **not** call Appwrite, to avoid per-request network cost. It also intentionally does **not** redirect away from `/signin` / `/signup` (that caused redirect loops with stale cookies).
- **Role-based access is enforced inside each section's Server Component layout** (e.g. `app/admin/layout.tsx:15` checks `user.labels?.includes("admin")`). Roles live as Appwrite user **labels** (`admin`, `therapist`). Add new role gates at the layout, not the middleware.
- `lib/appwrite/server.ts` exposes:
  - `createAdminClient()` — uses `APPWRITE_API_KEY`, full privileges. Use for user creation, label/role assignment, admin queries.
  - `createSessionClient()` — uses the cookie, acts as the logged-in user.
  - `getLoggedInUser()` — React-`cache`d, returns a **plainified** (`JSON.parse(JSON.stringify(...))`) user or `null`. The plainify step is required so the user can be passed from Server Layouts into Client Providers without Next.js serialization errors — preserve it when adding similar helpers.
- Browser-side Appwrite SDK is `lib/appwrite/client.ts` (`account`, `databases`, `storage`, `realtime`). Anything that needs the user's session from the server must go through `createSessionClient()` or a Server Action, **not** the browser client.

### Data layer

- `lib/appwrite/config.ts` centralises database + collection IDs. New collections must be added here AND in `scripts/setup-appwrite.ts`.
- `lib/appwrite/database.ts` holds typed CRUD helpers and the `Profile` / `Therapist` / `TherapySession` / `Message` / `MoodLog` / `JournalEntry` / `Goal` / `ClinicalNote` / `SessionFeedback` interfaces. Every helper sets explicit Appwrite `Permission` rules — follow the existing pattern (owner read/update/delete + admin read; therapist label for clinical data) when adding new collections.
- Realtime subscriptions use `appwriteClient.subscribe(...)` from the browser SDK (see `hooks/useVideoSession.ts` for the signaling pattern).

### Video sessions

`hooks/useVideoSession.ts` + `app/api/video/session/route.ts` implement WebRTC via **Cloudflare Calls**. Client calls the local Next.js route handler, which proxies to Cloudflare; track metadata is written into the `sessions` Appwrite collection document (`patientTracks` / `therapistTracks` JSON fields), and the other participant subscribes via Appwrite Realtime to learn about remote tracks. Don't try to replace this with a direct browser-to-Cloudflare call — Cloudflare credentials must stay server-side.

### Analytics (PostHog)

PostHog is initialised in **two** places by design:
1. `instrumentation-client.ts` — Next.js client-instrumentation hook, sets `capture_exceptions: true`.
2. `app/components/PostHogProvider.tsx` — wraps the React tree and provides `usePostHog()`; also runs `posthog.identify()` from the server-fetched user on mount.

Both use `api_host: "/ingest"` which is reverse-proxied to PostHog US in `next.config.ts` (`/ingest/static/*`, `/ingest/array/*`, `/ingest/*`). **Don't change the host to `us.i.posthog.com` directly** — the proxy is there to dodge ad-blockers. Server-side events use the factory in `lib/posthog-server.ts` (`flushAt: 1`, `flushInterval: 0` — events flush per-call because route handlers are short-lived). See `posthog-setup-report.md` for the full list of tracked events.

### Clinical risk

`lib/clinical/risk.ts` is a keyword-based risk scanner (`analyzeRisk(text) -> "low" | "moderate" | "high"`). It's intentionally simple — used in chat (`app/api/chat/`) and admin risk views. If extending, keep `HIGH_RISK_KEYWORDS` and `MODERATE_RISK_KEYWORDS` as the source of truth; the corresponding test is `__tests__/clinical-risk.test.ts`.

## Operational scripts (`scripts/`)

All scripts run as `APPWRITE_API_KEY=<key> npx tsx scripts/<name>.ts`. They use the admin client and are intended for one-off operator tasks, not application code.

- `setup-appwrite.ts` — bootstraps the database, collections, attributes, and indexes. Run once per environment; re-running is idempotent for existing collections but new collections must be added here AND in `lib/appwrite/config.ts`.
- `check-collections.ts`, `check-user-roles.ts` — read-only diagnostics. Safe to run anytime.
- `repair-profiles.ts`, `fix-reagan-user.ts` — destructive data fixes. Read them before running and treat as templates for similar repairs rather than reusable utilities.

## Repo-root noise

The repo root contains scratch/debug files left over from manual Appwrite testing — `test_appwrite.js`, `test_appwrite2.js` … `test_appwrite6.js`, `test_appwrite_local.js`, `test_node_appwrite.js`. **These are not part of the Jest suite** (the suite lives in `__tests__/` and Jest does not pick them up). Don't treat them as authoritative examples; they may reference stale schema or credentials. Safe to delete if they're in the way, but confirm with the user first.

## Testing

- Jest config: `jest.config.js` (uses `next/jest` preset, jsdom env, `@/` alias). Setup in `jest.setup.js` polyfills `TextEncoder`, `matchMedia`, `IntersectionObserver`.
- Coverage scope: `app/**`, `hooks/**`, `lib/**`.
- API-route tests (`__tests__/api-*.test.ts`) exercise route handlers directly — follow the existing mocking pattern for `lib/appwrite/server` and `posthog-node` when adding new ones.

## Environment

Required env vars (see `.env.local`):
- `NEXT_PUBLIC_APPWRITE_ENDPOINT`, `NEXT_PUBLIC_APPWRITE_PROJECT_ID`, `NEXT_PUBLIC_APPWRITE_DATABASE_ID`, `NEXT_PUBLIC_APPWRITE_STORAGE_BUCKET_ID`
- `NEXT_PUBLIC_APPWRITE_*_COLLECTION_ID` for each collection in `lib/appwrite/config.ts` (some have hard-coded fallbacks)
- `APPWRITE_API_KEY` — server-only, admin client
- `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`
- `NEXT_PUBLIC_SITE_URL` — used for OAuth redirect URLs in SSR contexts
