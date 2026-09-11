"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

export interface MoodChartDatum {
  date: string;
  score: number;
  emoji: string;
}

/**
 * Extracted so that `recharts` (8.5 MB unpacked + transitive d3) can be loaded
 * via `next/dynamic({ ssr: false })` instead of being pulled into the dashboard
 * page bundle. Reduces dev-server compile work and trims the initial chunk.
 */
export default function MoodChart({ data }: { data: MoodChartDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <AreaChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
        <defs>
          <linearGradient id="moodGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--brand-600)" stopOpacity={0.2} />
            <stop offset="95%" stopColor="var(--brand-600)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--ink-200)" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 10, fill: "var(--ink-500)" }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          domain={[1, 10]}
          ticks={[1, 5, 10]}
          tick={{ fontSize: 10, fill: "var(--ink-500)" }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          contentStyle={{
            background: "#fff",
            border: "1px solid var(--ink-200)",
            borderRadius: 12,
            fontSize: 12,
          }}
          formatter={(v) => [v ?? 0, "Mood score"]}
        />
        <Area
          type="monotone"
          dataKey="score"
          stroke="var(--brand-600)"
          strokeWidth={2}
          fill="url(#moodGrad)"
          dot={{ r: 3, fill: "var(--brand-600)" }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
