import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";

interface AdminStatCardProps {
  label: string;
  value: string;
  change?: string;
  trend?: "up" | "down" | "neutral";
  icon: React.ElementType;
  iconColor?: string;
  subtext?: string;
}

const TREND = {
  up: { Icon: ArrowUpRight, className: "bg-emerald-50 text-emerald-700" },
  down: { Icon: ArrowDownRight, className: "bg-rose-50 text-rose-700" },
  neutral: { Icon: Minus, className: "bg-stone-100 text-stone-600" },
} as const;

export default function AdminStatCard({
  label,
  value,
  change,
  trend = "neutral",
  icon: Icon,
  iconColor = "bg-brand-50 text-brand-700",
  subtext,
}: AdminStatCardProps) {
  const { Icon: TrendIcon, className: trendClass } = TREND[trend];

  return (
    <div className="flex flex-col rounded-2xl border border-stone-200/80 bg-white p-5 shadow-xs transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-stone-500">{label}</p>
        <div className={`rounded-lg p-2 ${iconColor}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-stone-900 tabular-nums">{value}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {change && (
          <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium ${trendClass}`}>
            <TrendIcon className="h-3.5 w-3.5" />
            {change}
          </span>
        )}
        {subtext && <span className="text-xs text-stone-500">{subtext}</span>}
      </div>
    </div>
  );
}
