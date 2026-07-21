"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, Sparkles, ArrowRight, RefreshCw, Infinity as InfinityIcon, CalendarX2, Wallet } from "lucide-react";
import PriceTag from "@/app/components/PriceTag";
import SignOutButton from "@/app/components/SignOutButton";
import { PLAN_PRICES, PLAN_PERIOD_LABELS, PLAN_SESSIONS, PLAN_CURRENCY } from "@/lib/constants";

/**
 * Feature lists.
 *
 * These used to repeat four of six bullets verbatim between Individual and
 * Plus, which made the difference between the two tiers invisible at exactly
 * the moment we were asking someone to choose one. Each list now opens with what
 * you are actually buying — the number of sessions — and the upper tiers say
 * "everything in Individual" once rather than restating it line by line, so the
 * only bullets left are the ones that are genuinely incremental.
 *
 * Two claims were dropped rather than reworded: "AI session summaries" (no such
 * feature exists anywhere in the product) and "24-hr therapist response SLA"
 * (nothing measures or enforces a response time). "Priority therapist matching"
 * went too — matching still runs on `PLACEHOLDER_THERAPIST_ID`, so there is no
 * queue to be prioritised in.
 */
const plans = [
  {
    id: "individual",
    name: "Individual",
    price: PLAN_PRICES.individual,
    period: PLAN_PERIOD_LABELS.individual,
    /** People covered by the price. Drives the per-person line on Couples. */
    people: 1,
    badge: null,
    highlighted: false,
    description: "One-on-one therapy tailored to your personal growth and mental wellness goals.",
    features: [
      "One 50-minute video session, one to one",
      "Matched with a licensed therapist",
      "Secure messaging between sessions",
      "Mood, goal and progress tracking",
    ],
  },
  {
    id: "plus",
    name: "Plus",
    price: PLAN_PRICES.plus,
    period: PLAN_PERIOD_LABELS.plus,
    people: 1,
    badge: "Most Popular",
    highlighted: true,
    description: "Two sessions plus therapy materials — the best value per session.",
    features: [
      "Two 50-minute video sessions",
      "Everything in Individual",
      "Therapy worksheets and guided exercises",
      "Lowest cost per session of any plan",
    ],
  },
  {
    id: "couples",
    name: "Couples",
    price: PLAN_PRICES.couples,
    period: PLAN_PERIOD_LABELS.couples,
    people: 2,
    badge: null,
    highlighted: false,
    description: "Two joint sessions for both partners, with shared resources.",
    features: [
      "Two 50-minute sessions with both partners on the call",
      "Everything in Individual, for both of you",
      "Couples worksheets and shared exercises",
      "Matched with a therapist who works with couples",
    ],
  },
];

const PLAN_IDS = plans.map((p) => p.id);
const DEFAULT_PLAN = "plus";

/**
 * Objection handling, at the point of decision.
 *
 * The Continue button previously stood alone under a row of plan cards with
 * nothing but "One-time purchase. No hidden fees." beneath it. Everything here
 * is behaviour the code actually implements — see the note against each — and
 * it carries real weight because the Terms make payments non-refundable, so
 * "what if I picked wrong?" has to be answered somewhere.
 */
const reassurances = [
  {
    icon: RefreshCw,
    // Admins can reassign a client to a different therapist
    // (app/admin/matching/reassign) and no fee is charged for it. Deliberately
    // NOT phrased as self-serve: there is no switch control in the dashboard.
    text: "Not the right fit? Ask us to match you with a different therapist — there is no charge to switch.",
  },
  {
    icon: InfinityIcon,
    // Entitlement is summed over all successful payments with no date filter,
    // and the payments table has no expiry column.
    text: "Your session credits never expire.",
  },
  {
    icon: CalendarX2,
    // A cancelled session is excluded from the booked count, so the credit is
    // released. The code is more permissive than this (any time before the
    // session starts); 24 h is the window the Terms commit to.
    text: "Cancel a booking 24 hours ahead and the credit returns to your account.",
  },
  {
    icon: Wallet,
    text: "Pay with M-Pesa, card, or bank transfer.",
  },
];

function OnboardingContent() {
  const searchParams = useSearchParams();

  /**
   * Honour the plan the visitor already chose on the landing page.
   *
   * Hard-coding `useState("plus")` meant someone who deliberately clicked
   * "Couples" in the pricing table arrived here with "Plus" selected — the
   * choice was silently thrown away and they were made to make it twice.
   * Validated against the known ids so a hand-edited query string cannot
   * select a plan that does not exist.
   */
  const requested = searchParams.get("plan");
  const [selected, setSelected] = useState(
    requested && PLAN_IDS.includes(requested) ? requested : DEFAULT_PLAN
  );
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const selectedPlan = plans.find((p) => p.id === selected);

  function handleContinue() {
    setLoading(true);
    router.push(`/checkout?plan=${selected}`);
  }

  const money = (amount: number) =>
    new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: PLAN_CURRENCY,
      maximumFractionDigits: 0,
    }).format(Math.round(amount));

  return (
    <div className="min-h-screen bg-cream flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-brand/10">
        <span className="text-xl font-bold text-brand tracking-tight">echo health</span>
        <SignOutButton />
      </header>

      {/* Main */}
      <main className="flex-1 flex flex-col items-center px-4 py-14">
        {/* Hero text */}
        <div className="text-center max-w-xl mb-12">
          <div className="inline-flex items-center gap-2 bg-brand/10 text-brand text-sm font-medium px-4 py-1.5 rounded-full mb-4">
            <Sparkles size={14} />
            Choose your plan
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-brand leading-tight">
            You&apos;re almost there
          </h1>
          {/* Was "You can change or cancel at any time", which describes a
              subscription. These are one-time bundles: there is nothing to
              cancel, and what is actually true is the credits outlasting you. */}
          <p className="mt-3 text-brand/60 text-base">
            Select a plan to get matched with your therapist. One payment, no
            subscription, and your sessions never expire.
          </p>
        </div>

        {/* Plan cards.
            Three-up only from `md`: at the old `sm` breakpoint each card had
            about 145px of content width, too narrow for a plan price to read as
            a headline. The larger mobile row gap clears the "Most Popular"
            badge, which hangs above its card and used to clip the card above. */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-5 gap-y-9 md:gap-5 w-full max-w-4xl">
          {plans.map((plan) => {
            const isSelected = selected === plan.id;
            const sessions = PLAN_SESSIONS[plan.id];
            const perSession = plan.price / sessions;
            return (
              <button
                key={plan.id}
                type="button"
                onClick={() => setSelected(plan.id)}
                aria-pressed={isSelected}
                className={`relative text-left rounded-2xl p-7 border-2 transition-all duration-200 focus:outline-none
                  ${plan.highlighted
                    ? "bg-brand text-white border-brand"
                    : "bg-white text-brand border-cream"
                  }
                  ${isSelected ? "ring-4 ring-brand/25 scale-[1.02] shadow-xl" : "hover:shadow-md"}`}
              >
                {/* Badge */}
                {plan.badge && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap bg-amber-400 text-amber-900 text-xs font-semibold px-3 py-0.5 rounded-full shadow-sm">
                    {plan.badge}
                  </span>
                )}

                {/* Selected checkmark */}
                {isSelected && (
                  <span className={`absolute top-4 right-4 flex items-center justify-center w-6 h-6 rounded-full
                    ${plan.highlighted ? "bg-white/20" : "bg-brand"}`}>
                    <Check size={13} className="text-white" strokeWidth={3} />
                  </span>
                )}

                <p className={`text-xs font-semibold uppercase tracking-widest mb-2 ${plan.highlighted ? "text-white/70" : "text-brand/50"}`}>
                  {plan.name}
                </p>

                <PriceTag
                  amount={plan.price}
                  period={plan.period}
                  priceClass={plan.highlighted ? "text-white" : "text-brand"}
                  periodClass={plan.highlighted ? "text-white/60" : "text-brand/50"}
                />

                {/* What you actually get, stated plainly.
                    The plan card previously showed only a price and a feature
                    list, so a visitor could not tell that "Plus" includes TWO
                    sessions without inferring it from a bullet. The per-session
                    figure is shown alongside because comparing 6,500-for-1
                    against 10,500-for-2 otherwise requires mental arithmetic at
                    the exact moment we are asking for a decision — and for
                    Couples the per-person figure too, since 18,000 looks like
                    the dearest plan until you notice it covers two people and
                    works out cheapest of all. */}
                <div className={`mt-3 mb-4 rounded-xl px-3 py-2 ${plan.highlighted ? "bg-white/15" : "bg-brand/5"}`}>
                  <p className={`text-sm font-bold ${plan.highlighted ? "text-white" : "text-brand"}`}>
                    {sessions} {sessions === 1 ? "session" : "sessions"} included
                  </p>
                  {sessions > 1 && (
                    <p className={`text-xs mt-0.5 ${plan.highlighted ? "text-white/70" : "text-brand/50"}`}>
                      {money(perSession)} per session
                      {plan.people > 1 && ` · ${money(perSession / plan.people)} per person`}
                    </p>
                  )}
                </div>

                <p className={`text-sm leading-relaxed mb-5 ${plan.highlighted ? "text-white/80" : "text-brand/60"}`}>
                  {plan.description}
                </p>

                <ul className="space-y-2">
                  {plan.features.map((feat) => (
                    <li key={feat} className="flex items-start gap-2 text-sm">
                      <Check
                        size={14}
                        className={`mt-0.5 shrink-0 ${plan.highlighted ? "text-white/70" : "text-brand"}`}
                        strokeWidth={2.5}
                      />
                      <span className={plan.highlighted ? "text-white/90" : "text-brand/80"}>{feat}</span>
                    </li>
                  ))}
                </ul>
              </button>
            );
          })}
        </div>

        {/* CTA */}
        <div className="mt-10 flex flex-col items-center gap-3">
          <button
            onClick={handleContinue}
            disabled={loading}
            className="flex items-center gap-2 bg-brand text-white font-semibold px-8 py-3.5 rounded-full shadow-md hover:bg-brand/90 active:scale-95 transition-all disabled:opacity-60"
          >
            {loading ? "Setting up…" : `Continue with ${selectedPlan?.name ?? "Plan"}`}
            {!loading && <ArrowRight size={16} />}
          </button>
          <p className="text-xs text-brand/40">One-time purchase. No hidden fees.</p>
        </div>

        {/* Reassurance, next to the button that costs money rather than in a
            footer nobody reaches. */}
        <ul className="mt-8 grid gap-3 sm:grid-cols-2 w-full max-w-2xl">
          {reassurances.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-start gap-2.5 text-sm text-brand/70">
              <Icon size={15} className="mt-0.5 shrink-0 text-brand" strokeWidth={2} />
              {text}
            </li>
          ))}
        </ul>

        {/* Trust strip.
            "⭐ 4.9 / 5 average rating" was removed, not rewritten. Nothing in
            this product collects or aggregates a rating — the figure existed
            only in this file, and it sat two inches from a price. */}
        <div className="mt-12 flex flex-wrap justify-center gap-6 text-xs text-brand/40">
          <span>🔒 TLS-encrypted in transit</span>
          <span>💳 M-Pesa, card &amp; bank transfer via Paystack</span>
          <span>🧾 One-time payment, nothing auto-renews</span>
        </div>
      </main>
    </div>
  );
}

/**
 * `useSearchParams` forces the tree beneath it to render on the client, so it
 * needs a Suspense boundary or the production build fails outright with
 * "Missing Suspense boundary with useSearchParams". Same pattern as /checkout.
 */
export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-cream flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-brand border-t-transparent animate-spin" />
        </div>
      }
    >
      <OnboardingContent />
    </Suspense>
  );
}
