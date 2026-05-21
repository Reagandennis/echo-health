"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Sparkles, ArrowRight } from "lucide-react";
import PriceTag from "@/app/components/PriceTag";
import SignOutButton from "@/app/components/SignOutButton";

const plans = [
  {
    id: "individual",
    name: "Individual",
    price: 69,
    period: "/month",
    badge: null,
    highlighted: false,
    description: "One-on-one therapy tailored to your personal growth and mental wellness goals.",
    features: [
      "Weekly 50-min video sessions",
      "Unlimited secure messaging",
      "Progress tracking dashboard",
      "AI session summaries",
    ],
  },
  {
    id: "plus",
    name: "Plus",
    price: 99,
    period: "/month",
    badge: "Most Popular",
    highlighted: true,
    description: "Everything in Individual, plus priority matching and faster therapist response times.",
    features: [
      "Weekly 50-min video sessions",
      "Priority therapist matching",
      "Unlimited secure messaging",
      "24-hr therapist response SLA",
      "Progress tracking dashboard",
      "AI session summaries",
    ],
  },
  {
    id: "couples",
    name: "Couples",
    price: 109,
    period: "/month",
    badge: null,
    highlighted: false,
    description: "Shared sessions designed to strengthen connection and resolve conflict together.",
    features: [
      "Weekly 50-min joint sessions",
      "Couples progress dashboard",
      "Secure partner messaging channel",
      "Relationship milestone tracking",
      "AI session summaries",
    ],
  },
];

export default function OnboardingPage() {
  const [selected, setSelected] = useState("plus");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const selectedPlan = plans.find((p) => p.id === selected);

  async function handleContinue() {
    setLoading(true);
    router.push(`/checkout?plan=${selected}`);
  }

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
          <p className="mt-3 text-brand/60 text-base">
            Select a plan to get matched with your therapist. You can change or cancel at any time.
          </p>
        </div>

        {/* Plan cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 w-full max-w-4xl">
          {plans.map((plan) => {
            const isSelected = selected === plan.id;
            return (
              <button
                key={plan.id}
                onClick={() => setSelected(plan.id)}
                className={`relative text-left rounded-2xl p-7 border-2 transition-all duration-200 focus:outline-none
                  ${plan.highlighted
                    ? "bg-brand text-white border-brand"
                    : "bg-white text-brand border-cream"
                  }
                  ${isSelected ? "ring-4 ring-brand/25 scale-[1.02] shadow-xl" : "hover:shadow-md"}`}
              >
                {/* Badge */}
                {plan.badge && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-400 text-amber-900 text-xs font-semibold px-3 py-0.5 rounded-full shadow-sm">
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
                  usd={plan.price}
                  period={plan.period}
                  priceClass={plan.highlighted ? "text-white text-4xl font-bold" : "text-brand text-4xl font-bold"}
                  periodClass={plan.highlighted ? "text-white/60 text-sm" : "text-brand/50 text-sm"}
                />

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
          <p className="text-xs text-brand/40">Cancel anytime. No hidden fees.</p>
        </div>

        {/* Trust strip */}
        <div className="mt-14 flex flex-wrap justify-center gap-6 text-xs text-brand/40">
          <span>🔒 TLS-encrypted in transit</span>
          <span>💳 Secure payments via Stripe</span>
          <span>⭐ 4.9 / 5 average rating</span>
        </div>
      </main>
    </div>
  );
}
