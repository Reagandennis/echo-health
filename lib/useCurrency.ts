"use client";

import { useEffect, useState } from "react";

interface CurrencyState {
  currency: string;
  locale: string;
  rate: number;
  loading: boolean;
}

const DEFAULT: CurrencyState = {
  currency: "USD",
  locale: "en-US",
  rate: 1,
  loading: true,
};

// Module-level cache — fetches happen only once per page load
let cached: CurrencyState | null = null;
let inflightPromise: Promise<CurrencyState> | null = null;

async function detectCurrency(): Promise<CurrencyState> {
  if (cached !== null) return cached;
  if (inflightPromise !== null) return inflightPromise;

  inflightPromise = (async (): Promise<CurrencyState> => {
    try {
      const geoRes = await fetch("https://ipapi.co/json/", {
        cache: "force-cache",
      });
      const geo = (await geoRes.json()) as {
        currency?: string;
        languages?: string;
      };
      const currency = geo.currency ?? "USD";
      const locale =
        typeof navigator === "undefined"
          ? (geo.languages?.split(",")[0] ?? "en-US")
          : (geo.languages?.split(",")[0] ?? navigator.language ?? "en-US");

      const rateRes = await fetch("https://open.er-api.com/v6/latest/USD", {
        cache: "force-cache",
      });
      const rateData = (await rateRes.json()) as {
        rates?: Record<string, number>;
      };
      const rate = rateData.rates?.[currency] ?? 1;

      cached = { currency, locale, rate, loading: false };
      return cached;
    } catch {
      cached = { ...DEFAULT, loading: false };
      return cached;
    }
  })();

  return inflightPromise;
}

export function useCurrency() {
  const [state, setState] = useState<CurrencyState>(cached ?? DEFAULT);

  useEffect(() => {
    void detectCurrency().then((result) => {
      setState(result);
    });
  }, []);

  function formatPrice(usdAmount: number): string {
    if (state.loading) return "…";
    const converted = usdAmount * state.rate;
    try {
      return new Intl.NumberFormat(state.locale, {
        style: "currency",
        currency: state.currency,
        maximumFractionDigits: 0,
      }).format(converted);
    } catch {
      return `$${Math.round(usdAmount).toLocaleString()}`;
    }
  }

  return { formatPrice, loading: state.loading, currency: state.currency };
}
