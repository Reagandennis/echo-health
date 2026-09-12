import { BookOpenCheck, CalendarX2, ExternalLink, Info, ShieldQuestion } from "lucide-react";

import AdminBadge, { kycBadge } from "../_components/AdminBadge";
import { requirementFor } from "@/lib/licensing";
import { allowedVerificationsFor } from "@/lib/validation";
import type { TherapistLicenceRow } from "../_lib/queries";
import LicenceReviewActions from "./LicenceReviewActions";

/**
 * One claimed jurisdiction, as a reviewer needs to see it.
 *
 * Shared by the verification queue and the credentials screen so the two cannot
 * drift into describing the same licence differently — which is what happened
 * with "licensed in Kenya", hardcoded in nine places until `lib/licensing.ts`
 * gave it one home.
 *
 * A Server Component: everything here is either a database column or a constant
 * from `lib/licensing.ts`, and the only interactive part is the decision
 * control, which is its own client island. Nothing on this card is asserted
 * without a record behind it — the discipline the credentials screen was
 * rebuilt to restore after it spent months rendering "Government ID — Verified"
 * as a literal string.
 */

/**
 * "California, the United States" / "Kenya".
 *
 * Subdivision FIRST, because it is the body that actually licensed them.
 * "The United States, California" reads as a country with a footnote, which is
 * the exact misreading `sub-national` exists to prevent.
 */
export function describeLicencePlace(
  jurisdiction: string,
  subdivision: string | null
): string {
  const country = requirementFor(jurisdiction)?.country ?? jurisdiction;
  return subdivision ? `${subdivision}, ${country}` : country;
}

/** `YYYY-MM-DD` compared as a string — a Postgres `date` has no zone, and
 *  parsing it into a `Date` would shift the day for anyone west of UTC. */
function isExpired(expiresAt: string | null): boolean {
  return Boolean(expiresAt) && expiresAt! < new Date().toISOString().slice(0, 10);
}

export default function LicenceReviewCard({
  licence,
  showDecision = true,
}: Readonly<{
  licence: TherapistLicenceRow;
  /** False on list rows, where a decision belongs after the evidence. */
  showDecision?: boolean;
}>) {
  const requirement = requirementFor(licence.jurisdiction);
  const place = describeLicencePlace(licence.jurisdiction, licence.subdivision);
  const expired = isExpired(licence.expiresAt);

  return (
    <div className="rounded-2xl border border-stone-200 bg-white shadow-sm p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-stone-800 break-words">{place}</h3>
          <p className="text-[11px] text-stone-400 mt-0.5">
            {licence.regulator ?? "No issuing body stated"}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {expired && <AdminBadge label="Expired" variant="danger" dot />}
          {kycBadge(licence.status)}
        </div>
      </div>

      {/*
        The three facts a reviewer checks, and no fourth one inferred from them.
        `licence_number` is shown because checking it against the issuing body's
        own register IS the job — a licence document only proves someone printed
        a document.
      */}
      <dl className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
        <div className="min-w-0">
          <dt className="text-[11px] text-stone-400 font-medium">Licence number</dt>
          <dd
            className={`mt-0.5 break-all ${
              licence.licenceNumber
                ? "font-mono text-xs text-stone-800"
                : "text-stone-400 italic text-xs"
            }`}
          >
            {licence.licenceNumber ?? "Not provided"}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-[11px] text-stone-400 font-medium">Expires</dt>
          <dd
            className={`mt-0.5 text-xs ${
              expired ? "text-rose-700 font-semibold" : "text-stone-800"
            }`}
          >
            {licence.expiresAt ?? (
              <span className="text-stone-400 italic">Not stated</span>
            )}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-[11px] text-stone-400 font-medium">Submitted</dt>
          <dd className="mt-0.5 text-xs text-stone-800">
            {licence.submittedAt ? (
              licence.submittedAt.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })
            ) : (
              <span className="text-stone-400 italic">Never</span>
            )}
          </dd>
        </div>
      </dl>

      {expired && (
        <p className="mt-3 flex items-start gap-2 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
          <CalendarX2 className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>
            This licence expired on {licence.expiresAt}. A lapsed right to
            practise is a rejection, not a query — a licence can be held for life
            while the certificate to practise lapses annually.
          </span>
        </p>
      )}

      {/* ─── What this jurisdiction actually requires ───────────────────────── */}
      {requirement ? (
        <div className="mt-4 space-y-2">
          <p className="flex items-start gap-2 text-xs text-stone-600 bg-stone-50 border border-stone-100 rounded-xl p-3">
            <Info className="w-3.5 h-3.5 text-teal-600 flex-shrink-0 mt-0.5" />
            <span>{requirement.reviewerGuidance}</span>
          </p>

          {requirement.regulators.length > 0 && (
            <ul className="space-y-1">
              {requirement.regulators.map((body) => (
                <li
                  key={body}
                  className="flex items-start gap-2 text-[11px] text-stone-500"
                >
                  <BookOpenCheck className="w-3 h-3 flex-shrink-0 mt-0.5 text-stone-400" />
                  <span className="break-words">{body}</span>
                </li>
              ))}
            </ul>
          )}

          {/* The register, where one is known. A link, because "check the
              register" with no address is an instruction nobody follows. */}
          {requirement.registerUrl && (
            <a
              href={requirement.registerUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1.5 min-h-11 text-xs font-semibold text-teal-700 hover:text-teal-800"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Open the public register
            </a>
          )}

          {/*
            Stated to the reviewer, not buried. `needsLocalConfirmation` means
            nobody qualified has checked this country's requirements, so the
            list above is a starting point rather than a checklist — and
            `canListInJurisdiction` will keep the clinician out of the
            locally-licensed copy even after an approval.
          */}
          {requirement.needsLocalConfirmation && (
            <p className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
              <ShieldQuestion className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>
                No qualified local adviser has confirmed {requirement.country}
                &rsquo;s requirements yet. Approving records what you checked; it
                does NOT make Echo advertise this clinician as locally licensed
                there, which stays gated on that confirmation.
              </span>
            </p>
          )}
        </div>
      ) : (
        /* The column is free text so a market can be added without a migration,
           which means this is reachable. An approval is refused server-side. */
        <p className="mt-4 flex items-start gap-2 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
          <ShieldQuestion className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>
            <span className="font-semibold">
              &ldquo;{licence.jurisdiction}&rdquo; has no entry in
              lib/licensing.ts.
            </span>{" "}
            There is no guidance to review it against, and the server will refuse
            a decision until one exists.
          </span>
        </p>
      )}

      {licence.reviewNote && (
        <div className="mt-3 bg-stone-50 border border-stone-200 rounded-xl p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-500 mb-1">
            Note shown to the therapist
          </p>
          <p className="text-sm text-stone-700 whitespace-pre-wrap break-words">
            {licence.reviewNote}
          </p>
        </div>
      )}

      {licence.reviewedAt && (
        <p className="mt-2 text-[11px] text-stone-400 break-all">
          Decided{" "}
          {licence.reviewedAt.toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}
          {/* The raw Auth0 sub when that is all there is. "Admin" would be a
              guess about who approved a clinician's right to practise. */}
          {licence.reviewedBy ? ` by ${licence.reviewedBy}` : ""}
        </p>
      )}

      {showDecision && (
        <div className="mt-4 pt-4 border-t border-stone-100">
          <LicenceReviewActions
            licenceId={licence.id}
            place={place}
            status={licence.status}
            verification={licence.verification}
            /* Computed here so the control and `reviewLicenceAction` read the
               same function. The control is not the authority — the action
               refuses a mode this list excludes — but a UI that offers
               "regulator verified" for a jurisdiction Echo has not established
               is an invitation to claim it. */
            allowedVerifications={allowedVerificationsFor(licence.jurisdiction)}
            verificationMode={requirement?.verification ?? "case-by-case"}
          />
        </div>
      )}
    </div>
  );
}
