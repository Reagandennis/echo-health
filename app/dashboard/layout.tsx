import { redirect } from "next/navigation";
import { getLoggedInUser } from "@/lib/auth/session";
import ClientShell from "./_components/ClientShell";

export default async function DashboardLayout({ children }: { readonly children: React.ReactNode }) {
  const user = await getLoggedInUser();

  if (!user) {
    redirect("/signin");
  }

  return <ClientShell user={user}>{children}</ClientShell>;
}
