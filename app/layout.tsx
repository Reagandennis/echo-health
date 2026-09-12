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

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

// Display serif for marketing headlines and greetings (`font-display`). The
// soft axis keeps it warm rather than editorial; UI text stays in Geist.
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
  style: ["normal", "italic"],
  axes: ["SOFT", "opsz"],
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
        <PostHogProvider>
          <UserProvider hydrate>
            {children}
            <Suspense fallback={null}>
              <ChatWidgetWrapper />
            </Suspense>
          </UserProvider>
        </PostHogProvider>
      </body>
    </html>
  );
}
