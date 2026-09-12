"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Menu, X, LifeBuoy } from "lucide-react";
import BrandMark from "../portal/BrandMark";
import {
  PRIMARY_NAV,
  isNavGroup,
  type NavGroup,
  type NavLink as NavLinkType,
} from "@/lib/navigation";

/**
 * The one marketing header.
 *
 * It replaces thirteen inline `<header>` blocks — twelve of which contained a
 * single back-arrow to "/" and no navigation at all, so /faq and /guides had
 * no crawlable link between them and a visitor on /about could not reach
 * pricing without going home first.
 *
 * Every link below is a real `<Link>` rendered into the server HTML. The menus
 * toggle `hidden`, they never mount conditionally, so a crawler that executes
 * no JavaScript still sees the whole link graph — which is the entire reason
 * this is markup rather than a JS-built menu.
 */
export default function SiteHeader() {
  const pathname = usePathname();
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /*
   * Route change closes everything. Without it, tapping a link in the mobile
   * drawer navigates underneath a drawer that stays open on top of the new
   * page.
   *
   * Adjusted during render rather than in an effect. React re-runs this
   * component immediately with the new state before touching the DOM, so the
   * drawer never paints open on the new route — an effect would let one frame
   * of the old state through, and `react-hooks/set-state-in-effect` flags it
   * for exactly that reason.
   */
  const [renderedPath, setRenderedPath] = useState(pathname);
  if (renderedPath !== pathname) {
    setRenderedPath(pathname);
    setOpenMenu(null);
    setDrawerOpen(false);
  }

  useEffect(() => {
    if (!openMenu && !drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpenMenu(null);
        setDrawerOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [openMenu, drawerOpen]);

  useEffect(() => {
    if (!openMenu) return;
    const onDown = (e: MouseEvent) => {
      if (!headerRef.current?.contains(e.target as Node)) setOpenMenu(null);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [openMenu]);

  /* Lock the page behind the drawer. Restores whatever `overflow` was there
     rather than clearing it, so this composes with any other lock. */
  useEffect(() => {
    if (!drawerOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [drawerOpen]);

  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    []
  );

  /* Hover intent: a grace period on leave, so crossing the gap between the
     trigger and the panel does not snap the menu shut. */
  const hoverOpen = (label: string) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpenMenu(label);
  };
  const hoverClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpenMenu(null), 140);
  };

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-50 w-full border-b border-stone-200/70 bg-white/90 backdrop-blur-md"
    >
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-full focus:bg-brand focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Skip to content
      </a>

      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
        <BrandMark
          size="sm"
          className="shrink-0"
          name={
            <>
              <span className="text-brand-700">Echo</span>
              <span className="text-stone-800"> Health</span>
            </>
          }
        />

        <nav aria-label="Main" className="ml-4 hidden flex-1 items-center gap-0.5 lg:flex">
          {PRIMARY_NAV.map((item) =>
            isNavGroup(item) ? (
              <MegaMenu
                key={item.label}
                group={item}
                open={openMenu === item.label}
                onOpen={() => hoverOpen(item.label)}
                onClose={hoverClose}
                onToggle={() => setOpenMenu(openMenu === item.label ? null : item.label)}
                active={isActive(item.href)}
              />
            ) : (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive(item.href) ? "page" : undefined}
                className={`rounded-full px-3 py-2 text-sm font-medium transition-colors ${
                  isActive(item.href)
                    ? "bg-brand-50 text-brand-800"
                    : "text-stone-700 hover:bg-stone-100 hover:text-stone-900"
                }`}
              >
                {item.label}
              </Link>
            )
          )}
        </nav>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          {/* Crisis is one tap from every page. It is the one link on this site
              where "hidden on mobile" is not an acceptable trade — so it also
              sits at the top of the drawer below. */}
          <Link
            href="/crisis"
            className="hidden items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-100 hover:text-stone-900 md:inline-flex"
          >
            <LifeBuoy className="h-3.5 w-3.5" strokeWidth={2} />
            Crisis help
          </Link>
          <Link
            href="/signin"
            className="rounded-full px-3 py-2 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-100 hover:text-stone-900"
          >
            Sign in
          </Link>
          <Link
            href="/get-started"
            className="inline-flex min-h-11 items-center rounded-full bg-brand px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700"
          >
            Get started
          </Link>

          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
            aria-expanded={drawerOpen}
            aria-controls="mobile-nav"
            className="-mr-1 flex h-11 w-11 items-center justify-center rounded-full text-stone-700 transition-colors hover:bg-stone-100 lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </div>

      {drawerOpen && <MobileDrawer onClose={() => setDrawerOpen(false)} isActive={isActive} />}
    </header>
  );
}

/* ── Desktop mega-menu ───────────────────────────────────────────────────── */

function MegaMenu({
  group,
  open,
  onOpen,
  onClose,
  onToggle,
  active,
}: {
  readonly group: NavGroup;
  readonly open: boolean;
  readonly onOpen: () => void;
  readonly onClose: () => void;
  readonly onToggle: () => void;
  readonly active: boolean;
}) {
  const panelId = useId();
  const wide = Boolean(group.feature);
  const twoCol = group.items.length > 6;

  return (
    <div className="relative" onMouseEnter={onOpen} onMouseLeave={onClose}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        className={`flex items-center gap-1 rounded-full px-3 py-2 text-sm font-medium transition-colors ${
          active || open
            ? "bg-brand-50 text-brand-800"
            : "text-stone-700 hover:bg-stone-100 hover:text-stone-900"
        }`}
      >
        {group.label}
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}
          strokeWidth={2.2}
        />
      </button>

      {/*
        `hidden` rather than conditional mounting: the panel's links stay in the
        server-rendered HTML either way, so the condition pages get an internal
        link from every page on the site whether or not the crawler runs the
        JavaScript.
      */}
      <div
        id={panelId}
        hidden={!open}
        className={`absolute left-0 top-full z-50 pt-2 ${wide ? "w-[38rem]" : twoCol ? "w-[28rem]" : "w-72"}`}
      >
        <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-xl">
          <div className={wide ? "grid grid-cols-[1fr_15rem]" : ""}>
            <ul className={`p-2 ${twoCol ? "grid grid-cols-2 gap-x-1" : ""}`}>
              {group.items.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="block rounded-xl px-3 py-2.5 transition-colors hover:bg-stone-50"
                  >
                    <span className="block text-sm font-semibold text-stone-900">{link.label}</span>
                    {link.blurb && (
                      <span className="mt-0.5 block text-xs leading-5 text-stone-500">{link.blurb}</span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>

            {group.feature && (
              <div className="flex flex-col justify-between gap-4 bg-brand-gradient p-5 text-white">
                <div>
                  <p className="text-sm font-semibold">{group.feature.label}</p>
                  {group.feature.blurb && (
                    <p className="mt-1.5 text-xs leading-5 text-white/80">{group.feature.blurb}</p>
                  )}
                </div>
                <Link
                  href={group.feature.href}
                  className="inline-flex w-fit items-center rounded-full bg-white px-4 py-2 text-xs font-semibold text-brand-800 transition-colors hover:bg-brand-50"
                >
                  Start now
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Mobile drawer ───────────────────────────────────────────────────────── */

function MobileDrawer({
  onClose,
  isActive,
}: {
  readonly onClose: () => void;
  readonly isActive: (href: string) => boolean;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div id="mobile-nav" className="lg:hidden">
      <button
        type="button"
        aria-label="Close menu"
        onClick={onClose}
        className="fixed inset-0 z-40 animate-fade-in bg-stone-950/40"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Site navigation"
        className="fixed inset-y-0 right-0 z-50 flex w-[min(22rem,90vw)] flex-col bg-white shadow-2xl"
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-stone-200 px-4">
          <BrandMark size="sm" name={<span className="text-brand-700">Echo Health</span>} />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="flex h-11 w-11 items-center justify-center rounded-full text-stone-600 hover:bg-stone-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav aria-label="Mobile" className="flex-1 overflow-y-auto overscroll-contain p-3">
          <ul className="flex flex-col gap-0.5">
            <li>
              <Link
                href="/crisis"
                className="mb-2 flex min-h-11 items-center gap-2 rounded-xl bg-brand-50 px-3 py-3 text-sm font-semibold text-brand-800"
              >
                <LifeBuoy className="h-4 w-4" strokeWidth={2} />
                Crisis support
              </Link>
            </li>
            {PRIMARY_NAV.map((item) => {
              if (!isNavGroup(item)) {
                return (
                  <li key={item.href}>
                    <DrawerLink href={item.href} label={item.label} active={isActive(item.href)} />
                  </li>
                );
              }
              const open = expanded === item.label;
              return (
                <li key={item.label}>
                  <button
                    type="button"
                    onClick={() => setExpanded(open ? null : item.label)}
                    aria-expanded={open}
                    className="flex min-h-11 w-full items-center justify-between rounded-xl px-3 py-3 text-left text-[15px] font-semibold text-stone-900 transition-colors hover:bg-stone-50"
                  >
                    {item.label}
                    <ChevronDown
                      className={`h-4 w-4 text-stone-400 transition-transform ${open ? "rotate-180" : ""}`}
                    />
                  </button>
                  <ul hidden={!open} className="mb-1 ml-3 border-l border-stone-200 pl-3">
                    <li>
                      <DrawerLink href={item.href} label={`All ${item.label.toLowerCase()}`} sub />
                    </li>
                    {item.items.map((link: NavLinkType) => (
                      <li key={link.href}>
                        <DrawerLink href={link.href} label={link.label} sub active={isActive(link.href)} />
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="shrink-0 border-t border-stone-200 p-4">
          <Link
            href="/get-started"
            className="flex min-h-12 items-center justify-center rounded-full bg-brand text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700"
          >
            Get started
          </Link>
          <Link
            href="/signin"
            className="mt-2 flex min-h-12 items-center justify-center rounded-full text-sm font-semibold text-stone-700 ring-1 ring-inset ring-stone-300 transition-colors hover:bg-stone-50"
          >
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}

/** 44px minimum height — the drawer is the only navigation on a phone. */
function DrawerLink({
  href,
  label,
  sub = false,
  active = false,
}: {
  readonly href: string;
  readonly label: string;
  readonly sub?: boolean;
  readonly active?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex min-h-11 items-center rounded-xl px-3 transition-colors ${
        sub ? "text-sm" : "text-[15px] font-semibold"
      } ${active ? "bg-brand-50 text-brand-800" : "text-stone-700 hover:bg-stone-50"}`}
    >
      {label}
    </Link>
  );
}
