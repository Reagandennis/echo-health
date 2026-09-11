"use client";

import { useCurrency } from "@/lib/useCurrency";

interface PriceTagProps {
  /**
   * Amount in the BASE currency (KES) — i.e. straight from `PLAN_PRICES`.
   *
   * Renamed from `usd`: prices are denominated in the Paystack settlement
   * currency now, and a prop called `usd` holding KES is the kind of thing that
   * later gets "helpfully" converted a second time.
   */
  readonly amount: number;
  readonly period?: string;
  /**
   * Font-size utilities for the figure itself.
   *
   * Separate from `priceClass` because the size used to be hard-coded as
   * `text-4xl` in the base className while callers passed a competing size
   * (`text-2xl` on checkout) through `priceClass`. Tailwind resolves conflicting
   * utilities by stylesheet order, not by the order they appear in the class
   * string, so `text-4xl` silently won everywhere and the caller's choice was
   * ignored. One prop, one owner.
   */
  readonly sizeClass?: string;
  readonly priceClass?: string;
  readonly periodClass?: string;
  /**
   * Show the exact KES amount alongside a converted figure.
   *
   * Set this anywhere near a payment decision. A visitor who only ever sees
   * "≈ $12" and is then charged KES 1,550 has grounds for a chargeback, and in
   * most jurisdictions that is also a price-transparency breach.
   */
  readonly showExact?: boolean;
}

export default function PriceTag({
  amount,
  // No default period. Plans are one-time bundles with different units
  // ("per session" vs "for 2 sessions"), and the old "/ week" default silently
  // advertised a billing cycle that never existed.
  period = "",
  // Steps down on small screens. A three-up pricing grid leaves each card
  // roughly 150px of content width on a phone-sized viewport, which "KES 10,500"
  // at text-4xl does not fit.
  sizeClass = "text-3xl sm:text-4xl",
  priceClass = "text-brand",
  periodClass = "text-stone-500",
  showExact = false,
}: PriceTagProps) {
  const { formatPrice, formatExact, isConverted } = useCurrency();

  return (
    <div className="flex flex-col">
      {/* `flex-wrap`, so a long period label ("for 2 sessions") drops to its own
          line on a narrow card instead of squeezing or overflowing the price. */}
      <div className="flex flex-wrap items-end gap-x-1.5">
        <span className={`font-bold ${sizeClass} ${priceClass}`}>
          {/* The "≈" is load-bearing: it is the difference between quoting a
              price and estimating one. */}
          {isConverted ? "≈ " : ""}
          {formatPrice(amount)}
        </span>
        <span className={`text-sm mb-1 ${periodClass}`}>{period}</span>
      </div>

      {/* No loading state, deliberately. The KES figure above is correct from
          the first paint (see `lib/useCurrency.ts`); dimming it to opacity-40
          behind two third-party network calls made the most important element
          on the page look broken for the visitors we actually have. */}
      {isConverted && (
        <span className={`text-xs mt-1 ${periodClass}`}>
          {showExact
            ? `You will be charged ${formatExact(amount)}`
            : `Charged in ${formatExact(amount)}`}
        </span>
      )}
    </div>
  );
}
