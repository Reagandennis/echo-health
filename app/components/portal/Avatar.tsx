export function initialsOf(name?: string | null): string {
  if (!name) return "?";
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return initials || "?";
}

const SIZES = {
  sm: "h-8 w-8 text-xs",
  md: "h-9 w-9 text-xs",
  lg: "h-11 w-11 text-sm",
} as const;

/** Initials avatar. Decorative — always render the person's name beside it. */
export default function Avatar({
  name,
  size = "md",
  className = "",
}: {
  readonly name?: string | null;
  readonly size?: keyof typeof SIZES;
  readonly className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-brand-100 font-semibold text-brand-800 ring-1 ring-inset ring-brand-200 ${SIZES[size]} ${className}`}
    >
      {initialsOf(name)}
    </span>
  );
}
