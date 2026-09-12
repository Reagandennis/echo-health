"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

export interface EarningsDatum {
  readonly month: string;
  /** MAJOR units. A y-axis in cents reads as meaningless six-figure numbers. */
  readonly earnings: number;
}

/**
 * Extracted so `recharts` (8.5 MB unpacked, plus its transitive d3 packages) can
 * be pulled in via `next/dynamic({ ssr: false })` instead of riding along in the
 * page bundle. Earnings is a page therapists open to read three summary cards
 * and a list; the chart should not be what decides how fast those appear.
 *
 * Same pattern as `app/dashboard/progress/_components/MoodChart.tsx`.
 *
 * `formatEarnings` is passed in rather than imported so that `money()` — the
 * single minor-to-major conversion boundary — stays in the page. Importing it
 * from here would drag this module, and therefore recharts, straight back into
 * the page bundle and undo the split.
 */
export default function EarningsChart({
  data,
  formatEarnings,
}: {
  readonly data: readonly EarningsDatum[];
  readonly formatEarnings: (major: number) => string;
}) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={[...data]} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <defs>
          <linearGradient id="earningsGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#35858E" stopOpacity={0.15} />
            <stop offset="95%" stopColor="#35858E" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f4" />
        <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#a8a29e" }} />
        <YAxis tick={{ fontSize: 11, fill: "#a8a29e" }} />
        <Tooltip
          contentStyle={{ borderRadius: 12, border: "1px solid #e7e5e4", fontSize: 12 }}
          // Was a hardcoded "$", on a platform that settles in KES.
          formatter={(v) => [formatEarnings(v as number), "Earnings"]}
        />
        <Area
          type="monotone"
          dataKey="earnings"
          stroke="#35858E"
          strokeWidth={2}
          fill="url(#earningsGrad)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
