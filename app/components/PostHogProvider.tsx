"use client";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider, usePostHog } from "posthog-js/react";
import { useEffect } from "react";
import type { Models } from "appwrite";

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

function PostHogIdentify({
  user,
}: {
  user: Models.User<Models.Preferences> | null;
}) {
  const ph = usePostHog();

  useEffect(() => {
    if (!ph) return;
    if (user) {
      ph.identify(user.$id, {
        email: user.email,
        name: user.name,
      });
    } else {
      ph.reset();
    }
  }, [ph, user]);

  return null;
}

export default function PostHogProvider({
  user,
  children,
}: Readonly<{
  user: Models.User<Models.Preferences> | null;
  children: React.ReactNode;
}>) {
  return (
    <PHProvider client={posthog}>
      <PostHogIdentify user={user} />
      {children}
    </PHProvider>
  );
}
