import type { Metadata } from "next";

export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://echohealth.app";

export const siteName = "Echo Health";

export const defaultDescription =
  "Connect with licensed therapists on your terms. Echo Health makes mental wellness accessible, personal, and effective — whenever you need it.";

type PageMetaInput = {
  title: string;
  description?: string;
  path: string;
  /** Set false on policy / legal / utility pages we don't want crawlers to prioritise. */
  index?: boolean;
};

/**
 * Build per-page metadata that inherits from the root layout.
 * Pass an absolute path (e.g. "/about"); helper resolves canonical + OG URL.
 */
export function pageMetadata({ title, description, path, index = true }: PageMetaInput): Metadata {
  const url = `${siteUrl}${path}`;
  const desc = description ?? defaultDescription;

  return {
    title,
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
      title,
      description: desc,
    },
  };
}
