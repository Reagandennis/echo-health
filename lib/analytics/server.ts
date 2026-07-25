import "server-only";

import { getPostHogClient } from "@/lib/posthog-server";
import type { AnalyticsEvent, PersonProperties } from "@/lib/analytics/events";

/**
 * Upper bound on how long a flush may hold a request open.
 *
 * `getPostHogClient()` sets `flushAt: 1, flushInterval: 0`, so `capture()`
 * dispatches immediately and `shutdown()` waits for that dispatch. Its default
 * timeout is 30 SECONDS — long enough that a degraded PostHog would stall the
 * payment webhook past Paystack's own timeout, and a timed-out webhook is a
 * REDELIVERED webhook. Three seconds is generous for a single event and bounds
 * the damage.
 */
const FLUSH_TIMEOUT_MS = 3_000;

/**
 * Fire one server-side event. Never throws, never rejects.
 *
 * The swallowed catch is the point of this function, not an oversight. This
 * generalises the helper that previously lived in `app/api/payments/analytics.ts`,
 * where the reasoning was written down and still applies everywhere: the
 * payment webhook captures from inside a `try` whose `catch` returns 500, and a
 * 500 tells Paystack to redeliver an event we have already banked and already
 * granted an entitlement for. An unguarded `posthog.capture` would turn any
 * analytics hiccup into duplicate processing of a real payment.
 *
 * The same shape holds for the rest of the app: booking a session, assigning a
 * role and sending a message must all succeed in an environment with no PostHog
 * key at all. `new PostHog(...)` throws outright when the key is unset, which is
 * why the client is constructed INSIDE the try — constructing it is itself one
 * of the failure modes being contained.
 *
 * Callers should `await` this so the event flushes before a serverless-style
 * response ends, but nothing depends on its result.
 */
export async function captureServer(params: {
  distinctId: string;
  event: AnalyticsEvent;
  properties?: Record<string, unknown>;
  /**
   * Person properties to set alongside the event. Use `$set_once` semantics via
   * `setOnce` for values that must not be overwritten by a later event.
   */
  set?: PersonProperties;
  setOnce?: PersonProperties;
}): Promise<void> {
  try {
    const posthog = getPostHogClient();
    posthog.capture({
      distinctId: params.distinctId,
      event: params.event,
      properties: {
        ...params.properties,
        // Lets every insight separate server-attested events from
        // browser-reported ones without maintaining a list of which is which.
        $lib: "echo-server",
        ...(params.set ? { $set: params.set } : {}),
        ...(params.setOnce ? { $set_once: params.setOnce } : {}),
      },
    });
    await posthog.shutdown(FLUSH_TIMEOUT_MS);
  } catch (err) {
    // Logged, never rethrown. A missing event is a reporting gap; a thrown one
    // is a payment incident, a lost booking, or a failed role assignment.
    console.error("analytics capture failed", { event: params.event, err });
  }
}

/**
 * Distinct ID for events that genuinely have no user behind them — currently
 * only a payment webhook naming a reference we never issued.
 *
 * Paired with `$process_person_profile: false` at the call site so PostHog
 * records the event without creating or updating a person, which keeps a
 * synthetic identity out of the person table entirely.
 */
export const SYSTEM_DISTINCT_ID = "system";
