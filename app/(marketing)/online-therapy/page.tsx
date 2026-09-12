import Link from "next/link";
import {
  CalendarCheck,
  HeartHandshake,
  LifeBuoy,
  MessageSquare,
  Mic,
  Search,
  Video,
  X,
} from "lucide-react";
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
  Steps,
  faqJsonLd,
} from "@/app/components/marketing/sections";
import type { Faq } from "@/app/components/marketing/sections";
import { CONDITIONS } from "@/lib/navigation";
import { MARKETS } from "@/lib/markets";
import {
  PLAN_CURRENCY,
  formatKes as money,
  PLAN_LABELS,
  PLAN_PERIOD_LABELS,
  PLAN_PRICES,
  PLAN_SESSIONS,
} from "@/lib/constants";
import { legalEntityName, pageMetadata, siteUrl } from "@/lib/seo";

/**
 * The pillar page, and the hub of the site's internal link graph.
 *
 * Every condition page, every country page and all three service pages are
 * linked from the body here — not only from the footer. Footer links are
 * sitewide boilerplate and are discounted accordingly; a link from inside the
 * body of the topically-relevant page is the one that carries weight, and this
 * is the page that is topically relevant to all of them.
 *
 * The "who this is not for" section is not a legal afterthought. Half of what
 * makes an online therapy page trustworthy is naming the people it cannot
 * serve, and the alternative — a page that implies we handle crises, prescribe,
 * or write court reports — converts someone into a booking that will fail them.
 *
 * ── Kenya appears here as a disclosure, never as the market ──
 * This page was titled "Online therapy in Kenya" and read as a Kenya-only
 * service. Kenya is where the SUPPLY is: the clinicians are licensed there,
 * the sessions are scheduled on their clock, and the charge settles in their
 * currency. The clients are worldwide (`lib/markets.ts`). So every Kenya
 * reference below is one of the three facts a client elsewhere has to know
 * before paying — licensure, time zone, currency — and none of them is a
 * statement about who may book.
 */

/** Prices are read from `lib/constants.ts`, never typed into prose. */

export const metadata = pageMetadata({
  title: "Online therapy: how it works and what it costs",
  description:
    "Online therapy with therapists licensed in Kenya, booked from anywhere. How sessions run, what video and messaging involve, what it costs, and who it is not for.",
  path: "/online-therapy",
});

const STEPS = [
  {
    icon: Search,
    title: "Tell us what you need",
    body: "A short set of questions about what is going on, what you want from therapy and when you are free. Around three minutes, and nothing is shared until you create an account.",
  },
  {
    icon: CalendarCheck,
    title: "Get matched and pick a time",
    body: "We put forward therapists whose training and availability fit what you described. You choose, and you book from their real availability — published in East Africa Time (GMT+3), whichever time zone you are in.",
  },
  {
    icon: HeartHandshake,
    title: "Meet for 50 minutes",
    body: "Your session opens in the browser at the appointed time — no app to install, no dial-in number. After it, you can message your therapist between sessions.",
  },
];

const FORMATS = [
  {
    icon: Video,
    title: "Video",
    body: "The default. You and your therapist join the same private room from a browser, and the connection is peer-to-peer — the media goes between the two of you rather than being stored by us.",
  },
  {
    icon: Mic,
    title: "Audio only",
    body: "The same session with your camera off. Useful on a weak connection, in a shared house, or on the days when being looked at is more than you have. Tell your therapist at the start.",
  },
  {
    icon: MessageSquare,
    title: "Messaging between sessions",
    body: "Secure messages with your therapist in the platform, for the thought that arrives on Wednesday. It supports the sessions rather than replacing them, and it is not monitored around the clock.",
  },
];

const SUITS = [
  "You want to work on something specific — anxiety, low mood, a relationship, a loss, a pattern you keep repeating.",
  "Your schedule or your location makes a weekly trip to a consulting room unrealistic.",
  "You can make a slot in your therapist's working day, which runs on East Africa Time (GMT+3).",
  "You have a private-enough space, a phone or laptop, and a connection that holds a video call.",
  "You would rather begin from home than walk into a waiting room.",
  "You want to try a session or two before committing to anything longer.",
];

const DOES_NOT_SUIT = [
  "You are in crisis, or someone is in immediate danger. Contact your local emergency number now, or use our crisis page — Echo is not an emergency service and nobody is monitoring for urgent messages.",
  "You need a therapist registered by the regulator where you live. Echo's practitioners hold Kenyan licences and no others, so if local registration is what you need — for an insurer, a workplace scheme, or your own peace of mind — this is not the service.",
  "You need medication prescribed, reviewed or adjusted. Echo therapists do not prescribe. See a doctor or psychiatrist; therapy can run alongside that.",
  "You need a formal diagnosis or a report for an insurer, an employer, a school or a court. We do not carry out medico-legal assessments and cannot produce documents for them.",
  "Therapy has been ordered by a court, or is a condition of something. We cannot certify attendance or report on you to a third party.",
  "You need a level of care that online sessions cannot hold — inpatient treatment, an eating disorder needing medical monitoring, or active psychosis.",
  "You are under 18 and acting on your own. A parent or guardian has to start the account and consent — see our teen therapy page.",
];

const FAQS: readonly Faq[] = [
  {
    q: "Is online therapy as good as sitting in a room with someone?",
    a: "For many common difficulties it is a genuine alternative rather than a compromise, and for people who would otherwise not go at all it is the only version that happens. That said, it is not universally better: some people need the room, and some presentations need a level of care that a video call cannot hold. If in-person is what you want, an in-person practice is the right choice and we would rather say so.",
  },
  {
    q: "Are Echo therapists actually licensed, and licensed where?",
    a: "Licensed in Kenya. Every therapist applying to Echo submits their professional licence and identification, and an administrator reviews and verifies the documents before that therapist can be matched with anyone. Worth being explicit about the second half of the question: if you are outside Kenya, your therapist is not registered with the regulator in your own country. That is fine for therapy itself, and it is not fine if you need a locally registered provider for an insurer, an employer or a court.",
  },
  {
    q: "I am not in East Africa. Will the session times work?",
    a: "Sessions are scheduled in East Africa Time (GMT+3), because that is the clock your therapist keeps. From West Africa, southern Africa, the Gulf or the UK, most of an ordinary working day overlaps. From the United States or Canada the usable window is your therapist's afternoon and evening, which is your morning — a mid-morning slot in Nairobi falls in the middle of your night and is not bookable in practice. Each country page works the difference out for you rather than leaving you to do the arithmetic.",
  },
  {
    q: "How long is a session, and how many will I need?",
    a: "Sessions are 50 minutes. How many you need is not something anyone can honestly tell you in advance — some people come with a specific focus and finish in a handful of sessions, others stay longer. What you can ask for early is a shared sense of what you are working on and how you will both know whether it is helping.",
  },
  {
    q: "What do I need to join a session?",
    a: "A phone, tablet or laptop with a camera and microphone, a connection that holds a video call, and somewhere you can talk. Sessions open in the browser, so there is nothing to install. Headphones help more than anything else — for the audio, and for privacy at home.",
  },
  {
    q: "What if I need to move or cancel a session?",
    a: "Cancel at least 24 hours before the start and the credit returns to your account for you to use whenever you are ready. Credits do not expire, and because sessions are bought as one-time bundles there is no subscription running in the background.",
  },
  {
    q: "Who can see what I say in a session?",
    a: "Your therapist. Video runs directly between the two of you rather than being recorded by us, and messages and notes are stored behind per-record access controls so that only the people involved in your care can read them. Echo is a Kenyan data controller, so your records are handled under Kenya's Data Protection Act 2019, which gives you the right to access, correct or delete them. Your therapist will explain at the outset the narrow circumstances in which they would have to break confidentiality — essentially, a serious risk of harm.",
  },
  {
    q: "How do I pay, and in what currency?",
    a: "Card or bank transfer through Paystack, and M-Pesa if you hold a Kenyan mobile-money account. The charge settles in Kenyan shillings whatever your own currency is, so if your card is denominated in something else your bank sets the exchange rate and may add its own fee. You pay Echo, never your therapist directly, and there is no subscription to cancel.",
  },
];

const PLANS = ["individual", "plus", "couples"] as const;

const PLAN_NOTES: Record<(typeof PLANS)[number], string> = {
  individual: "One 50-minute session. The honest way to find out whether this is for you.",
  plus: "Two sessions plus therapy materials, for when you already know you want to start properly.",
  couples: "Two joint sessions covering both partners — one price for the pair, not each.",
};

const serviceJsonLd = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "Online therapy",
  serviceType: "Online psychotherapy and counselling",
  url: `${siteUrl}/online-therapy`,
  provider: {
    "@type": "Organization",
    name: legalEntityName,
    alternateName: "Echo Health",
    url: siteUrl,
  },
  /* Was `{ name: "Kenya" }` — a declaration that this service is available in
     one country, which is the opposite of true and the single most misleading
     thing this page emitted. Derived from `lib/markets.ts` so the list cannot
     drift from the country pages; `country` carries its own article for prose,
     which a schema.org `Country.name` must not. */
  areaServed: MARKETS.map((m) => ({
    "@type": "Country",
    name: m.country.replace(/^the /, ""),
  })),
  availableChannel: {
    "@type": "ServiceChannel",
    serviceUrl: `${siteUrl}/get-started`,
    availableLanguage: { "@type": "Language", name: "English" },
  },
  offers: PLANS.map((plan) => ({
    "@type": "Offer",
    name: PLAN_LABELS[plan],
    price: PLAN_PRICES[plan],
    priceCurrency: PLAN_CURRENCY,
    url: `${siteUrl}/pricing`,
  })),
};

const medicalWebPageJsonLd = {
  "@context": "https://schema.org",
  "@type": "MedicalWebPage",
  name: "Online therapy",
  url: `${siteUrl}/online-therapy`,
  /* Plain "en", not "en-KE": the page is written for readers in thirteen
     markets, and a regional language tag on the pillar page is a signal that
     this is Kenyan-audience content. */
  inLanguage: "en",
  audience: { "@type": "Patient" },
  about: CONDITIONS.map((c) => ({ "@type": "MedicalCondition", name: c.label })),
};

/* ── Link cloud ──────────────────────────────────────────────────────────── */

/**
 * The in-body link block.
 *
 * Same pill treatment as `RelatedLinks`, but grouped and headed, because this
 * page carries three distinct sets and one undifferentiated wall of twenty
 * links reads as a link farm to a person as well as to a crawler.
 */
function LinkCloud({
  groups,
}: {
  readonly groups: readonly {
    readonly heading: string;
    readonly links: readonly { readonly href: string; readonly label: string }[];
  }[];
}) {
  return (
    <div className="mt-14 grid gap-10 lg:grid-cols-3">
      {groups.map((group) => (
        <div key={group.heading}>
          <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-stone-500">
            {group.heading}
          </h3>
          <ul className="mt-5 flex flex-wrap gap-2.5">
            {group.links.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className="inline-flex min-h-11 items-center rounded-full bg-white px-5 text-sm font-medium text-stone-700 shadow-sm ring-1 ring-inset ring-stone-200 transition-colors hover:text-brand-700 hover:ring-stone-300"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/* ── Page ────────────────────────────────────────────────────────────────── */

export default function OnlineTherapyPage() {
  return (
    <>
      <Breadcrumbs trail={[{ href: "/online-therapy", label: "Online therapy" }]} />
      <JsonLd data={serviceJsonLd} />
      <JsonLd data={medicalWebPageJsonLd} />
      <JsonLd data={faqJsonLd(FAQS)} />

      <section className="curve-down bg-hero-soft px-4 pb-24 pt-8 [--curve-to:#fff] sm:px-6 sm:pb-32 sm:pt-12">
        <div className="mx-auto max-w-3xl text-center">
          <Eyebrow>Online therapy</Eyebrow>
          <h1 className="mt-4 font-display text-4xl tracking-tight text-stone-900 sm:text-5xl lg:text-[3.25rem] lg:leading-[1.08]">
            Therapy that fits around the life you actually have
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-[17px] leading-8 text-stone-600">
            Fifty minutes, over video, from wherever you can close a door — no
            commute, no waiting room, and no subscription running quietly in the
            background. Three things to know before you book: your therapist is
            licensed in Kenya rather than in your own country, sessions are
            scheduled in East Africa Time (GMT+3), and you are charged in Kenyan
            shillings whatever your own currency.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <CtaButton href="/get-started">Find your therapist</CtaButton>
            <CtaButton href="/therapists" variant="secondary">
              Browse therapists
            </CtaButton>
          </div>
          <p className="mt-5 text-sm text-stone-500">
            Sessions from {money(PLAN_PRICES.individual)}. Credits never expire.
          </p>
        </div>
      </section>

      <Section>
        <div className="mx-auto max-w-3xl">
          <SectionHeading
            align="left"
            eyebrow="The plain version"
            title="What online therapy actually is"
          />
          <div className="mt-8 flex flex-col gap-5 text-[17px] leading-8 text-stone-600">
            <p>
              It is the same thing as therapy in a consulting room, delivered
              over a video call. You meet the same therapist at the same time
              each week or fortnight, you talk for fifty minutes, and they work
              with you using the same recognised approaches they would use in
              person — cognitive behavioural therapy, trauma-focused work,
              grief work, couples work.
            </p>
            <p>
              What changes is the logistics, and the logistics are usually what
              stops people. No hour lost to traffic on either side of the
              session. No explaining to a colleague where you are going. No
              geography problem if the therapist who suits you practises in
              another country — which, on Echo, they usually do.
            </p>
            <p>
              What does not change is the part that matters: it is still a
              trained person, still bound by professional confidentiality, still
              accountable to the body that licensed them.
            </p>
          </div>
        </div>
      </Section>

      <Section tone="muted">
        <SectionHeading
          eyebrow="How it works"
          title="Three steps, about three minutes of admin"
          body="The only thing you have to decide up front is roughly what you want help with. Everything else is a preference you can change later."
        />
        <Steps steps={STEPS} />
      </Section>

      <Section>
        <SectionHeading
          eyebrow="Formats"
          title="Video, audio, and messages in between"
          body="One booking, three ways of using it. You do not have to decide now, and you can change it session to session."
        />
        <FeatureGrid features={FORMATS} columns={3} />
        <p className="mx-auto mt-10 max-w-2xl text-center text-sm leading-7 text-stone-500">
          Sessions open in your browser, so there is no app to install. If your
          connection drops mid-session, rejoining from the same link puts you
          back in the same room.
        </p>
      </Section>

      <Section tone="muted">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <SectionHeading
              align="left"
              eyebrow="Who it suits"
              title="Online therapy is a good fit if…"
            />
            <div className="mt-9 rounded-3xl bg-white p-7 shadow-sm ring-1 ring-stone-200/70 sm:p-8">
              <CheckList items={SUITS} />
            </div>
          </div>

          {/* The honest half. Rendered with the same weight as the section above
              it rather than shrunk into a disclaimer — a person who matches one
              of these needs to see it before they pay, not after. */}
          <div>
            <SectionHeading
              align="left"
              eyebrow="Who it does not suit"
              title="Echo is the wrong service if…"
            />
            <ul className="mt-9 flex flex-col gap-4">
              {DOES_NOT_SUIT.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-3 rounded-3xl bg-white p-5 text-[15px] leading-7 text-stone-700 shadow-sm ring-1 ring-stone-200/70"
                >
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-stone-100 text-stone-500">
                    <X className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <div className="mt-6 flex items-start gap-3 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-stone-200">
              <LifeBuoy className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" strokeWidth={1.8} aria-hidden="true" />
              <p className="text-sm leading-6 text-stone-600">
                In immediate danger? Contact your local emergency number. Our{" "}
                <Link href="/crisis" className="font-semibold text-brand-700 underline underline-offset-2">
                  crisis page
                </Link>{" "}
                lists verified helplines with their real opening hours, and a
                directory that finds one wherever you are.
              </p>
            </div>
          </div>
        </div>
      </Section>

      <Section>
        <SectionHeading
          eyebrow="What it costs"
          title="One payment, no renewal"
          body="You buy a bundle of sessions once. Nothing recurs, nothing auto-renews, and the credits stay in your account until you use them."
        />
        <ul className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {PLANS.map((plan) => (
            <li
              key={plan}
              className="flex flex-col rounded-3xl bg-white p-7 shadow-sm ring-1 ring-stone-200/70 sm:p-8"
            >
              <h3 className="font-semibold text-stone-900">{PLAN_LABELS[plan]}</h3>
              <p className="mt-4 font-display text-4xl tracking-tight text-stone-900">
                {money(PLAN_PRICES[plan])}
              </p>
              <p className="mt-1 text-sm text-stone-500">
                {PLAN_PERIOD_LABELS[plan]} · {PLAN_SESSIONS[plan]}{" "}
                {PLAN_SESSIONS[plan] === 1 ? "session" : "sessions"}
              </p>
              <p className="mt-5 flex-1 text-[15px] leading-7 text-stone-600">
                {PLAN_NOTES[plan]}
              </p>
            </li>
          ))}
        </ul>
        <div className="mt-12 flex flex-col items-center gap-4">
          <CtaButton href="/pricing" variant="secondary">
            See the full comparison
          </CtaButton>
          <p className="max-w-2xl text-center text-sm leading-7 text-stone-500">
            {/* The figures above are rendered server-side in KES and are not
                converted — only `PriceTag` on /pricing and /checkout shows an
                approximate local amount, so this must not promise one here. */}
            Paid by card or bank transfer through Paystack, or by M-Pesa if you
            hold a Kenyan mobile-money account. The charge settles in Kenyan
            shillings whatever your own currency; the pricing page shows an
            approximate figure in yours. Cancel a booked session at least 24
            hours ahead and the credit returns to your account.
          </p>
        </div>
      </Section>

      <Section tone="muted">
        <div className="mx-auto max-w-3xl">
          <SectionHeading
            align="left"
            eyebrow="Questions"
            title="Online therapy, answered plainly"
          />
          <FaqList faqs={FAQS} />
        </div>
      </Section>

      {/* The hub's link block. This page carries more internal links than any
          other on the site, by design — see the file header. */}
      <Section>
        <SectionHeading
          eyebrow="Where to go next"
          title="Everything online therapy on Echo covers"
          body="Start from what you want help with, from the kind of session you want, or from where you are."
        />
        <LinkCloud
          groups={[
            {
              heading: "By what you want help with",
              links: CONDITIONS.map((c) => ({
                href: `/therapy-for/${c.slug}`,
                label: `Therapy for ${c.short}`,
              })),
            },
            {
              heading: "By kind of session",
              links: [
                { href: "/individual-therapy", label: "Individual therapy" },
                { href: "/couples-therapy", label: "Couples therapy" },
                { href: "/teen-therapy", label: "Teen therapy" },
                { href: "/therapy-for", label: "All conditions" },
                { href: "/therapists", label: "Browse therapists" },
                { href: "/how-it-works", label: "How it works" },
                { href: "/pricing", label: "Pricing" },
              ],
            },
            {
              /* Country pages, not city pages: what differs between clients is
                 the time-zone gap to Nairobi, the currency their bank converts
                 from, and whether M-Pesa is available — all national, none
                 municipal. Each page states the licensure gap first. */
              heading: "By where you are",
              links: MARKETS.map((m) => ({
                href: `/online-therapy/${m.slug}`,
                label: `Therapy in ${m.country}`,
              })),
            },
          ]}
        />
      </Section>

      <CtaBand
        title="Start with one session"
        body="No subscription, no auto-renewal, and credits that do not expire. Answer a few questions and we will match you with a licensed therapist."
        label="Find your therapist"
      />

      <RelatedLinks
        title="Also worth reading"
        links={[
          { href: "/faq", label: "Frequently asked questions" },
          { href: "/guides", label: "Mental health guides" },
          { href: "/blog", label: "Articles" },
          { href: "/reviews", label: "Client stories" },
          { href: "/about", label: "About Echo" },
          { href: "/organizations", label: "For organizations" },
          { href: "/crisis", label: "Crisis support" },
        ]}
      />
    </>
  );
}
