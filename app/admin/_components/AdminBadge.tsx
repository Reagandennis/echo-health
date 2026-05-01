type BadgeVariant =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral"
  | "purple"
  | "teal";

const VARIANT_STYLES: Record<BadgeVariant, string> = {
  success: "bg-emerald-100 text-emerald-700 border-emerald-200",
  warning: "bg-amber-100 text-amber-700 border-amber-200",
  danger:  "bg-rose-100 text-rose-700 border-rose-200",
  info:    "bg-blue-100 text-blue-700 border-blue-200",
  neutral: "bg-stone-100 text-stone-600 border-stone-200",
  purple:  "bg-purple-100 text-purple-700 border-purple-200",
  teal:    "bg-teal-100 text-teal-700 border-teal-200",
};

interface AdminBadgeProps {
  label: string;
  variant?: BadgeVariant;
  dot?: boolean;
}

export default function AdminBadge({
  label,
  variant = "neutral",
  dot = false,
}: AdminBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${VARIANT_STYLES[variant]}`}
    >
      {dot && (
        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70 flex-shrink-0" />
      )}
      {label}
    </span>
  );
}

// Convenience helpers for common domain mappings
export function kycBadge(status: string) {
  const map: Record<string, { label: string; variant: BadgeVariant }> = {
    verified:   { label: "Verified",   variant: "success" },
    pending:    { label: "Pending",    variant: "warning" },
    rejected:   { label: "Rejected",  variant: "danger"  },
    incomplete: { label: "Incomplete", variant: "neutral" },
  };
  const cfg = map[status] ?? { label: status, variant: "neutral" as BadgeVariant };
  return <AdminBadge label={cfg.label} variant={cfg.variant} dot />;
}

export function sessionStatusBadge(status: string) {
  const map: Record<string, { label: string; variant: BadgeVariant }> = {
    confirmed:   { label: "Confirmed",   variant: "success" },
    pending:     { label: "Pending",     variant: "warning" },
    "in-progress":{ label: "In Progress", variant: "info"    },
    completed:   { label: "Completed",   variant: "teal"    },
    cancelled:   { label: "Cancelled",   variant: "danger"  },
  };
  const cfg = map[status] ?? { label: status, variant: "neutral" as BadgeVariant };
  return <AdminBadge label={cfg.label} variant={cfg.variant} dot />;
}

export function riskBadge(level: string) {
  const map: Record<string, { label: string; variant: BadgeVariant }> = {
    critical: { label: "Critical", variant: "danger"  },
    high:     { label: "High",     variant: "danger"  },
    medium:   { label: "Medium",   variant: "warning" },
    low:      { label: "Low",      variant: "success" },
    none:     { label: "None",     variant: "neutral" },
  };
  const cfg = map[level] ?? { label: level, variant: "neutral" as BadgeVariant };
  return <AdminBadge label={cfg.label} variant={cfg.variant} dot />;
}
