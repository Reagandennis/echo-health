import Link from "next/link";
import { BadgeCheck, CalendarClock, ShieldCheck, Video } from "lucide-react";
import Breadcrumbs from "@/app/components/marketing/Breadcrumbs";
import JsonLd from "@/app/components/marketing/JsonLd";
import TherapistDirectory from "@/app/components/marketing/TherapistDirectory";
import { CtaBand, Section } from "@/app/components/marketing/sections";
import { collectSpecialties, listPublicTherapists } from "@/lib/directory";
import { pageMetadata, siteUrl } from "@/lib/seo";

/**
 * The page AGENTS.md said should already exist.
 *
 * The `therapists` table has been world-readable since migration 0001
 * specifically so visitors could browse it before signing in, and nothing ever
 * did. The home page instead showed three invented clinicians over stock
 * photographs, with a "see the full roster" button pointing at an in-page
 * anchor because, per its own comment, browsing required an account.
 *
 * ## Rendering
 *
 * Five-minute ISR rather than a request-time render. The roster changes when
 * an admin approves a KYC application — days apart, not seconds — so paying
 * for a database round-trip on every visit to the most-linked page on the site
 * buys nothing. Five minutes is short enough that a newly approved therapist
 * appears while they are still reading the approval email.
 *
 * (`revalidate` is still the supported model here. Next 16 removes it only
 * when `cacheComponents` is enabled in `next.config.ts`, and it is not.)
 */
export const revalidate = 300;

export const metadata = pageMetadata({
  title: "Find a therapist",
  description:
    "Browse Echo Health's licensed therapists — their focus areas, experience and approach. Filter by what you want to work on, then book a session that fits your week.",
  path: "/therapists",
});

export default async function TherapistsPage() {
  const therapists = await listPublicTherapists();
  const specialties = collectSpecialties(therapists);

  /*
   * `ItemList` of the roster.
   *
   * BetterHelp ships no structured data at all on its provider pages, which is
   * a free win to take: a directory that declares its members is eligible for
   * treatment a plain page is not.
   */
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Echo Health therapists",
    url: `${siteUrl}/therapists`,
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: therapists.length,
      itemListElement: therapists.map((t, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `${siteUrl}/therapists/${t.id}`,
        name: t.name,
      })),
    },
  };

  return (
    <>
      <JsonLd data={jsonLd} />
      <Breadcrumbs trail={[{ href: "/therapists", label: "Find a therapist" }]} />

      <section className="bg-hero-soft px-4 pb-14 pt-6 sm:px-6 sm:pb-20">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl">
            <h1 className="font-display text-4xl leading-[1.1] tracking-tight text-stone-900 sm:text-5xl">
              Find a therapist who fits
            </h1>
            <p className="mt-5 text-[17px] leading-8 text-stone-600">
              Every therapist on Echo is independently licensed in Kenya and has
              had their credentials checked by our team before appearing here.
              Browse them, or answer a few questions and we&apos;ll suggest the
              ones who match what you&apos;re looking for.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/get-started"
                className="inline-flex min-h-12 items-center justify-center rounded-full bg-brand px-7 text-sm font-semibold text-white shadow-lg shadow-brand-900/15 transition-colors hover:bg-brand-700"
              >
                Match me with a therapist
              </Link>
              <Link
                href="/how-it-works"
                className="inline-flex min-h-12 items-center justify-center rounded-full bg-surface px-7 text-sm font-semibold text-stone-800 shadow-sm ring-1 ring-inset ring-stone-300 transition hover:ring-stone-400"
              >
                How matching works
              </Link>
            </div>
          </div>

          <ul className="mt-12 flex flex-wrap gap-x-8 gap-y-3">
            {[
              { icon: BadgeCheck, label: "Credentials checked before listing" },
              { icon: Video, label: "Video, phone or messaging" },
              { icon: CalendarClock, label: "50-minute sessions, East Africa Time" },
              { icon: ShieldCheck, label: "Switch therapists at no charge" },
            ].map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-2 text-sm font-medium text-stone-600">
                <Icon className="h-4 w-4 shrink-0 text-brand-600" strokeWidth={1.8} />
                {label}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <Section>
        {therapists.length > 0 ? (
          <TherapistDirectory therapists={therapists} specialties={specialties} />
        ) : (
          /*
           * The empty state is honest about being empty.
           *
           * The alternative — seeding the page with sample clinicians so it
           * "looks right" — is exactly how the invented therapists got onto
           * the home page in the first place. A directory with nobody in it is
           * a bad look for an afternoon; a directory with three people who do
           * not exist is a bad look that someone eventually screenshots.
           */
          <div className="mx-auto max-w-xl rounded-3xl bg-stone-50 p-8 text-center sm:p-12">
            <h2 className="font-display text-2xl tracking-tight text-stone-900">
              Our first therapists are being verified
            </h2>
            <p className="mt-4 text-[15px] leading-7 text-stone-600">
              Nobody is listed here yet — every clinician has to clear
              credential checks before we will put them in front of you, and we
              would rather show you an empty page than a name we cannot stand
              behind. Tell us what you need and we&apos;ll be in touch the
              moment there is a match.
            </p>
            <Link
              href="/get-started"
              className="mt-7 inline-flex min-h-12 items-center justify-center rounded-full bg-brand px-7 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
            >
              Tell us what you&apos;re looking for
            </Link>
          </div>
        )}
      </Section>

      <CtaBand
        title="Not sure who to pick?"
        body="Answer a few questions and we'll narrow the list for you. It takes about three minutes and costs nothing."
        label="Find my therapist"
      />
    </>
  );
}
