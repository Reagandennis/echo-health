import type { Metadata } from "next";
import Image from "next/image";
import { ShieldCheck, Lock, CalendarCheck } from "lucide-react";
import BrandMark from "@/app/components/portal/BrandMark";

/**
 * `noindex` is the lever here, not robots.txt.
 *
 * These three pages were previously `Disallow`ed in robots.txt while the home
 * page linked to two of them with an ordinary `<Link>`. Disallow blocks
 * *crawling*, not *indexing*: Google indexed them as URL-only entries ("No
 * information is available for this page") and, because it was forbidden to
 * fetch them, could never discover a `noindex` added later. They are now
 * fetchable and explicitly excluded instead.
 *
 * It has to live in this layout because all three pages are `"use client"`,
 * and a client component cannot export `metadata` at all.
 *
 * `follow: true` on purpose — these pages link onward to /terms and /privacy,
 * and there is no reason to strand those.
 */
export const metadata: Metadata = {
  title: {
    default: "Sign in to Echo Health",
    template: "%s | Echo Health",
  },
  description:
    "Sign in to Echo Health to message your therapist, join a session, or manage your bookings.",
  robots: { index: false, follow: true },
};

// The same three the landing page's trust strip vetted as true — see the note
// on `trust` in app/page.tsx before adding to this list.
const trust = [
  { icon: ShieldCheck, label: "Licence-verified therapists" },
  { icon: Lock, label: "Encrypted in transit" },
  { icon: CalendarCheck, label: "Book around your schedule" },
];

export default function AuthLayout({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex font-sans">
      {/* Brand panel — hidden on mobile */}
      <div className="relative hidden overflow-hidden bg-brand-gradient lg:flex lg:w-[46%] lg:flex-col lg:justify-between lg:p-12">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_0%_0%,rgb(255_255_255/0.16),transparent_70%)]"
        />
        <Image
          src="/echo-butterfly.png"
          alt=""
          width={500}
          height={500}
          className="pointer-events-none absolute -bottom-28 -right-24 w-[520px] opacity-[0.08] brightness-0 invert"
        />

        <BrandMark href="/" tone="dark" className="relative" />

        <figure className="relative max-w-md">
          <blockquote className="font-display text-3xl leading-snug text-white">
            &ldquo;The greatest revolution of our generation is the discovery
            that human beings, by changing the inner attitudes of their minds,
            can change the outer aspects of their lives.&rdquo;
          </blockquote>
          <figcaption className="mt-5 text-sm font-medium text-white/70">— William James</figcaption>
        </figure>

        <ul className="relative flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/85">
          {trust.map(({ icon: Icon, label }) => (
            <li key={label} className="flex items-center gap-2">
              <Icon className="h-4 w-4 text-white/70" strokeWidth={1.8} />
              {label}
            </li>
          ))}
        </ul>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 flex-col items-center justify-center bg-white px-6 py-12">
        {/* Mobile logo. Its second half used to be `text-cream` on white. */}
        <BrandMark href="/" className="mb-10 lg:hidden" />

        <div className="w-full max-w-sm">{children}</div>

        <p className="mt-12 text-xs text-stone-400">
          © {new Date().getFullYear()} Echo Health, Inc.
        </p>
      </div>
    </div>
  );
}
