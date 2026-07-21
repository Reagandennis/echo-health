import { getLoggedInUser } from "@/lib/auth/session";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import AdminPageHeader from "../../../_components/AdminPageHeader";
import { getTherapistKycReview, type KycReviewEventRow } from "../../../_lib/queries";
import { kycDocumentLabel } from "@/lib/kyc";
import {
  Clock, Upload, ShieldCheck, XCircle, AlertTriangle, ShieldAlert, FileText,
} from "lucide-react";

/**
 * Credentialing history for one therapist, read from `kyc_review_events`.
 *
 * WHAT THIS PAGE USED TO BE. Four hardcoded rows — a Safari login, a KYC
 * submission, a profile update, a logout — each stamped with the invented IP
 * `102.89.x.x`, rendered under a real therapist's real name. There was no audit
 * table at the time and nothing wrote one, so the page could not have shown
 * anything true. It did at least SAY it was mock in a comment, which the
 * credentials page did not.
 *
 * The reason that matters more than it looks: an audit log is consulted when
 * something has gone wrong and someone is reconstructing what happened. Four
 * plausible fabricated rows do not merely fail to help — they answer the
 * question wrongly, with the confidence of a record, to someone who has no
 * reason to doubt it.
 *
 * THE IP COLUMN IS GONE, and that is deliberate rather than an omission. The
 * platform does not record request IPs anywhere. Keeping the column and writing
 * "—" in it would suggest the data exists and happens to be missing for these
 * rows; removing it says the truth, which is that we do not collect it.
 *
 * WHAT THIS LOG DOES NOT COVER. Only credentialing decisions. Logins, logouts,
 * password changes and MFA events happen in Auth0 and are in its log stream, not
 * this database. The banner below says so, because a log that silently covers
 * less than its title implies is the same failure as one that invents rows.
 */

const ACTION_PRESENTATION: Record<
  string,
  { label: string; Icon: typeof Clock; iconWrap: string; icon: string }
> = {
  submitted: {
    label: "Submitted for review",
    Icon: Upload,
    iconWrap: "bg-blue-50",
    icon: "text-blue-600",
  },
  approved: {
    label: "Approved",
    Icon: ShieldCheck,
    iconWrap: "bg-emerald-50",
    icon: "text-emerald-600",
  },
  rejected: {
    label: "Rejected",
    Icon: XCircle,
    iconWrap: "bg-rose-50",
    icon: "text-rose-600",
  },
  changes_requested: {
    label: "Changes requested",
    Icon: AlertTriangle,
    iconWrap: "bg-amber-50",
    icon: "text-amber-600",
  },
  revoked: {
    label: "Approval revoked",
    Icon: ShieldAlert,
    iconWrap: "bg-rose-50",
    icon: "text-rose-700",
  },
  document_accepted: {
    label: "Document accepted",
    Icon: FileText,
    iconWrap: "bg-emerald-50",
    icon: "text-emerald-600",
  },
  document_rejected: {
    label: "Document rejected",
    Icon: FileText,
    iconWrap: "bg-rose-50",
    icon: "text-rose-600",
  },
};

/**
 * `action` is free text in the database — deliberately, so the log never refuses
 * a write because a new action name appeared. That means this map can be
 * incomplete, and an unrecognised action must still render rather than crash or
 * vanish. It shows the raw value, which is more useful to whoever is
 * investigating than a tidy "Unknown" would be.
 */
function presentation(action: string) {
  return (
    ACTION_PRESENTATION[action] ?? {
      label: action,
      Icon: Clock,
      iconWrap: "bg-stone-100",
      icon: "text-stone-500",
    }
  );
}

function formatWhen(value: Date) {
  return value.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function EventRow({ event }: { event: KycReviewEventRow }) {
  const { label, Icon, iconWrap, icon } = presentation(event.action);

  return (
    <tr className="hover:bg-stone-50/50 transition-colors align-top">
      <td className="px-5 py-4 whitespace-nowrap">
        <div className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${iconWrap}`}>
            <Icon className={`w-3.5 h-3.5 ${icon}`} />
          </div>
          <span className="text-xs font-semibold text-stone-700">{label}</span>
        </div>
      </td>

      <td className="px-5 py-4 text-sm text-stone-700 max-w-md">
        {event.documentId && (
          <p className="text-xs text-stone-500 mb-1">
            {event.documentFilename ? (
              <>
                {kycDocumentLabel(event.documentType ?? "other")} ·{" "}
                <span className="font-mono">{event.documentFilename}</span>
              </>
            ) : (
              /*
               * `kyc_review_events.document_id` is ON DELETE SET NULL, so the
               * event survives its document. Saying the document is gone is the
               * point — the decision still happened and the record of it must
               * not quietly lose its subject.
               */
              <span className="italic">Document has since been deleted</span>
            )}
          </p>
        )}
        {event.note ? (
          <p className="whitespace-pre-wrap">{event.note}</p>
        ) : (
          <span className="text-stone-400 text-xs">No note recorded</span>
        )}
      </td>

      <td className="px-5 py-4 text-xs text-stone-600 whitespace-nowrap">
        {event.actorId === "system" ? (
          <span className="italic text-stone-500">System</span>
        ) : (
          /*
           * The raw Auth0 sub when no profile resolves. "Who approved this
           * clinician" is the one question this table exists to answer, so an
           * unresolved actor is shown as the identifier it actually is rather
           * than as a friendly guess like "Admin".
           */
          <span className={event.actorName ? "" : "font-mono text-[11px] text-stone-500"}>
            {event.actorName ?? event.actorId}
          </span>
        )}
      </td>

      <td className="px-5 py-4 text-xs text-stone-500 whitespace-nowrap">
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {formatWhen(event.createdAt)}
        </div>
      </td>
    </tr>
  );
}

export default async function TherapistAuditLogPage({
  params,
}: {
  // Request-time API: a Promise in Next 16, not the plain object it was in 14.
  params: Promise<{ id: string }>;
}) {
  const user = await getLoggedInUser();
  if (!user || !user.labels?.includes("admin")) redirect("/dashboard");

  const { id } = await params;

  /*
   * Reuses the credentials screen's query rather than adding a near-duplicate.
   * It resolves the therapist and the trail in ONE transaction, which also
   * saves a second round-trip of RLS setup (~230ms against this instance — see
   * the note in `lib/db/session.ts`). It returns document metadata this page
   * does not render; that is a small cost and `content` is never selected, so
   * no file bytes cross the wire.
   */
  const review = await getTherapistKycReview(id);
  if (!review) notFound();

  const { therapist, events } = review;

  return (
    <div>
      <AdminPageHeader
        title="Credentialing history"
        description="Every KYC decision recorded for this therapist, newest first."
        breadcrumbs={[
          { label: "Therapists", href: "/admin/therapists" },
          { label: therapist.name, href: `/admin/therapists/${id}` },
          { label: "History" },
        ]}
      />

      <div className="mb-5 rounded-2xl border border-stone-200 bg-stone-50 p-4">
        <p className="text-xs text-stone-600">
          This is the append-only record from{" "}
          <span className="font-mono text-[11px]">kyc_review_events</span>. Entries cannot be
          edited or deleted by anyone, including administrators.{" "}
          <strong className="font-semibold text-stone-700">
            Sign-in activity is not shown here
          </strong>{" "}
          — authentication events are held by Auth0, not in this database.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        {events.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <Clock className="w-8 h-8 text-stone-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-stone-600">No credentialing decisions yet</p>
            <p className="text-xs text-stone-400 mt-1 max-w-sm mx-auto">
              Entries appear here when this therapist submits an application and when a decision
              is recorded against it.
            </p>
            <Link
              href={`/admin/therapists/${id}/credentials`}
              className="inline-block mt-4 text-xs font-semibold text-teal-600 hover:underline"
            >
              Review their credentials
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[640px]">
              <thead className="bg-stone-50 border-b border-stone-100">
                <tr>
                  {/* No IP column — see the note at the top of this file. */}
                  {["Event", "Detail", "By", "When"].map((h) => (
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
                {events.map((event) => (
                  <EventRow key={event.id} event={event} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/*
        The query caps at 200 events. Saying so matters on an audit surface:
        "these are the last 200" and "this is everything" are different claims,
        and only one of them is true.
      */}
      {events.length >= 200 && (
        <p className="mt-3 text-xs text-stone-400">
          Showing the 200 most recent entries.
        </p>
      )}
    </div>
  );
}
