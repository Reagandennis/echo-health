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
  skipTrailingSlashRedirect: true,
};

export default nextConfig;
