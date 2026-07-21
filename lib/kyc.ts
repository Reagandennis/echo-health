/**
 * Therapist credentialing rules — the single source of truth for what a
 * clinician must provide before they may see patients.
 *
 * This file exists because the previous answer to "what did we check" was
 * scattered across a hardcoded checklist in an admin page, an optional file
 * input on the onboarding form, and a single enum column. None of them agreed,
 * and the checklist asserted verifications that had never happened.
 *
 * Requirements live HERE, in code, rather than in the database, because they
 * are policy rather than data: changing them should be a reviewed diff with a
 * date attached, not an UPDATE nobody can find afterwards.
 */

/** Mirrors the `kyc_document_type` enum in migration 0013. */
export type KycDocumentType =
  | "government_id"
  | "professional_license"
  | "practising_certificate"
  | "qualification"
  | "insurance"
  | "other";

/** Mirrors the `kyc_doc_review` enum. */
export type KycDocReview = "pending" | "accepted" | "rejected";

/** Mirrors the `kyc_status` enum on `therapists`. */
export type KycStatus = "incomplete" | "pending" | "verified" | "rejected";

export interface KycDocumentSpec {
  readonly type: KycDocumentType;
  readonly label: string;
  /** Shown on the upload form. Say what a good submission looks like. */
  readonly help: string;
  /**
   * Whether an application can be submitted without it.
   *
   * Only make something required when you would genuinely refuse an otherwise
   * excellent clinician for its absence — a required field that reviewers wave
   * through teaches everyone that requirements are decorative.
   */
  readonly required: boolean;
  /** What the REVIEWER should confirm. Rendered beside the document in admin. */
  readonly reviewerGuidance: string;
}

/**
 * Ordered as the applicant should work through them: identity first, then the
 * right to practise, then supporting evidence.
 *
 * `insurance` is optional because indemnity cover is not universally held by
 * Kenyan practitioners and requiring it would exclude qualified clinicians. It
 * is still collected, because knowing who carries cover matters the day
 * something goes wrong.
 */
export const KYC_DOCUMENT_SPECS: readonly KycDocumentSpec[] = [
  {
    type: "government_id",
    label: "Government ID",
    help: "Passport, national ID or driving licence. The name must match the name on your profile.",
    required: true,
    reviewerGuidance:
      "Confirm the document is legible, unexpired, and the name matches the profile name exactly. A mismatch is not a formality — it is the whole identity check.",
  },
  {
    type: "professional_license",
    label: "Professional licence",
    help: "Your licence or registration certificate from the body that regulates your practice.",
    required: true,
    reviewerGuidance:
      "Check the registration number against the issuing body's public register YOURSELF. A licence document proves someone printed a document; the register proves the licence is current and not suspended.",
  },
  {
    type: "practising_certificate",
    label: "Current practising certificate",
    help: "The certificate for the current period, if your regulator issues one separately from your licence.",
    required: true,
    reviewerGuidance:
      "Confirm it covers TODAY. A licence can be held for life while the right to practise lapses annually — this is the document that expires, and the one most often out of date.",
  },
  {
    type: "qualification",
    label: "Highest qualification",
    help: "Your degree or diploma certificate in psychology, counselling, psychiatry or an equivalent field.",
    required: true,
    reviewerGuidance:
      "Check the awarding institution actually exists and the field is clinical. This is where fabricated credentials are easiest to spot and easiest to skim past.",
  },
  {
    type: "insurance",
    label: "Professional indemnity insurance",
    help: "Your certificate of cover, if you hold one. Optional, but it tells us who is covered if something goes wrong.",
    required: false,
    reviewerGuidance:
      "If provided, note the expiry and the cover limit. Absence is acceptable; an expired certificate presented as current is not.",
  },
  {
    type: "other",
    label: "Supporting document",
    help: "Anything else we have specifically asked you for.",
    required: false,
    reviewerGuidance:
      "Only relevant if it was requested. An unrequested document does not satisfy any requirement above.",
  },
] as const;

const SPEC_BY_TYPE = new Map(KYC_DOCUMENT_SPECS.map((s) => [s.type, s]));

export function kycDocumentSpec(type: KycDocumentType): KycDocumentSpec | undefined {
  return SPEC_BY_TYPE.get(type);
}

export function kycDocumentLabel(type: string): string {
  return SPEC_BY_TYPE.get(type as KycDocumentType)?.label ?? type;
}

export const REQUIRED_KYC_TYPES: readonly KycDocumentType[] = KYC_DOCUMENT_SPECS.filter(
  (s) => s.required
).map((s) => s.type);

/**
 * Which required document types are still missing from `provided`.
 *
 * Takes the types the applicant has actually uploaded and returns the gap. Used
 * on both sides: the onboarding form disables submission while this is
 * non-empty, and the server re-checks it, because a disabled button is a
 * courtesy and not a control.
 */
export function missingRequiredTypes(
  provided: readonly string[]
): readonly KycDocumentType[] {
  const have = new Set(provided);
  return REQUIRED_KYC_TYPES.filter((t) => !have.has(t));
}

/** True when every required document type is present. */
export function hasAllRequiredTypes(provided: readonly string[]): boolean {
  return missingRequiredTypes(provided).length === 0;
}

/**
 * Whether an application in `status` may be submitted (or resubmitted).
 *
 * `verified` is excluded so an approved clinician cannot re-open their own
 * application and sit in the queue unreviewed while retaining access.
 */
export function canSubmitForReview(status: KycStatus): boolean {
  return status === "incomplete" || status === "rejected";
}

/**
 * How a status should read to the THERAPIST. Deliberately not reused for the
 * admin UI, which needs different words for the same state.
 */
export const KYC_STATUS_COPY: Record<
  KycStatus,
  { readonly title: string; readonly body: string; readonly tone: "neutral" | "warning" | "success" | "danger" }
> = {
  incomplete: {
    title: "Your application is not yet submitted",
    body: "Upload the required documents to send your application for review.",
    tone: "neutral",
  },
  pending: {
    title: "Your application is under review",
    body: "Our clinical team is checking your documents. You will be emailed as soon as there is a decision.",
    tone: "warning",
  },
  verified: {
    title: "You are verified",
    body: "Your credentials have been reviewed and approved. You can accept clients.",
    tone: "success",
  },
  rejected: {
    title: "Your application needs attention",
    body: "We could not approve your application as submitted. See the reviewer's note below, then resubmit.",
    tone: "danger",
  },
};
