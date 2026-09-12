import SiteHeader from "@/app/components/marketing/SiteHeader";
import SiteFooter from "@/app/components/marketing/SiteFooter";
import JsonLd from "@/app/components/marketing/JsonLd";
import { siteUrl, siteName } from "@/lib/seo";

/**
 * Chrome for every public page.
 *
 * A route group, so no URL moves: `/about` is still `/about`. What changes is
 * that the header and footer are declared once here instead of being pasted
 * into thirteen page files — each of which had drifted into its own variant
 * (three different backdrop treatments, two different border colours, and
 * twelve carrying no navigation at all).
 *
 * Nothing in this layout reads cookies, headers or the session, which is what
 * keeps the pages under it statically renderable. Do NOT add a
 * `getLoggedInUser()` call here to personalise the header — it would opt every
 * marketing route into dynamic rendering, and a signed-in header is not worth
 * serving the home page from a server round-trip.
 */

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: siteName,
  /* The rendered wordmark and the registered entity are not the same string.
     Declaring both is how the knowledge graph resolves them to one entity
     instead of two. */
  alternateName: "Echo Psychology Group",
  url: siteUrl,
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${siteUrl}/therapists?q={search_term_string}`,
    },
    "query-input": "required name=search_term_string",
  },
};

export default function MarketingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <JsonLd data={websiteJsonLd} />
      <SiteHeader />
      {/* The header's skip link targets this. */}
      <main id="main" className="flex flex-1 flex-col">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
