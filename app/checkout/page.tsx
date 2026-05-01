"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ShieldCheck, Lock, CreditCard, Check, Tag, X, Sparkles } from "lucide-react";
import { Suspense } from "react";
import PriceTag from "@/app/components/PriceTag";
import { useUser } from "@/app/components/UserProvider";

const plans: Record<
  string,
  { name: string; price: number; period: string; features: string[] }
> = {
  individual: {
    name: "Individual",
    price: 69,
    period: "/month",
    features: [
      "Weekly 50-min video sessions",
      "Unlimited secure messaging",
      "Progress tracking dashboard",
      "AI session summaries",
    ],
  },
  plus: {
    name: "Plus",
    price: 99,
    period: "/month",
    features: [
      "Weekly 50-min video sessions",
      "Priority therapist matching",
      "Unlimited secure messaging",
      "24-hr therapist response SLA",
      "Progress tracking dashboard",
      "AI session summaries",
    ],
  },
  couples: {
    name: "Couples",
    price: 109,
    period: "/month",
    features: [
      "Weekly 50-min joint sessions",
      "Couples progress dashboard",
      "Secure partner messaging channel",
      "Relationship milestone tracking",
      "AI session summaries",
    ],
  },
};

// Format card number with spaces every 4 digits
function formatCardNumber(value: string) {
  return value
    .replaceAll(/\D/g, "")
    .slice(0, 16)
    .replaceAll(/(.{4})/g, "$1 ")
    .trim();
}

// Format expiry as MM / YY
function formatExpiry(value: string) {
  const digits = value.replaceAll(/\D/g, "").slice(0, 4);
  if (digits.length >= 3) return `${digits.slice(0, 2)} / ${digits.slice(2)}`;
  return digits;
}

function CheckoutContent() {
  const user = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const planId = searchParams.get("plan") ?? "plus";
  const plan = plans[planId] ?? plans.plus;

  const [form, setForm] = useState({
    cardName: "",
    cardNumber: "",
    expiry: "",
    cvc: "",
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Partial<typeof form>>({});

  // Promo code state
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
    setPromoInput("");
    setPromoError("");
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    let formatted = value;
    if (name === "cardNumber") formatted = formatCardNumber(value);
    if (name === "expiry") formatted = formatExpiry(value);
    if (name === "cvc") formatted = value.replaceAll(/\D/g, "").slice(0, 4);
    setForm((prev) => ({ ...prev, [name]: formatted }));
    setErrors((prev) => ({ ...prev, [name]: undefined }));
  }

  function validate() {
    const errs: Partial<typeof form> = {};
    if (!form.cardName.trim()) errs.cardName = "Name on card is required.";
    if (form.cardNumber.replaceAll(/\s/g, "").length < 16)
      errs.cardNumber = "Enter a valid 16-digit card number.";
    if (form.expiry.replaceAll(/\W/g, "").length < 4)
      errs.expiry = "Enter a valid expiry date.";
    if (form.cvc.length < 3) errs.cvc = "Enter a valid CVC.";
    return errs;
  }

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!promoApplied) {
      const errs = validate();
      if (Object.keys(errs).length > 0) {
        setErrors(errs);
        return;
      }
    }
    setLoading(true);
    // Payment provider integration goes here (e.g. Stripe, Paystack, etc.)
    // On failure: router.push(`/payment/failed?plan=${planId}&reason=declined`)
    router.push(`/payment/success?plan=${plan.name}`);
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
              ? "Your promo code has been applied. No payment needed for this session."
              : "You'll be charged after confirming your details below."}
          </p>

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {/* Promo code */}
            {promoApplied ? (
              <div className="flex items-center gap-3 bg-brand/8 border border-brand/20 rounded-xl px-4 py-3">
                <Sparkles size={16} className="text-brand shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-brand">Promo code applied!</p>
                  <p className="text-xs text-brand/50">{promoInput.toUpperCase()} · 1 free session</p>
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
            ) : (
              <div>
                <label htmlFor="promoCode" className="block text-xs font-semibold text-brand/60 uppercase tracking-wide mb-1.5">
                  Promo code <span className="normal-case font-normal text-brand/35">(optional)</span>
                </label>
                <div className="flex gap-2">
                  <input
                    id="promoCode"
                    type="text"
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
            )}

            {/* Payment fields — hidden when promo is applied */}
            {!promoApplied && (<>
            <div>
              <label htmlFor="cardName" className="block text-xs font-semibold text-brand/60 uppercase tracking-wide mb-1.5">
                Name on card
              </label>
              <input
                id="cardName"
                type="text"
                name="cardName"
                value={form.cardName}
                onChange={handleChange}
                placeholder="Jane Doe"
                autoComplete="cc-name"
                className={`w-full rounded-xl border px-4 py-3 text-sm text-brand bg-white placeholder:text-brand/30 focus:outline-none focus:ring-2 focus:ring-brand/40 transition
                  ${errors.cardName ? "border-red-400" : "border-brand/15"}`}
              />
              {errors.cardName && (
                <p className="text-red-500 text-xs mt-1">{errors.cardName}</p>
              )}
            </div>

            {/* Card number */}
            <div>
              <label htmlFor="cardNumber" className="block text-xs font-semibold text-brand/60 uppercase tracking-wide mb-1.5">
                Card number
              </label>
              <div className="relative">
                <input
                  id="cardNumber"
                  type="text"
                  name="cardNumber"
                  value={form.cardNumber}
                  onChange={handleChange}
                  placeholder="1234 5678 9012 3456"
                  autoComplete="cc-number"
                  inputMode="numeric"
                  className={`w-full rounded-xl border px-4 py-3 pr-12 text-sm text-brand bg-white placeholder:text-brand/30 focus:outline-none focus:ring-2 focus:ring-brand/40 transition
                    ${errors.cardNumber ? "border-red-400" : "border-brand/15"}`}
                />
                <CreditCard
                  size={18}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-brand/25"
                />
              </div>
              {errors.cardNumber && (
                <p className="text-red-500 text-xs mt-1">{errors.cardNumber}</p>
              )}
            </div>

            {/* Expiry + CVC */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="expiry" className="block text-xs font-semibold text-brand/60 uppercase tracking-wide mb-1.5">
                  Expiry date
                </label>
                <input
                  id="expiry"
                  type="text"
                  name="expiry"
                  value={form.expiry}
                  onChange={handleChange}
                  placeholder="MM / YY"
                  autoComplete="cc-exp"
                  inputMode="numeric"
                  className={`w-full rounded-xl border px-4 py-3 text-sm text-brand bg-white placeholder:text-brand/30 focus:outline-none focus:ring-2 focus:ring-brand/40 transition
                    ${errors.expiry ? "border-red-400" : "border-brand/15"}`}
                />
                {errors.expiry && (
                  <p className="text-red-500 text-xs mt-1">{errors.expiry}</p>
                )}
              </div>
              <div>
                <label htmlFor="cvc" className="block text-xs font-semibold text-brand/60 uppercase tracking-wide mb-1.5">
                  CVC
                </label>
                <input
                  id="cvc"
                  type="text"
                  name="cvc"
                  value={form.cvc}
                  onChange={handleChange}
                  placeholder="123"
                  autoComplete="cc-csc"
                  inputMode="numeric"
                  className={`w-full rounded-xl border px-4 py-3 text-sm text-brand bg-white placeholder:text-brand/30 focus:outline-none focus:ring-2 focus:ring-brand/40 transition
                    ${errors.cvc ? "border-red-400" : "border-brand/15"}`}
                />
                {errors.cvc && (
                  <p className="text-red-500 text-xs mt-1">{errors.cvc}</p>
                )}
              </div>
            </div>
            </>)}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-brand text-white font-semibold py-3.5 rounded-full shadow-md hover:bg-brand/90 active:scale-95 transition-all disabled:opacity-60 mt-2"
            >
              <Lock size={15} />
              {loading
                ? "Processing…"
                : promoApplied
                ? "Claim free session"
                : `Subscribe — ${plan.name}`}
            </button>

            <p className="text-center text-xs text-brand/35 mt-1">
              By subscribing you agree to our Terms of Service and Privacy Policy. Cancel anytime.
            </p>
          </form>
        </div>

        {/* Right — Order summary */}
        <div className="w-full max-w-sm lg:sticky lg:top-12">
          <div className="bg-white rounded-2xl border border-brand/10 shadow-sm p-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-brand/40 mb-4">
              Order summary
            </p>

            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <p className="text-lg font-bold text-brand">{plan.name} Plan</p>
                <p className="text-xs text-brand/40 mt-0.5">Billed monthly · cancel anytime</p>
              </div>
              <PriceTag
                usd={plan.price}
                period={plan.period}
                priceClass="text-brand text-2xl font-bold"
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

            {/* Trust badges */}
            <div className="flex flex-col gap-2 border-t border-brand/8 pt-4">
              {[
                { icon: ShieldCheck, label: "HIPAA compliant & encrypted" },
                { icon: Lock, label: "Secure payment processing" },
                { icon: CreditCard, label: "No hidden fees, ever" },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-2 text-xs text-brand/40">
                  <Icon size={13} className="text-brand/30" />
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
