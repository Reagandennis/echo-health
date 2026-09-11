"use client";

import {
  LayoutDashboard, Users, CalendarCheck, FileText, MessageCircle,
  ClipboardList, ClipboardCheck, BookOpen, Clock, Wallet, ShieldCheck, Settings,
} from "lucide-react";
import NavList, { type NavSection } from "@/app/components/portal/NavList";
import MobileDrawer from "@/app/components/portal/MobileDrawer";
import BrandMark from "@/app/components/portal/BrandMark";
import SignOutButton from "@/app/components/SignOutButton";

const SECTIONS: readonly NavSection[] = [
  {
    label: "Overview",
    items: [
      { href: "/therapist", label: "Dashboard", icon: LayoutDashboard, exact: true },
      { href: "/therapist/clients", label: "Clients", icon: Users },
      { href: "/therapist/sessions", label: "Sessions", icon: CalendarCheck },
      { href: "/therapist/messages", label: "Messages", icon: MessageCircle },
    ],
  },
  {
    label: "Clinical",
    items: [
      { href: "/therapist/notes", label: "Notes", icon: FileText },
      { href: "/therapist/treatment", label: "Treatment & Goals", icon: ClipboardList },
      { href: "/therapist/assessments", label: "Assessments", icon: ClipboardCheck },
      { href: "/therapist/resources", label: "Resources", icon: BookOpen },
    ],
  },
  {
    label: "Practice",
    items: [
      { href: "/therapist/availability", label: "Availability", icon: Clock },
      { href: "/therapist/earnings", label: "Earnings", icon: Wallet },
      { href: "/therapist/compliance", label: "Compliance", icon: ShieldCheck },
      { href: "/therapist/settings", label: "Settings", icon: Settings },
    ],
  },
];

export function TherapistSidebarNav() {
  return <NavList sections={SECTIONS} />;
}

export function TherapistMobileNav() {
  return (
    <MobileDrawer
      className="lg:hidden"
      label="Navigation"
      header={<BrandMark href="/therapist" tagline="Therapist portal" size="sm" />}
    >
      <div className="px-3 py-4">
        <NavList sections={SECTIONS} />
      </div>
      <div className="border-t border-stone-100 p-3">
        <SignOutButton variant="sidebar" className="text-stone-500 hover:bg-stone-100 hover:text-stone-900" />
      </div>
    </MobileDrawer>
  );
}
