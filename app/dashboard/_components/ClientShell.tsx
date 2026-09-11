import Link from "next/link";
import type { SessionUser } from "@/lib/auth/session";
import SignOutButton from "@/app/components/SignOutButton";
import { UserProvider } from "@/app/components/UserProvider";
import NotificationBell from "@/app/components/NotificationBell";
import BrandMark from "@/app/components/portal/BrandMark";
import Avatar from "@/app/components/portal/Avatar";
import { ClientSidebarNav, ClientTabBar, CrisisLink } from "./ClientNav";

/**
 * The client portal's chrome. Kept apart from `layout.tsx` so the layout reads
 * as what it is — an auth gate — and the chrome can be rendered on its own.
 */
export default function ClientShell({
  user,
  children,
}: {
  readonly user: SessionUser;
  readonly children: React.ReactNode;
}) {
  return (
    <UserProvider user={user}>
      <div className="min-h-screen bg-app-surface">
        {/* Sidebar — desktop */}
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-stone-200/80 bg-white lg:flex">
          <div className="flex h-16 shrink-0 items-center px-5">
            <BrandMark href="/dashboard" />
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-4">
            <ClientSidebarNav />
          </div>

          <div className="space-y-2 border-t border-stone-100 p-3">
            <CrisisLink />
            <Link
              href="/dashboard/settings"
              className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-stone-100"
            >
              <Avatar name={user.name} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-stone-900">{user.name}</p>
                <p className="truncate text-xs text-stone-500">{user.email}</p>
              </div>
            </Link>
            <SignOutButton variant="sidebar" className="text-stone-500 hover:bg-stone-100 hover:text-stone-900" />
          </div>
        </aside>

        <div className="flex min-h-screen flex-col lg:pl-64">
          {/* Top bar. The bell used to be a static button with a permanently
              lit dot — it announced unread notifications that did not exist.
              It is now the same live NotificationBell the other portals use. */}
          <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-stone-200/70 bg-white/80 px-4 backdrop-blur-md sm:px-6">
            <BrandMark href="/dashboard" size="sm" className="lg:hidden" />
            <span className="hidden lg:block" />
            <div className="flex items-center gap-2">
              <NotificationBell userId={user.$id} />
              <Link href="/dashboard/settings" aria-label="Account settings" className="rounded-full lg:hidden">
                <Avatar name={user.name} />
              </Link>
            </div>
          </header>

          {/* Bottom padding clears the mobile tab bar. */}
          <main className="flex-1 pb-28 lg:pb-12">{children}</main>
        </div>

        <ClientTabBar />
      </div>
    </UserProvider>
  );
}
