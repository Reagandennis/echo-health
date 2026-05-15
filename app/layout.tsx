import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ChatWidgetWrapper from "./components/ChatWidgetWrapper";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = "https://echohealth.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Echo Health — Therapy, reimagined",
    template: "%s | Echo Health",
  },
  icons: {
    icon: [{ url: "/icon.png", type: "image/png", sizes: "500x500" }],
    apple: [{ url: "/apple-icon.png", type: "image/png", sizes: "500x500" }],
    shortcut: [{ url: "/icon.png", type: "image/png" }],
  },
  description:
    "Connect with licensed therapists on your terms. Echo Health makes mental wellness accessible, personal, and effective — whenever you need it.",
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
  authors: [{ name: "Echo Health" }],
  creator: "Echo Health",
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
    siteName: "Echo Health",
    title: "Echo Health — Therapy, reimagined",
    description:
      "Connect with licensed therapists who truly listen. Mental wellness made personal, flexible, and within reach.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Echo Health — Therapy, reimagined",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@echohealth",
    creator: "@echohealth",
    title: "Echo Health — Therapy, reimagined",
    description:
      "Connect with licensed therapists who truly listen. Mental wellness made personal, flexible, and within reach.",
    images: ["/og-image.png"],
  },
};

import { getLoggedInUser } from "@/lib/appwrite/server";
import { Suspense } from "react";
import { UserProvider } from "./components/UserProvider";
import PostHogProvider from "./components/PostHogProvider";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getLoggedInUser();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <PostHogProvider user={user}>
          <UserProvider user={user}>
            {children}
            <Suspense fallback={null}>
              <ChatWidgetWrapper user={user} />
            </Suspense>
          </UserProvider>
        </PostHogProvider>
      </body>
    </html>
  );
}
