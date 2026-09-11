"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  readonly href: string;
  readonly label: string;
  readonly icon: LucideIcon;
  /** Match the path exactly. Needed for a section's home link, which is a
   *  prefix of every other link in the section and would otherwise always
   *  read as active. */
  readonly exact?: boolean;
}

export interface NavSection {
  readonly label?: string;
  readonly items: readonly NavItem[];
}

export function isActivePath(pathname: string, href: string, exact = false): boolean {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Sidebar navigation for the client and therapist portals.
 *
 * Both portals rendered their nav from a Server Component layout, which cannot
 * read the current path — so no link was ever marked active and there was no
 * way to tell which page you were on. This is the client half that can.
 *
 * Nav configs live in client modules (see `ClientNav`, `TherapistNav`) because
 * lucide icons are functions, and functions cannot cross from a Server
 * Component into a Client Component as props.
 */
export default function NavList({
  sections,
  onNavigate,
}: {
  readonly sections: readonly NavSection[];
  readonly onNavigate?: () => void;
}) {
  const pathname = usePathname() ?? "";

  return (
    <nav aria-label="Main" className="space-y-6">
      {sections.map((section, i) => (
        <div key={section.label ?? i}>
          {section.label && (
            <p className="px-3 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-stone-500">
              {section.label}
            </p>
          )}
          <ul className="space-y-0.5">
            {section.items.map(({ href, label, icon: Icon, exact }) => {
              const active = isActivePath(pathname, href, exact);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={`group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      active
                        ? "bg-brand-50 text-brand-800"
                        : "text-stone-600 hover:bg-stone-100 hover:text-stone-900"
                    }`}
                  >
                    {active && (
                      <span aria-hidden="true" className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-brand-500" />
                    )}
                    <Icon
                      size={17}
                      strokeWidth={active ? 2.2 : 1.8}
                      className={active ? "text-brand-600" : "text-stone-400 group-hover:text-stone-600"}
                    />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
