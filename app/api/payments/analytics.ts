import { captureServer, SYSTEM_DISTINCT_ID } from "@/lib/analytics/server";
import type { AnalyticsEvent } from "@/lib/analytics/events";

/**
 * Analytics for the payment routes.
 *
 * Everything here is deliberately unable to fail a charge. These events are the
 * only record of revenue PostHog will ever see, but a payment is worth more than
 * a datapoint: if the analytics call is broken, slow, or misconfigured, the
 * money still has to move and the webhook still has to answer 200.
 */

export { SYSTEM_DISTINCT_ID };

/**
 * Fire one payment-related server event. Never throws, never rejects.
 *
 * Now a thin alias over `captureServer` (`lib/analytics/server.ts`), which
 * generalised the never-throw guarantee — including the bounded flush timeout —
 * that was worked out here first and then turned out to be needed by every
 * other server capture in the app. There is one implementation rather than two
 * that can drift apart.
 *
 * It survives as a named function because the payment routes are where that
 * guarantee is load-bearing rather than merely tidy, and a reader following
 * `capturePaymentEvent` deserves to land on the reason: both payment routes
 * capture from inside a `try` whose `catch` returns 500, and in the webhook that
 * 500 tells Paystack to redeliver an event we have already banked and already
 * granted an entitlement for. An unguarded `posthog.capture` would therefore
 * turn any analytics hiccup into duplicate processing of a real payment. An
 * environment with no PostHog key at all must still be able to take money.
 */
export async function capturePaymentEvent(params: {
  distinctId: string;
  event: AnalyticsEvent;
  properties: Record<string, unknown>;
}): Promise<void> {
  await captureServer(params);
}
