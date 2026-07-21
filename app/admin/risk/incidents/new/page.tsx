import { getLoggedInUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import AdminPageHeader from "../../../_components/AdminPageHeader";
import { listProfilesAction } from "@/app/actions/database";
import IncidentForm from "./IncidentForm";

/**
 * Incidents are stored as `risk_alerts` rows — there is no incidents table.
 * The client list is loaded here so the form can offer a picker rather than a
 * free-text name box; see IncidentForm for why that matters.
 */
export default async function NewIncidentPage() {
  const user = await getLoggedInUser();
  if (!user || !user.labels?.includes("admin")) redirect("/dashboard");

  const profiles = await listProfilesAction();
  const clients = profiles
    .map((p: { userId: string; name: string | null }) => ({
      userId: p.userId,
      name: p.name ?? p.userId,
    }))
    .sort((a: { name: string }, b: { name: string }) =>
      a.name.localeCompare(b.name)
    );

  return (
    <div>
      <AdminPageHeader
        title="New Incident Report"
        description="Files a risk alert against a client's record. Visible to admins only."
        breadcrumbs={[
          { label: "Risk & Crisis", href: "/admin/risk" },
          { label: "Incidents", href: "/admin/risk/incidents" },
          { label: "New" },
        ]}
      />
      <IncidentForm clients={clients} />
    </div>
  );
}
