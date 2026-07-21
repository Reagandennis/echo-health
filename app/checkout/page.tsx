"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Lock,
  Check,
  Tag,
  X,
  Sparkles,
  RefreshCw,
  Infinity as InfinityIcon,
  CalendarX2,
  Wallet,
} from "lucide-react";
import { Suspense } from "react";
import PriceTag from "@/app/components/PriceTag";
import { useUser } from "@/app/components/UserProvider";
import { PLAN_PRICES, PLAN_PERIOD_LABELS, PLAN_SESSIONS, PROMO_DISCOUNT_PERCENT } from "@/lib/constants";

/**
 * Kept in step with the lists on /onboarding — a summary that describes a
 * different product from the one the visitor just picked is worse than no
 * summary at all. "AI session summaries" and the "24-hr therapist response SLA"
 * were dropped from both: neither exists in the product.
 */
const plans: Record<
  string,
  { name: string; price: number; period: string; features: string[] }
> = {
  individual: {
    name: "Individual",
    price: PLAN_PRICES.individual,
    period: PLAN_PERIOD_LABELS.individual,
    features: [
      "One 50-minute video session, one to one",
      "Matched with a licensed therapist",
      "Secure messaging between sessions",
      "Mood, goal and progress tracking",
    ],
  },
  plus: {
    name: "Plus",
    price: PLAN_PRICES.plus,
    period: PLAN_PERIOD_LABELS.plus,
    features: [
      "Two 50-minute video sessions",
      "Everything in Individual",
      "Therapy worksheets and guided exercises",
      "Lowest cost per session of any plan",
    ],
  },
  couples: {
    name: "Couples",
    price: PLAN_PRICES.couples,
    period: PLAN_PERIOD_LABELS.couples,
    features: [
      "Two 50-minute sessions with both partners on the call",
      "Everything in Individual, for both of you",
      "Couples worksheets and shared exercises",
      "Matched with a therapist who works with couples",
    ],
  },
};

/**
 * The same four promises as /onboarding, restated at the last possible moment.
 *
 * Repetition is the point: this is the screen where someone is about to part
 * with money under Terms that make the payment non-refundable, and the previous
 * version answered none of the questions that stops them.
 */
const reassurances = [
  {
    icon: RefreshCw,
    text: "Not the right fit? Ask us to match you with a different therapist — there is no charge to switch.",
  },
  { icon: InfinityIcon, text: "Your session credits never expire." },
  { icon: CalendarX2, text: "Cancel a booking 24 hours ahead and the credit returns to your account." },
  { icon: Wallet, text: "Pay with M-Pesa, card, or bank transfer." },
];

function CheckoutContent() {
  const user = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const planId = searchParams.get("plan") ?? "plus";
  const plan = plans[planId] ?? plans.plus;
  const sessions = PLAN_SESSIONS[planId] ?? PLAN_SESSIONS.plus;

  const [loading, setLoading] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  // Promo code state. `promoOpen` keeps the field collapsed until asked for —
  // see the note on the disclosure below.
  const [promoOpen, setPromoOpen] = useState(false);
  const [promoInput, setPromoInput] = useState("");
  const [promoApplied, setPromoApplied] = useState(false);
  const [promoError, setPromoError] = useState("");
  const [promoLoading, setPromoLoading] = useState(false);

  async function handleApplyPromo() {
    setPromoError("");
    if (!promoInput.trim()) {
      setPromoError("Please enter a promo code.");
      return;
    }
    setPromoLoading(true);
    try {
      const res = await fetch("/api/promo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: promoInput.trim(), userId: user?.$id ?? "anonymous" }),
      });
      const data: { error?: string } = await res.json();
      if (res.ok) {
        setPromoApplied(true);
      } else {
        setPromoError(data.error ?? "Invalid promo code.");
      }
    } catch {
      setPromoError("Could not validate promo code. Try again.");
    } finally {
      setPromoLoading(false);
    }
  }

  function handleRemovePromo() {
    setPromoApplied(false);
    setPromoOpen(false);
    setPromoInput("");
    setPromoError("");
  }

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setPayError(null);

    setLoading(true);
    try {
      // Only the plan id and the promo CODE are sent — never a price or a
      // discount. The server looks up the plan, re-validates the code, and
      // computes the amount. A client that could state its own price is how
      // people pay one shilling for the top plan.
      //
      // A promo is a 50% discount, not a free pass: the remainder is still
      // charged, so this no longer short-circuits past the payment processor.
      const res = await fetch("/api/payments/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: planId,
          ...(promoApplied ? { promoCode: promoInput.trim() } : {}),
        }),
      });

      const data = (await res.json()) as { authorizationUrl?: string; error?: string };

      if (!res.ok || !data.authorizationUrl) {
        throw new Error(data.error ?? "Could not start payment.");
      }

      // Hand off to Paystack's hosted checkout. `assign`, not `push`: this
      // leaves the app entirely and must be a full navigation.
      window.location.assign(data.authorizationUrl);
    } catch (err: unknown) {
      setPayError(err instanceof Error ? err.message : "Could not start payment.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-cream flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-brand/10">
        <span className="text-xl font-bold text-brand tracking-tight">echo health</span>
        <div className="flex items-center gap-1.5 text-xs text-brand/40">
          <Lock size={12} />
          Secured with 256-bit encryption
        </div>
      </header>

      <main className="flex-1 flex flex-col lg:flex-row items-start justify-center gap-8 px-4 py-12 max-w-5xl mx-auto w-full">
        {/* Left — Payment form */}
        <div className="flex-1 w-full max-w-lg">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1.5 text-sm text-brand/50 hover:text-brand mb-6 transition-colors"
          >
            <ArrowLeft size={15} />
            Back to plans
          </button>

          <h1 className="text-2xl font-bold text-brand mb-1">Complete your order</h1>
          <p className="text-sm text-brand/50 mb-8">
            {promoApplied
              ? `Your promo code gives ${PROMO_DISCOUNT_PERCENT}% off. You'll be charged the discounted amount.`
              : "You'll be redirected to Paystack to complete payment."}
          </p>

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {/* No card fields, deliberately.
                Card details are collected on Paystack's hosted checkout, not
                here. Accepting a PAN/CVC in this form would place the whole
                application in PCI DSS scope (SAQ D rather than SAQ A) — and the
                previous version collected them only to discard them, which is
                the worst of both worlds. */}
            {!promoApplied && (
              <div className="rounded-xl border border-brand/15 bg-white px-4 py-4 flex gap-3 items-start">
                <Lock size={16} className="text-brand mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-brand">Secure checkout by Paystack</p>
                  <p className="text-xs text-brand/55 mt-1 leading-relaxed">
                    You&apos;ll be redirected to Paystack to complete payment by card,
                    M-Pesa or bank transfer. Echo Health never sees your card details.
                  </p>
                </div>
              </div>
            )}

            {/* Promo code — a disclosure, not a field.
                This used to be the first and most prominent element on the page:
                a large empty box demanding a code that almost nobody has. An
                empty discount field immediately before payment does not win
                anyone a discount, it just plants "everyone else is paying less
                than me" and sends people off to search for a code they will not
                find. Collapsed to a link so the people who do hold one can still
                use it without the rest being asked a question they cannot
                answer. */}
            {promoApplied ? (
              <div className="flex items-center gap-3 bg-brand/8 border border-brand/20 rounded-xl px-4 py-3">
                <Sparkles size={16} className="text-brand shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-brand">Promo code applied!</p>
                  <p className="text-xs text-brand/50">{promoInput.toUpperCase()} · {PROMO_DISCOUNT_PERCENT}% off</p>
                </div>
                <button
                  type="button"
                  onClick={handleRemovePromo}
                  className="text-brand/40 hover:text-brand transition-colors"
                  aria-label="Remove promo code"
                >
                  <X size={15} />
                </button>
              </div>
            ) : promoOpen ? (
              <div>
                <label htmlFor="promoCode" className="block text-xs font-semibold text-brand/60 uppercase tracking-wide mb-1.5">
                  Promo code
                </label>
                <div className="flex gap-2">
                  <input
                    id="promoCode"
                    type="text"
                    autoFocus
                    value={promoInput}
                    onChange={(e) => { setPromoInput(e.target.value); setPromoError(""); }}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void handleApplyPromo(); } }}
                    placeholder="ECHO-XXXX"
                    className={`flex-1 rounded-xl border px-4 py-3 text-sm text-brand bg-white placeholder:text-brand/30 focus:outline-none focus:ring-2 focus:ring-brand/40 transition uppercase
                      ${promoError ? "border-red-400" : "border-brand/15"}`}
                  />
                  <button
                    type="button"
                    onClick={() => void handleApplyPromo()}
                    disabled={promoLoading}
                    className="flex items-center gap-1.5 px-4 py-3 rounded-xl bg-brand/10 text-brand text-sm font-semibold hover:bg-brand/20 transition disabled:opacity-50 shrink-0"
                  >
                    <Tag size={14} />
                    {promoLoading ? "…" : "Apply"}
                  </button>
                </div>
                {promoError && (
                  <p className="text-red-500 text-xs mt-1">{promoError}</p>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setPromoOpen(true)}
                className="text-sm text-brand/50 hover:text-brand underline underline-offset-4 transition-colors"
              >
                Have a promo code?
              </button>
            )}

            {payError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                <p className="text-sm text-red-700">{payError}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-brand text-white font-semibold py-3.5 rounded-full shadow-md hover:bg-brand/90 active:scale-95 transition-all disabled:opacity-60 mt-2"
            >
              <Lock size={15} />
              {loading
                ? "Processing…"
                : promoApplied
                ? `Pay ${PROMO_DISCOUNT_PERCENT}% off — ${plan.name}`
                : `Continue to payment — ${plan.name}`}
            </button>

            <p className="text-center text-xs text-brand/35 mt-1">
              By continuing you agree to our Terms of Service and Privacy Policy. This is a one-time purchase, not a subscription.
            </p>

            {/* Objection handling, immediately under the button that costs
                money. There was none here at all, on the one screen where the
                Terms make the payment non-refundable. */}
            <ul className="space-y-2.5 border-t border-brand/8 pt-5">
              {reassurances.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-start gap-2.5 text-sm text-brand/70">
                  <Icon size={15} className="mt-0.5 shrink-0 text-brand" strokeWidth={2} />
                  {text}
                </li>
              ))}
            </ul>
          </form>
        </div>

        {/* Right — Order summary.
            `order-first` on mobile. As the second child of a `flex-col` stack
            this sat BELOW the pay button on anything narrower than 1024px,
            which is most of our traffic: people were being asked to authorise a
            payment before they had seen the amount. */}
        <div className="w-full max-w-sm order-first lg:order-none lg:sticky lg:top-12">
          <div className="bg-white rounded-2xl border border-brand/10 shadow-sm p-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-brand/40 mb-4">
              Order summary
            </p>

            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <p className="text-lg font-bold text-brand">{plan.name} Plan</p>
                <p className="text-xs text-brand/40 mt-0.5">
                  {sessions} {sessions === 1 ? "session" : "sessions"} · one-time payment · credits never expire
                </p>
              </div>
              <PriceTag
                showExact
                amount={plan.price}
                period={plan.period}
                sizeClass="text-2xl"
                priceClass="text-brand"
                periodClass="text-brand/40 text-xs"
              />
            </div>

            <ul className="space-y-2 border-t border-brand/8 pt-4 mb-5">
              {plan.features.map((feat) => (
                <li key={feat} className="flex items-start gap-2 text-sm">
                  <Check size={14} className="text-brand mt-0.5 shrink-0" strokeWidth={2.5} />
                  <span className="text-brand/70">{feat}</span>
                </li>
              ))}
            </ul>

            {/* Trust badges.
                The first read "HIPAA compliant & encrypted". HIPAA is a US
                statute with no application in Kenya; the instrument that governs
                this data is the Data Protection Act 2019. Rather than swap one
                regime's name for another's — we do not claim certification
                against either — these state the protections that actually
                exist. */}
            <div className="flex flex-col gap-2 border-t border-brand/8 pt-4">
              {[
                { icon: Lock, label: "Encrypted in transit" },
                { icon: Lock, label: "Card details handled by Paystack, never by us" },
                { icon: Wallet, label: "No hidden fees, ever" },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-2 text-xs text-brand/40">
                  <Icon size={13} className="text-brand/30 shrink-0" />
                  {label}
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-cream flex items-center justify-center"><p className="text-brand/60">Loading...</p></div>}>
      <CheckoutContent />
    </Suspense>
  );
}
