import { redirect } from "next/navigation";
import { getLoggedInUser } from "@/lib/auth/session";
import AdminShell from "./_components/AdminShell";
import { countUnresolvedRiskAlerts } from "./_lib/queries";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getLoggedInUser();

  if (!user || !user.labels?.includes("admin")) {
    redirect("/dashboard");
  }

  /*
   * The sidebar's risk badge was a hardcoded `5`. It is now a real count, which
   * has to be queried here because the sidebar is a Client Component.
   *
   * Failing soft on purpose: a badge is navigation chrome, and a transient
   * database error should not take down every admin page with it. On failure the
   * count is omitted and no badge renders — which is the honest outcome, since
   * an unknown count is exactly what we have.
   */
  let riskAlerts: number | undefined;
  try {
    riskAlerts = await countUnresolvedRiskAlerts();
  } catch (err) {
    console.error("[admin] Could not count unresolved risk alerts", err);
  }

  return (
    <AdminShell user={user} riskAlerts={riskAlerts}>
      {children}
    </AdminShell>
  );
}
