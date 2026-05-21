"use client";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider, usePostHog } from "posthog-js/react";
import { useEffect, useState } from "react";

if (globalThis.window !== undefined) {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";

  if (key && !posthog.__loaded) {
    const isDev =
      globalThis.window.location.host.includes("localhost") ||
      globalThis.window.location.host.includes("127.0.0.1");

    posthog.init(key, {
      api_host: "/ingest",
      ui_host: host,
      defaults: "2026-01-30",
      capture_pageview: "history_change",
      capture_pageleave: true,
      loaded: (ph) => {
        if (isDev) ph.opt_out_capturing();
      },
    });
  }
}

interface MeUser {
  $id: string;
  name?: string;
  email?: string;
  labels?: string[];
}

function PostHogIdentify() {
  const ph = usePostHog();
  const [me, setMe] = useState<MeUser | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/me", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled) setMe(data?.user ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ph) return;
    if (me) {
      ph.identify(me.$id, { email: me.email, name: me.name });
    } else {
      ph.reset();
    }
  }, [ph, me]);

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
