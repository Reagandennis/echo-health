import { getLoggedInUser } from "@/lib/appwrite/server";
import { redirect } from "next/navigation";
import AdminPageHeader from "../_components/AdminPageHeader";
import AdminBadge from "../_components/AdminBadge";
import { ShieldCheck, Clock, ArrowRight } from "lucide-react";
import Link from "next/link";

export default async function ComplianceDashboardPage() {
  const user = await getLoggedInUser();
  if (!user || !user.labels?.includes("admin")) redirect("/dashboard");

  const areas = [
    { label: "HIPAA Compliance", score: 96, status: "compliant" },
    { label: "GDPR (EU Users)", score: 91, status: "compliant" },
    { label: "SOC 2 Controls", score: 88, status: "review-needed" },
    { label: "Data Residency", score: 100, status: "compliant" },
  ];

  const pending = [
    { task: "Annual HIPAA training for staff", due: "May 15, 2026" },
    { task: "SOC 2 Type II audit submission", due: "May 30, 2026" },
    { task: "GDPR data mapping review", due: "Jun 1, 2026" },
  ];

  return (
    <div>
      <AdminPageHeader
        title="Compliance & Legal"
        description="Regulatory compliance status and audit trail overview."
        breadcrumbs={[{ label: "Compliance" }]}
        actions={
          <div className="flex gap-2">
            <Link href="/admin/compliance/data-access" className="px-3 py-2 text-sm font-medium text-stone-600 bg-white border border-stone-200 rounded-xl hover:bg-stone-50">Data Access Log</Link>
            <Link href="/admin/compliance/audit-trail" className="px-3 py-2 text-sm font-medium text-white bg-teal-600 rounded-xl hover:bg-teal-700">Audit Trail</Link>
          </div>
        }
      />

      {/* Compliance scores */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {areas.map((a) => (
          <div key={a.label} className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <ShieldCheck className={`w-5 h-5 ${a.score >= 95 ? "text-teal-500" : a.score >= 85 ? "text-amber-500" : "text-rose-500"}`} />
              <AdminBadge label={a.status.replace("-", " ")} variant={a.status === "compliant" ? "success" : "warning"} />
            </div>
            <p className="text-2xl font-bold text-stone-900">{a.score}%</p>
            <p className="text-xs text-stone-500 mt-1">{a.label}</p>
            <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden mt-3">
              <div className="h-full rounded-full" style={{ width: `${a.score}%`, background: a.score >= 95 ? "#14b8a6" : a.score >= 85 ? "#f59e0b" : "#f43f5e" }} />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending tasks */}
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
          <h3 className="text-sm font-bold text-stone-800 mb-4">Upcoming Compliance Tasks</h3>
          <div className="space-y-3">
            {pending.map((p, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-amber-50 rounded-xl border border-amber-100">
                <p className="text-sm text-stone-800">{p.task}</p>
                <div className="flex items-center gap-1 text-xs text-amber-600 font-medium flex-shrink-0 ml-3">
                  <Clock className="w-3 h-3" /> {p.due}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick links */}
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
          <h3 className="text-sm font-bold text-stone-800 mb-4">Compliance Sections</h3>
          <div className="space-y-2">
            {[
              { label: "Data Access & Consent Logs", href: "/admin/compliance/data-access" },
              { label: "Platform Audit Trail",       href: "/admin/compliance/audit-trail" },
              { label: "Therapist Licensing Review", href: "/admin/therapists/verification-queue" },
              { label: "Privacy Policy Management",  href: "/admin/compliance/privacy" },
              { label: "Terms of Service Versions",  href: "/admin/compliance/terms" },
            ].map((l) => (
              <Link key={l.label} href={l.href} className="flex items-center justify-between p-3 hover:bg-stone-50 rounded-xl transition-colors group">
                <span className="text-sm text-stone-700">{l.label}</span>
                <ArrowRight className="w-4 h-4 text-stone-400 group-hover:text-teal-500 transition-colors" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
