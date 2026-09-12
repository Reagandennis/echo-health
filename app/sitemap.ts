import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/seo";
import { ALL_INDEXABLE_ROUTES } from "@/lib/navigation";

/**
 * Derived from `lib/navigation.ts`, not hand-maintained.
 *
 * The previous version was a literal list that had already fallen out of step
 * with the site in both directions: `/organizations` existed, was linked from
 * the footer and was never submitted, while `/cookies` was submitted despite
 * being `index: false` — which Search Console reports as "Submitted URL marked
 * 'noindex'". Deriving it means a page cannot ship into the nav without also
 * being declared here.
 *
 * ## No `lastModified`
 *
 * `sitemap.ts` is a cached route handler, so `new Date()` freezes at build
 * time — every URL would report the same `lastmod` and every deploy would bump
 * all of them, including `/privacy` and `/terms`, which change roughly never.
 * Google discounts a `lastmod` it observes to be untrustworthy, so emitting
 * nothing is a better signal than emitting a build timestamp. Add it back
 * per-URL when there is a real modification date to read — which is what
 * `/blog/[slug]` and `/guides/[slug]` will bring.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return ALL_INDEXABLE_ROUTES.map(({ path, changeFrequency, priority }) => ({
    url: `${siteUrl}${path}`,
    changeFrequency,
    priority,
  }));
}
