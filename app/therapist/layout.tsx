import { redirect } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard, Users, CalendarCheck, FileText, MessageCircle,
  ClipboardList, BookOpen, Clock, DollarSign, Shield, Settings,
  LogOut, Bell, ChevronRight, Stethoscope,
} from "lucide-react";
import { getLoggedInUser } from "@/lib/appwrite/server";
import SignOutButton from "@/app/components/SignOutButton";
import { UserProvider } from "@/app/components/UserProvider";
import NotificationBell from "@/app/components/NotificationBell";

const NAV_SECTIONS = [
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
      { href: "/therapist/assessments", label: "Assessments", icon: ClipboardList },
      { href: "/therapist/resources", label: "Resources", icon: BookOpen },
    ],
  },
  {
    label: "Practice",
    items: [
      { href: "/therapist/availability", label: "Availability", icon: Clock },
      { href: "/therapist/earnings", label: "Earnings", icon: DollarSign },
      { href: "/therapist/compliance", label: "Compliance", icon: Shield },
      { href: "/therapist/settings", label: "Settings", icon: Settings },
    ],
  },
];

export default async function TherapistLayout({ children }: { readonly children: React.ReactNode }) {
  const user = await getLoggedInUser();

  if (!user) {
    redirect("/signin");
  }

  const labels: string[] = user.labels ?? [];
  if (!labels.includes("therapist") && !labels.includes("admin")) {
    redirect("/dashboard");
  }

  const initials = user.name?.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase() ?? "T";
  const firstName = user.name?.split(" ")[0] ?? "Therapist";

  return (
    <UserProvider user={user}>
      <div className="min-h-screen bg-app-surface flex">
        {/* Sidebar desktop */}
        <aside className="hidden lg:flex flex-col w-60 bg-white border-r border-stone-200 fixed top-0 left-0 bottom-0 z-40 shadow-sm">
          {/* Brand */}
          <div className="bg-brand-gradient px-5 py-6 flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <Stethoscope size={14} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-white leading-tight">echo health</p>
              <p className="text-xs text-white/60">Therapist Portal</p>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-5">
            {NAV_SECTIONS.map((section) => (
              <div key={section.label}>
                <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-stone-400">
                  {section.label}
                </p>
                <div className="space-y-0.5">
                  {section.items.map(({ href, label, icon: Icon }) => (
                    <Link key={href} href={href}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-stone-500 hover:text-stone-900 hover:bg-stone-100 transition-colors">
                      <Icon size={15} />
                      {label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </nav>

          {/* User footer */}
          <div className="px-3 py-4 border-t border-stone-100">
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-stone-50 mb-1">
              <div className="w-8 h-8 rounded-full bg-brand text-white text-xs font-bold flex items-center justify-center shrink-0">
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-stone-900 truncate">{user.name}</p>
                <p className="text-xs text-stone-400 truncate">{user.email}</p>
              </div>
              <ChevronRight size={13} className="text-stone-300 shrink-0" />
            </div>
            <SignOutButton 
              variant="sidebar"
              className="text-stone-400 hover:bg-stone-100"
            />
          </div>
        </aside>

        {/* Main */}
        <div className="flex-1 lg:ml-60 flex flex-col min-h-screen">
          <header className="bg-white border-b border-stone-200 px-4 py-3 flex items-center justify-between sticky top-0 z-30 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="lg:hidden w-8 h-8 rounded-xl bg-brand flex items-center justify-center">
                <Stethoscope size={14} className="text-white" />
              </div>
              <span className="text-sm font-bold text-stone-900 lg:hidden">echo health</span>
              <span className="hidden lg:block text-sm text-stone-500">Good to see you, <span className="font-semibold text-stone-900">{firstName}</span></span>
            </div>
            <div className="flex items-center gap-2">
              <NotificationBell userId={user.$id} />
              <div className="w-9 h-9 rounded-full bg-brand text-white text-xs font-bold flex items-center justify-center">
                {initials}
              </div>
            </div>
          </header>

          <main className="flex-1 pb-24 lg:pb-0">
            {children}
          </main>
        </div>
      </div>
    </UserProvider>
  );
}
