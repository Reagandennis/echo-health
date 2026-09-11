"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  UserCheck,
  ShieldCheck,
  GitMerge,
  Calendar,
  CreditCard,
  AlertTriangle,
  BookOpen,
  BarChart3,
  Headphones,
  Lock,
  Settings,
  ChevronDown,
  ArrowLeft,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";
import SignOutButton from "@/app/components/SignOutButton";
import BrandMark from "@/app/components/portal/BrandMark";
import Avatar from "@/app/components/portal/Avatar";
import MobileDrawer from "@/app/components/portal/MobileDrawer";

/**
 * `badgeKey` names a count the LAYOUT supplies from a real query. An item
 * without one renders no badge at all.
 *
 * WHY THERE IS NO LONGER A `badge: number` LITERAL HERE. Three were hardcoded:
 * "Verification Queue: 3", "Risk & Crisis: 5" and "Support: 12". They rendered
 * on every admin page load regardless of the database, so the console
 * permanently claimed five unresolved clinical risk alerts against a table that
 * contained zero rows and had never been written to. A standing red badge next
 * to a crisis queue is worse than no badge: it is either ignored as decoration,
 * or it sends someone looking for five alerts that do not exist.
 *
 * `Verification Queue` and `Support` are now unbadged — their counts live behind
 * pages this component's owner does not maintain, and an unbadged link is honest
 * where an invented number is not. Wire them the same way as `riskAlerts` when
 * a real count is available.
 */
type BadgeKey = "riskAlerts";
type BadgeCounts = Partial<Record<BadgeKey, number>>;

type NavItem = {
  name: string;
  href: string;
  icon: React.ElementType;
  badgeKey?: BadgeKey;
};

type NavGroup = {
  label: string | null;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    label: null,
    items: [
      { name: "Overview", href: "/admin", icon: LayoutDashboard },
    ],
  },
  {
    label: "User Management",
    items: [
      { name: "Clients", href: "/admin/users", icon: Users },
      { name: "Therapists", href: "/admin/therapists", icon: UserCheck },
      { name: "Verification Queue", href: "/admin/therapists/verification-queue", icon: ShieldCheck },
    ],
  },
  {
    label: "Operations",
    items: [
      { name: "Matching", href: "/admin/matching", icon: GitMerge },
      { name: "Sessions", href: "/admin/sessions", icon: Calendar },
      { name: "Billing", href: "/admin/billing", icon: CreditCard },
    ],
  },
  {
    label: "Clinical",
    items: [
      { name: "Risk & Crisis", href: "/admin/risk", icon: AlertTriangle, badgeKey: "riskAlerts" },
      { name: "Content", href: "/admin/content", icon: BookOpen },
    ],
  },
  {
    label: "Platform",
    items: [
      { name: "Analytics", href: "/admin/analytics", icon: BarChart3 },
      { name: "Support", href: "/admin/support", icon: Headphones },
      { name: "Compliance", href: "/admin/compliance", icon: Lock },
      { name: "Config", href: "/admin/config", icon: Settings },
    ],
  },
];

const ALL_HREFS = NAV_GROUPS.flatMap((g) => g.items.map((i) => i.href));

/**
 * The single link to highlight: the LONGEST href that prefixes the path.
 * Plain prefix matching lit up both "Therapists" and "Verification Queue" on
 * the queue page, since one href is a prefix of the other.
 */
function activeHrefFor(pathname: string): string | undefined {
  return ALL_HREFS.filter((href) =>
    href === "/admin" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`),
  ).sort((a, b) => b.length - a.length)[0];
}

function AdminNav({ collapsed = false, badgeCounts }: { collapsed?: boolean; badgeCounts?: BadgeCounts }) {
  const pathname = usePathname() ?? "";
  const activeHref = activeHrefFor(pathname);
  const [closedGroups, setClosedGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = (label: string) => {
    setClosedGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  return (
    <nav aria-label="Admin" className="space-y-1">
      {NAV_GROUPS.map((group, gi) => {
        // Collapsed mode shows every item as an icon; group toggles need labels.
        const open = collapsed || !group.label || !closedGroups[group.label];
        return (
          <div key={group.label ?? gi} className={gi > 0 ? "pt-2" : ""}>
            {group.label && !collapsed && (
              <button
                type="button"
                onClick={() => toggleGroup(group.label!)}
                aria-expanded={open}
                className="flex w-full items-center justify-between px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-stone-500 transition-colors hover:text-stone-300"
              >
                {group.label}
                <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${open ? "" : "-rotate-90"}`} />
              </button>
            )}
            {group.label && collapsed && <div className="mx-3 my-2 h-px bg-white/[0.08]" />}

            {open && (
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const active = item.href === activeHref;
                  /*
                   * Zero renders nothing. An empty queue is not news, and a grey
                   * "0" next to Risk & Crisis would be one more number to scan
                   * past — the badge should mean "there is work here".
                   */
                  const count = item.badgeKey ? badgeCounts?.[item.badgeKey] : undefined;
                  const showBadge = typeof count === "number" && count > 0;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        title={collapsed ? item.name : undefined}
                        aria-current={active ? "page" : undefined}
                        className={`group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                          active
                            ? "bg-white/[0.07] text-white"
                            : "text-stone-400 hover:bg-white/[0.04] hover:text-stone-100"
                        } ${collapsed ? "justify-center" : ""}`}
                      >
                        {active && (
                          <span aria-hidden="true" className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-brand-400" />
                        )}
                        <item.icon
                          className={`h-4 w-4 shrink-0 ${
                            active ? "text-brand-300" : "text-stone-500 group-hover:text-stone-300"
                          }`}
                        />
                        {collapsed ? (
                          <span className="sr-only">{item.name}</span>
                        ) : (
                          <span className="flex-1">{item.name}</span>
                        )}
                        {!collapsed && showBadge && (
                          <span className="min-w-[18px] rounded-full bg-rose-500 px-1.5 py-0.5 text-center text-[10px] font-bold text-white">
                            {count}
                          </span>
                        )}
                        {collapsed && showBadge && (
                          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-rose-500" />
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </nav>
  );
}

function AdminFooterLinks({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <>
      <Link
        href="/dashboard"
        title={collapsed ? "Client dashboard" : undefined}
        className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-stone-400 transition-colors hover:bg-white/[0.04] hover:text-stone-100 ${
          collapsed ? "justify-center" : ""
        }`}
      >
        <ArrowLeft className="h-4 w-4 shrink-0" />
        {collapsed ? <span className="sr-only">Client dashboard</span> : "Client dashboard"}
      </Link>
      <SignOutButton
        variant="sidebar"
        iconOnly={collapsed}
        className="text-stone-400 hover:bg-white/[0.04] hover:text-stone-100"
      />
    </>
  );
}

interface AdminSidebarProps {
  userName: string;
  userLabel: string;
  /**
   * Real counts, queried by the layout. Optional so the sidebar degrades to no
   * badges rather than to a wrong one if a caller omits it.
   */
  badgeCounts?: BadgeCounts;
}

export default function AdminSidebar({ userName, userLabel, badgeCounts }: AdminSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`hidden flex-shrink-0 flex-col bg-stone-950 text-stone-100 transition-[width] duration-300 md:flex ${
        collapsed ? "w-[72px]" : "w-64"
      }`}
    >
      <div
        className={`flex h-16 items-center border-b border-white/[0.06] px-4 ${
          collapsed ? "justify-center" : "justify-between"
        }`}
      >
        <BrandMark href="/admin" tone="dark" name="Echo" tagline="Admin console" size="sm" iconOnly={collapsed} />
        {!collapsed && (
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            aria-label="Collapse sidebar"
            className="rounded-lg p-1.5 text-stone-500 transition-colors hover:bg-white/[0.06] hover:text-stone-200"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        )}
      </div>

      {collapsed && (
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          aria-label="Expand sidebar"
          className="mx-auto mt-2 rounded-lg p-2 text-stone-500 transition-colors hover:bg-white/[0.06] hover:text-stone-200"
        >
          <PanelLeft className="h-4 w-4" />
        </button>
      )}

      <div className="flex-1 overflow-y-auto px-2 py-3">
        <AdminNav collapsed={collapsed} badgeCounts={badgeCounts} />
      </div>

      <div className="space-y-1 border-t border-white/[0.06] p-2">
        <AdminFooterLinks collapsed={collapsed} />
        {!collapsed && (
          <div className="mt-1 flex items-center gap-3 rounded-lg bg-white/[0.04] px-3 py-2.5">
            <Avatar name={userName} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-stone-100">{userName}</p>
              <p className="text-[11px] capitalize text-stone-500">{userLabel}</p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

/**
 * The same navigation below `md`. The header's hamburger used to be a <button>
 * with no handler, so on a phone the admin console had no navigation at all.
 */
export function AdminMobileNav({ badgeCounts }: { badgeCounts?: BadgeCounts }) {
  return (
    <MobileDrawer
      tone="dark"
      label="Admin navigation"
      className="md:hidden"
      header={<BrandMark href="/admin" tone="dark" name="Echo" tagline="Admin console" size="sm" />}
    >
      <div className="px-2 py-3">
        <AdminNav badgeCounts={badgeCounts} />
      </div>
      <div className="space-y-1 border-t border-white/[0.06] p-2">
        <AdminFooterLinks />
      </div>
    </MobileDrawer>
  );
}
