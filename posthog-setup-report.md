# Analytics (PostHog) — current design

Supersedes the original post-wizard report, which was written in the Appwrite
era and had rotted in every section: it cited event names the app no longer
emitted, files that had moved, and an `identify()` keyed on the Appwrite user id.
Rules and rationale live in `AGENTS.md` § Analytics; this file is the inventory.

## Shape

| Piece | File | Job |
|---|---|---|
| Taxonomy | `lib/analytics/events.ts` | Every event name + the privacy rule |
| Scrubbing | `lib/analytics/sanitize.ts` | URL / element-text sanitisation, `sanitize_properties` |
| Server capture | `lib/analytics/server.ts` | `captureServer()` — never throws |
| Client init | `instrumentation-client.ts` | The **only** `posthog.init()` |
| Provider | `app/components/PostHogProvider.tsx` | Pseudonymous identify + replay gating |
| Node factory | `lib/posthog-server.ts` | `posthog-node` client (`flushAt: 1`) |

## Events actually emitted

| Event | Where | Side |
|---|---|---|
| `sign_up_started` / `sign_in_started` | `app/(auth)/signup`, `signin` | client (intent) |
| `user_authenticated` | `app/post-login/page.tsx` | **server (truth)** |
| `user_role_selected` | `app/api/user/set-role/route.ts` | server |
| `session_booked` | `createSessionAction` | server, post-commit |
| `session_cancelled` | `updateTherapySessionAction` | server, post-commit |
| `video_room_opened` / `video_connected` / `video_failed` | `hooks/useVideoSession.ts` | client |
| `message_sent` | `sendMessageAction` | server, metadata only |
| `goal_created` / `goal_completed` | `app/dashboard/goals` | client |
| `therapist_kyc_submitted` | `app/onboarding/therapist` | client |
| `therapist_kyc_reviewed` / `therapist_kyc_document_reviewed` | `app/api/admin/therapist-kyc` | server |
| `plan_upgrade_clicked` | `app/dashboard/billing` | client |
| `payment_initialized` | `app/api/payments/initialize` | server |
| `payment_succeeded` / `payment_failed` | `app/api/payments/webhook` | server |
| `promo_code_redeemed` | `app/api/promo` | server |
| `chat_message_sent` | `app/components/ChatWidget.tsx` | client |

Events marked `@unwired` in `lib/analytics/events.ts` are declared but NOT
emitted — `mood_logged`, `journal_entry_created`, `clinical_note_created`,
`therapist_onboarding_started`, `therapist_availability_saved`,
`therapist_directory_viewed`, `therapist_profile_viewed`. Each carries a note on
where its capture belongs. **Do not put an `@unwired` event on a dashboard.**

All payment events go through `capturePaymentEvent`, which is now a thin alias
over `captureServer` so the never-throw guarantee has one implementation rather
than two that can drift.

## Removed

- `video_session_joined` — fired off `therapistTracks`, a column left vestigial
  when the Echo video backend replaced DB track signaling, so it could never
  fire. It also carried `session_id`, a clinical record identifier. The
  `video_*` events above replace it and measure whether the call *connected*,
  which is what actually matters.

## Insights

Dashboard `1587400`. Three were rebuilt because they measured events that do not
exist; one is new.

| Insight | Status |
|---|---|
| `yaZDbXgX` Auth: intent vs completed logins | rebuilt |
| `UdMAn9Rf` Client activation funnel | rebuilt |
| `uQCLDbZs` Therapist supply funnel (KYC) | rebuilt |
| `jXWkbzS6` Session reliability (video) | new |
| `9A3Qcdcy` Goal activity, `PqwN5WP5` Upgrades & promos | unchanged — their events are wired but have never fired |

Server-side events only started on 2026-07-22, so the funnels backfill nothing;
they measure forward from that date.

## Privacy posture

Pseudonymous identification, replay disabled behind the login wall, URLs and
autocapture text scrubbed, no clinical content or risk outcomes captured. The
existing 20 person profiles had `email` and `name` purged via `$unset` on
2026-07-22. Full reasoning in `AGENTS.md`.
