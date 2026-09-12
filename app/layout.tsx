import type { Metadata } from "next";
import { Geist, Geist_Mono, Fraunces } from "next/font/google";
import "./globals.css";
import ChatWidgetWrapper from "./components/ChatWidgetWrapper";
import { siteUrl, siteName, legalEntityName, defaultDescription } from "@/lib/seo";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

/**
 * `preload: false` is the whole point of this block.
 *
 * `next/font` preloads any family with a `subsets` option, on every route it
 * is declared for — and this one is declared in the root layout, so a 22.6 KB
 * monospace file was being fetched with `<link rel="preload">` ahead of the
 * LCP on every page of the site.
 *
 * Outside the admin portal, `font-mono` is used in exactly two places:
 * `app/error.tsx` and `app/global-error.tsx`, both rendering an error digest.
 * Preloading a font for a screen almost nobody sees, on every screen everybody
 * sees, is the wrong trade. It still loads when something actually asks for
 * it; it just no longer competes at first paint.
 */
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

/**
 * Display serif for marketing headlines (`font-display`). UI text stays in Geist.
 *
 * ## Why there is no italic here any more
 *
 * `style: ["normal", "italic"]` pulled a second variable font file of 145.8 KB
 * — the largest single asset on the site — and preloaded it on every one of
 * the ~100 routes. It existed for one two-word `<em>` in the home page hero.
 * Every other `italic` in the codebase renders in Geist on a portal screen,
 * which this family never touches.
 *
 * Dropping it removes 145.8 KB per route. If a marketing headline genuinely
 * needs a true italic later, load it as a separate `Fraunces` instance scoped
 * to that page rather than reinstating it in the root layout.
 *
 * `axes` went with it: nothing in the CSS reads `font-variation-settings`, so
 * the SOFT and opsz axes were enlarging the variable table for a variation
 * that was never applied.
 */
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Echo Health — Therapy, reimagined",
    template: "%s | Echo Health",
  },
  description: defaultDescription,
  keywords: [
    "online therapy",
    "mental health",
    "licensed therapist",
    "teletherapy",
    "counseling",
    "anxiety",
    "depression",
    "couples therapy",
    "Echo Health",
  ],
  authors: [{ name: siteName }],
  creator: siteName,
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  /*
   * NO `alternates.canonical` here, deliberately.
   *
   * A canonical in the root layout is not a default, it is a footgun: Next's
   * metadata inheritance hands it to every page that does not override it, so
   * any page whose author forgets `pageMetadata` silently tells Google it is a
   * duplicate of the home page. That had already happened to `/organizations`
   * — the highest commercial-intent page on the site was instructing Google to
   * drop it — and to all three auth pages. Each page now declares its own via
   * `pageMetadata({ path })`.
   */
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName,
    title: "Echo Health — Therapy, reimagined",
    description:
      "Connect with licensed therapists who truly listen. Mental wellness made personal, flexible, and within reach.",
  },
  twitter: {
    card: "summary_large_image",
    site: "@echohealth",
    creator: "@echohealth",
    title: "Echo Health — Therapy, reimagined",
    description:
      "Connect with licensed therapists who truly listen. Mental wellness made personal, flexible, and within reach.",
  },
};

/**
 * The organisation entity.
 *
 * Three things here were wrong and are worth naming, because each failed
 * silently:
 *
 *  - `logo` pointed at `/favicon.ico`, which does not exist in this repo (the
 *    app uses `app/icon.png` / `app/apple-icon.png`). Google requires a
 *    fetchable logo, and `.ico` is not an accepted format anyway, so the
 *    property was invalid and no logo could ever appear in a knowledge panel.
 *    `/echo-logo.png` is the opaque-white original, which is the correct asset
 *    for a logo slot.
 *  - `medicalSpecialty` listed "Psychology", which is not a member of
 *    schema.org's MedicalSpecialty enumeration. An invalid member invalidates
 *    the property.
 *  - `sameAs` claimed `twitter.com/echohealth` while the footer linked to bare
 *    `twitter.com` with no handle, so the structured data asserted an account
 *    the page did not link to. The footer now links the same handles.
 *
 * `alternateName` is here because the rendered wordmark and the registered
 * entity are different strings — without it they resolve as two entities.
 */
const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "MedicalOrganization",
  name: siteName,
  alternateName: legalEntityName,
  url: siteUrl,
  logo: `${siteUrl}/echo-logo.png`,
  description: defaultDescription,
  medicalSpecialty: "Psychiatric",
  areaServed: { "@type": "Country", name: "Kenya" },
  availableService: {
    "@type": "MedicalTherapy",
    name: "Online psychotherapy",
  },
  sameAs: [
    "https://twitter.com/echohealth",
    "https://instagram.com/echohealth",
    "https://linkedin.com/company/echohealth",
  ],
};

import { Suspense } from "react";
import { UserProvider } from "./components/UserProvider";
import PostHogProvider from "./components/PostHogProvider";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      // globals.css sets `scroll-behavior: smooth` for in-page anchors. Next 16
      // no longer suspends it during route changes unless asked to — without
      // this, every navigation would visibly glide back to the top.
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} h-full antialiased`}
    >
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        {/*
          UserProvider is OUTSIDE PostHogProvider, and the order is load-bearing.
          Both used to run their own mount-time `GET /api/me` — a `force-dynamic`
          route that decrypts the session cookie — so every page view on every
          route cost two uncacheable round-trips, anonymous visitors included.
          PostHogProvider now reads the user from this context instead, which
          only works while it is nested inside. Invert these two and it throws
          from `useSession()`; that is deliberate, because the alternative is
          reintroducing the duplicate fetch without anyone noticing.
        */}
        <UserProvider hydrate>
          <PostHogProvider>
            {children}
            <Suspense fallback={null}>
              <ChatWidgetWrapper />
            </Suspense>
          </PostHogProvider>
        </UserProvider>
      </body>
    </html>
  );
}
