import Image from "next/image";
import Link from "next/link";

interface BrandMarkProps {
  readonly href?: string;
  /** The wordmark. A node, so the marketing header can keep its two-tone name. */
  readonly name?: React.ReactNode;
  readonly tagline?: string;
  /** `light` sits on light surfaces (dark text); `dark` on the admin sidebar. */
  readonly tone?: "light" | "dark";
  readonly size?: "sm" | "md";
  /** Just the butterfly — the collapsed admin sidebar. */
  readonly iconOnly?: boolean;
  readonly className?: string;
}

/**
 * The butterfly plus a wordmark — one lockup for every surface.
 *
 * Each portal used to draw its own: a stethoscope icon for therapists and
 * admins, bare text for clients, and a two-colour "echohealth" on the auth
 * pages whose second half was cream on white and so invisible on mobile.
 * None of them used the logo.
 */
export default function BrandMark({
  href = "/",
  name = "echo health",
  tagline,
  tone = "light",
  size = "md",
  iconOnly = false,
  className = "",
}: BrandMarkProps) {
  const dark = tone === "dark";
  const px = size === "sm" ? 28 : 34;

  if (iconOnly) {
    return (
      <Link href={href} aria-label="Home" className={`inline-flex rounded-lg ${className}`}>
        <Image src="/echo-logo-mark.png" alt="" width={px} height={px} loading="eager" className="shrink-0" />
      </Link>
    );
  }

  return (
    <Link href={href} className={`inline-flex items-center gap-2.5 rounded-lg ${className}`}>
      {/* Decorative: the wordmark beside it is the link's accessible name. */}
      <Image src="/echo-logo-mark.png" alt="" width={px} height={px} loading="eager" className="shrink-0" />
      <span className="flex flex-col leading-none">
        <span
          className={`font-semibold tracking-tight ${size === "sm" ? "text-[15px]" : "text-base"} ${
            dark ? "text-white" : "text-stone-900"
          }`}
        >
          {name}
        </span>
        {tagline && (
          <span className={`mt-1 text-[11px] font-medium ${dark ? "text-stone-400" : "text-stone-500"}`}>
            {tagline}
          </span>
        )}
      </span>
    </Link>
  );
}
