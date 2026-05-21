import posthog from "posthog-js";

const isProd = process.env.NODE_ENV === "production";

posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
  api_host: "/ingest",
  ui_host: "https://us.posthog.com",
  defaults: "2026-01-30",
  // capture_exceptions runs an extra error-listener bundle. Off in dev to
  // reduce HMR/recompile overhead and memory pressure on the dev server.
  capture_exceptions: isProd,
  debug: !isProd,
});
