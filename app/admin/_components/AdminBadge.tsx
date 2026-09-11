type BadgeVariant =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral"
  | "purple"
  | "teal";

const VARIANT_STYLES: Record<BadgeVariant, string> = {
  success: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  warning: "bg-amber-50 text-amber-800 ring-amber-600/25",
  danger:  "bg-rose-50 text-rose-700 ring-rose-600/20",
  info:    "bg-sky-50 text-sky-700 ring-sky-600/20",
  neutral: "bg-stone-100 text-stone-600 ring-stone-500/20",
  purple:  "bg-violet-50 text-violet-700 ring-violet-600/20",
  teal:    "bg-brand-50 text-brand-700 ring-brand-600/20",
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
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ring-1 ring-inset ${VARIANT_STYLES[variant]}`}
    >
      {dot && (
        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80 flex-shrink-0" />
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
