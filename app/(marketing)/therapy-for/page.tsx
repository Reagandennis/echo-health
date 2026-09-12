import Link from "next/link";
import { ArrowRight, LifeBuoy } from "lucide-react";
import Breadcrumbs from "@/app/components/marketing/Breadcrumbs";
import JsonLd from "@/app/components/marketing/JsonLd";
import {
  CtaBand,
  CtaButton,
  Eyebrow,
  RelatedLinks,
  Section,
  SectionHeading,
} from "@/app/components/marketing/sections";
import { CONDITIONS, LOCATIONS } from "@/lib/navigation";
import type { ConditionSlug } from "@/lib/navigation";
import { legalEntityName, pageMetadata, siteUrl } from "@/lib/seo";

/**
 * The index for the eight condition pages.
 *
 * ── Why the card copy is written here rather than imported ──
 * The detail pages hold their own copy in `[condition]/page.tsx`. Sharing a
 * blurb between the two would mean either importing from a page module —
 * Next.js rejects unrecognised exports from a `page` file — or a new shared
 * module, and the card copy genuinely wants to be different anyway: a hub card
 * is a one-line "is this me?" test, while the detail page opens by describing
 * the condition. Duplication here is eight short sentences, not eight pages.
 */

const SUMMARIES: Record<ConditionSlug, string> = {
  anxiety:
    "Worry that loops, a body that will not settle, and a life quietly rearranged around avoiding the thing.",
  depression:
    "Not always sadness. More often flatness — everything costing three times what it used to, and nothing reaching you.",
  stress:
    "When the recovery stops happening: the weekend no longer resets you and the exhaustion is still there on Monday.",
  trauma:
    "When part of you keeps responding as though it is still happening — the watchfulness, the avoidance, the broken sleep.",
  grief:
    "Not an illness, and mostly not something to be treated. Somewhere to say it, and help if it has got stuck.",
  relationships:
    "The argument that always goes the same way, the pattern that has followed you, the decision you cannot think straight about.",
  "self-esteem":
    "A running commentary that would end a friendship if you used it on anyone else — and that feels like accuracy.",
  sleep:
    "Awake at three doing arithmetic about how much is left, then dreading bedtime, then doing it again.",
};

export const metadata = pageMetadata({
  title: "What we help with — therapy by concern",
  description:
    "Anxiety, depression, stress and burnout, trauma, grief, relationships, self-esteem, sleep. What each looks like, when to seek help, and what therapy involves.",
  path: "/therapy-for",
});

const collectionJsonLd = {
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  name: "What we help with",
  url: `${siteUrl}/therapy-for`,
  inLanguage: "en-KE",
  about: CONDITIONS.map((c) => ({ "@type": "MedicalCondition", name: c.label })),
  provider: {
    "@type": "Organization",
    name: legalEntityName,
    url: siteUrl,
    areaServed: { "@type": "Country", name: "Kenya" },
  },
};

export default function TherapyForIndexPage() {
  const related = [
    { href: "/online-therapy", label: "How online therapy works" },
    { href: "/individual-therapy", label: "Individual therapy" },
    { href: "/couples-therapy", label: "Couples therapy" },
    { href: "/teen-therapy", label: "Teen therapy" },
    { href: "/therapists", label: "Browse therapists" },
    { href: "/pricing", label: "Pricing" },
    { href: "/how-it-works", label: "How it works" },
    ...LOCATIONS.map((l) => ({
      href: `/online-therapy/${l.slug}`,
      label: `Therapy in ${l.label}`,
    })),
  ];

  return (
    <>
      <Breadcrumbs trail={[{ href: "/therapy-for", label: "What we help with" }]} />
      <JsonLd data={collectionJsonLd} />

      <section className="curve-down bg-hero-soft px-4 pb-24 pt-8 [--curve-to:#fff] sm:px-6 sm:pb-32 sm:pt-12">
        <div className="mx-auto max-w-3xl text-center">
          <Eyebrow>What we help with</Eyebrow>
          <h1 className="mt-4 font-display text-4xl tracking-tight text-stone-900 sm:text-5xl lg:text-[3.25rem] lg:leading-[1.08]">
            Start where it actually hurts
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-[17px] leading-8 text-stone-600">
            You do not need a diagnosis, a label, or the right words to book a
            session. But if one of these describes your week better than the
            others, it is a reasonable place to begin reading — each page covers
            what it looks like day to day, when it is worth talking to someone,
            and what the therapy for it actually involves.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <CtaButton href="/get-started">Find your therapist</CtaButton>
            <CtaButton href="/online-therapy" variant="secondary">
              How online therapy works
            </CtaButton>
          </div>
        </div>
      </section>

      <Section>
        <SectionHeading
          title="Eight things people bring to us most"
          body="This is not an exhaustive list of what a therapist can work on — it is the set of concerns we have written a proper page about. If yours is not here, it is still worth booking."
        />
        <ul className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {CONDITIONS.map((c) => (
            <li key={c.slug}>
              <Link
                href={`/therapy-for/${c.slug}`}
                className="group flex h-full flex-col rounded-3xl bg-white p-7 shadow-sm ring-1 ring-stone-200/70 transition-shadow hover:shadow-md sm:p-8"
              >
                <h3 className="font-display text-2xl tracking-tight text-stone-900">
                  {c.label}
                </h3>
                <p className="mt-3 flex-1 text-[15px] leading-7 text-stone-600">
                  {SUMMARIES[c.slug]}
                </p>
                <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-brand-700">
                  Therapy for {c.short}
                  <ArrowRight
                    className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      <Section tone="muted">
        <div className="mx-auto max-w-3xl">
          <SectionHeading
            align="left"
            eyebrow="Before you read further"
            title="What Echo is not"
          />
          <div className="mt-8 flex flex-col gap-5 text-[17px] leading-8 text-stone-600">
            <p>
              Echo is online talking therapy with practitioners licensed in
              Kenya. We do not provide emergency or crisis care, we do not
              prescribe or adjust medication, and we do not issue diagnoses for
              insurers, employers, schools or courts. Those are real needs — they
              are just not the thing this service does.
            </p>
            <p>
              Nothing on these pages is a substitute for assessment by a
              qualified clinician, and none of it is a promise about how therapy
              will go for you. Therapy helps a great many people; it is not a
              guaranteed outcome, and anybody telling you otherwise is selling
              something.
            </p>
          </div>

          {/* Crisis routing, on the hub as well as on every detail page. */}
          <div className="mt-9 flex items-start gap-3 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-stone-200">
            <LifeBuoy className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" strokeWidth={1.8} aria-hidden="true" />
            <p className="text-sm leading-6 text-stone-600">
              If you or someone else is in immediate danger, call{" "}
              <a href="tel:999" className="font-semibold text-brand-700 underline underline-offset-2">
                999
              </a>{" "}
              or{" "}
              <a href="tel:112" className="font-semibold text-brand-700 underline underline-offset-2">
                112
              </a>
              . Our{" "}
              <Link href="/crisis" className="font-semibold text-brand-700 underline underline-offset-2">
                crisis page
              </Link>{" "}
              lists verified helplines, with their real opening hours.
            </p>
          </div>
        </div>
      </Section>

      <CtaBand
        title="Not sure which one it is?"
        body="Most people are not. The intake questions are written to work that out with you — answer what you can and leave the rest."
        label="Find your therapist"
      />

      <RelatedLinks title="Explore Echo" links={related} />
    </>
  );
}
