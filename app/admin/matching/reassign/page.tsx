import { getLoggedInUser } from "@/lib/appwrite/server";
import { redirect } from "next/navigation";
import AdminPageHeader from "../../_components/AdminPageHeader";
import { listProfilesAction, listTherapistsAction } from "@/app/actions/database";
import ReassignForm from "./ReassignForm";

export default async function ReassignPage({
  searchParams,
}: {
  searchParams: Promise<{ patientId?: string; conflictId?: string }>;
}) {
  const user = await getLoggedInUser();
  if (!user || !user.labels?.includes("admin")) redirect("/dashboard");

  const [profiles, therapists, params] = await Promise.all([
    listProfilesAction(),
    listTherapistsAction(),
    searchParams,
  ]);

  return (
    <div>
      <AdminPageHeader
        title="Reassignment Interface"
        description="Move a client from one therapist to another."
        breadcrumbs={[{ label: "Matching", href: "/admin/matching" }, { label: "Reassign" }]}
      />
      <div className="max-w-2xl">
        <ReassignForm 
          profiles={profiles} 
          therapists={therapists} 
          initialPatientId={params.patientId}
          conflictId={params.conflictId}
        />
      </div>
    </div>
  );
}
