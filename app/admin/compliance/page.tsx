import { getLoggedInUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import AdminPageHeader from "../_components/AdminPageHeader";
import { ShieldCheck, ShieldAlert, AlertTriangle, ArrowRight } from "lucide-react";
import Link from "next/link";

/**
 * Compliance index — the fourth and last fabricated surface in this console.
 *
 * ## What was here
 *
 * Four scored tiles with progress bars: "HIPAA Compliance 96% — compliant",
 * "GDPR (EU Users) 91%", "SOC 2 Controls 88% — review needed", "Data Residency
 * 100%". Then three dated obligations: annual HIPAA staff training due May 15,
 * a SOC 2 Type II audit submission due May 30, a GDPR data mapping review due
 * June 1.
 *
 * None of it came from anywhere. There is no scoring mechanism, no audit
 * programme, no training record and no mapping exercise — and there never was,
 * so the percentages were not even stale.
 *
 * Two things make this worse than an empty page:
 *
 *  1. **AGENTS.md forbids exactly these claims.** HIPAA is a United States
 *     statute with no application to a Kenyan service; SOC 2 is an attestation
 *     nobody has performed. The claim had already been removed three times —
 *     from the home page, from `/organizations`, and from the OpenGraph image —
 *     and it was still sitting in the admin console, scored, with a green
 *     "compliant" badge.
 *  2. **It is a management dashboard.** Client-facing fabrications mislead
 *     customers; this one misleads the person deciding whether the company has
 *     a compliance problem. "96% HIPAA compliant" is the answer that stops
 *     someone asking the question.
 *
 * ## What it shows now
 *
 * The governing instrument, the things that are actually enforced in the
 * database, and the gaps — with no score attached to any of them, because a
 * percentage implies a measurement. The two links to `/admin/compliance/privacy`
 * and `/admin/compliance/terms` are also gone: neither route exists, so both
 * were 404s.
 */
export default async function ComplianceDashboardPage() {
  const user = await getLoggedInUser();
  if (!user || !user.labels?.includes("admin")) redirect("/dashboard");

  /*
   * Enforced by the database, not by policy — which is why each can be stated
   * without a caveat. The first three are verified against a live database by
   * `scripts/verify-kyc-security.ts` and `scripts/verify-risk-pipeline.ts`;
   * jest cannot see any of them, because it mocks `lib/db/session.ts`.
   */
  const enforced = [
    {
      label: "Row-level security",
      detail:
        "The app connects as echo_app, which is subject to every policy. 73 policies across 23 tables.",
    },
    {
      label: "Journal entries are author-only",
      detail:
        "No therapist or admin read path exists. An admin claiming the role still sees zero rows.",
    },
    {
      label: "Credentialing is append-only",
      detail:
        "kyc_review_events admits INSERT and SELECT for admins, never UPDATE or DELETE.",
    },
    {
      label: "Licence evidence is frozen once reviewed",
      detail:
        "Migration 0019 — a verified licence cannot have its number or jurisdiction rewritten.",
    },
  ];

  /* Named as gaps rather than scored. Each is a real piece of work. */
  const gaps = [
    "No admin read-logging. Access is restricted by RLS; reads are not recorded.",
    "No data subject request queue. Requests arrive by email and are handled by a person.",
    "No account self-deletion. Erasure is manual, with two limits enforced by ON DELETE RESTRICT.",
    "Response deadlines are not confirmed per market. Echo serves thirteen.",
  ];

  return (
    <div>
      <AdminPageHeader
        title="Compliance & Legal"
        description="What is enforced, what is not, and where the gaps are."
        breadcrumbs={[{ label: "Compliance" }]}
        actions={
          <div className="flex gap-2">
            <Link href="/admin/compliance/data-access" className="px-3 py-2 text-sm font-medium text-stone-600 bg-white border border-stone-200 rounded-xl hover:bg-stone-50">Admin access</Link>
            <Link href="/admin/compliance/audit-trail" className="px-3 py-2 text-sm font-medium text-white bg-teal-600 rounded-xl hover:bg-teal-700">Audit Trail</Link>
          </div>
        }
      />

      <div className="mb-8 flex gap-3 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-stone-400" />
        <div className="text-sm leading-6 text-stone-600">
          <p className="font-semibold text-stone-900">
            The governing instrument is the Kenya Data Protection Act 2019.
          </p>
          <p className="mt-1">
            Echo makes no HIPAA, CCPA or SOC 2 claim. This page previously scored
            all three; none had been assessed. Where clients are in other
            markets, which instrument applies is a question for counsel.
          </p>
        </div>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {enforced.map((e) => (
          <div key={e.label} className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-teal-500" />
              <div>
                <p className="text-sm font-semibold text-stone-900">{e.label}</p>
                <p className="mt-1 text-xs leading-5 text-stone-500">{e.detail}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending tasks */}
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
          <h3 className="text-sm font-bold text-stone-800 mb-4">Known gaps</h3>
          {/* Deliberately undated. The dates that were here belonged to
              obligations nobody had accepted, and a due date is a commitment. */}
          <div className="space-y-3">
            {gaps.map((g) => (
              <div key={g} className="flex items-start gap-2.5 rounded-xl border border-amber-100 bg-amber-50 p-3">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                <p className="text-sm leading-6 text-stone-800">{g}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Quick links */}
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
          <h3 className="text-sm font-bold text-stone-800 mb-4">Compliance Sections</h3>
          <div className="space-y-2">
            {[
              /* `/admin/compliance/privacy` and `/admin/compliance/terms` were
                 listed here and neither route exists — both were 404s. */
              { label: "Admin access to client data", href: "/admin/compliance/data-access" },
              { label: "Platform audit trail",        href: "/admin/compliance/audit-trail" },
              { label: "Therapist licensing review",  href: "/admin/therapists/verification-queue" },
              { label: "Data subject requests",       href: "/admin/compliance/gdpr" },
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
