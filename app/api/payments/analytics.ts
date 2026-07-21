import { getPostHogClient } from "@/lib/posthog-server";

/**
 * Analytics for the payment routes.
 *
 * Everything here is deliberately unable to fail a charge. These events are the
 * only record of revenue PostHog will ever see, but a payment is worth more than
 * a datapoint: if the analytics call is broken, slow, or misconfigured, the
 * money still has to move and the webhook still has to answer 200.
 */

/**
 * Upper bound on how long a flush may hold a request open.
 *
 * `getPostHogClient()` sets `flushAt: 1, flushInterval: 0`, so `capture()`
 * dispatches immediately and `shutdown()` waits for that dispatch. Its default
 * timeout is 30 SECONDS — long enough that a degraded PostHog would stall the
 * webhook past Paystack's own timeout, and a timed-out webhook is a REDELIVERED
 * webhook. Three seconds is generous for a single event and bounds the damage.
 */
const FLUSH_TIMEOUT_MS = 3_000;

/**
 * Fire one server-side event. Never throws, never rejects.
 *
 * The swallowed catch is the point of this function, not an oversight. Both
 * payment routes capture from inside a `try` whose `catch` returns 500 — in the
 * webhook that 500 tells Paystack to redeliver an event we have already banked
 * and already granted an entitlement for. An unguarded `posthog.capture` would
 * therefore turn any analytics hiccup into duplicate processing of a real
 * payment.
 *
 * Note that `getPostHogClient()` is called INSIDE the try: `new PostHog(...)`
 * throws outright when `NEXT_PUBLIC_POSTHOG_KEY` is unset, so constructing the
 * client is itself one of the failure modes being contained. An environment with
 * no PostHog key must still be able to take money.
 */
export async function capturePaymentEvent(params: {
  distinctId: string;
  event: string;
  properties: Record<string, unknown>;
}): Promise<void> {
  try {
    const posthog = getPostHogClient();
    posthog.capture({
      distinctId: params.distinctId,
      event: params.event,
      properties: params.properties,
    });
    await posthog.shutdown(FLUSH_TIMEOUT_MS);
  } catch (err) {
    // Logged, never rethrown. A missing event is a reporting gap; a thrown one
    // is a payment incident.
    console.error("payment analytics capture failed", { event: params.event, err });
  }
}

/**
 * Distinct ID for events that genuinely have no user behind them — currently
 * only a webhook naming a reference we never issued.
 *
 * Paired with `$process_person_profile: false` at the call site so PostHog
 * records the event without creating or updating a person, which keeps a
 * synthetic identity out of the person table entirely.
 */
export const SYSTEM_DISTINCT_ID = "system";
