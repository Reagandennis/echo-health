import Link from "next/link";
import {
  ArrowRight,
  CalendarCheck,
  CalendarX2,
  Check,
  HeartHandshake,
  Infinity as InfinityIcon,
  Lock,
  Minus,
  Search,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import PriceTag from "@/app/components/PriceTag";
import JsonLd from "@/app/components/marketing/JsonLd";
import StickyCta from "@/app/components/marketing/StickyCta";
import TherapistCard from "@/app/components/marketing/TherapistCard";
import {
  CtaButton,
  FaqList,
  Section,
  SectionHeading,
  Steps,
  faqJsonLd,
  type Faq,
} from "@/app/components/marketing/sections";
import { sampleTherapists } from "@/lib/directory";
import { CONDITIONS } from "@/lib/navigation";
import { pageMetadata, siteUrl, defaultDescription } from "@/lib/seo";
import {
  PLAN_CURRENCY,
  PLAN_PERIOD_LABELS,
  PLAN_PRICES,
  PLAN_SESSIONS,
} from "@/lib/constants";

/**
 * ## What this page may not say
 *
 * An earlier version carried a band of animated counters — "10,000+ people
 * helped", "500+ licensed therapists", "94% report improvement" — and a chart
 * of outcome percentages footnoted "based on outcome surveys across 10,000+
 * Echo Health users". None of those numbers existed anywhere but in this file:
 * there is no survey table, no aggregation query, and the database has almost
 * no users. Sitting directly above a price, they were a misleading
 * representation under the Consumer Protection Act 2012 (Kenya) s.12–13.
 *
 * They are not coming back in a different shape. Every number on this page is
 * either read from `lib/constants.ts` or is a fact the code enforces. Where a
 * competitor would put a live counter, this page puts the terms of the offer,
 * which are more persuasive anyway because they are checkable.
 *
 * The one place a real count appears is the therapist strip, which reads the
 * actual directory and renders nothing if it is empty.
 */
export const metadata = pageMetadata({
  title: "Online therapy with licensed therapists in Kenya",
  description: defaultDescription,
  path: "/",
  absoluteTitle: true,
});

/** Five minutes, matching `/therapists` — the strip below reads the same rows. */
export const revalidate = 300;

/* ─── Data ─────────────────────────────────────────── */

/**
 * The three hero cards.
 *
 * This is the page's primary CTA and it is deliberately a segmentation choice
 * rather than a button: "Individual / Couples / Teen" is the intake quiz's
 * first question, so answering it here means arriving at `/get-started`
 * already one step in. `?for=` is read and validated by `IntakeQuiz`.
 *
 * It also does the job a "who is this for" section would otherwise need a
 * whole scroll-length to do — a visitor sorts themselves in one tap.
 */
const AUDIENCES = [
  {
    href: "/get-started?for=self",
    title: "Individual",
    body: "For myself",
    className: "bg-brand-700 hover:bg-brand-800",
  },
  {
    href: "/get-started?for=couple",
    title: "Couples",
    body: "For me and my partner",
    className: "bg-brand-800 hover:bg-brand-900",
  },
  {
    href: "/get-started?for=teen",
    title: "Teen",
    body: "For my child, aged 13–17",
    className: "bg-brand-900 hover:bg-brand-950",
  },
] as const;

const STEPS = [
  {
    icon: Search,
    title: "Tell us what you need",
    body: "A short questionnaire about what you want to work on, who you'd feel comfortable with, and when you can meet. About three minutes.",
  },
  {
    icon: CalendarCheck,
    title: "Meet your therapist",
    body: "We introduce you to a licensed therapist whose focus and availability fit what you told us. Not the right fit? Switching is free.",
  },
  {
    icon: HeartHandshake,
    title: "Start when you're ready",
    body: "Fifty minutes by video, phone or messaging — from wherever you feel most yourself. Reschedule up to 24 hours ahead.",
  },
];

/**
 * The terms of the offer, standing where a competitor puts social proof.
 *
 * Every one of these is enforced somewhere in the code — one-time payment in
 * `lib/constants.ts`, credit expiry in the booking logic, the 24-hour window
 * in cancellation — so they stay true without anyone remembering to check.
 */
const GUARANTEES = [
  {
    icon: Wallet,
    title: "Pay once",
    body: "A one-time payment for a bundle of sessions. No subscription, no auto-renewal, nothing to cancel.",
  },
  {
    icon: InfinityIcon,
    title: "Credits never expire",
    body: "Sessions you have paid for stay in your account until you use them, however long that takes.",
  },
  {
    icon: CalendarX2,
    title: "Reschedule freely",
    body: "Cancel at least 24 hours ahead and the credit goes straight back to your account.",
  },
  {
    icon: Lock,
    title: "Private by design",
    body: "Sessions and messages are encrypted in transit and visible only to you and your therapist.",
  },
];

/**
 * Echo against seeing someone in person.
 *
 * Two rows are losses, and they stay. A comparison table that wins every row
 * is an advertisement and reads as one; a table that concedes the two things
 * in-person therapy genuinely does better is the reason a reader believes the
 * other ten. It is also simply true: there is no way to sit in a room with
 * someone over a video call, and a platform cannot prescribe.
 */
const COMPARISON: readonly {
  readonly feature: string;
  readonly echo: boolean;
  readonly inPerson: boolean | "sometimes";
}[] = [
  { feature: "Licensed, credential-checked therapist", echo: true, inPerson: true },
  { feature: "Sitting in the same room", echo: false, inPerson: true },
  { feature: "Can prescribe medication", echo: false, inPerson: "sometimes" },
  { feature: "Sessions from anywhere with a signal", echo: true, inPerson: false },
  { feature: "Evening and weekend availability", echo: true, inPerson: "sometimes" },
  { feature: "Messaging between sessions", echo: true, inPerson: false },
  { feature: "Switch therapists at no cost", echo: true, inPerson: false },
  { feature: "No travel across town to get there", echo: true, inPerson: false },
  { feature: "Pay per session, nothing recurring", echo: true, inPerson: "sometimes" },
  { feature: "Price known before you book", echo: true, inPerson: false },
];

const PLANS = [
  {
    id: "individual",
    name: "Individual",
    description: "One session with a licensed therapist. Book another whenever you need it.",
    features: [
      "One 50-minute video or phone session",
      "Secure in-app messaging with your therapist",
      "Matched with a therapist within 24 hours",
      "Progress tracking dashboard",
    ],
    highlighted: false,
  },
  {
    id: "plus",
    name: "Plus",
    description: "Two sessions plus therapy materials — the lowest cost per session.",
    features: [
      "Two 50-minute video or phone sessions",
      "Therapy worksheets and guided exercises",
      "Everything in Individual",
      "Lowest cost per session of any plan",
    ],
    highlighted: true,
  },
  {
    id: "couples",
    name: "Couples",
    description: "Two joint sessions for you and your partner, with shared resources.",
    features: [
      "Two 50-minute sessions with both partners on the call",
      "Couples worksheets and shared exercises",
      "Matched with a therapist who works with couples",
      "Everything in Individual, for both of you",
    ],
    highlighted: false,
  },
] as const;

const money = (amount: number) =>
  new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: PLAN_CURRENCY,
    maximumFractionDigits: 0,
  }).format(amount);

/**
 * The home-page FAQ.
 *
 * Pricing is answered here rather than being held back for the pricing page —
 * "how much is it" is the question people leave over, and making them navigate
 * for it costs more than the click it saves.
 */
const FAQS: readonly Faq[] = [
  {
    q: "How much does therapy on Echo cost?",
    a: `Sessions start at ${money(PLAN_PRICES.individual)} for one 50-minute session. The Plus bundle is ${money(PLAN_PRICES.plus)} for two sessions, and Couples is ${money(PLAN_PRICES.couples)} for two joint sessions. Every plan is a one-time payment — there is no subscription and nothing renews. Pay with M-Pesa, card or bank transfer.`,
  },
  {
    q: "Who are the therapists?",
    a: "Independently licensed mental-health practitioners registered in Kenya. We check every practitioner's credentials before their profile appears on the site, and nobody is listed until that check passes.",
  },
  {
    q: "Is Echo Health right for me?",
    a: "Echo suits people who want to talk to a licensed therapist regularly and privately. It is not right if you are in immediate danger, need medication prescribed or managed, need an official diagnosis for a legal or insurance purpose, or have been ordered into therapy by a court — we cannot do any of those things. If you need help right now, call 999 or see our crisis page.",
  },
  {
    q: "How long until I'm matched?",
    a: "We aim to introduce you to a therapist within 24 hours of sign-up. If nobody suitable is free in that window, we will tell you rather than match you with someone who is not a good fit.",
  },
  {
    q: "What if my therapist isn't the right fit?",
    a: "Tell us and we will match you with someone else. There is no charge to switch and any unused session credits stay with you — the fit between you and your therapist is the part of therapy that most predicts whether it helps.",
  },
  {
    q: "Can I use Echo from outside Kenya?",
    a: "You can, and many people do. Be aware that our therapists are licensed in Kenya, sessions are scheduled in East Africa Time, and prices are charged in Kenyan shillings.",
  },
  {
    q: "Is what I say private?",
    a: "Sessions and messages are encrypted in transit and visible only to you and your therapist. Your therapist keeps clinical notes that you cannot see and that we do not show to other clients or to our support team. The limits are the usual ones any therapist would explain in a first session — where there is a serious risk to your safety or someone else's.",
  },
];

/* ─── Page ─────────────────────────────────────────── */

export default async function Home() {
  /* Real rows, or the section does not render. The strip this replaced showed
     three invented clinicians over stock photographs — including one whose
     photo also appeared on /about under a different name and job title. */
  const therapists = await sampleTherapists(3);

  return (
    <>
      <JsonLd data={faqJsonLd(FAQS)} />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Service",
          serviceType: "Online psychotherapy",
          provider: { "@type": "MedicalOrganization", name: "Echo Health", url: siteUrl },
          areaServed: { "@type": "Country", name: "Kenya" },
          /* `offers` carries the real figures from `lib/constants.ts`, so a
             price change cannot leave stale structured data behind. */
          offers: PLANS.map((p) => ({
            "@type": "Offer",
            name: p.name,
            price: PLAN_PRICES[p.id],
            priceCurrency: PLAN_CURRENCY,
            url: `${siteUrl}/pricing`,
            description: p.description,
          })),
        }}
      />

      {/* ── Hero ─────────────────────────────────── */}
      <section
        className="curve-down bg-hero-soft px-4 pb-24 pt-16 sm:px-6 sm:pt-24"
        style={{ "--curve-to": "var(--surface)" } as React.CSSProperties}
      >
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="font-display text-[2.75rem] leading-[1.06] tracking-tight text-stone-900 sm:text-6xl lg:text-7xl">
            You deserve to be heard.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-[17px] leading-8 text-stone-600 sm:text-lg">
            Talk to a licensed therapist by video, phone or message — booked
            around your week, from wherever you feel most yourself.
          </p>

          <p className="mt-12 text-sm font-semibold text-stone-700">
            Who is this therapy for?
          </p>
          <ul className="mx-auto mt-4 grid max-w-3xl gap-3 sm:grid-cols-3">
            {AUDIENCES.map((a) => (
              <li key={a.href}>
                <Link
                  href={a.href}
                  className={`group flex min-h-[5.5rem] w-full flex-col justify-center rounded-2xl px-6 py-5 text-left text-white transition-colors sm:min-h-[9rem] ${a.className}`}
                >
                  <span className="font-display text-2xl tracking-tight sm:text-3xl">{a.title}</span>
                  <span className="mt-1 flex items-center gap-1.5 text-sm text-white/80">
                    {a.body}
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          <ul className="mt-12 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
            {[
              { icon: ShieldCheck, label: "Licence-verified therapists" },
              { icon: Lock, label: "Encrypted in transit" },
              { icon: CalendarCheck, label: "Book around your schedule" },
            ].map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-2 text-sm font-medium text-stone-600">
                <Icon className="h-4 w-4 text-brand-600" strokeWidth={1.8} />
                {label}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── The terms of the offer ───────────────── */}
      <section className="bg-surface px-4 pb-16 pt-16 sm:px-6 sm:pb-24 sm:pt-20">
        <div className="mx-auto max-w-7xl">
          <h2 className="sr-only">What you get</h2>
          <div className="relative overflow-hidden rounded-3xl bg-brand-900 px-6 py-12 text-white shadow-xl shadow-brand-950/10 sm:px-12 sm:py-14">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_90%_at_100%_0%,oklch(55%_0.1_205/0.4),transparent_70%)]"
            />
            <div className="relative grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
              {GUARANTEES.map(({ icon: Icon, title, body }) => (
                <div key={title} className="flex flex-col gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 ring-1 ring-inset ring-white/15">
                    <Icon className="h-5 w-5 text-brand-200" strokeWidth={1.8} />
                  </span>
                  <h3 className="font-semibold text-white">{title}</h3>
                  <p className="text-sm leading-6 text-brand-100/75">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────── */}
      <Section id="how" tone="muted">
        <SectionHeading
          eyebrow="How it works"
          title="From curious to cared for, in three steps"
          body="No waiting rooms, no referral letter, no guesswork about who to call."
        />
        <Steps steps={STEPS} />
        <div className="mt-12 text-center">
          <CtaButton href="/how-it-works" variant="secondary">
            See the whole process
          </CtaButton>
        </div>
      </Section>

      {/* ── Therapists ───────────────────────────── */}
      {therapists.length > 0 && (
        <Section id="therapists">
          <SectionHeading
            eyebrow="Our team"
            title="Therapists you can actually look up"
            body="Every profile is a real clinician whose credentials we checked before listing them. Browse the whole roster — you do not need an account."
          />
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {therapists.map((t) => (
              <TherapistCard key={t.id} therapist={t} />
            ))}
          </div>
          <div className="mt-12 text-center">
            <CtaButton href="/therapists" variant="secondary">
              Browse all therapists
            </CtaButton>
          </div>
        </Section>
      )}

      {/* ── Comparison ───────────────────────────── */}
      <Section tone="muted">
        <SectionHeading
          eyebrow="Honestly"
          title="Echo Health vs. seeing someone in person"
          body="Two rows here go the other way. Online therapy is not better at everything, and you should know which parts before you pay for it."
        />
        <div className="mx-auto mt-12 max-w-3xl overflow-x-auto">
          <table className="w-full min-w-[30rem] border-collapse text-left">
            <caption className="sr-only">
              Comparison of Echo Health and in-person therapy across ten features
            </caption>
            <thead>
              <tr className="border-b border-stone-300">
                <th scope="col" className="py-4 pr-4 text-sm font-semibold text-stone-900">
                  <span className="sr-only">Feature</span>
                </th>
                <th scope="col" className="w-28 py-4 text-center text-sm font-semibold text-brand-700">
                  Echo Health
                </th>
                <th scope="col" className="w-28 py-4 text-center text-sm font-semibold text-stone-600">
                  In person
                </th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON.map(({ feature, echo, inPerson }) => (
                <tr key={feature} className="border-b border-stone-200">
                  <th scope="row" className="py-4 pr-4 text-[15px] font-normal text-stone-700">
                    {feature}
                  </th>
                  <td className="py-4 text-center">
                    <Mark on={echo} />
                  </td>
                  <td className="py-4 text-center">
                    <Mark on={inPerson} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* ── Conditions ───────────────────────────── */}
      <Section>
        <SectionHeading
          eyebrow="What we help with"
          title="Start where it actually hurts"
          body="Each of these has a page explaining what therapy for it involves and what a first session is like."
        />
        <ul className="mx-auto mt-12 flex max-w-4xl flex-wrap justify-center gap-2.5">
          {CONDITIONS.map((c) => (
            <li key={c.slug}>
              <Link
                href={`/therapy-for/${c.slug}`}
                className="inline-flex min-h-11 items-center rounded-full bg-surface px-5 text-sm font-medium text-stone-700 shadow-sm ring-1 ring-inset ring-stone-200 transition-colors hover:text-brand-700 hover:ring-stone-300"
              >
                {c.label}
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      {/* ── Pricing ──────────────────────────────── */}
      <Section id="pricing" tone="muted">
        <SectionHeading
          eyebrow="Pricing"
          title="One payment. No subscription."
          body="Session credits never expire, and nothing renews on its own. Pay with M-Pesa, card or bank transfer."
        />
        {/* Three-up only from `md`. At 640px each card had ~145px of content
            width, which is not enough for a price at any weight that reads as
            a headline. The extra row gap on mobile is for the "Most popular"
            badge, which hangs above its card and clipped the card above it. */}
        <div className="mt-14 grid items-stretch gap-x-6 gap-y-10 md:grid-cols-3 md:gap-6">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`relative flex flex-col rounded-3xl p-8 transition-shadow ${
                plan.highlighted
                  ? "bg-brand-900 text-white shadow-xl shadow-brand-950/20"
                  : "bg-surface text-stone-900 shadow-sm ring-1 ring-stone-200 hover:shadow-md"
              }`}
            >
              {plan.highlighted && (
                <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-sage px-4 py-1 text-xs font-bold uppercase tracking-widest text-brand-950 shadow">
                  Most popular
                </span>
              )}
              <h3 className={`text-lg font-semibold ${plan.highlighted ? "text-white" : "text-stone-900"}`}>
                {plan.name}
              </h3>
              <p className={`mt-1 text-sm leading-6 ${plan.highlighted ? "text-brand-100/80" : "text-stone-500"}`}>
                {plan.description}
              </p>
              <div className="mb-8 mt-6">
                <PriceTag
                  amount={PLAN_PRICES[plan.id]}
                  period={PLAN_PERIOD_LABELS[plan.id]}
                  priceClass={plan.highlighted ? "text-white" : "text-stone-900"}
                  periodClass={plan.highlighted ? "text-brand-100/70" : "text-stone-500"}
                />
                <p className={`mt-2 text-xs ${plan.highlighted ? "text-brand-100/70" : "text-stone-500"}`}>
                  {PLAN_SESSIONS[plan.id]}{" "}
                  {PLAN_SESSIONS[plan.id] === 1 ? "session" : "sessions"}, paid once
                </p>
              </div>
              <ul className="mb-8 flex flex-1 flex-col gap-3">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-3 text-sm">
                    <span
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                        plan.highlighted ? "bg-white/10 text-brand-200" : "bg-brand-50 text-brand-700"
                      }`}
                    >
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                    <span className={plan.highlighted ? "text-white/85" : "text-stone-600"}>{f}</span>
                  </li>
                ))}
              </ul>
              {/* `?plan=` survives sign-up, /post-login and /role-select and
                  lands pre-selected on /onboarding — so picking Couples here
                  means never being asked again. */}
              <Link
                href={`/get-started?for=${plan.id === "couples" ? "couple" : "self"}`}
                className={`flex min-h-12 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                  plan.highlighted
                    ? "bg-white text-brand-900 hover:bg-brand-50"
                    : "bg-brand text-white hover:bg-brand-700"
                }`}
              >
                Get started
              </Link>
            </div>
          ))}
        </div>
        <p className="mt-10 text-center text-sm text-stone-600">
          <Link href="/pricing" className="font-semibold text-brand-700 underline underline-offset-4">
            Compare the plans in full
          </Link>
        </p>
      </Section>

      {/* ── FAQ ──────────────────────────────────── */}
      <Section>
        <div className="mx-auto max-w-3xl">
          <SectionHeading eyebrow="Questions" title="The things people ask first" />
          <FaqList faqs={FAQS} />
          <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <CtaButton href="/faq" variant="secondary">
              More questions
            </CtaButton>
            <CtaButton href="/get-started">Get started</CtaButton>
          </div>
        </div>
      </Section>

      {/* ── Closing ──────────────────────────────── */}
      <section className="bg-stone-50 px-4 pb-20 sm:px-6 sm:pb-24">
        <div className="relative mx-auto max-w-7xl overflow-hidden rounded-3xl bg-brand-gradient px-6 py-14 text-center sm:px-12 sm:py-20">
          <div className="relative mx-auto max-w-2xl">
            <h2 className="font-display text-3xl tracking-tight text-white sm:text-4xl lg:text-[2.75rem] lg:leading-[1.1]">
              Today can be day one.
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-[17px] leading-8 text-white/90">
              Answer a few questions, meet a licensed therapist, and pay only
              for the sessions you book.
            </p>
            <CtaButton href="/get-started" variant="onDark" className="mt-9">
              Match with a therapist
            </CtaButton>
          </div>
        </div>
      </section>

      <StickyCta />
    </>
  );
}

/**
 * A comparison cell.
 *
 * The mark is `aria-hidden` and paired with visually hidden text, because a
 * screen reader announcing "check" in a table of ten rows conveys nothing
 * about which column it was in.
 */
function Mark({ on }: { readonly on: boolean | "sometimes" }) {
  if (on === "sometimes") {
    return (
      <>
        <Minus className="mx-auto h-5 w-5 text-stone-400" strokeWidth={2.5} aria-hidden="true" />
        <span className="sr-only">Sometimes</span>
      </>
    );
  }
  return on ? (
    <>
      <Check className="mx-auto h-5 w-5 text-brand-600" strokeWidth={3} aria-hidden="true" />
      <span className="sr-only">Yes</span>
    </>
  ) : (
    <>
      <span aria-hidden="true" className="mx-auto block h-5 w-5 text-lg leading-5 text-stone-300">
        ×
      </span>
      <span className="sr-only">No</span>
    </>
  );
}
