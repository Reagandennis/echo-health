import { createAdminClient, getLoggedInUser } from "@/lib/appwrite/server";
import { appwriteConfig } from "@/lib/appwrite/config";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import AdminPageHeader from "../../_components/AdminPageHeader";
import AdminBadge, { kycBadge } from "../../_components/AdminBadge";
import { Star, Calendar, DollarSign, Award, Activity, FileText, Clock, ChevronRight, CheckCircle, XCircle } from "lucide-react";
import TherapistKycActions from "../TherapistKycActions";

const SUB_LINKS = [
  { label: "Credentials",   href: "credentials",   icon: Award },
  { label: "Performance",   href: "performance",   icon: Activity },
  { label: "Sessions",      href: "sessions",      icon: Calendar },
  { label: "Availability",  href: "availability",  icon: Clock },
  { label: "Earnings",      href: "earnings",      icon: DollarSign },
  { label: "Feedback",      href: "feedback",      icon: Star },
  { label: "Notes",         href: "notes",         icon: FileText },
  { label: "Audit Log",     href: "audit-log",     icon: Clock },
];

export default async function TherapistDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getLoggedInUser();
  if (!user || !user.labels?.includes("admin")) redirect("/dashboard");

  const { id } = await params;
  const { databases } = createAdminClient();

  let therapist;
  try {
    therapist = await databases.getDocument(appwriteConfig.databaseId, appwriteConfig.collections.therapists, id);
  } catch { notFound(); }

  return (
    <div>
      <AdminPageHeader
        title={therapist.name as string}
        description={`${therapist.experience} years experience`}
        breadcrumbs={[
          { label: "Therapists", href: "/admin/therapists" },
          { label: therapist.name as string },
        ]}
        actions={
          <div className="flex gap-2 items-center">
            <TherapistKycActions therapistDocId={therapist.$id} currentStatus={therapist.kycStatus ?? "incomplete"} />
            <button className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-rose-600 rounded-xl hover:bg-rose-700 transition-colors">
              <XCircle className="w-4 h-4" /> Suspend
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6">
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-400 to-indigo-500 flex items-center justify-center text-white text-3xl font-bold mb-3">
                {(therapist.name as string).charAt(0).toUpperCase()}
              </div>
              <h2 className="text-lg font-bold text-stone-900">{therapist.name}</h2>
              <p className="text-sm text-stone-500">{therapist.bio?.toString().slice(0, 80)}…</p>
              <div className="mt-3 flex gap-2">
                {kycBadge(therapist.kycStatus ?? "incomplete")}
                {therapist.rating && (
                  <div className="flex items-center gap-1 px-2 py-0.5 bg-amber-100 rounded-full">
                    <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                    <span className="text-xs font-semibold text-amber-700">{therapist.rating}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-3 text-sm">
              {[
                { label: "License",     value: therapist.licenseNumber ?? "Not provided" },
                { label: "Experience",  value: `${therapist.experience} years` },
                { label: "KYC Status",  value: therapist.kycStatus ?? "incomplete" },
                { label: "Onboarding",  value: therapist.onboardingComplete ? "Complete" : "Incomplete" },
              ].map((row) => (
                <div key={row.label} className="flex justify-between gap-2">
                  <span className="text-stone-400">{row.label}</span>
                  <span className="text-stone-700 font-medium text-right">{row.value as string}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Specialties */}
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-3">Specialties</h3>
            <div className="flex flex-wrap gap-2">
              {((therapist.specialties as string[]) ?? []).map((s) => (
                <AdminBadge key={s} label={s} variant="teal" />
              ))}
              {!therapist.specialties?.length && <p className="text-xs text-stone-400">None listed</p>}
            </div>
          </div>
        </div>

        {/* Sub-nav + stats */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-2">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1">
              {SUB_LINKS.map((item) => (
                <Link key={item.href} href={`/admin/therapists/${id}/${item.href}`}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl hover:bg-purple-50 text-stone-600 hover:text-purple-700 transition-colors group">
                  <item.icon className="w-5 h-5 text-stone-400 group-hover:text-purple-500 transition-colors" />
                  <span className="text-xs font-medium text-center leading-tight">{item.label}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Performance summary */}
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
            <h3 className="text-sm font-bold text-stone-800 mb-4">Performance Snapshot</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "Sessions",        value: "—" },
                { label: "Completion Rate", value: "—%" },
                { label: "Avg Rating",      value: therapist.rating ? `${therapist.rating}/5` : "—" },
                { label: "Total Earnings",  value: "—" },
              ].map((m) => (
                <div key={m.label} className="bg-stone-50 rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-stone-900">{m.value}</p>
                  <p className="text-[11px] text-stone-500 mt-0.5">{m.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
