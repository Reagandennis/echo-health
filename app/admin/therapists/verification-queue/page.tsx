import { getLoggedInUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import Link from "next/link";
import { CheckCircle, Clock, FileWarning, Hourglass, Info } from "lucide-react";

import AdminPageHeader from "../../_components/AdminPageHeader";
import AdminBadge, { kycBadge } from "../../_components/AdminBadge";
import TherapistKycActions from "../TherapistKycActions";
import {
  listVerificationQueue,
  type VerificationQueueRow,
} from "../../_lib/queries";
import { kycDocumentLabel } from "@/lib/kyc";

/**
 * The KYC review queue.
 *
 * Three things were wrong with the version this replaces, all of the same kind:
 * it showed the admin less than the database knew.
 *
 *  1. It was unordered, so there was no sense in which anything was a queue.
 *     It now sorts on `kyc_submitted_at`, oldest first — the applicant who has
 *     waited longest is at the top.
 *  2. It labelled `updated_at` as "Submitted". Those are different facts: any
 *     profile edit moved `updated_at`, so an application submitted in March
 *     could read as submitted yesterday. `kyc_submitted_at` exists now and is
 *     what is displayed.
 *  3. It offered a one-click Approve on every row. Approving from a list means
 *     approving a clinician whose documents were never opened — which is
 *     precisely how both therapists in this database came to be marked verified
 *     against zero evidence. A row whose required documents have not all been
 *     accepted now links to the review screen instead of offering the button.
 */
export default async function VerificationQueuePage() {
  const user = await getLoggedInUser();
  if (!user || !user.labels?.includes("admin")) redirect("/dashboard");

  const queue = await listVerificationQueue();

  /*
   * Split rather than one list. "Pending" is work waiting on the reviewer;
   * "incomplete" is work waiting on the applicant. Mixing them makes the queue
   * look longer than it is and buries the rows someone can actually act on.
   */
  const awaitingReview = queue.filter((t) => t.kycStatus === "pending");
  const notSubmitted = queue.filter((t) => t.kycStatus !== "pending");

  return (
    <div>
      <AdminPageHeader
        title="Verification review queue"
        description="Applications awaiting a credentialing decision, longest-waiting first."
        breadcrumbs={[
          { label: "Therapists", href: "/admin/therapists" },
          { label: "Verification Queue" },
        ]}
      />

      {/*
        Stated here as a standing fact rather than left to the per-request
        `notice` the API returns. An approved row leaves this queue immediately
        — it is no longer pending — so the component that renders that notice
        unmounts with it. The credentials screen keeps showing the live notice;
        this is what stops the information being lost when the decision is made
        from the list.
      */}
      <p className="flex items-start gap-2 text-xs text-stone-500 bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 mb-6 max-w-3xl">
        <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-teal-600" />
        Approving grants the therapist role in Auth0. Roles are stamped into the
        session at login, so an approved clinician must sign out and back in
        before they gain access.
      </p>

      {queue.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mb-4">
            <CheckCircle className="w-8 h-8 text-emerald-500" />
          </div>
          <h3 className="text-base font-semibold text-stone-700 mb-1">All clear</h3>
          <p className="text-sm text-stone-400">
            No applications are awaiting review.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          <section>
            <div className="flex items-baseline gap-2 mb-3">
              <h2 className="text-sm font-bold text-stone-800">Awaiting review</h2>
              <span className="text-xs text-stone-400">
                {awaitingReview.length} application
                {awaitingReview.length === 1 ? "" : "s"}
              </span>
            </div>
            {awaitingReview.length === 0 ? (
              <p className="text-sm text-stone-400 bg-white border border-stone-200 rounded-2xl p-5">
                Nothing is waiting on a reviewer.
              </p>
            ) : (
              <div className="space-y-4">
                {awaitingReview.map((t) => (
                  <QueueCard key={t.$id} t={t} />
                ))}
              </div>
            )}
          </section>

          {notSubmitted.length > 0 && (
            <section>
              <div className="flex items-baseline gap-2 mb-1">
                <h2 className="text-sm font-bold text-stone-800">Not yet submitted</h2>
                <span className="text-xs text-stone-400">
                  {notSubmitted.length} application
                  {notSubmitted.length === 1 ? "" : "s"}
                </span>
              </div>
              <p className="text-xs text-stone-400 mb-3">
                These are waiting on the applicant, not on you. There is nothing
                to decide until they submit.
              </p>
              <div className="space-y-4">
                {notSubmitted.map((t) => (
                  <QueueCard key={t.$id} t={t} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function QueueCard({ t }: Readonly<{ t: VerificationQueueRow }>) {
  const credentialsHref = `/admin/therapists/${t.$id}/credentials`;
  const missingLabels = t.missingRequired.map((type) => kycDocumentLabel(type));
  const waited = waitingFor(t.kycSubmittedAt);

  return (
    <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-indigo-500 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
            {t.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              {/* The name is the route to the evidence, so there is always a
                  path to the documents even when no decision is offered. */}
              <Link
                href={credentialsHref}
                className="text-base font-bold text-stone-900 hover:text-teal-700 transition-colors"
              >
                {t.name}
              </Link>
              {kycBadge(t.kycStatus)}
            </div>
            <p className="text-xs text-stone-500">
              {t.experience} years experience · Licence:{" "}
              {t.licenseNumber ?? "not provided"}
            </p>
            <div className="flex flex-wrap gap-1 mt-2">
              {(t.specialties ?? []).map((s) => (
                <AdminBadge key={s} label={s} variant="neutral" />
              ))}
            </div>
          </div>
        </div>

        <div className="flex-shrink-0">
          <TherapistKycActions
            therapistDocId={t.$id}
            currentStatus={t.kycStatus}
            missingRequired={missingLabels}
            reviewHref={credentialsHref}
          />
        </div>
      </div>

      {/* ─── What has actually been looked at ───────────────────────────── */}
      <div className="mt-4 pt-4 border-t border-stone-100 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
        <span className="flex items-center gap-1.5 text-stone-500">
          <Clock className="w-3.5 h-3.5" />
          {t.kycSubmittedAt ? (
            <>
              Submitted{" "}
              {t.kycSubmittedAt.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
              {waited && (
                <span className="text-stone-400">· waiting {waited}</span>
              )}
            </>
          ) : (
            <span className="text-stone-400">Never submitted</span>
          )}
        </span>

        <span className="text-stone-500">
          <span className="font-semibold text-stone-700">{t.documentCount}</span>{" "}
          document{t.documentCount === 1 ? "" : "s"}
        </span>

        {/* The number that decides whether this row is actionable. A document
            nobody has opened is not evidence, and the queue should say how many
            of those there are before anyone reaches for Approve. */}
        <span
          className={`flex items-center gap-1.5 ${
            t.pendingDocumentCount > 0 ? "text-amber-700 font-semibold" : "text-stone-400"
          }`}
        >
          <Hourglass className="w-3.5 h-3.5" />
          {t.pendingDocumentCount} un-reviewed
        </span>

        <span className="text-stone-400">
          {t.acceptedDocumentCount} accepted · {t.rejectedDocumentCount} rejected
        </span>
      </div>

      {missingLabels.length > 0 && (
        <p className="mt-3 flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
          <FileWarning className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>
            <span className="font-semibold">Missing or unaccepted:</span>{" "}
            {missingLabels.join(", ")}
          </span>
        </p>
      )}

      {t.kycReviewNote && (
        <p className="mt-3 text-xs text-stone-500">
          <span className="font-semibold text-stone-600">Last note to therapist: </span>
          {t.kycReviewNote}
        </p>
      )}
    </div>
  );
}

/** How long this application has been waiting on a reviewer. */
function waitingFor(since: Date | null): string | null {
  if (!since) return null;
  const days = Math.floor((Date.now() - since.getTime()) / 86_400_000);
  if (days <= 0) return "less than a day";
  return `${days} day${days === 1 ? "" : "s"}`;
}
