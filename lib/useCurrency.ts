"use client";

import { useEffect, useState } from "react";
import { PLAN_CURRENCY } from "@/lib/constants";

/**
 * Localised price display.
 *
 * THE BASE CURRENCY IS KES — the currency the Paystack account settles in and
 * the one `PLAN_PRICES` is denominated in. Conversion here is a courtesy for
 * international visitors; the charge is always in KES.
 *
 * That distinction is not cosmetic. Showing someone "$12" and then charging them
 * KES 1,550 produces chargebacks, and in most jurisdictions breaches price
 * transparency rules. So:
 *
 *   • `formatPrice()` returns an APPROXIMATE local figure, for browsing.
 *   • `formatExact()` returns the real KES amount, for the point of payment.
 *   • `isConverted` tells the UI whether to mark a figure as approximate.
 *
 * This previously treated the base as USD and had a bug that made a wrong price
 * more likely than a missing one — see `rate` below.
 *
 * IT ALSO USED TO RENDER NOTHING UNTIL TWO THIRD-PARTY CALLS RESOLVED.
 * `formatPrice` returned "…" while `ipapi.co` and then `open.er-api.com` were in
 * flight, so on a Kenyan mobile connection the most important element on the
 * pricing page was an ellipsis for up to a couple of seconds. That was a
 * self-inflicted wound: KES is the base currency, so the correct answer for the
 * majority of visitors needs zero network calls. The price now renders
 * immediately in KES and is *upgraded* to a converted figure only if detection
 * resolves and says the visitor is somewhere else.
 */

interface CurrencyState {
  /** Currency to display in. Equals the base when conversion is unavailable. */
  currency: string;
  locale: string;
  /**
   * Multiplier from the base currency to `currency`.
   *
   * `null` means "conversion unavailable" and is deliberately NOT defaulted to
   * 1. The old code did `rates[currency] ?? 1`, which kept the detected local
   * currency while leaving the amount unconverted — so a Kenyan visitor saw
   * "KES 69" for a plan priced at KES 8,900, a ~130× under-display, silently.
   * A missing rate must degrade to showing the base price, never to showing a
   * confidently wrong one.
   */
  rate: number | null;
  /**
   * Whether currency detection is still in flight.
   *
   * This is NOT "the price is unknown" — the base-currency price is always
   * known. It only means a conversion may still arrive and replace the figure
   * on screen. Nothing user-facing should block on it; see `formatPrice`.
   */
  loading: boolean;
}

const BASE_CURRENCY = PLAN_CURRENCY;

const DEFAULT: CurrencyState = {
  currency: BASE_CURRENCY,
  locale: "en-KE",
  rate: null,
  loading: true,
};

// Module-level cache — detection runs once per page load, not per component.
let cached: CurrencyState | null = null;
let inflight: Promise<CurrencyState> | null = null;

async function detectCurrency(): Promise<CurrencyState> {
  if (cached !== null) return cached;
  if (inflight !== null) return inflight;

  inflight = (async (): Promise<CurrencyState> => {
    const settled = (state: CurrencyState) => {
      cached = state;
      return state;
    };

    try {
      const geoRes = await fetch("https://ipapi.co/json/", { cache: "force-cache" });
      if (!geoRes.ok) return settled({ ...DEFAULT, loading: false });

      const geo = (await geoRes.json()) as { currency?: string; languages?: string };
      const currency = geo.currency;

      const locale =
        geo.languages?.split(",")[0] ??
        (typeof navigator === "undefined" ? "en-KE" : navigator.language) ??
        "en-KE";

      // Visitor is already in the base currency — nothing to convert, and the
      // price shown is exact rather than approximate.
      if (!currency || currency === BASE_CURRENCY) {
        return settled({ currency: BASE_CURRENCY, locale, rate: null, loading: false });
      }

      const rateRes = await fetch(`https://open.er-api.com/v6/latest/${BASE_CURRENCY}`, {
        cache: "force-cache",
      });
      if (!rateRes.ok) return settled({ ...DEFAULT, locale, loading: false });

      const rateData = (await rateRes.json()) as {
        result?: string;
        rates?: Record<string, number>;
      };

      const rate = rateData.rates?.[currency];

      // No usable rate → show the base price. Explicitly NOT `?? 1`.
      if (rateData.result !== "success" || typeof rate !== "number" || rate <= 0) {
        return settled({ currency: BASE_CURRENCY, locale, rate: null, loading: false });
      }

      return settled({ currency, locale, rate, loading: false });
    } catch {
      return settled({ ...DEFAULT, loading: false });
    }
  })();

  return inflight;
}

function format(amount: number, currency: string, locale: string): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    // Unknown locale or currency code — fall back to something unambiguous
    // rather than an unlabelled number.
    return `${currency} ${Math.round(amount).toLocaleString()}`;
  }
}

export function useCurrency() {
  const [state, setState] = useState<CurrencyState>(cached ?? DEFAULT);

  useEffect(() => {
    let cancelled = false;
    void detectCurrency().then((result) => {
      if (!cancelled) setState(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const isConverted = state.rate !== null && state.currency !== BASE_CURRENCY;

  /**
   * Approximate price in the visitor's currency, for browsing.
   * Falls back to the exact base price when conversion is unavailable.
   *
   * Deliberately has no loading branch. `isConverted` is false until a rate has
   * actually been fetched, so this returns the exact KES price on the very first
   * paint and switches to a converted figure only once one exists — which is
   * both the fast path and the safe path. The three ways detection can end
   * (visitor is in Kenya / lookup failed / no usable rate) all resolve to the
   * base price too, so the common case never repaints at all.
   */
  function formatPrice(baseAmount: number): string {
    if (!isConverted) return format(baseAmount, BASE_CURRENCY, state.locale);
    return format(baseAmount * (state.rate as number), state.currency, state.locale);
  }

  /**
   * The real amount that will be charged, always in the settlement currency.
   * Use this anywhere near a payment — never a converted figure.
   */
  function formatExact(baseAmount: number): string {
    return format(baseAmount, BASE_CURRENCY, state.locale);
  }

  return {
    formatPrice,
    formatExact,
    /** True when `formatPrice` returned a conversion, so the UI can mark it "≈". */
    isConverted,
    /**
     * Detection still in flight. Exposed for diagnostics only — do NOT gate a
     * price, a skeleton or an opacity on it. `formatPrice` is always ready.
     */
    loading: state.loading,
    currency: state.currency,
    baseCurrency: BASE_CURRENCY,
  };
}
