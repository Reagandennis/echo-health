import type { PostHog } from "posthog-js";

import type { AnalyticsEvent, PersonProperties } from "./events";

/**
 * ── The browser-side analytics handle ──────────────────────────────────────
 *
 * Nothing outside `instrumentation-client.ts` imports `posthog-js` directly
 * any more, and that restriction is the entire point of this module.
 *
 * ## Why: posthog-js was 59% of the JavaScript on the home page
 *
 * Measured on a production build of `/`: 286 KB gzipped of JS in total, of
 * which 167 KB was the PostHog SDK. The page is static HTML whose only
 * interactive parts are a nav menu and a couple of small widgets.
 *
 * A static `import posthog from "posthog-js"` anywhere in the root layout's
 * module graph puts the SDK in the initial chunk for **every route in the
 * app**, and `PostHogProvider` — which is in the root layout — had one. The
 * init call was already deferred to an idle callback, but deferring `init()`
 * does nothing about the 167 KB: the bytes are fetched and parsed regardless,
 * because the module is in the graph.
 *
 * So the import is now dynamic, inside the same idle callback. The SDK is
 * fetched when the main thread is free rather than alongside the content.
 *
 * ## Why calls are queued rather than dropped
 *
 * posthog-js does **not** buffer calls made before `init()` — `capture`,
 * `identify` and `reset` each log "You must initialize PostHog before calling
 * posthog.<x>" and return. With a deferred load there is now a real window
 * where a user can act before the SDK exists: `sign_up_started` fires on a
 * click that immediately navigates to Auth0, and `intake_started` fires on
 * mount of `/get-started`.
 *
 * Silently losing exactly the events at the top of the funnel is the failure
 * this codebase has already been bitten by — see the `@unwired` note in
 * `events.ts`, where three dashboards read a flat zero because the events they
 * measured were never emitted. A dropped event and an event that never
 * happened are indistinguishable downstream, so the queue is not a nicety.
 *
 * The queue is bounded. If the SDK never loads (blocked by an extension, a
 * failed network), the alternative to a cap is an array that grows for the
 * lifetime of the tab.
 */

let client: PostHog | null = null;

/** Calls made before the SDK arrived, replayed in order once it does. */
const pending: ((ph: PostHog) => void)[] = [];

/**
 * Enough for the whole pre-init funnel several times over. Past this the SDK
 * is not coming, and holding more costs memory to no purpose.
 */
const MAX_QUEUED = 50;

const subscribers = new Set<() => void>();

/**
 * Hand over the initialised SDK. Called exactly once, by
 * `instrumentation-client.ts`, after `init()` returns.
 *
 * Idempotent: a second init would be a bug worth surviving rather than
 * compounding, and replaying the queue twice would double-count events.
 */
export function markAnalyticsReady(instance: PostHog): void {
  if (client) return;
  client = instance;

  for (const call of pending.splice(0)) {
    try {
      call(instance);
    } catch {
      /* One malformed queued call must not stop the rest from flushing. */
    }
  }

  for (const notify of subscribers) notify();
  subscribers.clear();
}

/**
 * Run `fn` against the SDK — now if it is loaded, otherwise when it arrives.
 *
 * Every call below goes through here. Prefer the named helpers; reach for this
 * only for a method they do not cover.
 */
export function withAnalytics(fn: (ph: PostHog) => void): void {
  if (client) {
    fn(client);
    return;
  }
  if (pending.length < MAX_QUEUED) pending.push(fn);
}

/**
 * The SDK, or null if it has not loaded yet.
 *
 * For the rare caller that needs a synchronous answer rather than a deferred
 * action — `has_opted_out_capturing()` on the cookie-preferences screen is the
 * only one. Everything else should use `withAnalytics` or a helper, because
 * this returns null during the window this module exists to paper over.
 */
export function getAnalytics(): PostHog | null {
  return client;
}

/* ── The API the app actually uses ───────────────────────────────────────── */

/**
 * `event` is typed to the taxonomy rather than to `string`.
 *
 * AGENTS.md: "Do not hand-write event names." Making that a type error is
 * cheaper than making it a review comment.
 */
export function capture(event: AnalyticsEvent, properties?: Record<string, unknown>): void {
  withAnalytics((ph) => ph.capture(event, properties));
}

export function identify(distinctId: string, properties: PersonProperties): void {
  withAnalytics((ph) => ph.identify(distinctId, properties));
}

/**
 * Exceptions are captured through the same queue.
 *
 * `capture_exceptions` is enabled at init in production, but that only covers
 * the ones posthog-js catches itself. This is for the handful of places that
 * catch an error, show the user something useful, and want it reported anyway
 * — the therapist KYC upload being the one that matters, because a failure
 * there is a clinician who cannot finish onboarding.
 */
export function captureException(error: unknown, properties?: Record<string, unknown>): void {
  withAnalytics((ph) => ph.captureException(error, properties));
}

export function reset(): void {
  withAnalytics((ph) => ph.reset());
}

export function startSessionRecording(): void {
  withAnalytics((ph) => ph.startSessionRecording());
}

export function stopSessionRecording(): void {
  withAnalytics((ph) => ph.stopSessionRecording());
}

export function optInCapturing(): void {
  withAnalytics((ph) => ph.opt_in_capturing());
}

export function optOutCapturing(): void {
  withAnalytics((ph) => ph.opt_out_capturing());
}

/* ── Readiness, for `useSyncExternalStore` ───────────────────────────────── */

/** Subscribe. Returns the unsubscribe function. */
export function subscribeAnalyticsReady(onChange: () => void): () => void {
  if (client) return () => {};
  subscribers.add(onChange);
  return () => {
    subscribers.delete(onChange);
  };
}

/** Client snapshot. */
export function isAnalyticsReady(): boolean {
  return client !== null;
}

/**
 * Server snapshot. Always false — the SDK is browser-only, so nothing rendered
 * on the server may assume it exists. Hoisted so the identity is stable across
 * renders; an inline arrow would make `useSyncExternalStore` re-subscribe on
 * every render.
 */
export const analyticsNeverReadyOnServer = (): false => false;
