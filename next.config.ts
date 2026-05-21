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
  // CSP intentionally omitted — needs Report-Only rollout to learn what
  // Appwrite/PostHog/Cloudflare/Unsplash actually load before enforcing.
  async headers() {
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
