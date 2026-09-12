import posthog from "posthog-js";

import { sanitizeProperties } from "@/lib/analytics/sanitize";
import { markAnalyticsReady } from "@/lib/analytics/ready";

const isProd = process.env.NODE_ENV === "production";

/**
 * Local runs must not land in the production project as real traffic.
 *
 * `NEXT_PUBLIC_POSTHOG_KEY` lives in `.env`, which `next dev` loads just like
 * `next start` does, so a dev session initialises against the SAME project as
 * production unless it explicitly opts out. Hostname is checked as well as
 * NODE_ENV so that a production BUILD served locally for smoke-testing is also
 * excluded — that case has `NODE_ENV=production` and would otherwise report.
 */
const isLocal =
  globalThis.window !== undefined &&
  /^(localhost|127\.0\.0\.1|\[::1\])$/.test(globalThis.window.location.hostname);

/**
 * This is the ONLY `posthog.init()` in the app.
 *
 * `PostHogProvider` used to call `init()` as well, guarded by
 * `!posthog.__loaded`. Next.js runs this client-instrumentation hook before the
 * React tree mounts, so by the time the provider module evaluated, `__loaded`
 * was already true and its entire options object — including the dev opt-out
 * that was supposed to keep localhost out of production analytics — was
 * silently discarded. Two inits meant the config you read was not the config
 * that applied; keeping one means it is.
 */
function initPostHog() {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
    api_host: "/ingest",
    ui_host: "https://us.posthog.com",
    defaults: "2026-01-30",

    // capture_exceptions runs an extra error-listener bundle. Off in dev to
    // reduce HMR/recompile overhead and memory pressure on the dev server.
    capture_exceptions: isProd,
    debug: !isProd,

    /**
     * SESSION REPLAY IS OFF AT STARTUP AND STAYS OFF BEHIND THE LOGIN WALL.
     *
     * Replay was previously recording authenticated therapist screens — 30-day
     * retention, keypress counts, `/therapist` start URLs. posthog-js masks form
     * INPUTS by default, but rendered DOM text is not masked, so a recording of
     * the clinician's console captures client names in lists, note bodies and
     * message threads: clinical records, sitting in an analytics vendor, viewable
     * by anyone with project access.
     *
     * `PostHogProvider` starts recording only once it has confirmed there is NO
     * session, so replay survives where it earns its keep (the marketing and
     * signup funnel) and never runs where the clinical data is.
     *
     * `maskAllInputs` is belt-and-braces for the anonymous surface, which still
     * includes the support-chat widget and the signup form.
     */
    disable_session_recording: true,
    session_recording: {
      maskAllInputs: true,
      maskTextSelector: "[data-ph-mask]",
    },

    /**
     * Runs on every client event, including the autocaptured ones we never wrote
     * by hand. Strips record ids out of URLs and drops autocaptured element text.
     */
    sanitize_properties: sanitizeProperties,

    loaded: (ph) => {
      if (!isProd || isLocal) ph.opt_out_capturing();
    },
  });

  // Releases `PostHogProvider`'s identify step, which is held until init has
  // run because posthog-js silently drops `identify`/`reset` issued before it.
  markAnalyticsReady();
}

/**
 * ── Why the init is deferred, and why that is safe ─────────────────────────
 *
 * `posthog.init()` is not a cheap assignment. It opens the `/flags` request,
 * installs the autocapture, rageclick, scroll-depth and `$pageleave` listeners,
 * reads and writes persistence, and starts its flush timers — all synchronously,
 * on the main thread, ahead of first paint. The marketing home page is static
 * HTML whose only interactivity is a couple of small widgets, so that work is
 * competing with content the visitor actually came for.
 *
 * Nothing measured is lost by moving it off the critical path:
 *  - The initial `$pageview` is sent by posthog-js from its own startup path,
 *    not by the caller, so it still goes out. The cost is that its timestamp
 *    moves by the length of the idle gap — a timing field, not an event.
 *  - The identify in `PostHogProvider` waits on `markAnalyticsReady()` rather
 *    than racing this, so a signed-in user is still identified exactly once.
 *
 * `requestIdleCallback` is absent in Safari before 17, where it would otherwise
 * mean analytics never initialise at all; hence the `setTimeout` fallback. The
 * `timeout` option covers the other direction — a main thread that stays busy
 * long enough for idle to never arrive — so init is bounded either way.
 *
 * Note what this does NOT do: the `import posthog from "posthog-js"` above
 * still pulls the SDK into the client bundle, because `PostHogProvider` needs
 * the same singleton at module scope. Deferring the download as well would mean
 * a dynamic import behind the React provider, which is a larger change.
 */
if (globalThis.window !== undefined) {
  if (typeof globalThis.requestIdleCallback === "function") {
    globalThis.requestIdleCallback(initPostHog, { timeout: 2000 });
  } else {
    globalThis.setTimeout(initPostHog, 1);
  }
}
