"use client";

import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Globe2,
  Loader2,
  Lock,
  MapPin,
  Pencil,
  Plus,
  Send,
  ShieldQuestion,
  X,
} from "lucide-react";

import {
  requirementFor,
  requiresSubdivision,
  selectableJurisdictions,
} from "@/lib/licensing";
import type { KycStatus } from "@/lib/kyc";
import {
  submitLicenceForReviewAction,
  upsertTherapistLicenceAction,
  type MyLicence,
} from "@/app/actions/licensing";

/**
 * ── Where the applicant is licensed ────────────────────────────────────────
 *
 * ## The problem this step exists to fix
 *
 * Every clinician on Echo was licensed in Kenya, and every client — in thirteen
 * countries — got one of them. In the user's words: *"it's a red flag for a UK
 * or US citizen getting therapy from a therapist in Kenya."* A therapist can
 * now hold one licence per jurisdiction, each verified separately, and this is
 * where they claim them.
 *
 * ## What this form may NOT send, and why the payloads are hand-built
 *
 * `therapist_licences_guard` (migration 0018) refuses a non-admin who writes
 * `verification`, `reviewed_at`, `reviewed_by`, a non-null `review_note`, or any
 * `status` other than `incomplete` on insert. It raises rather than returning
 * zero rows, and a raise inside the transaction takes the whole write with it —
 * so a form that sends the reviewer's conclusion is a form that cannot save
 * ANYTHING, and the applicant sees an untranslated Postgres error.
 *
 * That is why every payload below is an explicit object literal with exactly
 * the five fields the applicant owns. No spread of form state, no `...licence`,
 * no "send it all and let the server sort it out". The guarded columns are not
 * in the component's state at all, so there is nothing to leak into a payload.
 *
 * The one transition an applicant may make is `incomplete`/`rejected` →
 * `pending`, and it is its own explicit act: `submitLicenceForReviewAction`.
 */

/** The five fields an applicant owns. Mirrors `licenceUpsertSchema`. */
interface Draft {
  /** Present when editing a claim, absent when making a new one. */
  readonly id?: string;
  jurisdiction: string;
  subdivision: string;
  regulator: string;
  licenceNumber: string;
  /** `YYYY-MM-DD`, straight from `<input type="date">`. */
  expiresAt: string;
}

function emptyDraft(jurisdiction: string): Draft {
  return {
    jurisdiction,
    subdivision: "",
    regulator: "",
    licenceNumber: "",
    expiresAt: "",
  };
}

const STATUS_CHIP: Record<
  KycStatus,
  { readonly label: string; readonly className: string; readonly Icon: typeof Clock }
> = {
  incomplete: {
    label: "Not submitted",
    className: "bg-stone-100 text-stone-600",
    Icon: Pencil,
  },
  pending: {
    label: "Awaiting review",
    className: "bg-amber-100 text-amber-800",
    Icon: Clock,
  },
  verified: {
    label: "Verified",
    className: "bg-emerald-100 text-emerald-800",
    Icon: CheckCircle2,
  },
  rejected: {
    label: "Not approved",
    className: "bg-red-100 text-red-800",
    Icon: AlertTriangle,
  },
};

function placeOf(licence: MyLicence): string {
  const country = requirementFor(licence.jurisdiction)?.country ?? licence.jurisdiction;
  /* Subdivision first: it is the body that actually licensed them. */
  return licence.subdivision ? `${licence.subdivision}, ${country}` : country;
}

interface Props {
  readonly licences: readonly MyLicence[];
  /** Re-read from the server. Never patched locally — the row is the truth. */
  readonly onChanged: () => Promise<void>;
  readonly onError: (message: string | null) => void;
  /**
   * False while the application is `pending`: a reviewer may be part-way
   * through assessing exactly these claims. A `verified` clinician IS editable
   * here — adding a jurisdiction later is the point of the feature — and each
   * individual licence is locked by its own status regardless.
   */
  readonly editable: boolean;
}

export default function JurisdictionStep({
  licences,
  onChanged,
  onError,
  editable,
}: Props) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState<string | null>(null);

  const jurisdictions = selectableJurisdictions();
  const requirement = draft ? requirementFor(draft.jurisdiction) : undefined;
  const needsSubdivision = draft ? requiresSubdivision(draft.jurisdiction) : false;

  async function save() {
    if (!draft) return;
    setSaving(true);
    onError(null);
    try {
      /*
       * Built field by field. Empty optional fields are OMITTED rather than sent
       * as "" — `licenceUpsertSchema` requires a non-empty trimmed string when a
       * field is present, so an empty box would be a validation failure instead
       * of "not stated".
       */
      await upsertTherapistLicenceAction({
        ...(draft.id ? { id: draft.id } : {}),
        jurisdiction: draft.jurisdiction,
        ...(needsSubdivision && draft.subdivision.trim()
          ? { subdivision: draft.subdivision.trim() }
          : {}),
        ...(draft.regulator.trim() ? { regulator: draft.regulator.trim() } : {}),
        ...(draft.licenceNumber.trim()
          ? { licenceNumber: draft.licenceNumber.trim() }
          : {}),
        ...(draft.expiresAt ? { expiresAt: draft.expiresAt } : {}),
      });
      setDraft(null);
      await onChanged();
    } catch (err: unknown) {
      /* The server's sentence, verbatim. Both the schema and the guard produce
         messages an applicant can act on; replacing them with "Could not save"
         is how a fixable subdivision error becomes a support ticket. */
      onError(err instanceof Error ? err.message : "Could not save that licence.");
    } finally {
      setSaving(false);
    }
  }

  async function submitOne(licenceId: string) {
    setSubmitting(licenceId);
    onError(null);
    try {
      await submitLicenceForReviewAction(licenceId);
      await onChanged();
    } catch (err: unknown) {
      onError(
        err instanceof Error ? err.message : "Could not submit that licence."
      );
    } finally {
      setSubmitting(null);
    }
  }

  const canSubmitDraft =
    Boolean(draft) && (!needsSubdivision || Boolean(draft?.subdivision.trim()));

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-stone-900 flex items-center gap-2">
          <Globe2 size={20} className="text-brand" /> Where you are licensed
        </h2>
        <p className="text-sm text-stone-500 mt-1">
          One entry per place you may lawfully practise. We show clients whether
          their therapist is licensed where <em>they</em> are, so this has to be
          accurate rather than generous.
        </p>
      </div>

      {/* ─── What has been claimed so far ──────────────────────────────────── */}
      {licences.length === 0 ? (
        <p className="text-sm text-stone-500 bg-stone-50 border border-stone-200 rounded-xl px-4 py-3">
          You have not added a jurisdiction yet. At least one is required before
          you can submit your application.
        </p>
      ) : (
        <ul className="space-y-3">
          {licences.map((licence) => {
            const chip = STATUS_CHIP[licence.status];
            const own = editable && (licence.status === "incomplete" || licence.status === "rejected");
            return (
              <li
                key={licence.id}
                className="rounded-xl border border-stone-200 bg-white p-4"
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-stone-900 break-words">
                      {placeOf(licence)}
                    </p>
                    <p className="text-xs text-stone-500 mt-0.5 break-words">
                      {licence.regulator ?? "No issuing body stated"}
                      {licence.licenceNumber ? ` · ${licence.licenceNumber}` : ""}
                      {licence.expiresAt ? ` · expires ${licence.expiresAt}` : ""}
                    </p>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1.5 shrink-0 px-2.5 py-1 rounded-full text-[11px] font-semibold ${chip.className}`}
                  >
                    <chip.Icon size={12} /> {chip.label}
                  </span>
                </div>

                {/* The reviewer's reason. On a rejection it is the only
                    explanation they get, so it sits above the fix-it controls. */}
                {licence.status === "rejected" && licence.reviewNote && (
                  <p className="mt-3 text-sm text-red-800 bg-red-50 border border-red-200 rounded-lg px-3 py-2 whitespace-pre-line break-words">
                    {licence.reviewNote}
                  </p>
                )}

                {licence.status === "pending" && (
                  <p className="mt-3 flex items-start gap-1.5 text-xs text-stone-500">
                    <Lock size={12} className="mt-0.5 shrink-0" />
                    Locked while it is being reviewed — a reviewer may be looking
                    at exactly these details.
                  </p>
                )}

                {licence.status === "verified" && (
                  <p className="mt-3 flex items-start gap-1.5 text-xs text-stone-500">
                    <Lock size={12} className="mt-0.5 shrink-0" />
                    Verified details cannot be edited. Contact us if something
                    here is wrong — and add a new entry for any other place you
                    are licensed.
                  </p>
                )}

                {own && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onError(null);
                        setDraft({
                          id: licence.id,
                          jurisdiction: licence.jurisdiction,
                          subdivision: licence.subdivision ?? "",
                          regulator: licence.regulator ?? "",
                          licenceNumber: licence.licenceNumber ?? "",
                          expiresAt: licence.expiresAt ?? "",
                        });
                      }}
                      className="flex items-center gap-1.5 min-h-11 px-3 rounded-xl border border-stone-200 text-xs font-semibold text-stone-600 hover:bg-stone-50 transition-colors"
                    >
                      <Pencil size={12} /> Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void submitOne(licence.id)}
                      disabled={submitting !== null}
                      className="flex items-center gap-1.5 min-h-11 px-3 rounded-xl bg-brand text-white text-xs font-semibold hover:bg-brand/90 disabled:opacity-40 transition-colors"
                    >
                      {submitting === licence.id ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Send size={12} />
                      )}
                      {licence.status === "rejected"
                        ? "Resubmit for review"
                        : "Submit for review"}
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* ─── Add or edit ────────────────────────────────────────────────────── */}
      {editable && !draft && (
        <button
          type="button"
          onClick={() => {
            onError(null);
            setDraft(emptyDraft(jurisdictions[0]?.slug ?? "kenya"));
          }}
          className="flex items-center gap-1.5 min-h-11 px-4 rounded-xl border border-brand/30 bg-cream text-brand text-sm font-semibold hover:bg-brand/5 transition-colors"
        >
          <Plus size={15} /> Add a jurisdiction
        </button>
      )}

      {draft && (
        <div className="rounded-xl border border-stone-200 bg-white p-4 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-sm font-bold text-stone-900">
              {draft.id ? "Edit this licence" : "Add a jurisdiction"}
            </h3>
            <button
              type="button"
              onClick={() => {
                setDraft(null);
                onError(null);
              }}
              aria-label="Cancel"
              className="flex items-center justify-center w-11 h-11 -mr-2 -mt-2 rounded-xl text-stone-400 hover:text-stone-600 hover:bg-stone-50 transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          <div>
            <label
              htmlFor="licence-jurisdiction"
              className="block text-sm font-medium text-stone-700 mb-1.5"
            >
              Country or territory
            </label>
            <select
              id="licence-jurisdiction"
              value={draft.jurisdiction}
              onChange={(e) =>
                /* Subdivision is cleared on a jurisdiction change. Carrying a
                   US state onto a Kenyan licence is refused by the schema —
                   Kenya licenses nationally — and it would be refused with an
                   error about a field the form is no longer showing. */
                setDraft({
                  ...draft,
                  jurisdiction: e.target.value,
                  subdivision: "",
                })
              }
              className="w-full min-h-11 rounded-xl border border-stone-200 px-4 py-3 text-sm text-stone-800 outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
            >
              {jurisdictions.map((j) => (
                <option key={j.slug} value={j.slug}>
                  {j.country}
                </option>
              ))}
            </select>
          </div>

          {/* ─── What this jurisdiction asks of you ─────────────────────────── */}
          {requirement && (
            <div className="space-y-2">
              <p className="text-xs text-stone-600 bg-stone-50 border border-stone-200 rounded-xl px-3 py-2.5 leading-relaxed">
                {requirement.applicantGuidance}
              </p>

              {/*
                Said plainly, not hidden. `needsLocalConfirmation` means nobody
                qualified has checked this country's requirements yet — and
                `lib/licensing.ts` is explicit that naming the wrong regulator is
                worse than naming none, because it manufactures confidence in a
                credential nobody verified. The applicant is owed the same
                honesty the reviewer gets.
              */}
              {requirement.needsLocalConfirmation && (
                <p className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 leading-relaxed">
                  <ShieldQuestion size={14} className="shrink-0 mt-0.5" />
                  <span>
                    <strong>
                      Echo has not yet confirmed what {requirement.country}{" "}
                      requires.
                    </strong>{" "}
                    {requirement.verification === "case-by-case"
                      ? "We do not have a register to check you against, so a person will read your documents and record what they actually evidence — reviewed case by case, not against a checklist."
                      : "The bodies we list for it have not been confirmed by a local adviser, so your licence is reviewed case by case rather than against a register."}{" "}
                    Until that confirmation exists we will not advertise you as
                    locally licensed there, even after your licence is approved.
                  </span>
                </p>
              )}
            </div>
          )}

          {/* ─── State or province, where licensure is sub-national ─────────── */}
          {needsSubdivision && (
            <div>
              <label
                htmlFor="licence-subdivision"
                className="block text-sm font-medium text-stone-700 mb-1.5"
              >
                State or province{" "}
                <span className="text-stone-400 font-normal">(required)</span>
              </label>
              <input
                id="licence-subdivision"
                value={draft.subdivision}
                onChange={(e) =>
                  setDraft({ ...draft, subdivision: e.target.value })
                }
                placeholder="e.g. California"
                className="w-full min-h-11 rounded-xl border border-stone-200 px-4 py-3 text-sm text-stone-800 outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
              />
              <p className="flex items-start gap-1.5 text-xs text-stone-500 mt-1.5">
                <MapPin size={12} className="mt-0.5 shrink-0" />
                {/* The reason this field is mandatory rather than helpful:
                    `therapist_licences_guard` refuses the row without it, and
                    "licensed in the United States" is not a claim that exists. */}
                Licensure here is issued by the state or province, not
                nationally. A licence in one does not let you see clients in
                another, and we will only list you for the ones you name.
              </p>
            </div>
          )}

          <div>
            <label
              htmlFor="licence-regulator"
              className="block text-sm font-medium text-stone-700 mb-1.5"
            >
              Who issued it
            </label>
            <input
              id="licence-regulator"
              value={draft.regulator}
              onChange={(e) => setDraft({ ...draft, regulator: e.target.value })}
              placeholder={
                requirement?.regulators[0]?.split(" — ")[0] ??
                "The body you are registered with"
              }
              className="w-full min-h-11 rounded-xl border border-stone-200 px-4 py-3 text-sm text-stone-800 outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="licence-number"
                className="block text-sm font-medium text-stone-700 mb-1.5"
              >
                Registration or licence number
              </label>
              <input
                id="licence-number"
                value={draft.licenceNumber}
                onChange={(e) =>
                  setDraft({ ...draft, licenceNumber: e.target.value })
                }
                placeholder="As it appears on the register"
                className="w-full min-h-11 rounded-xl border border-stone-200 px-4 py-3 text-sm text-stone-800 outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
              />
            </div>
            <div>
              <label
                htmlFor="licence-expiry"
                className="block text-sm font-medium text-stone-700 mb-1.5"
              >
                Expires{" "}
                <span className="text-stone-400 font-normal">(if it does)</span>
              </label>
              <input
                id="licence-expiry"
                type="date"
                value={draft.expiresAt}
                onChange={(e) => setDraft({ ...draft, expiresAt: e.target.value })}
                className="w-full min-h-11 rounded-xl border border-stone-200 px-4 py-3 text-sm text-stone-800 outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void save()}
              disabled={!canSubmitDraft || saving}
              title={
                canSubmitDraft ? undefined : "Name the state or province first"
              }
              className="flex items-center justify-center gap-2 min-h-11 px-4 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              {draft.id ? "Save changes" : "Add this jurisdiction"}
            </button>
            {/* Stated so nobody expects saving to be the same as submitting.
                Saving leaves the licence `incomplete`; submitting is the one
                status transition an applicant is allowed to make. */}
            <p className="text-xs text-stone-500">
              Saved as a draft — you submit it for review separately.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
