import type { SessionUser } from "@/lib/auth/session";
import { UserProvider } from "@/app/components/UserProvider";
import NotificationBell from "@/app/components/NotificationBell";
import BrandMark from "@/app/components/portal/BrandMark";
import Avatar from "@/app/components/portal/Avatar";
import AdminSidebar, { AdminMobileNav } from "./AdminSidebar";

/** The admin console's chrome; `layout.tsx` is the auth gate and badge query. */
export default function AdminShell({
  user,
  riskAlerts,
  children,
}: {
  readonly user: SessionUser;
  readonly riskAlerts?: number;
  readonly children: React.ReactNode;
}) {
  return (
    <UserProvider user={user}>
      <div className="flex h-screen overflow-hidden bg-app-surface">
        {/* Sidebar — Client Component for active link detection */}
        <AdminSidebar
          userName={user.name}
          userLabel={user.labels?.[0] ?? "admin"}
          badgeCounts={{ riskAlerts }}
        />

        {/* Main content area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Top header */}
          <header className="flex h-16 flex-shrink-0 items-center justify-between border-b border-stone-200/80 bg-white/80 px-4 backdrop-blur-md md:px-6">
            <div className="flex items-center gap-1.5">
              <AdminMobileNav badgeCounts={{ riskAlerts }} />
              <BrandMark href="/admin" name="Echo" tagline="Admin console" size="sm" className="md:hidden" />
              <p className="hidden text-xs font-medium text-stone-500 md:block">Echo Health Platform</p>
            </div>

            <div className="flex items-center gap-3">
              <NotificationBell userId={user.$id} />
              <div className="flex items-center gap-2.5">
                <div className="hidden text-right sm:block">
                  <p className="text-sm font-semibold leading-tight text-stone-900">
                    {user.name}
                  </p>
                  <p className="text-xs capitalize leading-tight text-stone-500">
                    {user.labels?.[0] ?? "Admin"}
                  </p>
                </div>
                <Avatar name={user.name} />
              </div>
            </div>
          </header>

          {/* Scrollable page area */}
          <main className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-[1600px] p-4 sm:p-6 md:p-8">
              {children}
            </div>
          </main>
        </div>
      </div>
    </UserProvider>
  );
}
