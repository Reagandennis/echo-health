"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle,
  Loader2,
  ShieldQuestion,
  XCircle,
} from "lucide-react";

import { reviewLicenceAction } from "@/app/actions/licensing";
import type { VerificationMode } from "@/lib/licensing";

/** Mirrors the `licence_verification` enum; see the note in `lib/validation.ts`. */
type LicenceVerification = "named_regulator" | "sub_national" | "case_by_case";

/** Matches `varchar(1000)` on `therapist_licences.review_note`. */
const NOTE_MAX = 1000;

/**
 * How each conclusion should read to the person recording it.
 *
 * Phrased as what the reviewer DID, not as a grade. "Verified" invites a click;
 * "I checked the number against the register myself" is a claim someone either
 * made or did not, and the wording is the only thing that makes the difference
 * visible at the moment of deciding.
 */
const VERIFICATION_COPY: Record<
  LicenceVerification,
  { readonly label: string; readonly detail: string }
> = {
  named_regulator: {
    label: "I checked the regulator's own register",
    detail:
      "The registration appears on the body's public register and is current — not merely issued.",
  },
  sub_national: {
    label: "I checked the state or province board's register",
    detail:
      "Verified with the named state or province, which is the only body that licenses here. This licence covers that subdivision and nothing wider.",
  },
  case_by_case: {
    label: "I read the documents and used judgement — no register checked",
    detail:
      "What the clinician is shown to clients will say their right to practise was assessed from documents, not confirmed against a register.",
  },
};

interface Props {
  /** A `therapist_licences.id` uuid. */
  readonly licenceId: string;
  /** "California, the United States" / "Kenya" — already formatted by the page. */
  readonly place: string;
  readonly status: string;
  readonly verification: LicenceVerification;
  /**
   * The conclusions this jurisdiction admits, from `allowedVerificationsFor`.
   *
   * Computed on the server and passed in rather than derived here, so the page
   * and the server action read the SAME function. For a `case-by-case`
   * jurisdiction this contains only `case_by_case` — which is the whole point
   * of that mode: Echo has not established which body regulates practice there,
   * so "regulator verified" is not a claim anyone can make, and an option
   * offering it would be an invitation to make it anyway.
   */
  readonly allowedVerifications: readonly LicenceVerification[];
  readonly verificationMode: VerificationMode;
}

export default function LicenceReviewActions({
  licenceId,
  place,
  status,
  verification,
  allowedVerifications,
  verificationMode,
}: Props) {
  const router = useRouter();

  const [pending, setPending] = useState<"approve" | "reject" | null>(null);
  const [capturing, setCapturing] = useState<"approve" | "reject" | null>(null);
  /** No default. A pre-selected conclusion is one nobody had to decide. */
  const [chosen, setChosen] = useState<LicenceVerification | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function send(action: "approve" | "reject") {
    setPending(action);
    setError(null);

    const trimmed = note.trim();
    try {
      if (action === "approve") {
        if (!chosen) throw new Error("Choose how you verified this licence.");
        await reviewLicenceAction({
          licenceId,
          action: "approve",
          verification: chosen,
          ...(trimmed ? { note: trimmed } : {}),
        });
      } else {
        await reviewLicenceAction({ licenceId, action: "reject", note: trimmed });
      }

      setCapturing(null);
      setNote("");
      setChosen(null);
      /* Re-render the Server Components rather than patching local state. The
         page owns what the row now says; guessing here is how a UI comes to
         assert a state nobody recorded. */
      router.refresh();
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "The decision was not recorded, and the server did not say why."
      );
    } finally {
      setPending(null);
    }
  }

  // ─── Already decided ───────────────────────────────────────────────────────
  //
  // No revoke control. `reviewLicenceAction` only accepts a `pending` licence,
  // and withdrawing a verified licence needs its own action and its own trail
  // entry — not a button here guessing at a contract that does not exist.
  if (status === "verified") {
    return (
      <p className="flex items-start gap-1.5 text-xs text-emerald-700">
        <CheckCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
        <span>
          Verified — recorded as{" "}
          <span className="font-semibold">
            {VERIFICATION_COPY[verification].label.toLowerCase()}
          </span>
          .
        </span>
      </p>
    );
  }

  if (status === "rejected") {
    return (
      <p className="flex items-start gap-1.5 text-xs text-rose-700">
        <XCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
        <span>Rejected. The clinician must correct it and resubmit.</span>
      </p>
    );
  }

  if (status !== "pending") {
    return (
      <p className="text-xs text-stone-400">
        Not submitted for review — there is nothing to decide yet.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            setError(null);
            setCapturing(capturing === "approve" ? null : "approve");
          }}
          disabled={pending !== null}
          className={`flex items-center gap-1.5 min-h-11 px-3 rounded-xl border text-xs font-semibold transition-colors disabled:opacity-40 ${
            capturing === "approve"
              ? "bg-emerald-100 border-emerald-300 text-emerald-800"
              : "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
          }`}
        >
          <CheckCircle size={13} /> Approve licence
        </button>
        <button
          type="button"
          onClick={() => {
            setError(null);
            setCapturing(capturing === "reject" ? null : "reject");
          }}
          disabled={pending !== null}
          className={`flex items-center gap-1.5 min-h-11 px-3 rounded-xl border text-xs font-semibold transition-colors disabled:opacity-40 ${
            capturing === "reject"
              ? "bg-rose-100 border-rose-300 text-rose-800"
              : "bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100"
          }`}
        >
          <XCircle size={13} /> Reject licence
        </button>
      </div>

      {/* ─── Approve: the conclusion has to be chosen, never defaulted ───── */}
      {capturing === "approve" && (
        <div className="rounded-xl border border-stone-200 bg-white p-3 space-y-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
              How did you verify {place}?
            </p>
            <p className="text-[11px] text-stone-500 mt-0.5">
              This is stored on the licence and is what clients are told. It is
              not derived from the jurisdiction — if you could not reach the
              register, say so.
            </p>
          </div>

          {verificationMode === "case-by-case" && (
            <p className="flex items-start gap-1.5 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2">
              <ShieldQuestion className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>
                Echo has not established which body regulates practice here, so
                there is no register to have checked against and{" "}
                <strong>&ldquo;regulator verified&rdquo; is not offered</strong>
                . Record what the documents actually evidence, and escalate if
                you cannot tell.
              </span>
            </p>
          )}

          <div className="space-y-2">
            {allowedVerifications.map((mode) => (
              <label
                key={mode}
                className={`flex items-start gap-2 min-h-11 rounded-lg border px-2.5 py-2 cursor-pointer transition-colors ${
                  chosen === mode
                    ? "border-teal-300 bg-teal-50"
                    : "border-stone-200 hover:bg-stone-50"
                }`}
              >
                <input
                  type="radio"
                  name={`licence-verification-${licenceId}`}
                  value={mode}
                  checked={chosen === mode}
                  onChange={() => setChosen(mode)}
                  className="mt-0.5 flex-shrink-0 accent-teal-600"
                />
                <span className="min-w-0">
                  <span className="block text-xs font-semibold text-stone-800">
                    {VERIFICATION_COPY[mode].label}
                  </span>
                  <span className="block text-[11px] text-stone-500 mt-0.5">
                    {VERIFICATION_COPY[mode].detail}
                  </span>
                </span>
              </label>
            ))}
          </div>

          <div>
            <label
              htmlFor={`licence-approve-note-${licenceId}`}
              className="block text-[11px] font-semibold uppercase tracking-wider text-stone-500 mb-1"
            >
              Note (optional)
            </label>
            <textarea
              id={`licence-approve-note-${licenceId}`}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={NOTE_MAX}
              rows={2}
              placeholder="e.g. Register checked 12 Sep; registration current to 31 Mar."
              className="w-full text-sm text-stone-800 border border-stone-200 rounded-lg px-2.5 py-2 outline-none focus:border-teal-400 resize-y"
            />
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setCapturing(null);
                setChosen(null);
                setNote("");
              }}
              className="min-h-11 px-2.5 text-xs font-medium text-stone-500 hover:text-stone-700"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void send("approve")}
              disabled={!chosen || pending !== null}
              className="flex items-center gap-1.5 min-h-11 px-3 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {pending === "approve" && (
                <Loader2 size={12} className="animate-spin" />
              )}
              Record approval
            </button>
          </div>
        </div>
      )}

      {/* ─── Reject: a reason is mandatory, server-side too ───────────────── */}
      {capturing === "reject" && (
        <div className="rounded-xl border border-stone-200 bg-white p-3 space-y-2">
          <label
            htmlFor={`licence-reject-note-${licenceId}`}
            className="block text-[11px] font-semibold uppercase tracking-wider text-stone-500"
          >
            Why is {place} not approved?
          </label>
          <p className="text-[11px] text-stone-500">
            The clinician reads this verbatim. It is the only explanation they
            get, so it has to stand on its own.
          </p>
          <textarea
            id={`licence-reject-note-${licenceId}`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={NOTE_MAX}
            rows={3}
            placeholder="e.g. The number given does not appear on the HCPC register. If you are BACP-registered, give the BACP number instead — we describe those differently."
            className="w-full text-sm text-stone-800 border border-stone-200 rounded-lg px-2.5 py-2 outline-none focus:border-rose-300 resize-y"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] text-stone-400">
              {note.trim().length === 0 ? "Required" : `${note.length}/${NOTE_MAX}`}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setCapturing(null);
                  setNote("");
                }}
                className="min-h-11 px-2.5 text-xs font-medium text-stone-500 hover:text-stone-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void send("reject")}
                disabled={note.trim().length === 0 || pending !== null}
                className="flex items-center gap-1.5 min-h-11 px-3 rounded-lg bg-stone-800 text-white text-xs font-semibold hover:bg-stone-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {pending === "reject" && (
                  <Loader2 size={12} className="animate-spin" />
                )}
                Record rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="flex items-start gap-1.5 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2"
        >
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
