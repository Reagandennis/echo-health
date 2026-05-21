// Server Component — interactive children (StatCounter, ProgressBar, etc.) are individually "use client"

import Image from "next/image";
import Link from "next/link";
import {
  Search,
  CalendarCheck,
  HeartHandshake,
  ShieldCheck,
  Clock,
  MessageCircle,
  Check,
} from "lucide-react";
import StatCounter from "./components/StatCounter";
import ProgressBar from "./components/ProgressBar";
import TestimonialCard from "./components/TestimonialCard";
import PriceTag from "./components/PriceTag";
import Footer from "./components/Footer";

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

const outcomes = [
  { label: "Report reduced anxiety within 8 weeks", value: 94 },
  { label: "Say they feel genuinely understood", value: 91 },
  { label: "Continue therapy beyond 3 months", value: 78 },
  { label: "Would recommend Echo Health to a friend", value: 97 },
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

const plans = [
  {
    name: "Individual",
    price: 69,
    period: "/ week",
    description: "One-on-one sessions with a licensed therapist.",
    features: [
      "Weekly 50-min video or phone session",
      "Unlimited in-app messaging",
      "Therapist matching within 24 h",
      "Progress tracking dashboard",
    ],
    highlighted: false,
    cta: "Get started",
  },
  {
    name: "Plus",
    price: 99,
    period: "/ week",
    description: "More support, more flexibility.",
    features: [
      "Everything in Individual",
      "2 sessions per week",
      "Priority therapist matching",
      "On-demand crisis support",
      "Monthly care plan review",
    ],
    highlighted: true,
    cta: "Start free trial",
  },
  {
    name: "Couples",
    price: 109,
    period: "/ week",
    description: "Guided sessions for you and your partner.",
    features: [
      "Weekly 50-min couples session",
      "Individual check-ins between sessions",
      "Shared progress insights",
      "Specialised couples therapists",
    ],
    highlighted: false,
    cta: "Get started",
  },
];

const trust = [
  { icon: ShieldCheck, label: "HIPAA compliant" },
  { icon: Clock, label: "Available 7 days a week" },
  { icon: MessageCircle, label: "Unlimited messaging" },
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

        {/* ── Stats ────────────────────────────────── */}
        <section className="bg-teal-700 px-6 py-20 text-white">
          <div className="mx-auto max-w-5xl">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-12  ">
              <StatCounter end={10000} suffix="+" label="People helped" className="text-white" labelClassName="text-white/70" />
              <StatCounter end={500} suffix="+" label="Licensed therapists" className="text-white" labelClassName="text-white/70" />
              <StatCounter end={94} suffix="%" label="Report improvement" className="text-white" labelClassName="text-white/70" />
              <StatCounter end={3} label="Avg. days to first session" className="text-white" labelClassName="text-white/70" />
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

        {/* ── Outcomes chart ───────────────────────── */}
        <section className="px-6 py-24 bg-teal-700">
          <div className="mx-auto max-w-5xl grid gap-16 sm:grid-cols-2 items-center">
            <div>
              <span className="text-xs font-semibold uppercase tracking-widest text-white/70">Real results</span>
              <h2 className="mt-3 text-3xl sm:text-4xl font-bold  text-white leading-tight ">
                Therapy that actually moves the needle
              </h2>
              <p className="mt-4 text-white leading-7">
                Based on outcome surveys across 10,000+ Echo Health users after
                8 weeks of consistent therapy. Results are from self-reported
                assessments.
              </p>
              <a
                href="#get-started"
                className="mt-8 inline-block rounded-full bg-teal-900 px-7 py-3 text-sm font-bold text-white hover:opacity-90 transition-opacity"
              >
                Start your journey
              </a>
            </div>
            <div className="flex flex-col gap-6 rounded-2xl border border-cream/70 bg-white p-8 shadow-sm">
              {outcomes.map((o, i) => (
                <ProgressBar key={o.label} label={o.label} value={o.value} delay={i * 150} />
              ))}
            </div>
          </div>
        </section>

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
              <a href="#get-started" className="rounded-full border-2 border-brand px-8 py-3 text-sm font-semibold text-brand hover:bg-cream/40 transition-colors">
                Browse all therapists
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
                No hidden fees. Cancel or change plans anytime. First week is free on Plus.
              </p>
            </div>
            <div className="grid gap-6 sm:grid-cols-3 items-stretch">
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
                      usd={plan.price}
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
                  <Link
                    href="/signup"
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
            <p className="mt-4 text-white/80 leading-7">
              Thousands of people have already taken control of their mental
              health with Echo Health. Today can be your day one.
            </p>
            <Link
              href="/signup"
              className="mt-8 inline-block rounded-full bg-white px-10 py-4 text-sm font-semibold text-teal-700 shadow-lg hover:opacity-90 transition-opacity"
            >
              Match with a therapist — it&apos;s free to start
            </Link>
          </div>
        </section>

      </main>

      <Footer />
    </div>
  );
}
