"use client";

import { useCurrency } from "@/lib/useCurrency";

interface PriceTagProps {
  readonly usd: number;
  readonly period?: string;
  readonly priceClass?: string;
  readonly periodClass?: string;
}

export default function PriceTag({
  usd,
  period = "/ week",
  priceClass = "text-brand",
  periodClass = "text-brand/50",
}: PriceTagProps) {
  const { formatPrice, loading } = useCurrency();

  return (
    <div className="flex items-end gap-1">
      <span
        className={`text-4xl font-bold transition-opacity duration-300 ${priceClass} ${
          loading ? "opacity-40" : "opacity-100"
        }`}
      >
        {formatPrice(usd)}
      </span>
      <span className={`text-sm mb-1 ${periodClass}`}>{period}</span>
    </div>
  );
}
