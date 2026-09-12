"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useUser } from "@/app/components/UserProvider";
import { listMyEarningsAction } from "@/app/actions/database";
import { PLAN_CURRENCY, PLAN_LABELS } from "@/lib/constants";
import { Wallet, TrendingUp, CheckCircle2, AlertCircle } from "lucide-react";

// PERF: defer the recharts chunk (8.5 MB + d3 transitives) so it isn't pulled
// into this page's initial bundle. `ssr: false` because recharts measures the
// DOM to size itself and has nothing to render on the server.
const EarningsChart = dynamic(() => import("./_components/EarningsChart"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[260px] items-center justify-center">
      <div className="w-5 h-5 rounded-full border-2 border-brand/30 border-t-brand animate-spin" />
    </div>
  ),
});

/**
 * Earnings, read from the `payout_ledger` accrual ledger.
 *
 * This page used to derive earnings in the browser: it fetched the therapist's
 * sessions, took 40% of `therapy_sessions.amount` on every render, and stored
 * nothing. Two consequences it is worth being explicit about, because both were
 * visible to real clinicians:
 *
 *  • `amount` is nullable and nothing populated it, so the page fell back to a
 *    `FALLBACK_SESSION_PRICE = 0` constant and displayed KES 0 for every session
 *    ever delivered. A therapist's earnings screen read zero, permanently.
 *  • Even correct, it was a display calculation. Nothing recorded what was owed,
 *    and nothing recorded what had been PAID — so "total earned" could not
 *    distinguish money in the bank from money still outstanding.
 *
 * Both figures are now stored facts. Amounts arrive in MINOR units and are
 * divided by 100 exactly once, in `money()`.
 */

interface Entry {
  $id: string;
  sessionId: string;
  sessionScheduledAt: string | Date;
  plan: string | null;
  grossMinor: number;
  chargedMinor: number;
  basis: "list" | "charged" | "unfunded";
  amountMinor: number;
  currency: string;
  status: "accrued" | "paid" | "reversed";
  payoutBatch: string | null;
  paidAt: string | Date | null;
  accruedAt: string | Date;
}

interface Ledger {
  currency: string;
  accruedMinor: number;
  paidMinor: number;
  reversedMinor: number;
  entries: Entry[];
}

/**
 * Formats MINOR units as currency. The single conversion boundary — nothing
 * upstream of this divides by 100, so there is one place for a currency bug to
 * live rather than one per component.
 */
function money(minor: number, currency: string = PLAN_CURRENCY): string {
  const major = minor / 100;
  try {
    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(major);
  } catch {
    return `${currency} ${major.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  }
}

function groupByMonth(entries: Entry[]) {
  const map = new Map<string, number>();
  for (const e of entries) {
    if (e.status === "reversed") continue;
    const key = new Date(e.sessionScheduledAt).toLocaleDateString("en-US", {
      month: "short",
      year: "2-digit",
    });
    map.set(key, (map.get(key) ?? 0) + e.amountMinor);
  }
  // Charted in MAJOR units: a y-axis in cents reads as meaningless six-figure
  // numbers for what is really a few thousand shillings.
  return [...map].map(([month, minor]) => ({ month, earnings: minor / 100 }));
}

const STATUS_STYLES: Record<Entry["status"], string> = {
  accrued: "bg-amber-50 text-amber-700",
  paid: "bg-green-50 text-green-700",
  reversed: "bg-stone-100 text-stone-500",
};

const STATUS_LABELS: Record<Entry["status"], string> = {
  accrued: "Awaiting payout",
  paid: "Paid",
  reversed: "Reversed",
};

export default function EarningsPage() {
  const user = useUser();
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        setLedger((await listMyEarningsAction()) as unknown as Ledger);
      } catch {
        // Surfaced rather than swallowed: the previous version caught and
        // ignored, so a failed load was indistinguishable from having earned
        // nothing — the worst possible ambiguity on a payments screen.
        setError("Could not load your earnings. Please refresh, or contact support if this persists.");
      }
      setLoading(false);
    })();
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 rounded-full border-2 border-brand border-t-transparent animate-spin" />
      </div>
    );
  }

  if (error || !ledger) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <p>{error ?? "Could not load your earnings."}</p>
        </div>
      </div>
    );
  }

  const { currency, accruedMinor, paidMinor, entries } = ledger;
  const chartData = groupByMonth(entries);
  const payable = entries.filter((e) => e.status !== "reversed");

  const cards = [
    {
      label: "Awaiting payout",
      value: money(accruedMinor, currency),
      icon: Wallet,
      color: "text-amber-600 bg-amber-50",
    },
    {
      label: "Paid out",
      value: money(paidMinor, currency),
      icon: CheckCircle2,
      color: "text-green-600 bg-green-50",
    },
    {
      label: "Sessions earned on",
      value: payable.length.toString(),
      icon: TrendingUp,
      color: "text-brand bg-brand/10",
    },
  ];

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">Earnings</h1>
        <p className="mt-1 text-sm text-stone-500">
          Recorded when a session completes. Amounts are fixed at that point and do not
          change afterwards.
        </p>
      </div>

      {/* Three summary cards, each an icon beside a currency figure. At
          `grid-cols-3` on a 360px phone that is ~110px per cell, which wraps
          "KES 12,500" onto two lines behind the icon. Stack below `sm`. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {cards.map((c) => (
          <div
            key={c.label}
            className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5 flex items-center gap-4"
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${c.color}`}>
              <c.icon size={18} />
            </div>
            <div>
              <p className="text-xl font-bold text-stone-900">{c.value}</p>
              <p className="text-xs text-stone-400">{c.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6">
        <h2 className="font-semibold text-stone-800 mb-4">Monthly Earnings</h2>
        {chartData.length === 0 ? (
          <div className="py-12 text-center text-sm text-stone-400">
            No completed sessions yet
          </div>
        ) : (
          <EarningsChart
            data={chartData}
            formatEarnings={(major) => money(Math.round(major * 100), currency)}
          />
        )}
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-stone-100">
          <h2 className="font-semibold text-stone-800">Session Earnings</h2>
        </div>
        {entries.length === 0 ? (
          <div className="py-10 text-center text-sm text-stone-400">
            No earnings recorded yet
          </div>
        ) : (
          <div className="divide-y divide-stone-100">
            {entries.slice(0, 50).map((e) => (
              <div key={e.$id} className="flex items-center justify-between gap-4 px-6 py-3 text-sm">
                <div className="min-w-0">
                  <p className="text-stone-700">
                    {new Date(e.sessionScheduledAt).toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                  <p className="text-xs text-stone-400 truncate">
                    {e.plan ? (PLAN_LABELS[e.plan] ?? e.plan) : "No plan recorded"}
                    {/* Only worth surfacing when it explains a surprising number:
                        an unfunded session accrues zero, which otherwise looks
                        like a bug to the person it is not paying. */}
                    {e.basis === "unfunded" && " · no payment recorded for this session"}
                    {e.status === "paid" && e.payoutBatch && ` · batch ${e.payoutBatch}`}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[e.status]}`}
                  >
                    {STATUS_LABELS[e.status]}
                  </span>
                  <span
                    className={`font-semibold tabular-nums ${
                      e.status === "reversed" ? "text-stone-400 line-through" : "text-green-700"
                    }`}
                  >
                    {money(e.amountMinor, e.currency)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
