import { getLoggedInUser, createAdminClient } from "@/lib/appwrite/server";
import { redirect } from "next/navigation";
import AdminPageHeader from "../../_components/AdminPageHeader";
import AssignmentForm from "./AssignmentForm";
import { listProfilesAction, listTherapistsAction } from "@/app/actions/database";

export default async function ManualAssignPage() {
  const user = await getLoggedInUser();
  if (!user || !user.labels?.includes("admin")) redirect("/dashboard");

  const { users } = createAdminClient();
  const [profiles, therapists, allUsers] = await Promise.all([
    listProfilesAction(),
    listTherapistsAction(),
    users.list(),
  ]);

  const clientUserIds = new Set(allUsers.users.filter(u => u.labels?.includes("client")).map(u => u.$id));
  const patients = profiles.filter((p: any) => clientUserIds.has(p.userId));

  return (
    <div>
      <AdminPageHeader
        title="Manual Match Assignment"
        description="Manually assign a client to a therapist."
        breadcrumbs={[{ label: "Matching", href: "/admin/matching" }, { label: "Assign" }]}
      />
      
      <AssignmentForm patients={patients} therapists={therapists} />
    </div>
  );
}
