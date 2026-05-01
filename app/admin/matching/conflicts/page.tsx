import { getLoggedInUser } from "@/lib/appwrite/server";
import { redirect } from "next/navigation";
import AdminPageHeader from "../../_components/AdminPageHeader";
import AdminBadge from "../../_components/AdminBadge";
import { AlertTriangle, CheckCircle, Loader2 } from "lucide-react";
import { 
  listMatchConflictsAction, 
  listProfilesAction, 
  listTherapistsAction,
  resolveMatchConflictAction
} from "@/app/actions/database";
import ConflictList from "./ConflictList";

export default async function MatchConflictsPage() {
  const user = await getLoggedInUser();
  if (!user || !user.labels?.includes("admin")) redirect("/dashboard");

  const [conflicts, profiles, therapists] = await Promise.all([
    listMatchConflictsAction(),
    listProfilesAction(),
    listTherapistsAction(),
  ]);

  return (
    <div>
      <AdminPageHeader
        title="Match Failure & Conflict Logs"
        breadcrumbs={[{ label: "Matching", href: "/admin/matching" }, { label: "Conflicts" }]}
      />
      
      <ConflictList 
        initialConflicts={conflicts} 
        profiles={profiles} 
        therapists={therapists} 
      />
    </div>
  );
}
