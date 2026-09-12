/**
 * A one-shot "PostHog has been initialised" signal.
 *
 * ## Why this exists
 *
 * `instrumentation-client.ts` defers `posthog.init()` to an idle callback so
 * the SDK's startup work (the `/flags` request, autocapture and rage-click
 * listeners, its timers) stops competing with first paint. That deferral
 * introduces an ordering hazard: the React tree mounts, and `PostHogProvider`
 * can resolve the session from `/api/me`, before init has run.
 *
 * posthog-js does not queue calls made before init — `capture`, `identify` and
 * `reset` each log "You must initialize PostHog before calling posthog.<x>" and
 * then return. So on any load where the session round-trip beat the idle
 * callback, the user would simply never be identified, with nothing but a
 * console line to show for it. That is precisely the class of silent analytics
 * failure this codebase has been bitten by before.
 *
 * ## Shape
 *
 * Deliberately a `useSyncExternalStore`-compatible subscribe/snapshot pair
 * rather than a promise: the consumer is a React effect that must be able to
 * unsubscribe on teardown, and resolving a promise inside an effect would mean
 * a `setState` after init with no way to cancel it.
 *
 * This module holds no reference to posthog-js. It is a latch, not a wrapper —
 * `instrumentation-client.ts` remains the only place that knows how PostHog is
 * configured, and the only place that calls `init()`.
 */

let ready = false;
const subscribers = new Set<() => void>();

/**
 * Flip the latch. Called exactly once, by `instrumentation-client.ts`, once
 * `posthog.init()` has returned. Idempotent, because a second init would be a
 * bug worth surviving rather than compounding.
 */
export function markAnalyticsReady(): void {
  if (ready) return;
  ready = true;
  for (const notify of subscribers) notify();
  subscribers.clear();
}

/** `useSyncExternalStore` subscribe. Returns the unsubscribe function. */
export function subscribeAnalyticsReady(onChange: () => void): () => void {
  if (ready) return () => {};
  subscribers.add(onChange);
  return () => {
    subscribers.delete(onChange);
  };
}

/** `useSyncExternalStore` client snapshot. */
export function isAnalyticsReady(): boolean {
  return ready;
}

/**
 * `useSyncExternalStore` server snapshot. Always false: `init()` is
 * browser-only, so nothing rendered on the server may assume PostHog exists.
 * Hoisted to module scope so the identity is stable across renders.
 */
export const analyticsNeverReadyOnServer = (): false => false;
