import { PostHog } from "posthog-node";

export function getPostHogClient(): PostHog {
  /* Same two names as the client. See the comment in
     `instrumentation-client.ts`: the dashboard labels this a "Project API
     key", so it lands in an env var named after the label about as often as
     after the docs — and a mismatch here means server-side events (payments,
     role assignment, KYC) are silently dropped while nothing looks broken. */
  const key =
    process.env.NEXT_PUBLIC_POSTHOG_KEY ?? process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;

  /*
   * Still a non-null assertion, and still THROWS when neither is set. That is
   * load-bearing, not an oversight: `captureServer` in
   * `lib/analytics/server.ts` constructs the client inside its `try` precisely
   * so that a missing key is one of the failure modes its catch contains. Its
   * comment says as much. Returning null instead would move the failure to
   * `posthog.capture(...)` on an undefined value — still caught there, but NOT
   * in the two route handlers that call this directly.
   */
  return new PostHog(key!, {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    flushAt: 1,
    flushInterval: 0,
  });
}
