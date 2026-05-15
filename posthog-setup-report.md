<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into Echo Health. Here is a summary of what was set up:

**Client-side initialization** — `instrumentation-client.ts` was created at the project root to initialize PostHog via the `posthog-js` SDK with error tracking (`capture_exceptions: true`) and a reverse proxy to reduce ad-blocker interference.

**Reverse proxy** — `next.config.ts` was updated with `/ingest/*` rewrites routing through `us.i.posthog.com` and `us-assets.i.posthog.com`.

**Server-side client** — `lib/posthog-server.ts` was created as a lightweight factory for `posthog-node`, used in API routes to capture server-side events.

**Environment variables** — `NEXT_PUBLIC_POSTHOG_KEY` and `NEXT_PUBLIC_POSTHOG_HOST` were written to `.env.local`.

**User identification** — `posthog.identify()` is called on successful sign-up and sign-in using the Appwrite user ID as the distinct ID, with `email` and `name` as person properties.

| Event | Description | File |
|---|---|---|
| `user_signed_up` | User successfully created an account via email/password | `app/(auth)/signup/page.tsx` |
| `user_signed_in` | User successfully signed in via email/password | `app/(auth)/signin/page.tsx` |
| `user_role_selected` | User completed role selection during onboarding (client or therapist) | `app/api/user/set-role/route.ts` |
| `therapist_onboarding_completed` | Therapist submitted their full onboarding profile | `app/therapist/onboarding/page.tsx` |
| `video_session_joined` | Client entered a video session room | `app/dashboard/sessions/[sessionId]/page.tsx` |
| `chat_message_sent` | A user sent a support chat message | `app/components/ChatWidget.tsx` |
| `promo_code_redeemed` | User successfully redeemed a promo code | `app/api/promo/route.ts` |
| `goal_created` | Client created a new therapy goal | `app/dashboard/goals/page.tsx` |
| `goal_completed` | Client completed all milestones in a goal | `app/dashboard/goals/page.tsx` |
| `therapist_kyc_reviewed` | Admin approved or rejected a therapist KYC verification | `app/api/admin/therapist-kyc/route.ts` |
| `plan_upgrade_clicked` | Client clicked the upgrade plan CTA on the billing page | `app/dashboard/billing/page.tsx` |

## Next steps

We've built a dashboard and five insights to keep an eye on user behavior:

- [Analytics basics dashboard](/dashboard/1587400)
- [New Signups & Sign-ins Over Time](/insights/yaZDbXgX) — daily trend of registrations and logins
- [Signup to Video Session Funnel](/insights/UdMAn9Rf) — conversion from signup → role selected → video session joined
- [Goal Activity (Created & Completed)](/insights/9A3Qcdcy) — client engagement with therapy goals
- [Therapist Onboarding Completion](/insights/uQCLDbZs) — funnel from role selection to completed therapist profile
- [Plan Upgrade Clicks & Promo Code Redemptions](/insights/PqwN5WP5) — monetization signals

### Agent skill

We've left an agent skill folder in your project at `.claude/skills/integration-nextjs-app-router/`. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
