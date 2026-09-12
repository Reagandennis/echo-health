import type { Metadata } from "next";

/**
 * The site's own origin.
 *
 * ## The guard below is not paranoia
 *
 * `.env.example` ships `NEXT_PUBLIC_SITE_URL=http://localhost:3000`, and the
 * `??` fallback only fires when the variable is *unset* — not when it is set
 * to something wrong. A localhost value reaching a production build would put
 * `http://localhost:3000/...` into every canonical, every `og:url`, every
 * sitemap `<loc>`, `metadataBase`, and robots.txt's `Sitemap:` and `Host:`
 * lines. That is a total de-indexing event with no visible symptom anywhere in
 * the UI: the site looks perfectly fine while telling Google that its
 * canonical home is a machine nobody can reach.
 *
 * So in production a loopback value is treated as if it were unset, and says
 * so on the server console. It is deliberately NOT a thrown error — failing
 * the boot of a working app over a metadata variable trades a silent SEO
 * problem for a loud outage.
 */
const FALLBACK_SITE_URL = "https://echohealth.app";

function resolveSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (!raw) return FALLBACK_SITE_URL;

  const isLoopback = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(:|\/|$)/i.test(raw);
  if (isLoopback && process.env.NODE_ENV === "production") {
    console.warn(
      `[seo] NEXT_PUBLIC_SITE_URL is "${raw}" in a production build. ` +
        `Ignoring it and using ${FALLBACK_SITE_URL} — a loopback origin in ` +
        `canonicals and the sitemap would de-index the site.`
    );
    return FALLBACK_SITE_URL;
  }
  return raw;
}

export const siteUrl = resolveSiteUrl();

export const siteName = "Echo Health";

/** The registered entity. The wordmark says "Echo Health"; contracts say this. */
export const legalEntityName = "Echo Psychology Group";

/**
 * The site-wide fallback description.
 *
 * Deliberately says nothing about country. The clinicians are licensed in
 * Kenya and the clients are worldwide, so a default that named either one
 * would be wrong on most of the pages that inherit it.
 */
export const defaultDescription =
  "Talk to a licensed therapist by video, phone or message, from anywhere in the world. Echo Health makes therapy accessible, private and built around your week.";

type PageMetaInput = {
  title: string;
  description?: string;
  path: string;
  /** Set false on policy / preference / utility pages we don't want indexed. */
  index?: boolean;
  /** Bypass the "%s | Echo Health" template — for the home page, mostly. */
  absoluteTitle?: boolean;
};

/**
 * Build per-page metadata that inherits from the root layout.
 *
 * Pass an absolute path (e.g. "/about"); the helper resolves canonical + OG URL.
 *
 * Note the `twitter.site` / `twitter.creator` below. Next's metadata
 * inheritance replaces a field wholesale rather than merging it, so a page
 * that sets any `twitter` key drops the parent's entire `twitter` block —
 * which is how the handle silently disappeared from every page except the two
 * that had no metadata at all.
 */
export function pageMetadata({
  title,
  description,
  path,
  index = true,
  absoluteTitle = false,
}: PageMetaInput): Metadata {
  const url = `${siteUrl}${path}`;
  const desc = description ?? defaultDescription;

  return {
    title: absoluteTitle ? { absolute: title } : title,
    description: desc,
    alternates: { canonical: url },
    robots: index
      ? { index: true, follow: true, googleBot: { index: true, follow: true } }
      : { index: false, follow: true },
    openGraph: {
      type: "website",
      url,
      siteName,
      title,
      description: desc,
    },
    twitter: {
      card: "summary_large_image",
      site: "@echohealth",
      creator: "@echohealth",
      title,
      description: desc,
    },
  };
}
