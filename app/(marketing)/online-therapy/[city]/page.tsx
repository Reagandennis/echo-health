import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock, Headphones, LifeBuoy, Smartphone, Wallet, BadgeCheck } from "lucide-react";
import Breadcrumbs from "@/app/components/marketing/Breadcrumbs";
import JsonLd from "@/app/components/marketing/JsonLd";
import {
  CheckList,
  CtaBand,
  CtaButton,
  Eyebrow,
  FaqList,
  FeatureGrid,
  RelatedLinks,
  Section,
  SectionHeading,
  faqJsonLd,
} from "@/app/components/marketing/sections";
import type { Faq } from "@/app/components/marketing/sections";
import { CONDITIONS, LOCATIONS } from "@/lib/navigation";
import type { LocationSlug } from "@/lib/navigation";
import { PLAN_CURRENCY, PLAN_PRICES, PLAN_SESSIONS } from "@/lib/constants";
import { legalEntityName, pageMetadata, siteUrl } from "@/lib/seo";

/**
 * The five city pages.
 *
 * ── The line these pages must not cross ──
 * A location page for a service with no premises in that location is one step
 * away from a doorway page. What keeps these legitimate is that the local angle
 * is *true*: sessions are scheduled in East Africa Time, paid for in shillings
 * over M-Pesa, and delivered by practitioners licensed in Kenya. What we do NOT
 * claim is a consulting room, a local team, or a therapist who lives in that
 * city — we do not record where therapists are, and inventing it would be both
 * a lie and the exact thing that makes these pages worthless.
 *
 * Each page therefore states plainly that Echo is online only and that an
 * in-person practice is the better choice for someone who wants a room. That
 * sentence costs conversions and earns the page the right to exist.
 */

interface CityContent {
  /** ≤ 60 chars. */
  readonly metaTitle: string;
  /** 140–160 chars. */
  readonly metaDescription: string;
  /** Hero paragraph. City-specific, so the five pages are not one page × 5. */
  readonly intro: string;
  /** The travel angle, in geography that is actually true of this city. */
  readonly commute: string;
  /** Local access context. No statistics — none exist that we can cite. */
  readonly context: string;
  /** One bespoke question per city, ahead of the shared set. */
  readonly bespokeFaq: Faq;
}

const CONTENT: Record<LocationSlug, CityContent> = {
  nairobi: {
    metaTitle: "Online therapy in Nairobi",
    metaDescription:
      "Online therapy in Nairobi with therapists licensed in Kenya. Evening and weekend slots in East Africa Time, paid by M-Pesa, with no cross-city commute to manage.",
    intro:
      "Nairobi has more private practice than anywhere else in the country, and it is still a city where the appointment you can get and the appointment you can actually reach are two different things. Online therapy removes the second problem entirely.",
    commute:
      "A five o'clock session in Westlands means leaving the office at four, and getting home afterwards on Waiyaki Way or Mombasa Road can cost more than the fifty minutes you went for. A session you join from your desk, your car or your sitting room costs fifty minutes and nothing else.",
    context:
      "It also widens the list. Instead of choosing from whoever practises within a tolerable drive of you, you are choosing from therapists licensed anywhere in Kenya — which matters most when what you need is specific, like trauma-focused work or couples therapy.",
    bespokeFaq: {
      q: "I live in Nairobi. Will my therapist be in Nairobi too?",
      a: "Possibly, and it makes no practical difference. Echo matches on what you need and when you are free, not on which estate anyone lives in — every therapist on the platform is licensed in Kenya and every session is online. If proximity matters to you because you want the option of meeting in person one day, Echo is not the right service for that.",
    },
  },
  mombasa: {
    metaTitle: "Online therapy in Mombasa",
    metaDescription:
      "Online therapy in Mombasa with therapists licensed in Kenya. Sessions in East Africa Time, paid by M-Pesa, with no ferry queue or bridge crossing in the way.",
    intro:
      "Mombasa is a city split by water, and the split decides a lot about what is realistically reachable on a weekday evening. Online therapy takes the geography out of the decision and leaves only the two questions that matter: who, and when.",
    commute:
      "If your therapist is on the island and you are not, the session costs you the Likoni crossing or the Nyali bridge at the wrong hour, twice. A video session costs you fifty minutes and a quiet room, and it does not care which side of the water either of you is on.",
    context:
      "Specialist private practice in Kenya tends to be concentrated in the capital, which for people outside it usually means a shorter list and a longer wait. Matching online is how the list gets longer.",
    bespokeFaq: {
      q: "Are sessions available in the evening, after the commute?",
      a: "Therapists set their own availability and evening slots are common, precisely because most clients are working. You see real times when you book, all of them in East Africa Time, so there is no timezone arithmetic to get wrong.",
    },
  },
  kisumu: {
    metaTitle: "Online therapy in Kisumu",
    metaDescription:
      "Online therapy in Kisumu with therapists licensed in Kenya. Sessions in East Africa Time, paid by M-Pesa, and a far wider choice of therapist than locally.",
    intro:
      "The hardest part of finding a therapist outside Nairobi is usually not deciding to go — it is the length of the list once you get there. Online therapy replaces the list of people near you with the list of people licensed in Kenya.",
    commute:
      "No drive across town at the end of a working day, and no arriving for a fifty-minute session already tired from getting there. You join from home, or from a parked car, and you are where you need to be afterwards.",
    context:
      "It also makes the specific things findable. If what you need is trauma-focused work, couples therapy or someone who works with teenagers, the constraint has never really been the city — it has been how few people within reach do that particular thing.",
    bespokeFaq: {
      q: "My internet is not always reliable. Can I still do this?",
      a: "Often, yes. Turning your camera off drops the bandwidth a session needs substantially, and an audio-only session is a normal way to work rather than a downgrade — tell your therapist at the start. If a session does drop, rejoining from the same link puts you back in the same room.",
    },
  },
  nakuru: {
    metaTitle: "Online therapy in Nakuru",
    metaDescription:
      "Online therapy in Nakuru with therapists licensed in Kenya. Sessions in East Africa Time, paid by M-Pesa, with a wider choice of therapist than a local search.",
    intro:
      "Nakuru is close enough to Nairobi to be told that the good practitioners are there, and far enough away that the drive makes weekly sessions unrealistic. Online therapy resolves that without anyone moving.",
    commute:
      "A weekly appointment in Nairobi means the better part of a day, every week, plus fuel. That is not a therapy plan anyone sustains. Fifty minutes at a time you choose, from where you already are, is one people do.",
    context:
      "The point of being online is not only convenience — it is choice. You are matched from therapists licensed anywhere in Kenya, so the availability of the specific kind of help you want stops being a question of what exists locally.",
    bespokeFaq: {
      q: "Can I have sessions from work, or does it need to be from home?",
      a: "Wherever you can talk without being overheard. People join from a parked car, a spare room or an empty meeting room. Headphones help more than anything else, both for the sound and because they keep the therapist's side of the conversation private.",
    },
  },
  eldoret: {
    metaTitle: "Online therapy in Eldoret",
    metaDescription:
      "Online therapy in Eldoret with therapists licensed in Kenya. Sessions in East Africa Time, paid by M-Pesa, and a choice of therapist that is not limited locally.",
    intro:
      "In a town where a lot of people know a lot of people, the privacy of being seen walking into a practice is a genuine reason not to go. A session you take from your own house removes that consideration completely.",
    commute:
      "No car outside a building anyone recognises, no waiting room, and no conversation about where you were on Tuesday afternoons. You are simply at home for an hour.",
    context:
      "The wider choice matters as much as the privacy. Matching online means the question is which therapist fits what you need, not which therapist happens to practise within a reasonable drive of Uasin Gishu.",
    bespokeFaq: {
      q: "How private is this really?",
      a: "Video runs directly between you and your therapist rather than being recorded by us, and messages and notes sit behind per-record access controls so only the people involved in your care can read them. Kenya's Data Protection Act 2019 gives you the right to access, correct or delete your data. Your therapist will explain at the start the narrow circumstances in which they would have to break confidentiality — essentially a serious risk of harm.",
    },
  },
};

/** Prices are read from `lib/constants.ts`, never typed into prose. */
const money = (amount: number) =>
  new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: PLAN_CURRENCY,
    maximumFractionDigits: 0,
  }).format(amount);

/* ── Route generation ────────────────────────────────────────────────────── */

/**
 * Five pages, and only five. Without `dynamicParams = false`, `/online-therapy/
 * kitale` would render a real page for a city we have written nothing about —
 * which is precisely the auto-generated doorway page that gets a site's whole
 * location cluster discounted.
 */
export const dynamicParams = false;

export function generateStaticParams() {
  return LOCATIONS.map((l) => ({ city: l.slug }));
}

function lookup(slug: string) {
  const meta = LOCATIONS.find((l) => l.slug === slug);
  if (!meta) return null;
  return { meta, content: CONTENT[meta.slug] };
}

export async function generateMetadata({
  params,
}: {
  readonly params: Promise<{ readonly city: string }>;
}) {
  const { city } = await params;
  const found = lookup(city);
  if (!found) return {};
  return pageMetadata({
    title: found.content.metaTitle,
    description: found.content.metaDescription,
    path: `/online-therapy/${found.meta.slug}`,
  });
}

/* ── Page ────────────────────────────────────────────────────────────────── */

export default async function CityPage({
  params,
}: {
  readonly params: Promise<{ readonly city: string }>;
}) {
  const { city } = await params;
  const found = lookup(city);
  if (!found) notFound();
  const { meta, content } = found;

  const whyLocal = [
    {
      icon: Clock,
      title: "Booked in East Africa Time",
      body: "Every slot you see is in your own clock time — no conversion, and no platform quietly assuming you are somewhere else.",
    },
    {
      icon: Wallet,
      title: "Paid by M-Pesa",
      body: "M-Pesa, card or bank transfer through Paystack, in Kenyan shillings. No foreign card required, and no currency conversion between what is advertised and what leaves your account.",
    },
    {
      icon: BadgeCheck,
      title: "Licensed in Kenya",
      body: "Every therapist submits their professional licence and identification, and an administrator verifies it before they can be matched with anyone.",
    },
    {
      icon: Smartphone,
      title: "No journey across town",
      body: `Fifty minutes is fifty minutes. Nothing is added to it for getting to ${meta.label} traffic and back out of it again.`,
    },
  ];

  const whatYouNeed = [
    "A phone, tablet or laptop with a camera and a microphone. Sessions open in the browser — there is nothing to install.",
    "A connection that holds a video call. If it is patchy, turning the camera off drops what the session needs considerably.",
    "Somewhere you can talk without being overheard. A parked car counts, and plenty of people use one.",
    "Headphones, which do more for privacy at home than anything else you can change.",
    "About an hour, so you are not walking straight from a session into something else.",
  ];

  const faqs: readonly Faq[] = [
    content.bespokeFaq,
    {
      q: `Does Echo have an office in ${meta.label}?`,
      a: `No. Echo is online only — there is no consulting room in ${meta.label} or anywhere else, and no in-person appointments. If what you want is to sit in a room with someone, a local in-person practice is the right choice, and we would rather tell you that than take the booking.`,
    },
    {
      q: "How much does a session cost?",
      a: `A single 50-minute session is ${money(PLAN_PRICES.individual)}. The Plus bundle is ${money(PLAN_PRICES.plus)} for ${PLAN_SESSIONS.plus} sessions, and Couples is ${money(PLAN_PRICES.couples)} for ${PLAN_SESSIONS.couples} joint sessions covering both partners. These are one-time purchases — nothing recurs, nothing auto-renews, and session credits do not expire.`,
    },
    {
      q: "What if I need to move a session?",
      a: "Cancel at least 24 hours before it starts and the credit goes straight back to your account, to use whenever you are ready.",
    },
    {
      q: "What if I am in crisis?",
      a: "Echo is not an emergency service and nobody is watching the platform for urgent messages. If you or someone else is in immediate danger, call 999 or 112. Our crisis page lists verified helplines with their real opening hours, including Kenya Red Cross on 1199 and Childline Kenya on 116 for under-18s.",
    },
  ];

  const otherCities = LOCATIONS.filter((l) => l.slug !== meta.slug);

  const serviceJsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: `Online therapy in ${meta.label}`,
    serviceType: "Online psychotherapy and counselling",
    url: `${siteUrl}/online-therapy/${meta.slug}`,
    provider: {
      "@type": "Organization",
      name: legalEntityName,
      alternateName: "Echo Health",
      url: siteUrl,
    },
    /* `areaServed` is the city; there is deliberately no `address` or
       `LocalBusiness` type, because claiming a physical location we do not have
       would be a false local-business signal as well as untrue. */
    areaServed: {
      "@type": "City",
      name: meta.label,
      containedInPlace: { "@type": "AdministrativeArea", name: meta.county },
    },
    availableChannel: {
      "@type": "ServiceChannel",
      serviceUrl: `${siteUrl}/get-started`,
      availableLanguage: { "@type": "Language", name: "English" },
    },
  };

  return (
    <>
      <Breadcrumbs
        trail={[
          { href: "/online-therapy", label: "Online therapy" },
          { href: `/online-therapy/${meta.slug}`, label: meta.label },
        ]}
      />
      <JsonLd data={serviceJsonLd} />
      <JsonLd data={faqJsonLd(faqs)} />

      <section className="curve-down bg-hero-soft px-4 pb-24 pt-8 [--curve-to:#fff] sm:px-6 sm:pb-32 sm:pt-12">
        <div className="mx-auto max-w-3xl text-center">
          <Eyebrow>{meta.county}</Eyebrow>
          <h1 className="mt-4 font-display text-4xl tracking-tight text-stone-900 sm:text-5xl lg:text-[3.25rem] lg:leading-[1.08]">
            Online therapy in {meta.label}
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-[17px] leading-8 text-stone-600">
            {content.intro}
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <CtaButton href="/get-started">Find your therapist</CtaButton>
            <CtaButton href="/online-therapy" variant="secondary">
              How online therapy works
            </CtaButton>
          </div>
          <p className="mt-5 text-sm text-stone-500">
            Sessions from {money(PLAN_PRICES.individual)}, paid by M-Pesa. Credits never expire.
          </p>
        </div>
      </section>

      <Section>
        <div className="mx-auto max-w-3xl">
          <SectionHeading
            align="left"
            eyebrow={`Therapy from ${meta.label}`}
            title="What you are actually booking"
          />
          <div className="mt-8 flex flex-col gap-5 text-[17px] leading-8 text-stone-600">
            <p>{content.commute}</p>
            <p>{content.context}</p>
            {/* Stated on every city page, deliberately high up. See the file
                header: this is the sentence that separates a local page from a
                doorway page. */}
            <p>
              To be clear about what this is: Echo has no consulting room in{" "}
              {meta.label}. Every session is online, and you are matched with a
              therapist licensed in Kenya on the basis of what you need and when
              you are free — not on which city they happen to live in. If sitting
              in a room with someone is what you want, an in-person practice is
              the better choice.
            </p>
          </div>
        </div>
      </Section>

      <Section tone="muted">
        <SectionHeading
          eyebrow="Why it works here"
          title={`Built for clients in ${meta.label}, not translated for them`}
          body="Kenyan clock, Kenyan shillings, Kenyan licences. None of that is a feature so much as the absence of friction that shows up on platforms built somewhere else."
        />
        <FeatureGrid features={whyLocal} columns={4} />
      </Section>

      <Section>
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <SectionHeading
              align="left"
              eyebrow="Before your first session"
              title="What you need, and nothing more"
            />
            <div className="mt-9 rounded-3xl bg-white p-7 shadow-sm ring-1 ring-stone-200/70 sm:p-8">
              <CheckList items={whatYouNeed} />
            </div>
          </div>
          <div className="lg:pt-2">
            <SectionHeading
              align="left"
              as="h3"
              title="If privacy at home is the problem"
              body="It is the most common practical obstacle, and it is solvable."
            />
            <div className="mt-9 flex flex-col gap-4">
              <p className="flex items-start gap-3 rounded-3xl bg-stone-50 p-5 text-[15px] leading-7 text-stone-700 ring-1 ring-stone-200/70">
                <Headphones className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" strokeWidth={1.8} aria-hidden="true" />
                <span>
                  Headphones mean only your half of the conversation is audible,
                  which is usually enough. An audio-only session with the camera
                  off makes you harder to place from a doorway as well.
                </span>
              </p>
              <p className="rounded-3xl bg-stone-50 p-5 text-[15px] leading-7 text-stone-700 ring-1 ring-stone-200/70">
                A parked car is a legitimate therapy room and a very common one.
                So is an empty meeting room, or the house at a time when it is
                empty — tell your therapist if you need to work around a window
                like that, because they will book you accordingly.
              </p>
              <p className="rounded-3xl bg-stone-50 p-5 text-[15px] leading-7 text-stone-700 ring-1 ring-stone-200/70">
                Echo sends no post and nothing identifiable to a shared address.
                Your payment appears as a Paystack charge, and sessions live
                behind your own login.
              </p>
            </div>
          </div>
        </div>
      </Section>

      <Section tone="muted">
        <SectionHeading
          eyebrow="What people bring"
          title="Common reasons people in Kenya start therapy"
          body="Each of these has a page of its own — what it looks like day to day, when it is worth talking to someone, and what the therapy involves."
        />
        <ul className="mt-12 flex flex-wrap justify-center gap-2.5">
          {CONDITIONS.map((c) => (
            <li key={c.slug}>
              <Link
                href={`/therapy-for/${c.slug}`}
                className="inline-flex min-h-11 items-center rounded-full bg-white px-5 text-sm font-medium text-stone-700 shadow-sm ring-1 ring-inset ring-stone-200 transition-colors hover:text-brand-700 hover:ring-stone-300"
              >
                Therapy for {c.short}
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      <Section>
        <div className="mx-auto max-w-3xl">
          <SectionHeading
            align="left"
            eyebrow="Questions"
            title={`Online therapy in ${meta.label}: common questions`}
          />
          <FaqList faqs={faqs} />

          <div className="mt-10 flex items-start gap-3 rounded-3xl bg-brand-50 p-6 ring-1 ring-brand-100">
            <LifeBuoy className="mt-0.5 h-5 w-5 shrink-0 text-brand-700" strokeWidth={1.8} aria-hidden="true" />
            <p className="text-sm leading-6 text-stone-700">
              Echo is not a crisis service. If you or someone else is in
              immediate danger, call{" "}
              <a href="tel:999" className="font-semibold text-brand-700 underline underline-offset-2">
                999
              </a>{" "}
              or{" "}
              <a href="tel:112" className="font-semibold text-brand-700 underline underline-offset-2">
                112
              </a>
              , or see our{" "}
              <Link href="/crisis" className="font-semibold text-brand-700 underline underline-offset-2">
                verified crisis lines
              </Link>
              .
            </p>
          </div>
        </div>
      </Section>

      <CtaBand
        title={`Start from ${meta.label}, today`}
        body="Answer a few questions and we will match you with a licensed therapist. One payment, no subscription, and credits that do not expire."
        label="Find your therapist"
      />

      <RelatedLinks
        title="Online therapy elsewhere in Kenya"
        links={[
          ...otherCities.map((l) => ({
            href: `/online-therapy/${l.slug}`,
            label: `Online therapy in ${l.label}`,
          })),
          { href: "/online-therapy", label: "How online therapy works" },
          { href: "/individual-therapy", label: "Individual therapy" },
          { href: "/couples-therapy", label: "Couples therapy" },
          { href: "/teen-therapy", label: "Teen therapy" },
          { href: "/therapy-for", label: "What we help with" },
          { href: "/pricing", label: "Pricing" },
          { href: "/therapists", label: "Browse therapists" },
        ]}
      />
    </>
  );
}
