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
  Stethoscope,
} from "lucide-react";
import SignOutButton from "@/app/components/SignOutButton";

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

interface AdminSidebarProps {
  userName: string;
  userLabel: string;
  /**
   * Real counts, queried by the layout. Optional so the sidebar degrades to no
   * badges rather than to a wrong one if a caller omits it.
   */
  badgeCounts?: Partial<Record<BadgeKey, number>>;
}

export default function AdminSidebar({ userName, userLabel, badgeCounts }: AdminSidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    "User Management": true,
    "Operations": true,
    "Clinical": true,
    "Platform": true,
  });

  const isActive = (href: string, exact = false) => {
    if (exact || href === "/admin") return pathname === href;
    return pathname.startsWith(href);
  };

  const toggleGroup = (label: string) => {
    setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  return (
    <aside
      className={`hidden md:flex flex-col bg-stone-950 text-stone-100 transition-all duration-300 ${
        collapsed ? "w-[72px]" : "w-64"
      } flex-shrink-0`}
    >
      {/* Logo */}
      <div className="flex items-center justify-between p-4 border-b border-stone-800 h-16">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-teal-500 rounded-lg flex items-center justify-center flex-shrink-0">
              <Stethoscope className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="font-bold text-sm tracking-tight">Echo</span>
              <span className="text-teal-400 font-bold text-sm"> Admin</span>
            </div>
          </div>
        )}
        {collapsed && (
          <div className="w-8 h-8 bg-teal-500 rounded-lg flex items-center justify-center mx-auto">
            <Stethoscope className="w-4 h-4 text-white" />
          </div>
        )}
        {!collapsed && (
          <button
            onClick={() => setCollapsed(true)}
            className="p-1.5 rounded-lg hover:bg-stone-800 text-stone-400 hover:text-stone-200 transition-colors"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Expand toggle when collapsed */}
      {collapsed && (
        <button
          onClick={() => setCollapsed(false)}
          className="p-2 mt-2 mx-auto rounded-lg hover:bg-stone-800 text-stone-400 hover:text-stone-200 transition-colors"
        >
          <PanelLeft className="w-4 h-4" />
        </button>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {NAV_GROUPS.map((group, gi) => (
          <div key={gi} className={gi > 0 ? "pt-1" : ""}>
            {/* Group header */}
            {group.label && !collapsed && (
              <button
                onClick={() => toggleGroup(group.label!)}
                className="flex items-center justify-between w-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-stone-500 hover:text-stone-400 transition-colors"
              >
                {group.label}
                <ChevronDown
                  className={`w-3 h-3 transition-transform duration-200 ${
                    openGroups[group.label] ? "rotate-0" : "-rotate-90"
                  }`}
                />
              </button>
            )}
            {group.label && collapsed && (
              <div className="h-px bg-stone-800 mx-2 my-2" />
            )}

            {/* Items */}
            {(!group.label || !collapsed ? openGroups[group.label!] !== false : true) && (
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const active = isActive(item.href, item.href === "/admin");
                  /*
                   * Zero renders nothing. An empty queue is not news, and a grey
                   * "0" next to Risk & Crisis would be one more number to scan
                   * past — the badge should mean "there is work here".
                   */
                  const count = item.badgeKey
                    ? badgeCounts?.[item.badgeKey]
                    : undefined;
                  const showBadge = typeof count === "number" && count > 0;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      title={collapsed ? item.name : undefined}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group relative ${
                        active
                          ? "bg-teal-600/20 text-teal-300"
                          : "text-stone-400 hover:bg-stone-800 hover:text-stone-100"
                      } ${collapsed ? "justify-center" : ""}`}
                    >
                      {active && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-teal-400 rounded-r-full" />
                      )}
                      <item.icon
                        className={`w-4 h-4 flex-shrink-0 ${
                          active ? "text-teal-400" : "text-stone-500 group-hover:text-stone-300"
                        }`}
                      />
                      {!collapsed && (
                        <>
                          <span className="text-sm font-medium flex-1">{item.name}</span>
                          {showBadge && (
                            <span className="bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                              {count}
                            </span>
                          )}
                        </>
                      )}
                      {collapsed && showBadge && (
                        <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-rose-500 rounded-full" />
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className={`border-t border-stone-800 p-2 space-y-1 ${collapsed ? "px-2" : ""}`}>
        <Link
          href="/dashboard"
          title={collapsed ? "Client Dashboard" : undefined}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-stone-800 transition-colors text-stone-500 hover:text-stone-300 ${
            collapsed ? "justify-center" : ""
          }`}
        >
          <ArrowLeft className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span className="text-sm font-medium">Client Dashboard</span>}
        </Link>

        <SignOutButton
          variant="sidebar"
          className="text-stone-500 hover:bg-stone-800 hover:text-stone-300"
        />

        {!collapsed && (
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-stone-900 mt-1">
            <div className="w-8 h-8 rounded-full bg-teal-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
              {userName.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-stone-200 truncate">{userName}</p>
              <p className="text-[10px] text-stone-500 capitalize">{userLabel}</p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
