import { createAdminClient, getLoggedInUser } from "@/lib/appwrite/server";
import { appwriteConfig } from "@/lib/appwrite/config";
import { redirect, notFound } from "next/navigation";
import AdminPageHeader from "../../../_components/AdminPageHeader";
import AdminBadge, { kycBadge } from "../../../_components/AdminBadge";
import { Award, FileText, CheckCircle, XCircle, Upload } from "lucide-react";

export default async function TherapistCredentialsPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const user = await getLoggedInUser();
  if (!user || !user.labels?.includes("admin")) redirect("/dashboard");
  const { id } = await params;
  const { databases } = createAdminClient();
  let t: Record<string, unknown>;
  try { t = await databases.getDocument(appwriteConfig.databaseId, appwriteConfig.collections.therapists, id) as unknown as Record<string, unknown>; } catch { notFound(); }

  return (
    <div>
      <AdminPageHeader
        title="Credentials & Licensing"
        breadcrumbs={[{ label: "Therapists", href: "/admin/therapists" }, { label: t.name as string, href: `/admin/therapists/${id}` }, { label: "Credentials" }]}
      />

      <div className="max-w-2xl space-y-6">
        {/* License */}
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
              <Award className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-stone-800">License Details</h3>
              <p className="text-xs text-stone-400">Primary clinical license</p>
            </div>
          </div>
          <div className="space-y-4">
            {[
              { label: "License Number", value: (t.licenseNumber as string) ?? "Not provided" },
              { label: "License Type", value: "Licensed Clinical Social Worker (LCSW)" },
              { label: "Issuing Authority", value: "State Board of Behavioral Sciences" },
              { label: "Issue Date", value: "January 15, 2019" },
              { label: "Expiry Date", value: "January 14, 2027" },
            ].map((f) => (
              <div key={f.label} className="flex justify-between items-center py-2 border-b border-stone-50 last:border-0">
                <span className="text-xs text-stone-400 font-medium">{f.label}</span>
                <span className="text-sm text-stone-800 font-medium">{f.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* KYC Status */}
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-bold text-stone-800">KYC Verification Status</h3>
            {kycBadge((t.kycStatus as string) ?? "incomplete")}
          </div>
          <div className="space-y-3">
            {[
              { label: "Government ID", status: "verified" },
              { label: "Professional License", status: (t.kycStatus as string) === "verified" ? "verified" : "pending" },
              { label: "Insurance Certificate", status: "pending" },
              { label: "Background Check", status: (t.kycStatus as string) === "verified" ? "verified" : "incomplete" },
            ].map((doc) => (
              <div key={doc.label} className="flex items-center justify-between p-3 bg-stone-50 rounded-xl">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-stone-400" />
                  <span className="text-sm text-stone-700">{doc.label}</span>
                </div>
                <AdminBadge
                  label={doc.status.charAt(0).toUpperCase() + doc.status.slice(1)}
                  variant={doc.status === "verified" ? "success" : doc.status === "pending" ? "warning" : "neutral"}
                  dot
                />
              </div>
            ))}
          </div>
          <div className="flex gap-3 mt-6">
            <button className="flex items-center gap-1.5 flex-1 justify-center px-4 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors">
              <CheckCircle className="w-4 h-4" /> Approve All
            </button>
            <button className="flex items-center gap-1.5 flex-1 justify-center px-4 py-2.5 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors">
              <XCircle className="w-4 h-4" /> Reject
            </button>
          </div>
        </div>

        {/* Upload */}
        <div className="bg-stone-50 border-2 border-dashed border-stone-200 rounded-2xl p-6 text-center">
          <Upload className="w-8 h-8 text-stone-400 mx-auto mb-2" />
          <p className="text-sm font-medium text-stone-600">Upload additional documents</p>
          <p className="text-xs text-stone-400 mt-1">PDF, JPG or PNG · Max 10MB</p>
          <button className="mt-4 px-4 py-2 text-sm font-semibold text-teal-600 border border-teal-300 bg-white rounded-xl hover:bg-teal-50 transition-colors">
            Choose File
          </button>
        </div>
      </div>
    </div>
  );
}
