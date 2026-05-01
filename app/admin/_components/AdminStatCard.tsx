import { ReactNode } from "react";
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

export default function AdminStatCard({
  label,
  value,
  change,
  trend = "neutral",
  icon: Icon,
  iconColor = "bg-teal-100 text-teal-700",
  subtext,
}: AdminStatCardProps) {
  const trendColor =
    trend === "up"
      ? "text-emerald-600"
      : trend === "down"
      ? "text-rose-600"
      : "text-stone-500";

  const TrendIcon =
    trend === "up" ? ArrowUpRight : trend === "down" ? ArrowDownRight : Minus;

  return (
    <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <div className={`p-3 rounded-xl ${iconColor}`}>
          <Icon className="w-5 h-5" />
        </div>
        {change && (
          <div className={`flex items-center gap-0.5 text-xs font-semibold ${trendColor}`}>
            <TrendIcon className="w-3.5 h-3.5" />
            {change}
          </div>
        )}
      </div>
      <p className="text-stone-500 text-xs font-medium uppercase tracking-wider mb-1">
        {label}
      </p>
      <p className="text-2xl font-bold text-stone-900">{value}</p>
      {subtext && <p className="text-xs text-stone-400 mt-1">{subtext}</p>}
    </div>
  );
}
