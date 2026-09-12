"use client";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider, usePostHog } from "posthog-js/react";
import { useEffect, useSyncExternalStore } from "react";

import type { PersonProperties } from "@/lib/analytics/events";
import {
  analyticsNeverReadyOnServer,
  isAnalyticsReady,
  subscribeAnalyticsReady,
} from "@/lib/analytics/ready";
import { useSession } from "./UserProvider";

/*
 * No `posthog.init()` here — `instrumentation-client.ts` owns it.
 *
 * This module used to init too, behind `if (key && !posthog.__loaded)`. Next.js
 * runs the client-instrumentation hook first, so that guard was always false by
 * the time this evaluated and every option here was dead code — including a dev
 * opt-out that was supposed to keep localhost out of the production project.
 * The pageview/pageleave options it set are covered by the `defaults:
 * "2026-01-30"` preset (verified: `$pageleave` is being ingested).
 *
 * This component owns the two things init cannot do: identify the session user,
 * and decide whether session replay is allowed to run at all.
 *
 * ## Where the user comes from
 *
 * From `UserProvider`'s context, NOT from a fetch of its own. This component
 * used to issue its own mount-time `GET /api/me`, and so did `UserProvider` —
 * two uncacheable round-trips per page view (the route is `force-dynamic`), on
 * every route, including for anonymous visitors with no cookie to decrypt. The
 * root layout now nests `UserProvider` outside this one so there is a single
 * probe and a single answer. If that nesting is ever inverted again, this
 * component throws from `useSession()` rather than failing quietly.
 */

function roleOf(labels: string[] | undefined): PersonProperties["role"] {
  if (labels?.includes("admin")) return "admin";
  if (labels?.includes("therapist")) return "therapist";
  if (labels?.includes("client")) return "client";
  return "none";
}

function PostHogIdentify() {
  const ph = usePostHog();
  const { user, resolved } = useSession();

  /*
   * `init()` is deferred to an idle callback, so the SDK may not exist yet when
   * the session resolves. posthog-js drops `identify`/`reset` issued before
   * init — it logs a line and returns — so without this gate the user would go
   * silently unidentified on whichever loads lost that race.
   */
  const analyticsReady = useSyncExternalStore(
    subscribeAnalyticsReady,
    isAnalyticsReady,
    analyticsNeverReadyOnServer,
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
    if (!ph || !analyticsReady || !resolved) return;

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
      const props: PersonProperties = { role: roleOf(user.labels) };
      ph.identify(user.$id, props);

      /*
       * Hard stop on replay for anyone with a session.
       *
       * Recording is disabled at init, so this is normally a no-op — it exists
       * for the sign-in transition, where a visitor was being recorded
       * anonymously and then authenticates within the same page lifetime. That
       * recording must stop at the door, not at the next full page load.
       */
      posthog.stopSessionRecording();
    } else {
      ph.reset();
      /*
       * Confirmed no session: this is the marketing and signup funnel, where
       * replay is genuinely useful and no clinical data is on screen.
       */
      posthog.startSessionRecording();
    }
  }, [ph, analyticsReady, resolved, user]);

  return null;
}

export default function PostHogProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <PHProvider client={posthog}>
      <PostHogIdentify />
      {children}
    </PHProvider>
  );
}
