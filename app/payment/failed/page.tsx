"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { XCircle, RefreshCw, ArrowLeft, Headphones } from "lucide-react";
import { Suspense } from "react";

const REASONS: Record<string, string> = {
  declined: "Your card was declined. Please check your card details or try a different card.",
  expired: "Your card has expired. Please use a card with a valid expiry date.",
  insufficient: "Insufficient funds. Please use a different payment method.",
  network: "A network error occurred. Please check your connection and try again.",
};

function PaymentFailedContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const planId = searchParams.get("plan") ?? "plus";
  const reason = searchParams.get("reason") ?? "declined";
  const message = REASONS[reason] ?? REASONS.declined;
  const planLabel = planId.charAt(0).toUpperCase() + planId.slice(1);

  return (
    <div className="min-h-screen bg-cream flex flex-col items-center justify-center px-4">
      <div className="mb-8">
        <div className="w-24 h-24 rounded-full bg-red-50 flex items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
            <XCircle size={40} className="text-red-500" strokeWidth={1.5} />
          </div>
        </div>
      </div>

      <div className="text-center max-w-md mb-10">
        <h1 className="text-3xl font-bold text-brand mb-3">Payment unsuccessful</h1>
        <p className="text-brand/60 text-base leading-relaxed">{message}</p>
      </div>

      <div className="bg-white rounded-2xl border border-red-100 shadow-sm p-6 w-full max-w-sm mb-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-brand/40 mb-4">What happened?</p>
        <div className="space-y-2 text-sm">
          {[
            { label: "Error type", value: reason.charAt(0).toUpperCase() + reason.slice(1) },
            { label: "Plan", value: `${planLabel} Plan` },
            { label: "Charge", value: "None — you were not charged" },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between">
              <span className="text-brand/40">{label}</span>
              <span className={`font-medium ${label === "Charge" ? "text-emerald-600" : "text-brand"}`}>
                {value}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
        <button
          onClick={() => router.push(`/checkout?plan=${planId}`)}
          className="flex-1 flex items-center justify-center gap-2 bg-brand text-white font-semibold py-3.5 rounded-full shadow-md hover:bg-brand/90 active:scale-95 transition-all"
        >
          <RefreshCw size={15} /> Try again
        </button>
        <button
          onClick={() => router.push("/onboarding")}
          className="flex-1 flex items-center justify-center gap-2 border border-brand/20 text-brand font-semibold py-3.5 rounded-full hover:bg-brand/5 active:scale-95 transition-all"
        >
          <ArrowLeft size={15} /> Change plan
        </button>
      </div>

      <button className="flex items-center gap-1.5 text-xs text-brand/40 hover:text-brand mt-6 transition-colors">
        <Headphones size={13} /> Contact support
      </button>
    </div>
  );
}

export default function PaymentFailedPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-cream flex items-center justify-center"><p className="text-brand/60">Loading...</p></div>}>
      <PaymentFailedContent />
    </Suspense>
  );
}
