import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/seo";

/**
 * Two things worth knowing about this file.
 *
 * 1. `disallow` is not an indexing control. A disallowed URL that is linked
 *    from somewhere can still be indexed — Google simply cannot see what is on
 *    it, and so can never discover a `noindex` you add later. The authenticated
 *    surfaces below are actually protected by `proxy.ts`; these rules only stop
 *    crawl budget going to pages that will redirect.
 *
 *    This is why `/signin` and `/signup` are NOT listed here any more. They
 *    were, and because the home page links to both without `nofollow`, Google
 *    indexed them as URL-only entries it was forbidden to fetch. They now
 *    carry `robots: { index: false }` from `app/(auth)/layout.tsx`, which is
 *    the lever that actually keeps a page out of the index.
 *
 * 2. `/auth/` is served by the proxy, not by route files, so it does not look
 *    like a page to anyone reading the tree — but it is a real crawlable path
 *    that 302s to Auth0. It was missing from the previous version.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          // Therapist profile photos. The blanket `/api/` rule below would
          // otherwise hide every image on the public directory from Google
          // Images, and `Allow` wins over `Disallow` on a longer match.
          "/api/avatar/",
        ],
        disallow: [
          "/admin/",
          "/therapist/",
          "/dashboard/",
          "/api/",
          "/auth/",
          "/ingest/",
          "/onboarding/",
          "/checkout/",
          "/payment/",
          "/post-login/",
          "/role-select/",
          // Filter permutations of the directory are the same page with a
          // query applied; crawling them multiplies one URL into hundreds.
          "/therapists?",
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
