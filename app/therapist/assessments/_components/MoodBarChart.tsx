"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

export interface MoodBarDatum {
  readonly date: string;
  readonly score: number;
}

/**
 * Extracted so `recharts` (8.5 MB unpacked, plus its transitive d3 packages) can
 * be pulled in via `next/dynamic({ ssr: false })` instead of riding along in the
 * page bundle. The chart is behind a tab that is not always the one the user
 * opens, so a static import made every visit to Assessments pay for it.
 *
 * Same pattern as `app/dashboard/progress/_components/MoodChart.tsx`.
 */
export default function MoodBarChart({ data }: { readonly data: readonly MoodBarDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={[...data]} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f4" />
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#a8a29e" }} />
        <YAxis domain={[0, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fontSize: 11, fill: "#a8a29e" }} />
        <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e7e5e4", fontSize: 12 }} />
        <Bar dataKey="score" fill="#35858E" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
