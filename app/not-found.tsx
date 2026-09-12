import Link from "next/link";
import { Compass } from "lucide-react";
import SiteHeader from "./components/marketing/SiteHeader";
import SiteFooter from "./components/marketing/SiteFooter";

/**
 * The 404.
 *
 * Two things were wrong with the previous version, and both cost more than
 * they look like they should:
 *
 *  - It rendered a bare `<div>` with no `<main>`, no navigation and no footer,
 *    so a visitor who mistyped a URL — or a crawler that followed a stale link
 *    — landed somewhere with exactly two exits and no way into the rest of the
 *    site. A 404 is a routine page on any site of this size; it should
 *    recirculate people rather than strand them.
 *  - One of those two exits pointed at `/dashboard`, which is auth-gated and
 *    disallowed in robots.txt. For a signed-out visitor it bounced them to a
 *    login screen they had not asked for; for a crawler it was a link into a
 *    wall.
 *
 * It now carries the full marketing chrome, so every public route is one click
 * away, and the suggestions below are the pages people are most often looking
 * for when they arrive here.
 */

const SUGGESTIONS = [
  { href: "/therapists", label: "Find a therapist", body: "Browse the people you could work with." },
  { href: "/how-it-works", label: "How it works", body: "What happens between signing up and a first session." },
  { href: "/pricing", label: "Pricing", body: "What a session costs, in shillings." },
  { href: "/guides", label: "Guides", body: "Reading on anxiety, sleep, grief and more." },
  { href: "/faq", label: "FAQ", body: "The questions people ask first." },
  { href: "/crisis", label: "Crisis support", body: "Verified helplines, available right now." },
];

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="flex flex-1 flex-col px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto w-full max-w-3xl">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-100">
            <Compass className="h-7 w-7" strokeWidth={1.6} />
          </span>
          <p className="mt-8 text-sm font-semibold uppercase tracking-[0.18em] text-brand-700">
            Error 404
          </p>
          <h1 className="mt-3 font-display text-4xl leading-[1.08] tracking-tight text-stone-900 sm:text-5xl">
            That page isn&apos;t here
          </h1>
          <p className="mt-5 max-w-xl text-[17px] leading-8 text-stone-600">
            The address may have changed, or the link that brought you here may
            be out of date. Nothing is wrong with your account — here is where
            most people are heading.
          </p>

          <ul className="mt-12 grid gap-4 sm:grid-cols-2">
            {SUGGESTIONS.map((s) => (
              <li key={s.href}>
                <Link
                  href={s.href}
                  className="flex min-h-[4.5rem] flex-col justify-center rounded-2xl bg-surface px-5 py-4 shadow-sm ring-1 ring-stone-200/70 transition-shadow hover:shadow-md"
                >
                  <span className="font-semibold text-stone-900">{s.label}</span>
                  <span className="mt-0.5 text-sm text-stone-600">{s.body}</span>
                </Link>
              </li>
            ))}
          </ul>

          <p className="mt-10 text-[15px] leading-7 text-stone-600">
            Still stuck?{" "}
            <Link href="/contact" className="font-semibold text-brand-700 underline underline-offset-2">
              Tell us what you were looking for
            </Link>{" "}
            and we will point you at it.
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
