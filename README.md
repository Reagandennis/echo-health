# Echo Health

> Therapy, reimagined — a teletherapy platform connecting clients with licensed therapists for secure, online sessions.

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![React](https://img.shields.io/badge/React-19-149eca?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-RLS-336791?logo=postgresql&logoColor=white)
![License](https://img.shields.io/badge/license-Proprietary-lightgrey)

Echo Health is a full-stack teletherapy application built on the Next.js App Router. It serves three distinct user surfaces — **clients**, **therapists**, and **admins** — over a single codebase, with authorization enforced both in the database (Postgres Row-Level Security) and in the application layer.

---

## Table of contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Scripts](#scripts)
- [Project structure](#project-structure)
- [Database & migrations](#database--migrations)
- [Testing](#testing)
- [Security & compliance](#security--compliance)
- [Deployment](#deployment)
- [Contributing](#contributing)

---

## Features

- **Three role-based surfaces** — client dashboard (`/dashboard`), therapist workspace (`/therapist`), and admin console (`/admin`), each gated by role at the layout level.
- **Secure 1:1 video sessions** — peer-to-peer WebRTC over a self-hosted signaling backend; the server relays call setup only and never sees media.
- **Real-time updates** — messaging, session state, and support chat update live via Postgres `LISTEN`/`NOTIFY` streamed to the browser over Server-Sent Events.
- **Therapist credentialing (KYC)** — identity-document upload and admin review workflow with a full audit trail.
- **Payments** — plan purchases and therapist payouts via Paystack, with server-verified webhooks.
- **Clinical tooling** — journaling, goals, mood logging, clinical notes, and a keyword-based risk-signal scanner (see [Security & compliance](#security--compliance)).
- **Product analytics** — PostHog, reverse-proxied to survive ad-blockers.

## Tech stack

| Concern | Technology |
| --- | --- |
| Framework | Next.js 16 (App Router) · React 19 · TypeScript 5 |
| Styling | Tailwind CSS 4 |
| Authentication | Auth0 (Universal Login, `@auth0/nextjs-auth0` v4) |
| Database | PostgreSQL with Row-Level Security · Drizzle ORM |
| Real-time | Postgres `LISTEN`/`NOTIFY` → SSE |
| Video | Self-hosted WebRTC signaling backend (`video.echopsychology.com`) |
| Payments | Paystack |
| Email | Resend |
| Analytics | PostHog |
| Testing | Jest · Testing Library |

## Architecture

Authorization is enforced **twice, by design**: Postgres RLS refuses rows the caller may not see (failing quietly), while application-layer checks fail loudly with `Forbidden` for the UI and audit trail. Both layers are kept in sync when adding new data access.

- **Auth** — Auth0 Universal Login. Session routes are mounted in `proxy.ts` (Next 16 renamed `middleware.ts` → `proxy.ts`); role-based access is enforced inside each section's Server Component layout. Roles arrive as namespaced ID-token claims.
- **Data layer** — Every query runs inside a transaction that sets the caller's identity (`withUser` / `withCurrentUser` / `withAnonymous` in `lib/db/session.ts`), which the RLS policies read. The app connects as a non-superuser role that is *subject* to RLS; migrations run as a separate admin role.
- **Real-time** — A single shared `LISTEN` connection per process fans out change notifications (identifiers only, never row contents) to subscribers, who refetch through normal RLS-protected queries.
- **Video** — A server action mints a short-lived, per-participant session token against the video backend (holding the API key server-side); the browser then runs the WebRTC offer/answer/ICE handshake peer-to-peer over a signaling WebSocket.
- **File uploads** — Stored as `bytea` in Postgres and served through authorizing route handlers (public avatars; owner/admin-only KYC documents).

> **Deeper internals** — implementation details, invariants, and the reasoning behind non-obvious decisions live in [`AGENTS.md`](./AGENTS.md). Read it before making non-trivial changes.

## Getting started

### Prerequisites

- **Node.js 20.9+**
- **PostgreSQL** with the application/admin roles and RLS policies applied (see [Database & migrations](#database--migrations))
- Accounts / credentials for Auth0, Paystack, Resend, PostHog, and the video backend

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env.local   # then fill in the values (see below)

# 3. Apply database migrations
npm run db:migrate

# 4. Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

> If you hit out-of-memory errors during development, use `npm run dev:webpack`, which raises the Node heap and uses the webpack compiler.

## Environment variables

Configure these in `.env.local` (never commit it — it is gitignored). Key variables:

| Variable | Purpose |
| --- | --- |
| `APP_DATABASE_URL` | Application DB connection (RLS-subject role). Requires `?sslmode=require`. |
| `DATABASE_URL` | Admin DB connection — used **only** by migrations; bypasses RLS. |
| `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET` | Auth0 application credentials. |
| `AUTH0_SECRET` | 32-byte hex; encrypts the session cookie (`openssl rand -hex 32`). |
| `APP_BASE_URL` | App origin; Auth0 builds callback URLs from it (must match Auth0's allowed callbacks). |
| `ECHO_VIDEO_API_URL`, `ECHO_VIDEO_API_KEY` | Video backend base URL + tenant API key (server-only). |
| `PAYSTACK_SECRET_KEY` | Paystack secret (server-only). |
| `RESEND_API_KEY` | Transactional email (optional in dev; email no-ops if unset). |
| `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` | PostHog analytics. |
| `NEXT_PUBLIC_SITE_URL` | Public site origin for SSR redirect URLs. |

Secrets (`*_SECRET`, `*_API_KEY`, `PAYSTACK_SECRET_KEY`) must stay server-side — never prefix them with `NEXT_PUBLIC_`.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run dev:webpack` | Dev server with the webpack compiler + a larger heap |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | Run ESLint |
| `npm test` | Run the Jest suite |
| `npm run test:watch` | Jest in watch mode |
| `npm run test:coverage` | Jest with coverage |
| `npm run db:generate -- --name=<name>` | Author a new (custom SQL) migration |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:studio` | Browse the database |

## Project structure

```
app/            App Router routes
  dashboard/    Client surface
  therapist/    Therapist surface
  admin/        Admin surface
  api/          Route handlers (events SSE, chat, payments, avatars, KYC, …)
  actions/      Server Actions (database access)
  components/   Shared React components
hooks/          Client hooks (realtime, video session, …)
lib/            Core modules
  auth/         Session + claims
  db/           Drizzle schema, session helpers, migrations
  video.ts      Video backend client
  ...           validation, rate-limit, email, constants, clinical/risk
__tests__/      Jest tests
scripts/        Operational scripts (migrations helpers, verifiers)
```

Path alias: `@/*` → repository root (e.g. `@/lib/db/schema`).

## Database & migrations

Schema changes are written as **custom SQL** and `lib/db/schema.ts` is kept in sync by hand — the Drizzle types mirror the database, but the migrations are the source of truth.

```bash
npm run db:generate -- --name=add_something   # creates a custom SQL migration
# edit the generated .sql, update lib/db/schema.ts to match
npm run db:migrate                             # apply it
```

Row-Level Security policies live in the migrations and are the primary authorization boundary. See `AGENTS.md` for the RLS model and the `db:generate:auto` caveat.

## Testing

```bash
npm test                 # full suite
npx jest path/to/file    # a single file
npx jest -t "name"       # tests matching a name
```

Coverage spans `app/**`, `hooks/**`, and `lib/**`. Note that the Jest suite mocks the database layer, so it does **not** verify RLS policies; database-level guarantees are checked by the verifier scripts in `scripts/`.

## Security & compliance

Echo Health handles sensitive clinical and identity data. Key controls:

- **Row-Level Security** enforces per-user data isolation at the database, independent of application code.
- **KYC documents** (government IDs) are restricted to their owner and admins and served with `Content-Disposition: attachment` to prevent stored-XSS.
- **Journal entries** are author-only; **clinical notes** are visible to the authoring therapist and admins, never the patient.
- **Payments** are granted only from server-verified Paystack responses/webhooks, never from client-supplied data.

> **On the risk scanner:** `lib/clinical/risk.ts` performs **substring keyword matching** against a fixed word list. It is **not** a validated clinical instrument, contains no AI, and produces false positives and false negatives. Its disclosure text must be shown wherever a risk level is surfaced to a human. It is a triage hint, not a diagnosis.

Any regulatory posture (e.g. HIPAA/GDPR) depends on the deployment environment and organizational controls, not on the application code alone.

## Deployment

The application **requires a long-lived Node.js process** (e.g. Azure App Service / Container Apps) — the real-time `LISTEN`/`NOTIFY` connection does not survive on serverless platforms, and connection pooling in transaction mode (PgBouncer) must **not** sit in front of it.

Deployment checklist:

1. Set all environment variables in the hosting platform.
2. Run `npm run db:migrate` against the target database.
3. Add `<origin>/auth/callback` to the Auth0 application's **Allowed Callback URLs**.
4. On the video backend, allowlist the app origin and disable dev mode.

## Contributing

This is a private, proprietary project. Before making non-trivial changes, read [`AGENTS.md`](./AGENTS.md) — it is the single source of truth for architecture, invariants, and the reasoning behind decisions that are easy to get wrong.

---

© Echo Health. All rights reserved.
