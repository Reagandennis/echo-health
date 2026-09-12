import Link from "next/link";
import { ShieldCheck, Lock, BadgeCheck } from "lucide-react";
import BrandMark from "../portal/BrandMark";
import { FOOTER_COLUMNS, FOOTER_LOCATIONS, FOOTER_LEGAL } from "@/lib/navigation";

/**
 * The site's link hub.
 *
 * A flat marketing site gets its internal link graph from the footer, so this
 * one carries every condition page and every location page — they appear
 * nowhere else in the chrome. The previous footer had three columns and twelve
 * links, which left `/organizations` reachable from exactly one place on the
 * whole site.
 *
 * Server component on purpose: it is the largest block of markup on every page
 * and none of it is interactive.
 */

const ASSURANCES = [
  { icon: BadgeCheck, label: "Licence-verified therapists" },
  { icon: Lock, label: "Encrypted in transit" },
  { icon: ShieldCheck, label: "Kenya DPA 2019 aligned" },
] as const;

/**
 * Real handles, not bare domains.
 *
 * The previous footer linked `https://twitter.com` with no path, which is a
 * link to the site rather than to us — and the root layout's `sameAs` claimed
 * `twitter.com/echohealth`, so the structured data asserted an account the
 * page did not link to. Both now say the same thing.
 */
const SOCIALS = [
  {
    href: "https://twitter.com/echohealth",
    label: "Echo Health on X",
    path: "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.253 5.622 5.91-5.622Zm-1.161 17.52h1.833L7.084 4.126H5.117z",
  },
  {
    href: "https://instagram.com/echohealth",
    label: "Echo Health on Instagram",
    path: "M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069Zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073Zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324ZM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881Z",
  },
  {
    href: "https://linkedin.com/company/echohealth",
    label: "Echo Health on LinkedIn",
    path: "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286ZM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065Zm1.782 13.019H3.555V9h3.564v11.452ZM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003Z",
  },
] as const;

export default function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-stone-200/70 bg-stone-50">
      {/* ── Crisis notice ──────────────────────────────────────────────
          Above everything, on every page. Echo is not an emergency
          service, and someone who arrives here in crisis needs to be told
          that before they read a pricing column. */}
      <div className="border-b border-stone-200/70 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
          <p className="text-center text-sm leading-6 text-stone-600">
            Echo Health is not a crisis service. If you or someone else is in
            immediate danger, call{" "}
            <a href="tel:999" className="font-semibold text-brand-700 underline underline-offset-2">999</a>{" "}
            or{" "}
            <a href="tel:112" className="font-semibold text-brand-700 underline underline-offset-2">112</a>.{" "}
            <Link href="/crisis" className="font-semibold text-brand-700 underline underline-offset-2">
              See verified crisis lines
            </Link>
            .
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,18rem)_1fr]">
          <div className="flex flex-col gap-5">
            <BrandMark
              size="sm"
              name={
                <>
                  <span className="text-brand-700">Echo</span>
                  <span className="text-stone-800"> Health</span>
                </>
              }
            />
            <p className="max-w-xs text-sm leading-6 text-stone-600">
              Licensed therapists, booked around your life. Video, phone or
              messaging — from wherever you feel most yourself.
            </p>
            <ul className="flex flex-col gap-2.5">
              {ASSURANCES.map(({ icon: Icon, label }) => (
                <li key={label} className="flex items-center gap-2 text-xs font-medium text-stone-600">
                  <Icon className="h-4 w-4 shrink-0 text-brand-600" strokeWidth={1.8} />
                  {label}
                </li>
              ))}
            </ul>
            <div className="flex gap-1">
              {SOCIALS.map((s) => (
                <a
                  key={s.href}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  className="flex h-11 w-11 items-center justify-center rounded-full text-stone-400 transition-colors hover:bg-white hover:text-stone-700"
                >
                  <svg className="h-[18px] w-[18px]" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path d={s.path} />
                  </svg>
                </a>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-9 sm:grid-cols-4">
            {FOOTER_COLUMNS.map((col) => (
              <nav key={col.label} aria-label={col.label} className="flex flex-col gap-4">
                <h2 className="text-sm font-semibold text-stone-900">{col.label}</h2>
                <ul className="flex flex-col gap-2.5">
                  {col.items.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="text-sm leading-6 text-stone-600 transition-colors hover:text-brand-700"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>

        {/* Locations as one wrapped row rather than a fifth column, which would
            crowd the grid at every breakpoint for the lowest-priority links. */}
        <nav aria-label="Therapy by location" className="mt-12 border-t border-stone-200 pt-8">
          <h2 className="text-sm font-semibold text-stone-900">Online therapy across Kenya</h2>
          <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2.5">
            {FOOTER_LOCATIONS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="text-sm text-stone-600 transition-colors hover:text-brand-700">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* ── The disclosure that has to be here ──────────────────────────
            Echo's clinicians are licensed in Kenya and the service settles
            in KES. Saying so plainly is cheaper than a refund from someone
            who booked from another jurisdiction expecting local cover. */}
        <p className="mt-10 max-w-4xl text-xs leading-6 text-stone-500">
          Echo Health connects clients with independently licensed mental-health
          practitioners registered in Kenya. Sessions are delivered online and
          priced in Kenyan shillings. Echo Health does not provide emergency,
          crisis or psychiatric-prescribing services, and nothing on this site is
          a substitute for assessment by a qualified clinician.
        </p>
      </div>

      <div className="border-t border-stone-200">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-6 text-xs text-stone-500 sm:flex-row sm:px-6">
          <span>© {new Date().getFullYear()} Echo Psychology Group. All rights reserved.</span>
          <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            {FOOTER_LEGAL.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="transition-colors hover:text-brand-700">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}
