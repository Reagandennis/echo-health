"use client";

import { useEffect, useSyncExternalStore } from "react";

import type { PersonProperties } from "@/lib/analytics/events";
import {
  analyticsNeverReadyOnServer,
  identify,
  isAnalyticsReady,
  reset,
  startSessionRecording,
  stopSessionRecording,
  subscribeAnalyticsReady,
} from "@/lib/analytics/client";
import { useSession } from "./UserProvider";

/*
 * No `posthog.init()` here — `instrumentation-client.ts` owns it.
 *
 * This module used to init too, behind `if (key && !posthog.__loaded)`. Next.js
 * runs the client-instrumentation hook first, so that guard was always false by
 * the time this evaluated and every option here was dead code — including a dev
 * opt-out that was supposed to keep localhost out of the production project.
 *
 * ## It also no longer imports posthog-js, and that is the point
 *
 * This component previously wrapped the tree in `posthog-js/react`'s provider,
 * passing the SDK singleton as `client`, so that its own child could call
 * `usePostHog()`. Nothing else in the app consumed that context — it was a
 * closed loop, and the cost of it was enormous: a static `import posthog from
 * "posthog-js"` in the ROOT LAYOUT'S module graph puts the SDK in the initial
 * chunk of every route in the app. Measured on the home page, that was 167 KB
 * gzipped out of 286 KB of JavaScript, on a page made of static HTML.
 *
 * Both the provider and the direct import are gone. `lib/analytics/client.ts`
 * reaches the SDK once the deferred dynamic import has resolved, and queues
 * anything issued before then.
 *
 * ## Where the user comes from
 *
 * From `UserProvider`'s context, NOT from a fetch of its own. This component
 * used to issue its own mount-time `GET /api/me`, and so did `UserProvider` —
 * two uncacheable round-trips per page view (the route is `force-dynamic`), on
 * every route, including for anonymous visitors with no cookie to decrypt. The
 * root layout nests `UserProvider` outside this one so there is a single probe
 * and a single answer. If that nesting is ever inverted, `useSession()` throws
 * rather than failing quietly.
 */

function roleOf(labels: string[] | undefined): PersonProperties["role"] {
  if (labels?.includes("admin")) return "admin";
  if (labels?.includes("therapist")) return "therapist";
  if (labels?.includes("client")) return "client";
  return "none";
}

function PostHogIdentify() {
  const { user, resolved } = useSession();

  /*
   * The SDK is both deferred AND dynamically imported, so it may genuinely not
   * exist when the session resolves.
   *
   * `lib/analytics/client.ts` would queue these calls anyway, so gating is
   * belt-and-braces for `identify` — but NOT for the replay decision below,
   * which must not be queued and replayed out of order against a session state
   * that has since changed.
   */
  const analyticsReady = useSyncExternalStore(
    subscribeAnalyticsReady,
    isAnalyticsReady,
    analyticsNeverReadyOnServer
  );

  useEffect(() => {
    /*
     * `resolved`, not `!loading`. `UserProvider` clears `loading` even when the
     * /api/me probe fails, which leaves `user` null without anything having
     * established that nobody is signed in. Reading that as "signed out" would
     * take the `else` branch below and start replay on an authenticated screen.
     * Unknown must keep replay off — failing closed matters more here than a
     * few lost marketing recordings.
     */
    if (!analyticsReady || !resolved) return;

    if (user) {
      /*
       * Pseudonymous identification: the Auth0 `sub` and a coarse role, with no
       * email and no name.
       *
       * Every person profile in the project used to carry both, which made the
       * analytics vendor's copy of the data a list of identifiable people using
       * a mental-health service. The `sub` still joins back to a real user
       * through this app's own database when there is a genuine reason to — but
       * that path is access-controlled and audited, and this one is not.
       */
      identify(user.$id, { role: roleOf(user.labels) });

      /*
       * Hard stop on replay for anyone with a session.
       *
       * Recording is disabled at init, so this is normally a no-op — it exists
       * for the sign-in transition, where a visitor was being recorded
       * anonymously and then authenticates within the same page lifetime. That
       * recording must stop at the door, not at the next full page load.
       */
      stopSessionRecording();
    } else {
      reset();
      /*
       * Confirmed no session: this is the marketing and signup funnel, where
       * replay is genuinely useful and no clinical data is on screen.
       */
      startSessionRecording();
    }
  }, [analyticsReady, resolved, user]);

  return null;
}

export default function PostHogProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <PostHogIdentify />
      {children}
    </>
  );
}
