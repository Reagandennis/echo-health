// Server Component — interactive children (StatCounter, ProgressBar, etc.) are individually "use client"

import Image from "next/image";
import Link from "next/link";
import {
  Search,
  CalendarCheck,
  HeartHandshake,
  ShieldCheck,
  Lock,
  CalendarX2,
  Infinity as InfinityIcon,
  Wallet,
  Check,
  ArrowRight,
} from "lucide-react";
import TestimonialCard from "@/app/components/TestimonialCard";
import PriceTag from "@/app/components/PriceTag";
import Footer from "@/app/components/Footer";
import BrandMark from "@/app/components/portal/BrandMark";
import { PLAN_PRICES, PLAN_SESSIONS, PLAN_PERIOD_LABELS } from "@/lib/constants";

/* ─── Data ─────────────────────────────────────────── */

const steps = [
  {
    icon: Search,
    title: "Tell us what you need",
    body: "Answer a short questionnaire about your goals, preferences, and schedule. Takes under 3 minutes.",
  },
  {
    icon: CalendarCheck,
    title: "Get matched instantly",
    body: "We surface licensed therapists whose approach, availability, and specialties fit you best.",
  },
  {
    icon: HeartHandshake,
    title: "Start your first session",
    body: "Connect via video, phone, or chat — on your terms, from wherever feels most comfortable.",
  },
];

/**
 * How the offer works, stated as facts rather than as statistics.
 *
 * This replaced a band of animated counters — "10,000+ people helped",
 * "500+ licensed therapists", "94% report improvement" — and a chart of
 * outcome percentages footnoted "based on outcome surveys across 10,000+ Echo
 * Health users". None of those numbers existed anywhere but in the JSX: there
 * is no survey table, no aggregation query, no seed data, and the database has
 * almost no users. Sitting directly above a price, they were a misleading
 * representation under the Consumer Protection Act 2012 (Kenya) s.12–13.
 *
 * Everything below is enforced in code, so it stays true without anyone having
 * to remember to check it.
 */
const guarantees = [
  {
    icon: Wallet,
    title: "Pay once",
    body: "One-time payment for a bundle of sessions. No subscription, no auto-renewal, nothing to cancel.",
  },
  {
    icon: InfinityIcon,
    title: "Credits never expire",
    body: "Sessions you have paid for stay in your account until you use them, however long that takes.",
  },
  {
    icon: CalendarX2,
    title: "Reschedule freely",
    body: "Cancel a booking at least 24 hours ahead and the credit goes straight back to your account.",
  },
  {
    icon: Lock,
    title: "Private by design",
    body: "Sessions and messages are encrypted in transit and visible only to you and your therapist.",
  },
];

const therapists = [
  {
    name: "Dr. Amara Osei",
    title: "Licensed Clinical Psychologist",
    specialties: ["Anxiety", "Trauma", "CBT"],
    experience: "12 yrs exp.",
    photo:
      "https://images.unsplash.com/photo-1614608682850-e0d6ed316d47?w=400&q=80&fit=crop&crop=face",
  },
  {
    name: "Marcus Rivera, LCSW",
    title: "Licensed Clinical Social Worker",
    specialties: ["Depression", "Grief", "Relationships"],
    experience: "9 yrs exp.",
    photo:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=80&fit=crop&crop=face",
  },
  {
    name: "Dr. Priya Nair",
    title: "Marriage & Family Therapist",
    specialties: ["Couples", "Family", "Life transitions"],
    experience: "15 yrs exp.",
    photo:
      "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&q=80&fit=crop&crop=face",
  },
];

const testimonials = [
  {
    quote:
      "I was skeptical about online therapy, but Echo Health matched me with someone who genuinely gets me. I haven't felt this clear-headed in years.",
    name: "Jamie L.",
    detail: "Using Echo Health for 6 months",
    initials: "JL",
    color: "bg-brand-600",
  },
  {
    quote:
      "The matching process was shockingly accurate. My therapist specialises in exactly what I was struggling with, and the video sessions fit perfectly into my schedule.",
    name: "Devon M.",
    detail: "Anxiety & stress management",
    initials: "DM",
    color: "bg-brand-800",
  },
  {
    quote:
      "After years of putting off therapy because of cost and logistics, Echo Health removed every single barrier. I wish I'd started sooner.",
    name: "Rosa K.",
    detail: "Individual & couples therapy",
    initials: "RK",
    color: "bg-stone-600",
  },
];

/**
 * Public pricing. These MUST match `PLAN_PRICES` / `PLAN_SESSIONS` exactly —
 * this is the page a customer forms their expectation from.
 *
 * It previously advertised "/ week" on every plan and "2 sessions per week" on
 * Plus, which described a weekly subscription that does not exist: these are
 * one-time bundles of 1 or 2 sessions. Someone reading it could reasonably have
 * believed KES 2,000 bought them a session every week.
 *
 * `id` matches the keys in `PLAN_PRICES` because it travels: every CTA below
 * carries it to /signup, and it survives all the way to /checkout. Without it
 * the section was decorative — clicking "Couples" dropped you on /onboarding
 * with "Plus" pre-selected and no memory of the choice you had just made.
 */
const plans = [
  {
    id: "individual",
    name: "Individual",
    price: PLAN_PRICES.individual,
    sessions: PLAN_SESSIONS.individual,
    period: PLAN_PERIOD_LABELS.individual,
    description: "One session with a licensed therapist. Book another whenever you need it.",
    features: [
      "One 50-min video or phone session",
      "Secure in-app messaging with your therapist",
      "Therapist matching within 24 h",
      "Progress tracking dashboard",
    ],
    highlighted: false,
    cta: "Get started",
  },
  {
    id: "plus",
    name: "Plus",
    price: PLAN_PRICES.plus,
    sessions: PLAN_SESSIONS.plus,
    period: PLAN_PERIOD_LABELS.plus,
    description: "Two sessions plus therapy materials — the best value per session.",
    features: [
      "Two 50-min video or phone sessions",
      "Therapy materials & worksheets",
      "Priority therapist matching",
      "Secure in-app messaging with your therapist",
      "Progress tracking dashboard",
    ],
    highlighted: true,
    cta: "Get started",
  },
  {
    id: "couples",
    name: "Couples",
    price: PLAN_PRICES.couples,
    sessions: PLAN_SESSIONS.couples,
    period: PLAN_PERIOD_LABELS.couples,
    description: "Two joint sessions for you and your partner, with shared resources.",
    features: [
      "Two 50-min joint sessions for both partners",
      "Couples resource library & exercises",
      "Shared progress insights",
      "Specialised couples therapists",
    ],
    highlighted: false,
    cta: "Get started",
  },
];

/**
 * Hero trust strip.
 *
 * The first badge used to read "HIPAA compliant". HIPAA is a United States
 * statute and has no application to a Kenyan service — the instrument that
 * actually governs this data is the Data Protection Act 2019 (Kenya). Claiming
 * compliance with the wrong regime is worse than claiming none: it is both
 * false and unverifiable. These describe the protections that exist instead of
 * naming a regime.
 *
 * "Available 7 days a week" and "Unlimited messaging" went with it — the first
 * depends entirely on individual therapist availability, and neither is
 * enforced anywhere in the product.
 */
const trust = [
  { icon: ShieldCheck, label: "Licence-verified therapists" },
  { icon: Lock, label: "Encrypted in transit" },
  { icon: CalendarCheck, label: "Book around your schedule" },
];

/* ─── Pieces ───────────────────────────────────────── */

function SectionHeading({
  eyebrow,
  title,
  body,
}: {
  readonly eyebrow: string;
  readonly title: string;
  readonly body?: string;
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">{eyebrow}</p>
      <h2 className="mt-3 font-display text-3xl tracking-tight text-stone-900 sm:text-5xl">{title}</h2>
      {body && <p className="mx-auto mt-5 max-w-xl leading-7 text-stone-600">{body}</p>}
    </div>
  );
}

/* ─── Page ─────────────────────────────────────────── */

export default function Home() {
  return (
    <div className="flex flex-col flex-1 font-sans bg-white">

      {/* ── Nav ──────────────────────────────────────── */}
      <header className="sticky top-0 z-50 w-full border-b border-stone-200/60 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <BrandMark
            size="sm"
            name={
              <>
                <span className="text-brand-700">Echo Psychology</span>
                <span className="hidden text-stone-700 sm:inline"> Group</span>
              </>
            }
          />
          <nav className="hidden items-center gap-8 text-sm font-medium text-stone-600 md:flex">
            <a href="#how" className="transition-colors hover:text-stone-900">How it works</a>
            <a href="#therapists" className="transition-colors hover:text-stone-900">Therapists</a>
            <a href="#pricing" className="transition-colors hover:text-stone-900">Pricing</a>
          </nav>
          {/* "Sign in" used to be `hidden sm:inline`, so a returning client on
              a phone had no way to sign in from the home page. */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Link href="/signin" className="rounded-full px-3 py-2 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-100 hover:text-stone-900">
              Sign in
            </Link>
            <Link href="/signup" className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700">
              Get started
            </Link>
          </div>
        </div>
      </header>

      <main className="flex flex-col flex-1">

        {/* ── Hero ─────────────────────────────────── */}
        <section className="relative isolate overflow-hidden bg-aurora px-6 pt-20 pb-28 sm:pt-28 sm:pb-36">
          <Image
            src="/echo-butterfly.png"
            alt=""
            width={500}
            height={500}
            preload
            className="pointer-events-none absolute left-1/2 top-0 -z-10 w-[680px] max-w-none -translate-x-1/2 opacity-[0.06]"
          />
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-brand-700 ring-1 ring-inset ring-brand-200 backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
              Therapy, reimagined
            </span>
            <h1 className="mt-8 font-display text-5xl leading-[1.05] tracking-tight text-stone-900 sm:text-7xl">
              Feel heard.{" "}
              <br className="hidden sm:block" />
              <em className="text-brand-600">Heal forward.</em>
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-lg leading-8 text-stone-600">
              Connect with licensed therapists who truly listen. Echo Health
              makes mental wellness personal, flexible, and within reach —
              whenever you need it.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/signup"
                className="group inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-brand-900/15 transition-colors hover:bg-brand-700 sm:w-auto"
              >
                Match with a therapist
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <a
                href="#how"
                className="inline-flex w-full items-center justify-center rounded-full bg-white px-7 py-3.5 text-sm font-semibold text-stone-800 shadow-sm ring-1 ring-inset ring-stone-300 transition hover:ring-stone-400 sm:w-auto"
              >
                Learn how it works
              </a>
            </div>
          </div>

          {/* Trust badges */}
          <ul className="mx-auto mt-14 flex max-w-3xl flex-wrap items-center justify-center gap-x-8 gap-y-3">
            {trust.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-2 text-sm font-medium text-stone-600">
                <Icon className="h-4 w-4 text-brand-600" strokeWidth={1.8} />
                {label}
              </li>
            ))}
          </ul>
        </section>

        {/* ── How the money works ──────────────────── */}
        <section className="px-4 sm:px-6">
          <div className="relative mx-auto -mt-12 max-w-6xl overflow-hidden rounded-3xl bg-brand-900 px-6 py-12 text-white shadow-xl shadow-brand-950/10 sm:px-12 sm:py-14">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_90%_at_100%_0%,oklch(55%_0.1_205/0.4),transparent_70%)]"
            />
            <div className="relative grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
              {guarantees.map(({ icon: Icon, title, body }) => (
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
        </section>

        {/* ── How it works ─────────────────────────── */}
        <section id="how" className="px-6 py-24 sm:py-28">
          <div className="mx-auto max-w-6xl">
            <SectionHeading
              eyebrow="Simple process"
              title="Go from curious to cared-for in minutes"
              body="No waiting rooms, no referrals, no guesswork. Getting started is easier than you think."
            />
            <ol className="mt-16 grid gap-6 md:grid-cols-3">
              {steps.map((step, i) => (
                <li
                  key={step.title}
                  className="flex flex-col gap-6 rounded-3xl bg-white p-8 shadow-sm ring-1 ring-stone-200/70 transition-shadow hover:shadow-md"
                >
                  <div className="flex items-center justify-between">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-100">
                      <step.icon className="h-6 w-6" strokeWidth={1.8} />
                    </span>
                    <span aria-hidden="true" className="font-display text-4xl text-stone-200">
                      0{i + 1}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-stone-900">{step.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-stone-600">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* An "Outcomes" section stood here: a "Real results" headline over four
            progress bars (94% reduced anxiety, 91% feel understood, 78% continue
            past 3 months, 97% would recommend) footnoted "based on outcome
            surveys across 10,000+ Echo Health users after 8 weeks". No such
            survey, aggregation or user base exists — the numbers were literals
            in this file. Removed rather than rewritten: there is no honest
            version of a clinical-outcomes claim we have not measured. Restore it
            the day `sessionFeedback` is actually aggregated. */}

        {/* ── Therapists ───────────────────────────── */}
        <section id="therapists" className="border-y border-stone-200/60 bg-stone-50 px-6 py-24 sm:py-28">
          <div className="mx-auto max-w-6xl">
            <SectionHeading
              eyebrow="Our team"
              title="Meet a few of our therapists"
              body="Every Echo Health therapist is fully licensed, background-checked, and vetted through our rigorous credentialing process."
            />
            <div className="mt-16 grid gap-6 md:grid-cols-3">
              {therapists.map((t) => (
                <article
                  key={t.name}
                  className="group flex flex-col overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-stone-200/70 transition-shadow hover:shadow-lg"
                >
                  <div className="relative h-64 w-full overflow-hidden bg-stone-100">
                    <Image
                      src={t.photo}
                      alt={`Photo of ${t.name}`}
                      fill
                      loading="lazy"
                      className="object-cover object-top transition-transform duration-500 group-hover:scale-[1.03]"
                      sizes="(max-width: 768px) 100vw, 33vw"
                    />
                  </div>
                  <div className="flex flex-1 flex-col gap-4 p-6">
                    <div>
                      <h3 className="font-semibold text-stone-900">{t.name}</h3>
                      <p className="mt-0.5 text-sm text-stone-500">{t.title} · {t.experience}</p>
                    </div>
                    <div className="mt-auto flex flex-wrap gap-2">
                      {t.specialties.map((s) => (
                        <span key={s} className="rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-800 ring-1 ring-inset ring-brand-100">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                </article>
              ))}
            </div>
            <div className="mt-12 text-center">
              {/* Pointed at `#get-started`, an id that does not exist on this
                  page — the button did nothing. Sends visitors to pricing, the
                  next real step, since browsing the full roster requires an
                  account. */}
              <a
                href="#pricing"
                className="inline-flex items-center gap-2 rounded-full bg-white px-7 py-3 text-sm font-semibold text-stone-800 shadow-sm ring-1 ring-inset ring-stone-300 transition hover:ring-stone-400"
              >
                See plans &amp; get matched
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </section>

        {/* ── Testimonials ─────────────────────────── */}
        <section className="px-6 py-24 sm:py-28">
          <div className="mx-auto max-w-6xl">
            <SectionHeading eyebrow="Stories" title="Heard from the people who matter most" />
            <div className="mt-16 grid gap-6 md:grid-cols-3">
              {testimonials.map((t) => (
                <TestimonialCard key={t.name} {...t} />
              ))}
            </div>
          </div>
        </section>

        {/* ── Pricing ──────────────────────────────── */}
        <section id="pricing" className="border-t border-stone-200/60 bg-stone-50 px-6 py-24 sm:py-28">
          <div className="mx-auto max-w-5xl">
            <SectionHeading
              eyebrow="Pricing"
              title="Simple, transparent plans"
              body="One-time payment — no subscription and no auto-renewal. Your session credits never expire. Pay with M-Pesa, card, or bank transfer."
            />
            {/* Three-up only from `md`. At the old `sm` breakpoint (640px) each
                card had roughly 145px of content width, which is not enough for
                a plan price at any weight that reads as a headline. The extra
                row gap on mobile is for the "Most popular" badge, which hangs
                above its card and clipped the card stacked above it. */}
            <div className="mt-16 grid items-stretch gap-x-6 gap-y-10 md:grid-cols-3 md:gap-6">
              {plans.map((plan) => (
                <div
                  key={plan.name}
                  className={`relative flex flex-col rounded-3xl p-8 transition-shadow ${
                    plan.highlighted
                      ? "bg-brand-900 text-white shadow-xl shadow-brand-950/20"
                      : "bg-white text-stone-900 shadow-sm ring-1 ring-stone-200 hover:shadow-md"
                  }`}
                >
                  {plan.highlighted && (
                    <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-sage px-4 py-1 text-xs font-bold uppercase tracking-widest text-brand-950 shadow">
                      Most popular
                    </span>
                  )}
                  <div className="mb-6">
                    <h3 className={`text-lg font-semibold ${plan.highlighted ? "text-white" : "text-stone-900"}`}>
                      {plan.name}
                    </h3>
                    <p className={`mt-1 text-sm leading-6 ${plan.highlighted ? "text-brand-100/80" : "text-stone-500"}`}>
                      {plan.description}
                    </p>
                  </div>
                  <div className="mb-8">
                    <PriceTag
                      amount={plan.price}
                      period={plan.period}
                      priceClass={plan.highlighted ? "text-white" : "text-stone-900"}
                      periodClass={plan.highlighted ? "text-brand-100/70" : "text-stone-500"}
                    />
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
                  {/* Carries the choice the visitor just made. `?plan=` survives
                      sign-up, /post-login and /role-select, and lands as the
                      pre-selected plan on /onboarding — so picking "Couples"
                      here means never being asked again. */}
                  <Link
                    href={`/signup?plan=${plan.id}`}
                    className={`block rounded-full py-3 text-center text-sm font-semibold transition-colors ${
                      plan.highlighted ? "bg-white text-brand-900 hover:bg-brand-50" : "bg-brand text-white hover:bg-brand-700"
                    }`}
                  >
                    {plan.cta}
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA Banner ───────────────────────────── */}
        <section className="bg-stone-50 px-4 pb-24 sm:px-6">
          <div className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl bg-brand-gradient px-6 py-16 text-center sm:px-12 sm:py-20">
            <Image
              src="/echo-butterfly.png"
              alt=""
              width={500}
              height={500}
              className="pointer-events-none absolute -bottom-28 -right-20 w-[440px] opacity-10 brightness-0 invert"
            />
            <div className="relative mx-auto max-w-2xl">
              <h2 className="font-display text-3xl tracking-tight text-white sm:text-5xl">
                Your first step starts here.
              </h2>
              {/* Was "Thousands of people have already taken control of their
                  mental health with Echo Health" — the same unevidenced volume
                  claim as the counters above, in prose. The CTA also said "free to
                  start", which it is not: the cheapest way in is a paid session. */}
              <p className="mx-auto mt-4 max-w-lg leading-7 text-white">
                Answer a few questions, meet a licensed therapist, and pay only for
                the sessions you book. Today can be your day one.
              </p>
              <Link
                href="/signup"
                className="mt-8 inline-flex items-center gap-2 rounded-full bg-white px-8 py-3.5 text-sm font-semibold text-brand-800 shadow-lg transition-colors hover:bg-brand-50"
              >
                Match with a therapist
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>

      </main>

      <Footer />
    </div>
  );
}
