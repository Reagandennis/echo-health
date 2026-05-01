import { createAdminClient, getLoggedInUser } from "@/lib/appwrite/server";
import { appwriteConfig } from "@/lib/appwrite/config";
import { redirect } from "next/navigation";
import AdminPageHeader from "../../_components/AdminPageHeader";
import AdminBadge, { kycBadge } from "../../_components/AdminBadge";
import { CheckCircle, XCircle, FileText, Clock } from "lucide-react";
import TherapistKycActions from "../TherapistKycActions";

export default async function VerificationQueuePage() {
  const user = await getLoggedInUser();
  if (!user || !user.labels?.includes("admin")) redirect("/dashboard");

  const { databases } = createAdminClient();
  const res = await databases.listDocuments(appwriteConfig.databaseId, appwriteConfig.collections.therapists);
  const pending = res.documents.filter((t) => t.kycStatus === "pending" || t.kycStatus === "incomplete");

  return (
    <div>
      <AdminPageHeader
        title="Verification Review Queue"
        description="Therapists awaiting KYC verification. Review and approve or reject."
        breadcrumbs={[{ label: "Therapists", href: "/admin/therapists" }, { label: "Verification Queue" }]}
      />

      {pending.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mb-4">
            <CheckCircle className="w-8 h-8 text-emerald-500" />
          </div>
          <h3 className="text-base font-semibold text-stone-700 mb-1">All clear!</h3>
          <p className="text-sm text-stone-400">No pending verifications.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pending.map((t) => (
            <div key={t.$id} className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-indigo-500 flex items-center justify-center text-white font-bold text-lg">
                    {(t.name as string).charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-base font-bold text-stone-900">{t.name}</h3>
                      {kycBadge(t.kycStatus ?? "incomplete")}
                    </div>
                    <p className="text-xs text-stone-500">{t.experience} years experience · License: {t.licenseNumber ?? "Not provided"}</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {((t.specialties as string[]) ?? []).map((s) => (
                        <AdminBadge key={s} label={s} variant="neutral" />
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0 items-center">
                  <a href={`/admin/therapists/${t.$id}/credentials`} className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-xl transition-colors">
                    <FileText className="w-4 h-4" /> Review Docs
                  </a>
                  <TherapistKycActions therapistDocId={t.$id} currentStatus={t.kycStatus ?? "incomplete"} />
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-stone-100 flex items-center gap-1 text-xs text-stone-400">
                <Clock className="w-3 h-3" /> Submitted: recently
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
