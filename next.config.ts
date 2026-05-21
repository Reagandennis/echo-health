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
  async headers() {
    // Derive Appwrite host (https + wss) from the public endpoint, so the CSP
    // matches whichever environment we deploy to.
    const appwriteEndpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ?? "";
    let appwriteHttps = "";
    let appwriteWss = "";
    try {
      const u = new URL(appwriteEndpoint);
      appwriteHttps = `${u.protocol}//${u.host}`;
      appwriteWss = `wss://${u.host}`;
    } catch {
      // env not set at build time — CSP will still be valid, just without the host.
    }

    const cspDirectives = [
      "default-src 'self'",
      // 'unsafe-inline' is currently required by Next.js for hydration. Tighten
      // to nonces once we move all inline scripts to React 19's <Script> with
      // explicit nonce support.
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      `connect-src 'self' ${appwriteHttps} ${appwriteWss}`.trim(),
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
