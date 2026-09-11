import Link from "next/link";
import type { SessionUser } from "@/lib/auth/session";
import SignOutButton from "@/app/components/SignOutButton";
import { UserProvider } from "@/app/components/UserProvider";
import NotificationBell from "@/app/components/NotificationBell";
import BrandMark from "@/app/components/portal/BrandMark";
import Avatar from "@/app/components/portal/Avatar";
import { TherapistMobileNav, TherapistSidebarNav } from "./TherapistNav";

/** The therapist portal's chrome; `layout.tsx` is the auth and role gate. */
export default function TherapistShell({
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
            <BrandMark href="/therapist" tagline="Therapist portal" />
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-4">
            <TherapistSidebarNav />
          </div>

          <div className="space-y-1 border-t border-stone-100 p-3">
            <Link
              href="/therapist/settings"
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
          <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-stone-200/70 bg-white/80 px-4 backdrop-blur-md sm:px-6">
            {/* Below `lg` the sidebar is hidden; this drawer is the only nav.
                There previously was none — the page just lost its menu. */}
            <div className="flex items-center gap-1.5 lg:hidden">
              <TherapistMobileNav />
              <BrandMark href="/therapist" size="sm" />
            </div>
            <span className="hidden lg:block" />
            <div className="flex items-center gap-2">
              <NotificationBell userId={user.$id} />
              <Link href="/therapist/settings" aria-label="Account settings" className="rounded-full lg:hidden">
                <Avatar name={user.name} />
              </Link>
            </div>
          </header>

          <main className="flex-1 pb-12">{children}</main>
        </div>
      </div>
    </UserProvider>
  );
}
