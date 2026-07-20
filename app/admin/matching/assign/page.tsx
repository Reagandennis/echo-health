import { getLoggedInUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import AdminPageHeader from "../../_components/AdminPageHeader";
import AssignmentForm from "./AssignmentForm";
import { listProfilesAction, listTherapistsAction } from "@/app/actions/database";

/**
 * The candidate list used to be `profiles` intersected with the set of Appwrite
 * users carrying the "client" label. Both halves of that are gone: Appwrite has
 * no users, and roles now live in the Auth0 token where they cannot be
 * enumerated server-side.
 *
 * `profiles` is itself the client roster — a therapist's identity lives in
 * `therapists`, not `profiles` — so it is the correct candidate set on its own,
 * and the label intersection it replaced was returning nothing at all.
 */
export default async function ManualAssignPage() {
  const user = await getLoggedInUser();
  if (!user || !user.labels?.includes("admin")) redirect("/dashboard");

  const [patients, therapists] = await Promise.all([
    listProfilesAction(),
    listTherapistsAction(),
  ]);

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
