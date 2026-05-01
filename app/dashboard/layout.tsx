import { redirect } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard, MessageCircle, CalendarCheck, TrendingUp,
  Target, BookOpen, CreditCard, Settings, LogOut, AlertTriangle,
  Bell,
} from "lucide-react";
import { getLoggedInUser } from "@/lib/appwrite/server";
import SignOutButton from "@/app/components/SignOutButton";
import { UserProvider } from "@/app/components/UserProvider";

const NAV_ITEMS = [
  { href: "/dashboard",           label: "Home",     icon: LayoutDashboard },
  { href: "/dashboard/messages",  label: "Messages", icon: MessageCircle },
  { href: "/dashboard/sessions",  label: "Sessions", icon: CalendarCheck },
  { href: "/dashboard/progress",  label: "Progress", icon: TrendingUp },
  { href: "/dashboard/goals",     label: "Goals",    icon: Target },
  { href: "/dashboard/resources", label: "Resources",icon: BookOpen },
  { href: "/dashboard/billing",   label: "Billing",  icon: CreditCard },
  { href: "/dashboard/settings",  label: "Settings", icon: Settings },
] as const;

export default async function DashboardLayout({ children }: { readonly children: React.ReactNode }) {
  const user = await getLoggedInUser();

  if (!user) {
    redirect("/signin");
  }

  const firstName = user.name?.split(" ")[0] ?? "there";

  return (
    <UserProvider user={user}>
      <div className="min-h-screen bg-app-surface flex">
        {/* Sidebar — desktop */}
        <aside className="hidden lg:flex flex-col w-56 bg-white border-r border-brand/10 fixed top-0 left-0 bottom-0 z-40 shadow-sm">
          <div className="bg-brand-gradient px-5 py-6 flex flex-col gap-1">
            <span className="text-lg font-bold text-white tracking-tight">echo health</span>
            <p className="text-xs text-white/60 truncate">{user.name}</p>
          </div>

          <nav className="flex-1 overflow-y-auto py-5 px-3 space-y-0.5">
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
              return (
                <Link key={href} href={href}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-brand/60 hover:text-brand hover:bg-cream transition-colors">
                  <Icon size={16} />
                  {label}
                </Link>
              );
            })}
          </nav>

          <div className="px-3 py-5 border-t border-brand/8 space-y-1">
            <Link href="/dashboard/settings"
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-brand/50 hover:text-brand hover:bg-cream transition-colors">
              <Settings size={16} />
              Settings
            </Link>
            <SignOutButton 
              variant="sidebar"
              className="text-brand/50 hover:text-brand hover:bg-cream"
            />
          </div>
        </aside>

        {/* Main content area */}
        <div className="flex-1 lg:ml-56 flex flex-col min-h-screen">
          {/* Top bar — mobile + shared */}
          <header className="bg-white border-b border-brand/10 px-4 py-3.5 flex items-center justify-between lg:justify-end sticky top-0 z-30">
            <span className="text-base font-bold text-brand lg:hidden">echo health</span>
            <div className="flex items-center gap-2">
              <span className="hidden lg:block text-sm text-brand/50 mr-2">Hi, {firstName} 👋</span>
              <button className="relative w-8 h-8 rounded-xl bg-cream flex items-center justify-center hover:bg-brand/10 transition-colors" aria-label="Notifications">
                <Bell size={15} className="text-brand/60" />
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-brand rounded-full" />
              </button>
            </div>
          </header>

          {/* Page content */}
          <main className="flex-1 pb-24 lg:pb-0">
            {children}
          </main>
        </div>

        {/* Bottom tab bar — mobile */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-brand/10 z-40 flex">
          {NAV_ITEMS.slice(0, 5).map(({ href, icon: Icon }) => {
            return (
              <Link key={href} href={href}
                className="flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 text-[10px] font-medium text-brand/35">
                <Icon size={18} />
              </Link>
            );
          })}
        </nav>
      </div>
    </UserProvider>
  );
}
