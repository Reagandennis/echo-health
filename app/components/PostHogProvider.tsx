"use client";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider, usePostHog } from "posthog-js/react";
import { useEffect, useState } from "react";

import type { PersonProperties } from "@/lib/analytics/events";

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
 */

interface MeUser {
  $id: string;
  labels?: string[];
}

/** Tri-state. `null` is "not known yet", NOT "signed out" — see below. */
type SessionState = { user: MeUser | null } | null;

function roleOf(labels: string[] | undefined): PersonProperties["role"] {
  if (labels?.includes("admin")) return "admin";
  if (labels?.includes("therapist")) return "therapist";
  if (labels?.includes("client")) return "client";
  return "none";
}

function PostHogIdentify() {
  const ph = usePostHog();
  const [state, setState] = useState<SessionState>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/me", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled) setState({ user: data?.user ?? null });
      })
      // A failed probe leaves state `null` — unknown — which keeps replay off.
      // Failing closed matters more here than a few lost marketing recordings.
      .catch(() => {
        if (!cancelled) setState(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ph || state === null) return;

    if (state.user) {
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
      const props: PersonProperties = { role: roleOf(state.user.labels) };
      ph.identify(state.user.$id, props);

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
  }, [ph, state]);

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
