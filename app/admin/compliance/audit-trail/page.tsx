import { getLoggedInUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import Link from "next/link";
import AdminPageHeader from "../../_components/AdminPageHeader";
import AdminBadge from "../../_components/AdminBadge";
import { listPlatformAuditTrail, type PlatformAuditRow } from "../../_lib/queries";
import { kycDocumentLabel } from "@/lib/kyc";
import { Clock, ShieldCheck, XCircle, AlertTriangle, ShieldAlert, Upload, FileText } from "lucide-react";

/**
 * Platform credentialing trail, read from `kyc_review_events`.
 *
 * WHAT THIS PAGE USED TO BE, and why it was the most dangerous of the three
 * fabricated audit surfaces in this console. It was titled "Platform Audit
 * Trail", subtitled "Immutable log of all significant platform actions", and
 * contained ten hardcoded rows and no query. Among them:
 *
 *   • "Suspended account for Liam O." — no suspension had occurred, and there
 *     is no suspension feature.
 *   • "Refund approved for Daniel T." — no refund had occurred, and the refund
 *     flow was deleted precisely because it did not exist.
 *   • "Approved $1,584 payout for Dr. Patel" — no payout, and the platform
 *     settles in KES, not dollars.
 *   • "Approved Dr. Kim's verification" — no such therapist, no such decision.
 *
 * An audit trail is consulted when something has gone wrong and someone is
 * establishing what happened and who did it. This one asserted, under a
 * compliance heading and the word "immutable", a set of administrative actions
 * that had never taken place. Unlike the two per-user audit pages, it did not
 * even carry a comment admitting it was mock.
 *
 * WHAT IT IS NOW. Real rows from `kyc_review_events`, which is the one
 * genuinely append-only table in the database — `echo_app` has SELECT and
 * INSERT only, UPDATE and DELETE are revoked at the grant level with no policy,
 * and `scripts/verify-kyc-security.ts` asserts that an admin cannot rewrite it.
 * So "immutable" is now a claim this page can actually support.
 *
 * WHAT WAS REMOVED. The role/event dropdowns and the two date inputs filtered
 * nothing — no handler, no state, no query. The Export button had no handler.
 * They are gone rather than wired up: controls that imply a capability the page
 * does not have are the same failure as rows that imply events that did not
 * happen, and building export/filtering is a separate decision, not a repair.
 */

const ACTION_PRESENTATION: Record<
  string,
  { label: string; Icon: typeof Clock; variant: "success" | "danger" | "warning" | "neutral"; iconWrap: string; icon: string }
> = {
  submitted:         { label: "Submitted",         Icon: Upload,       variant: "neutral", iconWrap: "bg-blue-50",    icon: "text-blue-600" },
  approved:          { label: "Approved",          Icon: ShieldCheck,  variant: "success", iconWrap: "bg-emerald-50", icon: "text-emerald-600" },
  rejected:          { label: "Rejected",          Icon: XCircle,      variant: "danger",  iconWrap: "bg-rose-50",    icon: "text-rose-600" },
  changes_requested: { label: "Changes requested", Icon: AlertTriangle, variant: "warning", iconWrap: "bg-amber-50",  icon: "text-amber-600" },
  revoked:           { label: "Approval revoked",  Icon: ShieldAlert,  variant: "danger",  iconWrap: "bg-rose-50",    icon: "text-rose-700" },
  document_accepted: { label: "Document accepted", Icon: FileText,     variant: "success", iconWrap: "bg-emerald-50", icon: "text-emerald-600" },
  document_rejected: { label: "Document rejected", Icon: FileText,     variant: "danger",  iconWrap: "bg-rose-50",    icon: "text-rose-600" },
};

/**
 * `action` is free text in the database — deliberately, so the log never
 * refuses a write because a new action name appeared. An unrecognised value must
 * therefore still render, showing the raw string, which is more use to whoever
 * is investigating than a tidy "Unknown".
 */
function presentation(action: string) {
  return (
    ACTION_PRESENTATION[action] ?? {
      label: action,
      Icon: Clock,
      variant: "neutral" as const,
      iconWrap: "bg-stone-100",
      icon: "text-stone-500",
    }
  );
}

function TrailRow({ row }: { row: PlatformAuditRow }) {
  const { label, Icon, variant, iconWrap, icon } = presentation(row.action);

  return (
    <tr className="hover:bg-stone-50/50 transition-colors align-top">
      <td className="px-5 py-4 text-xs text-stone-500 whitespace-nowrap">
        {row.createdAt.toLocaleString("en-GB", {
          day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
        })}
      </td>

      <td className="px-5 py-4 whitespace-nowrap">
        <div className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${iconWrap}`}>
            <Icon className={`w-3.5 h-3.5 ${icon}`} />
          </div>
          <AdminBadge label={label} variant={variant} dot />
        </div>
      </td>

      <td className="px-5 py-4 text-sm text-stone-800">
        {row.actorId === "system" ? (
          <span className="italic text-stone-500">System</span>
        ) : (
          /*
           * The raw Auth0 sub when no profile resolves. "Who approved this
           * clinician" is the question this table exists to answer; an
           * unresolved actor is shown as the identifier it is, never as a
           * friendly guess like "Admin" — which is exactly what the fabricated
           * version printed for every single row.
           */
          <span className={row.actorName ? "font-medium" : "font-mono text-[11px] text-stone-500"}>
            {row.actorName ?? row.actorId}
          </span>
        )}
      </td>

      <td className="px-5 py-4 text-sm">
        <Link
          href={`/admin/therapists/${row.subjectTherapistId}/audit-log`}
          className="text-teal-700 hover:underline"
        >
          {row.subjectName}
        </Link>
        {row.documentId && (
          <span className="block text-[11px] text-stone-400 mt-0.5">
            {kycDocumentLabel(row.documentType ?? "other")}
          </span>
        )}
      </td>

      <td className="px-5 py-4 text-xs text-stone-600 max-w-md">
        {row.note ? (
          <span className="whitespace-pre-wrap">{row.note}</span>
        ) : (
          <span className="text-stone-400">—</span>
        )}
      </td>
    </tr>
  );
}

export default async function AuditTrailPage() {
  const user = await getLoggedInUser();
  if (!user || !user.labels?.includes("admin")) redirect("/dashboard");

  const trail = await listPlatformAuditTrail();

  return (
    <div>
      <AdminPageHeader
        title="Credentialing audit trail"
        description="Every therapist verification decision made on this platform, newest first."
        breadcrumbs={[
          { label: "Compliance", href: "/admin/compliance" },
          { label: "Audit Trail" },
        ]}
      />

      {/*
        Scope stated up front. The previous title claimed "all significant
        platform actions"; this covers one category of them, and saying which is
        the difference between a record and a false impression of completeness.
      */}
      <div className="mb-5 rounded-2xl border border-stone-200 bg-stone-50 p-4">
        <p className="text-xs text-stone-600 leading-relaxed">
          Read from <span className="font-mono text-[11px]">kyc_review_events</span>, which is
          append-only: the application role can insert and read, but cannot update or delete, and
          neither can an administrator.
          <br />
          <strong className="font-semibold text-stone-700">This covers credentialing only.</strong>{" "}
          Sign-in activity is held by Auth0, payment history is in the transactions ledger, and
          administrative configuration changes are not currently recorded anywhere.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        {trail.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <Clock className="w-8 h-8 text-stone-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-stone-600">No credentialing decisions recorded</p>
            <p className="text-xs text-stone-400 mt-1 max-w-sm mx-auto">
              Entries appear here as therapists submit applications and decisions are made against
              them.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[820px]">
              <thead className="bg-stone-50 border-b border-stone-100">
                <tr>
                  {/* No IP column — request IPs are not recorded by this platform. */}
                  {["Timestamp", "Action", "By", "Therapist", "Note"].map((h) => (
                    <th
                      key={h}
                      className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-stone-500"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-50">
                {trail.map((row) => (
                  <TrailRow key={row.id} row={row} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {trail.length >= 200 && (
        <p className="mt-3 text-xs text-stone-400">Showing the 200 most recent entries.</p>
      )}
    </div>
  );
}
