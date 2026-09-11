import type { Metadata } from "next";
import { Geist, Geist_Mono, Fraunces } from "next/font/google";
import "./globals.css";
import ChatWidgetWrapper from "./components/ChatWidgetWrapper";
import { siteUrl, siteName, defaultDescription } from "@/lib/seo";

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
  alternates: {
    canonical: siteUrl,
  },
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

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "MedicalOrganization",
  name: siteName,
  url: siteUrl,
  logo: `${siteUrl}/favicon.ico`,
  description: defaultDescription,
  medicalSpecialty: ["Psychiatric", "Psychology"],
  areaServed: "Online",
  sameAs: [
    "https://twitter.com/echohealth",
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
