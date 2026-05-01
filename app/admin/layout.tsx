import { redirect } from "next/navigation";
import { getLoggedInUser } from "@/lib/appwrite/server";
import { UserProvider } from "@/app/components/UserProvider";
import AdminSidebar from "./_components/AdminSidebar";
import { Menu } from "lucide-react";
import NotificationBell from "@/app/components/NotificationBell";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getLoggedInUser();

  if (!user || !user.labels?.includes("admin")) {
    redirect("/dashboard");
  }

  return (
    <UserProvider user={user}>
      <div className="flex h-screen bg-stone-50 overflow-hidden">
        {/* Sidebar — Client Component for active link detection */}
        <AdminSidebar
          userName={user.name}
          userLabel={user.labels?.[0] ?? "admin"}
        />

        {/* Main content area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Top header */}
          <header className="h-16 bg-white border-b border-stone-200 flex items-center justify-between px-6 flex-shrink-0">
            <div className="flex items-center gap-3">
              {/* Mobile menu button (sidebar hidden on mobile) */}
              <button className="md:hidden p-2 text-stone-500 hover:bg-stone-100 rounded-lg">
                <Menu className="w-5 h-5" />
              </button>
              <div className="hidden md:block">
                <p className="text-xs text-stone-400 font-medium">Echo Health Platform</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <NotificationBell userId={user.$id} />
              <div className="flex items-center gap-2.5">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-semibold text-stone-900 leading-tight">
                    {user.name}
                  </p>
                  <p className="text-xs text-stone-400 capitalize leading-tight">
                    {user.labels?.[0] ?? "Admin"}
                  </p>
                </div>
                <div className="w-9 h-9 rounded-full bg-teal-600 flex items-center justify-center text-white text-sm font-bold">
                  {user.name.charAt(0).toUpperCase()}
                </div>
              </div>
            </div>
          </header>

          {/* Scrollable page area */}
          <main className="flex-1 overflow-y-auto">
            <div className="p-6 md:p-8 max-w-[1600px] mx-auto">
              {children}
            </div>
          </main>
        </div>
      </div>
    </UserProvider>
  );
}
