"use client";

import { useCallback, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, MessageCircle, CalendarCheck, TrendingUp,
  Target, BookOpen, CreditCard, Settings, MoreHorizontal, LifeBuoy,
} from "lucide-react";
import NavList, { isActivePath, type NavItem, type NavSection } from "@/app/components/portal/NavList";
import { useModalBehavior } from "@/app/components/portal/MobileDrawer";
import SignOutButton from "@/app/components/SignOutButton";

const HOME: NavItem = { href: "/dashboard", label: "Home", icon: LayoutDashboard, exact: true };
const SESSIONS: NavItem = { href: "/dashboard/sessions", label: "Sessions", icon: CalendarCheck };
const MESSAGES: NavItem = { href: "/dashboard/messages", label: "Messages", icon: MessageCircle };
const PROGRESS: NavItem = { href: "/dashboard/progress", label: "Progress", icon: TrendingUp };
const GOALS: NavItem = { href: "/dashboard/goals", label: "Goals", icon: Target };
const RESOURCES: NavItem = { href: "/dashboard/resources", label: "Resources", icon: BookOpen };
const BILLING: NavItem = { href: "/dashboard/billing", label: "Billing", icon: CreditCard };
const SETTINGS: NavItem = { href: "/dashboard/settings", label: "Settings", icon: Settings };

const SECTIONS: readonly NavSection[] = [
  { items: [HOME, SESSIONS, MESSAGES, PROGRESS, GOALS, RESOURCES] },
  { label: "Account", items: [BILLING, SETTINGS] },
];

/*
 * The bottom bar has room for four destinations plus "More". It used to show
 * the first five nav items as bare icons, which left Resources, Billing and
 * Settings unreachable on a phone — and gave no label to any of them.
 */
const TAB_ITEMS = [HOME, SESSIONS, MESSAGES, PROGRESS] as const;
const MORE_ITEMS = [GOALS, RESOURCES, BILLING, SETTINGS] as const;

export function ClientSidebarNav() {
  return <NavList sections={SECTIONS} />;
}

/**
 * A quiet, always-present route to crisis support. On a mental-health
 * platform this belongs in the chrome, not only in the marketing footer.
 */
export function CrisisLink({ className = "" }: { readonly className?: string }) {
  return (
    <Link
      href="/crisis"
      className={`flex items-center gap-3 rounded-xl bg-stone-50 px-3 py-2.5 text-sm ring-1 ring-inset ring-stone-200 transition-colors hover:bg-rose-50 hover:ring-rose-200 ${className}`}
    >
      <LifeBuoy size={16} className="shrink-0 text-rose-600" />
      <span className="leading-tight">
        <span className="block font-semibold text-stone-800">Need urgent help?</span>
        <span className="block text-xs text-stone-500">Helplines &amp; emergency numbers</span>
      </span>
    </Link>
  );
}

export function ClientTabBar() {
  const pathname = usePathname() ?? "";
  const [moreOpen, setMoreOpen] = useState(false);
  const close = useCallback(() => setMoreOpen(false), []);
  const sheetRef = useRef<HTMLDivElement>(null);
  const sheetId = useId();

  useModalBehavior(moreOpen, close, sheetRef);

  const moreActive = MORE_ITEMS.some((item) => isActivePath(pathname, item.href, item.exact));
  const tabClass = (active: boolean) =>
    `flex w-full flex-col items-center gap-0.5 pt-2 pb-2.5 text-[11px] font-medium transition-colors ${
      active ? "text-brand-700" : "text-stone-500 hover:text-stone-800"
    }`;
  const pillClass = (active: boolean) =>
    `flex h-7 w-12 items-center justify-center rounded-full transition-colors ${active ? "bg-brand-100" : ""}`;

  return (
    <>
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-stone-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
      >
        <ul className="grid grid-cols-5">
          {TAB_ITEMS.map(({ href, label, icon: Icon, exact }) => {
            const active = isActivePath(pathname, href, exact);
            return (
              <li key={href}>
                <Link href={href} aria-current={active ? "page" : undefined} className={tabClass(active)}>
                  <span className={pillClass(active)}>
                    <Icon size={19} strokeWidth={active ? 2.2 : 1.8} />
                  </span>
                  {label}
                </Link>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-expanded={moreOpen}
              aria-controls={sheetId}
              className={tabClass(moreActive)}
            >
              <span className={pillClass(moreActive)}>
                <MoreHorizontal size={19} strokeWidth={moreActive ? 2.2 : 1.8} />
              </span>
              More
            </button>
          </li>
        </ul>
      </nav>

      {moreOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            aria-hidden="true"
            onClick={close}
            className="absolute inset-0 bg-stone-950/40 backdrop-blur-[2px] motion-safe:animate-fade-in"
          />
          <div
            id={sheetId}
            ref={sheetRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label="More"
            onClick={(e) => {
              if ((e.target as HTMLElement).closest("a")) close();
            }}
            className="absolute inset-x-0 bottom-0 rounded-t-3xl bg-white px-4 pt-3 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-xl outline-none motion-safe:animate-sheet-up"
          >
            <div aria-hidden="true" className="mx-auto mb-4 h-1 w-10 rounded-full bg-stone-200" />
            <div className="grid grid-cols-2 gap-2">
              {MORE_ITEMS.map(({ href, label, icon: Icon, exact }) => {
                const active = isActivePath(pathname, href, exact);
                return (
                  <Link
                    key={href}
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-3 rounded-2xl px-4 py-3.5 text-sm font-medium ring-1 ring-inset transition-colors ${
                      active
                        ? "bg-brand-50 text-brand-800 ring-brand-200"
                        : "text-stone-700 ring-stone-200 hover:bg-stone-50"
                    }`}
                  >
                    <Icon size={18} className={active ? "text-brand-600" : "text-stone-400"} />
                    {label}
                  </Link>
                );
              })}
            </div>
            <CrisisLink className="mt-3" />
            <div className="mt-2 border-t border-stone-100 pt-2">
              <SignOutButton variant="sidebar" className="text-stone-500 hover:bg-stone-100 hover:text-stone-900" />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
