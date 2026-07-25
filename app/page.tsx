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
} from "lucide-react";
import TestimonialCard from "./components/TestimonialCard";
import PriceTag from "./components/PriceTag";
import Footer from "./components/Footer";
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
    color: "bg-brand",
  },
  {
    quote:
      "The matching process was shockingly accurate. My therapist specialises in exactly what I was struggling with, and the video sessions fit perfectly into my schedule.",
    name: "Devon M.",
    detail: "Anxiety & stress management",
    initials: "DM",
    color: "bg-[#5aa8b0]",
  },
  {
    quote:
      "After years of putting off therapy because of cost and logistics, Echo Health removed every single barrier. I wish I'd started sooner.",
    name: "Rosa K.",
    detail: "Individual & couples therapy",
    initials: "RK",
    color: "bg-[#8abbbf]",
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

/* ─── Page ─────────────────────────────────────────── */

export default function Home() {
  return (
    <div className="flex flex-col flex-1 font-sans bg-white">

      {/* ── Nav ──────────────────────────────────────── */}
      <header className="sticky top-0 z-50 w-full border-b border-cream bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="text-xl font-semibold tracking-tight">
            <span className="text-brand">Echo Psychology </span>
            <span className="text-slate-700">Group</span>
          </span> 
          <nav className="hidden gap-8 text-sm font-medium sm:flex text-slate-500">
            <a href="#how" className="hover:text-brand transition-colors">How it works</a>
            <a href="#therapists" className="hover:text-brand transition-colors">Therapists</a>
            <a href="#pricing" className="hover:text-brand transition-colors">Pricing</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/signin" className="hidden sm:inline text-sm font-medium text-brand hover:opacity-80 transition-opacity">
              Sign in
            </Link>
            <Link href="/signup" className="rounded-full bg-brand px-5 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity shadow-sm">
              Get started
            </Link>
          </div>
        </div>
      </header>

      <main className="flex flex-col flex-1">

        {/* ── Hero ─────────────────────────────────── */}
        <section className="flex flex-col items-center justify-center px-6 py-28 text-center bg-white">
          <div className="mx-auto max-w-2xl">
            <span className="inline-block rounded-full bg-cream px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-brand mb-8">
              Therapy, reimagined
            </span>
            <h1 className="text-5xl sm:text-6xl font-bold leading-tight tracking-tight text-slate-800">
              Feel heard.{" "}
              <span className="text-brand">
                Heal forward.
              </span>
            </h1>
            <p className="mt-6 text-lg leading-8 max-w-xl mx-auto text-slate-500">
              Connect with licensed therapists who truly listen. Echo Health
              makes mental wellness personal, flexible, and within reach —
              whenever you need it.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/signup" className="w-full sm:w-auto rounded-full bg-brand px-8 py-3.5 text-sm font-semibold text-white shadow-md hover:opacity-90 transition-opacity">
                Match with a therapist
              </Link>
              <a href="#how" className="w-full sm:w-auto rounded-full border-2 border-brand bg-cream/30 px-8 py-3.5 text-sm font-semibold text-brand hover:bg-cream/60 transition-colors">
                Learn how it works
              </a>
            </div>
          </div>

          {/* Trust badges */}
          <div className="mt-16 flex flex-wrap items-center justify-center gap-8">
            {trust.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2 text-sm text-slate-400">
                <Icon className="w-4 h-4 text-brand/50" strokeWidth={1.8} />
                {label}
              </div>
            ))}
          </div>
        </section>

        {/* ── How the money works ──────────────────── */}
        <section className="bg-teal-700 px-6 py-20 text-white">
          <div className="mx-auto max-w-5xl">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
              {guarantees.map(({ icon: Icon, title, body }) => (
                <div key={title} className="flex flex-col gap-3">
                  <Icon className="w-6 h-6 text-white/80" strokeWidth={1.8} />
                  <h3 className="font-semibold text-white">{title}</h3>
                  <p className="text-sm leading-6 text-white/70">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── How it works ─────────────────────────── */}
        <section id="how" className="px-6 py-24 bg-white">
          <div className="mx-auto max-w-5xl">
            <div className="text-center mb-16">
              <span className="text-xs font-semibold uppercase tracking-widest text-brand/50">Simple process</span>
              <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-brand">
                Go from curious to cared-for in minutes
              </h2>
              <p className="mt-4 text-brand/60 max-w-lg mx-auto leading-7">
                No waiting rooms, no referrals, no guesswork. Getting started
                is easier than you think.
              </p>
            </div>
            <div className="grid gap-8 sm:grid-cols-3">
              {steps.map((step, i) => (
                <div
                  key={step.title}
                  className="relative flex flex-col gap-5 rounded-2xl border border-cream/70 bg-white p-8 shadow-sm hover:shadow-md transition-shadow"
                >
                  <span className="absolute -top-3 -left-3 w-7 h-7 rounded-full bg-brand text-white text-xs font-bold flex items-center justify-center shadow">
                    {i + 1}
                  </span>
                  <div className="w-12 h-12 rounded-xl bg-cream/60 flex items-center justify-center">
                    <step.icon className="w-6 h-6 text-brand" strokeWidth={1.8} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-brand text-lg">{step.title}</h3>
                    <p className="mt-2 text-sm text-brand/60 leading-6">{step.body}</p>
                  </div>
                </div>
              ))}
            </div>
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
        <section id="therapists" className="px-6 py-24 bg-white">
          <div className="mx-auto max-w-5xl">
            <div className="text-center mb-16">
              <span className="text-xs font-semibold uppercase tracking-widest text-brand/50">Our team</span>
              <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-slate-800">
                Meet a few of our therapists
              </h2>
              <p className="mt-4 text-slate-500 max-w-lg mx-auto leading-7">
                Every Echo Health therapist is fully licensed, background-checked,
                and vetted through our rigorous credentialing process.
              </p>
            </div>
            <div className="grid gap-8 sm:grid-cols-3">
              {therapists.map((t) => (
                <div
                  key={t.name}
                  className="flex flex-col rounded-2xl border border-cream/70 overflow-hidden shadow-sm hover:shadow-md transition-shadow group"
                >
                  <div className="relative h-56 w-full overflow-hidden bg-cream/30">
                    <Image
                      src={t.photo}
                      alt={`Photo of ${t.name}`}
                      fill
                      loading="lazy"
                      className="object-cover object-top group-hover:scale-105 transition-transform duration-500"
                      sizes="(max-width: 768px) 100vw, 33vw"
                    />
                  </div>
                  <div className="p-6 flex flex-col gap-3 flex-1">
                    <div>
                      <h3 className="font-semibold text-slate-800">{t.name}</h3>
                      <p className="text-xs text-slate-400 mt-0.5">{t.title} · {t.experience}</p>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-auto">
                      {t.specialties.map((s) => (
                        <span key={s} className="rounded-full bg-cream px-3 py-1 text-xs font-medium text-brand/80">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-12 text-center">
              {/* Pointed at `#get-started`, an id that does not exist on this
                  page — the button did nothing. Sends visitors to pricing, the
                  next real step, since browsing the full roster requires an
                  account. */}
              <a href="#pricing" className="rounded-full border-2 border-brand px-8 py-3 text-sm font-semibold text-brand hover:bg-cream/40 transition-colors">
                See plans &amp; get matched
              </a>
            </div>
          </div>
        </section>

        {/* ── Testimonials ─────────────────────────── */}
        <section className="px-6 py-24 bg-cream">
          <div className="mx-auto max-w-5xl">
            <div className="text-center mb-16">
              <span className="text-xs font-semibold uppercase tracking-widest text-brand/50">Stories</span>
              <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-slate-800">
                Heard from the people who matter most
              </h2>
            </div>
            <div className="grid gap-8 sm:grid-cols-3">
              {testimonials.map((t) => (
                <TestimonialCard key={t.name} {...t} />
              ))}
            </div>
          </div>
        </section>

        {/* ── Pricing ──────────────────────────────── */}
        <section id="pricing" className="px-6 py-24 bg-white">
          <div className="mx-auto max-w-5xl">
            <div className="text-center mb-16">
              <span className="text-xs font-bold uppercase tracking-widest text-brand/50">Pricing</span>
              <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-slate-800">
                Simple, transparent plans
              </h2>
              <p className="mt-4 text-slate-500 max-w-md mx-auto leading-7">
                One-time payment — no subscription and no auto-renewal. Your session
                credits never expire. Pay with M-Pesa, card, or bank transfer.
              </p>
            </div>
            {/* Three-up only from `md`. At the old `sm` breakpoint (640px) each
                card had roughly 145px of content width, which is not enough for
                a plan price at any weight that reads as a headline. The extra
                row gap on mobile is for the "Most popular" badge, which hangs
                above its card and clipped the card stacked above it. */}
            <div className="grid gap-x-6 gap-y-10 md:gap-6 md:grid-cols-3 items-stretch">
              {plans.map((plan) => (
                <div
                  key={plan.name}
                  className={`relative flex flex-col rounded-2xl border-2 p-8 shadow-sm transition-shadow hover:shadow-md ${
                    plan.highlighted
                      ? "border-brand bg-brand text-white"
                      : "border-slate-200 bg-white text-slate-800"
                  }`}
                >
                  {plan.highlighted && (
                    <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-cream px-4 py-1 text-xs font-bold uppercase tracking-widest text-brand shadow">
                      Most popular
                    </span>
                  )}
                  <div className="mb-6">
                    <h3 className={`text-lg font-bold ${plan.highlighted ? "text-white" : "text-brand"}`}>
                      {plan.name}
                    </h3>
                    <p className={`mt-1 text-sm ${plan.highlighted ? "text-white/70" : "text-slate-400"}`}>
                      {plan.description}
                    </p>
                  </div>
                  <div className="mb-8">
                    <PriceTag
                      amount={plan.price}
                      period={plan.period}
                      priceClass={plan.highlighted ? "text-white" : "text-brand"}
                      periodClass={plan.highlighted ? "text-white/60" : "text-brand/50"}
                    />
                  </div>
                  <ul className="flex flex-col gap-3 flex-1 mb-8">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm">
                        <Check
                          className={`w-4 h-4 mt-0.5 shrink-0 ${plan.highlighted ? "text-cream" : "text-brand"}`}
                          strokeWidth={2.5}
                        />
                        <span className={plan.highlighted ? "text-white/80" : "text-brand/70"}>{f}</span>
                      </li>
                    ))}
                  </ul>
                  {/* Carries the choice the visitor just made. `?plan=` survives
                      sign-up, /post-login and /role-select, and lands as the
                      pre-selected plan on /onboarding — so picking "Couples"
                      here means never being asked again. */}
                  <Link
                    href={`/signup?plan=${plan.id}`}
                    className={`block text-center rounded-full py-3 text-sm font-semibold transition-opacity hover:opacity-90 ${
                      plan.highlighted ? "bg-white text-brand" : "bg-brand text-white"
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
        <section className="bg-teal-700 px-6 py-20 text-center">
          <div className="mx-auto max-w-2xl">
            <h2 className="text-3xl sm:text-4xl font-bold text-white">
              Your first step starts here.
            </h2>
            {/* Was "Thousands of people have already taken control of their
                mental health with Echo Health" — the same unevidenced volume
                claim as the counters above, in prose. The CTA also said "free to
                start", which it is not: the cheapest way in is a paid session. */}
            <p className="mt-4 text-white/80 leading-7">
              Answer a few questions, meet a licensed therapist, and pay only for
              the sessions you book. Today can be your day one.
            </p>
            <Link
              href="/signup"
              className="mt-8 inline-block rounded-full bg-white px-10 py-4 text-sm font-semibold text-teal-700 shadow-lg hover:opacity-90 transition-opacity"
            >
              Match with a therapist
            </Link>
          </div>
        </section>

      </main>

      <Footer />
    </div>
  );
}
