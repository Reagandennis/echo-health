import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ── Compression ────────────────────────────────────────────────────
  compress: true,

  // ── React strict mode catches perf regressions early ──────────────
  reactStrictMode: true,

  // ── Image optimisation ─────────────────────────────────────────────
  images: {
    formats: ["image/avif", "image/webp"],   // serve AVIF first, fallback to WebP
    minimumCacheTTL: 60 * 60 * 24 * 7,      // cache optimised images 7 days
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
    ],
  },

  // ── Experimental: optimise lucide-react icon tree-shaking ─────────
  experimental: {
    optimizePackageImports: ["lucide-react"],

    /**
     * Server Actions cap request bodies at 1 MB by default, which is smaller
     * than the therapist onboarding uploads (profile photo up to 5 MB, licence
     * document up to 10 MB). Without this, those uploads fail inside the
     * framework — before `uploadAvatarAction` / `uploadKycDocumentAction` run —
     * so the app's own size check never gets a chance to produce a useful error.
     *
     * Sized just above the largest accepted file to leave room for multipart
     * encoding overhead. Keep it in step with `MAX_AVATAR_BYTES` /
     * `MAX_DOCUMENT_BYTES` in `app/actions/database.ts`: the framework limit
     * should always be the looser of the two, so users get the app's message
     * rather than a raw framework error.
     */
    serverActions: {
      bodySizeLimit: "12mb",
    },
  },

  // ── PostHog reverse proxy ──────────────────────────────────────────
  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: "https://us-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/array/:path*",
        destination: "https://us-assets.i.posthog.com/array/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://us.i.posthog.com/:path*",
      },
    ];
  },

  // ── Security headers ───────────────────────────────────────────────
  async headers() {
    /**
     * `connect-src` no longer needs a backend host allowlisted.
     *
     * Most backend calls are same-origin: the database is reached through Server
     * Actions, PostHog through the `/ingest` rewrite below, and realtime through
     * the `/api/events` SSE stream.
     *
     * The exception is the Echo video backend (video.echopsychology.com): the
     * browser opens its signaling WebSocket and fetches ICE creds DIRECTLY, so
     * its https + wss origins must be allowlisted in `connect-src`. (The earlier
     * Cloudflare Calls stack was proxied through `/api/video/*` and needed no
     * allowlist; the new service is contacted cross-origin.)
     *
     * WebRTC media itself negotiates STUN/TURN outside the fetch layer and so is
     * not governed by `connect-src`.
     */
    const videoOrigin = "https://video.echopsychology.com";
    const videoWsOrigin = "wss://video.echopsychology.com";
    const cspDirectives = [
      "default-src 'self'",
      // 'unsafe-inline' is currently required by Next.js for hydration. Tighten
      // to nonces once we move all inline scripts to React 19's <Script> with
      // explicit nonce support.
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      `connect-src 'self' ${videoOrigin} ${videoWsOrigin}`,
      "media-src 'self' blob:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
      "upgrade-insecure-requests",
    ];

    const securityHeaders = [
      {
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload",
      },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      {
        // Camera / microphone needed for Cloudflare Calls video sessions.
        // Everything else off by default.
        key: "Permissions-Policy",
        value:
          "camera=(self), microphone=(self), geolocation=(), payment=(), usb=(), interest-cohort=()",
      },
      { key: "X-DNS-Prefetch-Control", value: "on" },
      // CSP rolled out in Report-Only first. Watch browser-reported violations
      // (and any logging endpoint you wire up via `report-to`) for a sprint,
      // then switch the key to `Content-Security-Policy` to enforce.
      {
        key: "Content-Security-Policy-Report-Only",
        value: cspDirectives.join("; "),
      },
    ];

    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },

  skipTrailingSlashRedirect: true,
};

export default nextConfig;
