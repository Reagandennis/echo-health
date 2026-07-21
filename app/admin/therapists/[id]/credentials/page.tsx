import { getLoggedInUser } from "@/lib/auth/session";
import { redirect, notFound } from "next/navigation";
import {
  AlertTriangle,
  Clock,
  Download,
  FileText,
  Info,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";

import AdminPageHeader from "../../../_components/AdminPageHeader";
import AdminBadge, { kycBadge } from "../../../_components/AdminBadge";
import {
  getTherapistKycReview,
  type KycDocumentSummary,
  type KycReviewEventRow,
} from "../../../_lib/queries";
import {
  KYC_DOCUMENT_SPECS,
  kycDocumentLabel,
  type KycDocReview,
  type KycDocumentSpec,
} from "@/lib/kyc";
import TherapistKycActions from "../../TherapistKycActions";
import KycDocumentActions from "../../KycDocumentActions";

/**
 * Therapist credentialing review.
 *
 * WHAT THIS SCREEN USED TO DO, AND WHY NONE OF IT SURVIVED.
 *
 * The previous version rendered a four-row verification checklist in which
 * "Government ID — Verified" was a hardcoded string, shown for every therapist,
 * always, with no check behind it anywhere in the system. "Background Check —
 * Verified" was derived from the KYC flag; there is no background check in this
 * codebase. Licence type, issuing authority, issue date and expiry date were
 * literals — "Licensed Clinical Social Worker (LCSW)", "State Board of
 * Behavioral Sciences", "January 15, 2019" — presented as this specific
 * clinician's credentials. A Californian regulator, on a platform whose
 * clinicians practise in Kenya. The Approve All and Reject buttons had no
 * onClick handlers and did nothing. The upload box had no file input.
 *
 * Both therapists in this database were approved through that screen. It told
 * the admin that identity and background checks had passed while nothing had
 * been reviewed at all.
 *
 * These were deleted rather than finished. A fabricated field is worse than an
 * absent one: an empty state prompts someone to go and find the answer, whereas
 * a confident wrong one ends the enquiry. Everything below is a column in the
 * database or a constant in `lib/kyc.ts`. Where there is no data there is a gap,
 * stated as a gap.
 */
export default async function TherapistCredentialsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getLoggedInUser();
  if (!user || !user.labels?.includes("admin")) redirect("/dashboard");

  const { id } = await params;
  const review = await getTherapistKycReview(id);
  if (!review) notFound();

  const { therapist: t, documents, events, missingRequired } = review;

  // Group by the requirement each document is meant to satisfy, so the reviewer
  // reads "practising certificate: here is the file, here is what to check"
  // rather than an undifferentiated list of filenames.
  const groups = KYC_DOCUMENT_SPECS.map((spec) => ({
    spec,
    documents: documents.filter((d) => d.docType === spec.type),
  }));

  /*
   * Documents whose type matches no spec. The database enum and `lib/kyc.ts`
   * currently agree, so this is empty — but if a type is added to the enum and
   * not to the spec list, the alternative is that an identity document silently
   * fails to appear on the screen whose job is to display it.
   */
  const unclassified = documents.filter(
    (d) => !KYC_DOCUMENT_SPECS.some((s) => s.type === d.docType)
  );

  const missingLabels = missingRequired.map((type) => kycDocumentLabel(type));
  const unreviewed = documents.filter((d) => d.reviewStatus === "pending").length;

  return (
    <div>
      <AdminPageHeader
        title="Credentials & KYC review"
        description="Every field here comes from the database. Nothing on this page is asserted without a record behind it."
        breadcrumbs={[
          { label: "Therapists", href: "/admin/therapists" },
          { label: t.name, href: `/admin/therapists/${id}` },
          { label: "Credentials" },
        ]}
      />

      <div className="max-w-3xl space-y-6">
        {/* ─── Application status ─────────────────────────────────────────── */}
        <section className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6">
          <div className="flex items-center justify-between gap-3 mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-teal-100 rounded-xl flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-teal-600" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-stone-800">Application status</h2>
                <p className="text-xs text-stone-400">{t.name}</p>
              </div>
            </div>
            {kycBadge(t.kycStatus)}
          </div>

          <dl className="space-y-3 text-sm">
            <Field
              label="Licence number"
              /*
               * Stated by the applicant, not verified by anything. The reviewer
               * guidance for the professional licence says to check it against
               * the issuing body's own register — this field is the input to
               * that check, not its result, and is labelled so.
               */
              hint="As entered by the applicant — verify it against the regulator's register"
              value={t.licenseNumber ?? null}
              fallback="Not provided"
            />
            <Field
              label="Submitted for review"
              value={formatDateTime(t.kycSubmittedAt)}
              fallback="Never submitted"
            />
            <Field
              label="Last reviewed"
              value={formatDateTime(t.kycReviewedAt)}
              fallback="Never reviewed"
            />
            <Field
              label="Reviewed by"
              value={t.kycReviewedBy}
              fallback="—"
              mono
            />
            <Field label="Documents on file" value={String(documents.length)} />
          </dl>

          {t.kycReviewNote && (
            <div className="mt-4 bg-stone-50 border border-stone-200 rounded-xl p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-500 mb-1">
                Note shown to the therapist
              </p>
              <p className="text-sm text-stone-700 whitespace-pre-wrap">
                {t.kycReviewNote}
              </p>
            </div>
          )}

          {missingLabels.length > 0 && (
            <div className="mt-4 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3">
              <ShieldAlert className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-800">
                  Not approvable yet — {missingLabels.length} required document
                  {missingLabels.length === 1 ? "" : "s"} outstanding
                </p>
                <p className="text-xs text-amber-700 mt-0.5">
                  {missingLabels.join(", ")}. A required type counts only once a
                  reviewer has accepted a document for it; an uploaded but
                  unreviewed file is not evidence of anything.
                </p>
              </div>
            </div>
          )}

          {missingLabels.length === 0 && unreviewed > 0 && (
            <p className="mt-4 flex items-start gap-2 text-xs text-stone-500">
              <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              Every required type has an accepted document. {unreviewed} further
              document{unreviewed === 1 ? " is" : "s are"} still awaiting a
              decision.
            </p>
          )}
        </section>

        {/* ─── Documents ──────────────────────────────────────────────────── */}
        <section className="space-y-4">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-sm font-bold text-stone-800">Submitted documents</h2>
            <p className="text-xs text-stone-400">
              {documents.length} file{documents.length === 1 ? "" : "s"} ·{" "}
              {unreviewed} awaiting a decision
            </p>
          </div>

          {groups.map(({ spec, documents: docs }) => (
            <DocumentGroup
              key={spec.type}
              spec={spec}
              documents={docs}
              therapistDocId={t.$id}
            />
          ))}

          {unclassified.length > 0 && (
            <div className="bg-white rounded-2xl border border-rose-200 shadow-sm p-5">
              <h3 className="text-sm font-bold text-rose-700 mb-1">
                Unrecognised document type
              </h3>
              <p className="text-xs text-stone-500 mb-3">
                These carry a type this build does not know about. They satisfy no
                requirement until `lib/kyc.ts` describes them.
              </p>
              <div className="space-y-3">
                {unclassified.map((doc) => (
                  <DocumentRow
                    key={doc.id}
                    doc={doc}
                    therapistDocId={t.$id}
                    label={kycDocumentLabel(doc.docType)}
                  />
                ))}
              </div>
            </div>
          )}
        </section>

        {/* ─── Decision ───────────────────────────────────────────────────── */}
        {/*
          Placed AFTER the documents, deliberately. The buttons that were here
          before sat above everything, did nothing, and were labelled
          "Approve All" — an instruction to skip the reading. A decision belongs
          at the end of the evidence.
        */}
        <section className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6">
          <h2 className="text-sm font-bold text-stone-800 mb-1">Decision</h2>
          <p className="text-xs text-stone-400 mb-4">
            Recorded against your account in an append-only trail. Rejections and
            change requests are shown to the therapist verbatim.
          </p>
          <TherapistKycActions
            therapistDocId={t.$id}
            currentStatus={t.kycStatus}
            missingRequired={missingLabels}
            variant="full"
          />
        </section>

        {/* ─── Decision trail ─────────────────────────────────────────────── */}
        <ReviewTrail events={events} />
      </div>
    </div>
  );
}

// ─── Pieces ──────────────────────────────────────────────────────────────────

function Field({
  label,
  value,
  hint,
  fallback = "—",
  mono = false,
}: Readonly<{
  label: string;
  value: string | null;
  hint?: string;
  fallback?: string;
  mono?: boolean;
}>) {
  return (
    <div className="flex justify-between items-start gap-4 py-2 border-b border-stone-50 last:border-0">
      <div>
        <dt className="text-xs text-stone-400 font-medium">{label}</dt>
        {hint && <p className="text-[11px] text-stone-300 mt-0.5">{hint}</p>}
      </div>
      <dd
        className={`text-sm text-right ${
          value ? "text-stone-800 font-medium" : "text-stone-400 italic"
        } ${mono && value ? "font-mono text-xs" : ""}`}
      >
        {value ?? fallback}
      </dd>
    </div>
  );
}

function DocumentGroup({
  spec,
  documents,
  therapistDocId,
}: Readonly<{
  spec: KycDocumentSpec;
  documents: KycDocumentSummary[];
  therapistDocId: string;
}>) {
  const accepted = documents.some((d) => d.reviewStatus === "accepted");
  // A gap is only a gap when the requirement is real. An optional type with no
  // upload is a fact, not a problem, and must not be styled like one.
  const isGap = spec.required && !accepted;

  return (
    <div
      className={`bg-white rounded-2xl border shadow-sm p-5 ${
        isGap ? "border-amber-200" : "border-stone-200"
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-stone-800">{spec.label}</h3>
          {spec.required ? (
            <AdminBadge label="Required" variant="purple" />
          ) : (
            <AdminBadge label="Optional" variant="neutral" />
          )}
        </div>
        {accepted && <AdminBadge label="Requirement met" variant="success" dot />}
      </div>

      {/* The reviewer's instructions for THIS document type, from lib/kyc.ts.
          Rendered next to the file rather than in a policy document nobody
          opens while holding a PDF. */}
      <p className="flex items-start gap-2 text-xs text-stone-600 bg-stone-50 border border-stone-100 rounded-xl p-3 mb-4">
        <Info className="w-3.5 h-3.5 text-teal-600 flex-shrink-0 mt-0.5" />
        <span>{spec.reviewerGuidance}</span>
      </p>

      {spec.type === "other" && documents.length > 0 && (
        <p className="text-[11px] text-stone-400 mb-3">
          Uploads made before document types existed were backfilled as
          &ldquo;other&rdquo; by migration 0013. Nobody stated what they are, and
          accepting one satisfies no requirement above.
        </p>
      )}

      {documents.length === 0 ? (
        isGap ? (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800">Not provided</p>
              <p className="text-xs text-amber-700 mt-0.5">
                This document is required. The application cannot be approved
                until one is uploaded and accepted.
              </p>
            </div>
          </div>
        ) : (
          <p className="text-xs text-stone-400 italic">Not provided. Optional.</p>
        )
      ) : (
        <div className="space-y-3">
          {documents.map((doc) => (
            <DocumentRow
              key={doc.id}
              doc={doc}
              therapistDocId={therapistDocId}
              label={spec.label}
            />
          ))}
          {isGap && (
            <p className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              Provided, but not accepted. This requirement is not met until a
              reviewer accepts one of these documents.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function DocumentRow({
  doc,
  therapistDocId,
  label,
}: Readonly<{
  doc: KycDocumentSummary;
  therapistDocId: string;
  label: string;
}>) {
  return (
    <div className="border border-stone-100 rounded-xl p-3 bg-stone-50/60">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-2 min-w-0">
          <FileText className="w-4 h-4 text-stone-400 flex-shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-stone-800 break-all">
              {doc.filename}
            </p>
            <p className="text-[11px] text-stone-400 mt-0.5">
              {formatBytes(doc.sizeBytes)} · {doc.mimeType} · uploaded{" "}
              {formatDateTime(doc.uploadedAt)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {docReviewBadge(doc.reviewStatus)}
          {/*
            A plain link to the attachment endpoint, NOT an <img>/<iframe>
            preview. `/api/kyc/[id]` sends Content-Disposition: attachment
            precisely because rendering a user-uploaded file in-origin is a
            stored-XSS vector — a crafted SVG or HTML upload would execute
            against an admin session. Do not "improve" this into an inline
            viewer.
          */}
          <a
            href={`/api/kyc/${doc.id}`}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold text-stone-600 bg-white border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors"
          >
            <Download className="w-3 h-3" /> Download
          </a>
        </div>
      </div>

      {doc.reviewNote && (
        <p className="mt-2 text-xs text-stone-600 bg-white border border-stone-200 rounded-lg px-2.5 py-2">
          <span className="font-semibold text-stone-500">Reviewer note: </span>
          {doc.reviewNote}
        </p>
      )}

      {doc.reviewedAt && (
        <p className="mt-2 text-[11px] text-stone-400">
          Decided {formatDateTime(doc.reviewedAt)}
          {doc.reviewedBy ? ` by ${doc.reviewedBy}` : ""}
        </p>
      )}

      <div className="mt-3">
        <KycDocumentActions
          therapistDocId={therapistDocId}
          documentId={doc.id}
          documentLabel={label}
          currentDecision={doc.reviewStatus}
        />
      </div>
    </div>
  );
}

/**
 * `kyc_review_events`, newest first.
 *
 * This is the answer to "who approved this clinician, when, and on what
 * evidence" — the question asked after something has gone wrong, by someone who
 * will not accept a current-status column as an answer. The table grants
 * `echo_app` only SELECT and INSERT, so nothing rendered here can have been
 * edited after the fact.
 */
function ReviewTrail({ events }: Readonly<{ events: KycReviewEventRow[] }>) {
  return (
    <section className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6">
      <div className="flex items-center gap-2 mb-1">
        <Clock className="w-4 h-4 text-stone-400" />
        <h2 className="text-sm font-bold text-stone-800">Decision trail</h2>
      </div>
      <p className="text-xs text-stone-400 mb-4">
        Append-only. Entries cannot be edited or removed.
      </p>

      {events.length === 0 ? (
        <p className="text-sm text-stone-400 italic">
          No decisions recorded for this therapist.
        </p>
      ) : (
        <ol className="space-y-3">
          {events.map((e) => {
            const copy = eventCopy(e.action);
            return (
              <li
                key={e.id}
                className="flex gap-3 pb-3 border-b border-stone-50 last:border-0 last:pb-0"
              >
                <div className="flex-shrink-0 mt-0.5">
                  <AdminBadge label={copy.label} variant={copy.variant} dot />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-stone-500">
                    {formatDateTime(e.createdAt)} ·{" "}
                    {/* The raw Auth0 sub when no profile resolves the name. An
                        unresolved actor is shown as an id, never as "Admin". */}
                    <span className={e.actorName ? "" : "font-mono"}>
                      {e.actorName ?? e.actorId}
                    </span>
                  </p>
                  {e.documentId && (
                    <p className="text-xs text-stone-600 mt-0.5">
                      {e.documentFilename ? (
                        <>
                          {e.documentType
                            ? `${kycDocumentLabel(e.documentType)}: `
                            : ""}
                          <span className="break-all">{e.documentFilename}</span>
                        </>
                      ) : (
                        /* ON DELETE SET NULL keeps the event when the document
                           goes; the decision still happened. */
                        <span className="italic text-stone-400">
                          document since deleted
                        </span>
                      )}
                    </p>
                  )}
                  {e.note && (
                    <p className="text-sm text-stone-700 mt-1 whitespace-pre-wrap">
                      {e.note}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

// ─── Formatting ──────────────────────────────────────────────────────────────

type BadgeVariant = Parameters<typeof AdminBadge>[0]["variant"];

/**
 * `action` is free text in the database on purpose — a log that rejects a write
 * because someone added an action name has failed at its job. So this maps the
 * known values and falls back to the raw string rather than dropping the entry.
 */
function eventCopy(action: string): { label: string; variant: BadgeVariant } {
  const map: Record<string, { label: string; variant: BadgeVariant }> = {
    submitted: { label: "Submitted", variant: "info" },
    approved: { label: "Approved", variant: "success" },
    rejected: { label: "Rejected", variant: "danger" },
    changes_requested: { label: "Changes requested", variant: "warning" },
    revoked: { label: "Revoked", variant: "danger" },
    document_accepted: { label: "Document accepted", variant: "success" },
    document_rejected: { label: "Document rejected", variant: "danger" },
  };
  return (
    map[action] ?? { label: action.replace(/_/g, " "), variant: "neutral" }
  );
}

function docReviewBadge(status: KycDocReview) {
  const map: Record<KycDocReview, { label: string; variant: BadgeVariant }> = {
    accepted: { label: "Accepted", variant: "success" },
    rejected: { label: "Rejected", variant: "danger" },
    pending: { label: "Not reviewed", variant: "warning" },
  };
  const cfg = map[status];
  return <AdminBadge label={cfg.label} variant={cfg.variant} dot />;
}

/**
 * Deliberately a local copy rather than an import from the onboarding uploader:
 * this page must not take a dependency on a file in another surface's tree just
 * to render "240 KB".
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDateTime(value: Date | null): string | null {
  if (!value) return null;
  return value.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
