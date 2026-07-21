"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle,
  FileSearch,
  Info,
  Loader2,
  MessageSquareWarning,
  XCircle,
} from "lucide-react";

import { submitKycReview } from "./kycReviewApi";

/** The therapist-level decisions the review API accepts. */
type Decision = "approve" | "reject" | "request_changes";

/** Decisions the server will not accept without a written reason. */
const REQUIRES_NOTE: ReadonlySet<Decision> = new Set(["reject", "request_changes"]);

/** Matches `varchar(1000)` on `therapists.kyc_review_note`. */
const NOTE_MAX = 1000;

interface Props {
  /** A `therapists.id` uuid, named for the Appwrite-era field the JSX still uses. */
  therapistDocId: string;
  currentStatus: string;
  /**
   * Human-readable labels of required document types with no ACCEPTED document.
   *
   * When non-empty the server WILL refuse an approval, so the button is disabled
   * and says which documents are outstanding. This is an optimisation of the
   * admin's time, not a control: the server re-checks, and its refusal is
   * rendered if it happens anyway.
   */
  missingRequired?: readonly string[];
  /**
   * Where to send an admin who cannot approve from here. Supplied by the queue,
   * which must not offer a one-click approval for an application nobody has
   * opened — the whole reason this screen was rebuilt.
   */
  reviewHref?: string;
  /** `compact` for list rows and page headers, `full` for the review panel. */
  variant?: "compact" | "full";
}

export default function TherapistKycActions({
  therapistDocId,
  currentStatus,
  missingRequired = [],
  reviewHref,
  variant = "compact",
}: Readonly<Props>) {
  const router = useRouter();

  const [status, setStatus] = useState(currentStatus);
  const [pending, setPending] = useState<Decision | null>(null);
  /** Which decision is currently collecting its mandatory note, if any. */
  const [capturing, setCapturing] = useState<Decision | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const blocked = missingRequired.length > 0;

  async function send(action: Decision, body: string) {
    setPending(action);
    setError(null);
    setNotice(null);
    setWarnings([]);

    const trimmed = body.trim();
    const result = await submitKycReview(
      action === "approve"
        ? { therapistDocId, action, ...(trimmed ? { note: trimmed } : {}) }
        : { therapistDocId, action, note: trimmed }
    );

    setPending(null);

    if (!result.ok) {
      setError(result.error ?? "The decision was not recorded.");
      return;
    }

    // `request_changes` deliberately does not move the local status: the server
    // owns what it becomes, and guessing here is how the old UI ended up
    // asserting states nobody had established.
    if (action === "approve") setStatus("verified");
    if (action === "reject") setStatus("rejected");

    setCapturing(null);
    setNote("");
    setNotice(result.notice ?? null);
    setWarnings(result.warnings);

    // Re-render the Server Components so the document states, the gap list and
    // the decision trail reflect what just happened.
    router.refresh();
  }

  function start(action: Decision) {
    setError(null);
    if (REQUIRES_NOTE.has(action)) {
      setCapturing(capturing === action ? null : action);
      return;
    }
    void send(action, "");
  }

  const messages = (
    <>
      {error && (
        <p
          role="alert"
          className="flex items-start gap-1.5 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2 text-left"
        >
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </p>
      )}
      {/* The decision was recorded, but a follow-up is outstanding — the Auth0
          role was not granted, or the therapist could not be emailed. Nothing
          else will surface these, so they are shown rather than logged. */}
      {warnings.map((w) => (
        <p
          key={w}
          className="flex items-start gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-left"
        >
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>{w}</span>
        </p>
      ))}
      {notice && (
        /* Kept from the previous component: roles are stamped into the session
           at login, so a freshly approved therapist keeps seeing the old claim
           until they sign out and back in. */
        <p className="flex items-start gap-1.5 text-xs text-teal-700 bg-teal-50 border border-teal-200 rounded-xl px-3 py-2 text-left">
          <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>{notice}</span>
        </p>
      )}
    </>
  );

  const noteField = capturing && (
    <div className="w-full sm:w-80 bg-white border border-stone-200 rounded-xl p-3 text-left shadow-sm">
      <label
        htmlFor={`kyc-note-${therapistDocId}`}
        className="block text-[11px] font-semibold uppercase tracking-wider text-stone-500 mb-1.5"
      >
        {capturing === "reject" ? "Reason for rejection" : "What needs to change"}
      </label>
      <p className="text-[11px] text-stone-500 mb-2">
        The therapist reads this. It is the only explanation they get, so it has
        to stand on its own.
      </p>
      <textarea
        id={`kyc-note-${therapistDocId}`}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={NOTE_MAX}
        rows={3}
        className="w-full text-sm text-stone-800 border border-stone-200 rounded-lg px-2.5 py-2 outline-none focus:border-teal-400 resize-y"
        placeholder={
          capturing === "reject"
            ? "e.g. The practising certificate expired in March and the licence number does not appear on the Board's register."
            : "e.g. Please upload a practising certificate covering the current period."
        }
      />
      <div className="flex items-center justify-between gap-2 mt-2">
        <span className="text-[11px] text-stone-400">
          {note.trim().length === 0
            ? "Required"
            : `${note.length}/${NOTE_MAX}`}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setCapturing(null);
              setNote("");
            }}
            className="px-2.5 py-1.5 text-xs font-medium text-stone-500 hover:text-stone-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void send(capturing, note)}
            disabled={note.trim().length === 0 || pending !== null}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-800 text-white text-xs font-semibold hover:bg-stone-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {pending === capturing && <Loader2 size={12} className="animate-spin" />}
            {capturing === "reject" ? "Reject application" : "Request changes"}
          </button>
        </div>
      </div>
    </div>
  );

  const wrapper =
    variant === "full"
      ? "flex flex-col gap-3"
      : "flex flex-col items-end gap-2";

  // ─── Terminal-ish states ───────────────────────────────────────────────────
  //
  // There is no "revoke" action in the review API, so this component does not
  // offer one. Migration 0013 withdrew the existing approvals in SQL; if
  // revocation becomes routine it needs a server action and a trail entry, not
  // a button here that guesses at a contract.
  if (status === "verified") {
    return (
      <div className={wrapper}>
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200 px-3 py-1 rounded-full">
          <CheckCircle size={12} /> Verified
        </span>
        {messages}
      </div>
    );
  }

  // ─── Blocked: documents are missing or unreviewed ──────────────────────────
  //
  // The queue used to render an Approve button here regardless. Approving from a
  // list row means approving a clinician whose documents were never opened,
  // which is exactly how every therapist in this database came to be marked
  // verified against zero evidence.
  if (blocked && variant === "compact") {
    return (
      <div className={wrapper}>
        {reviewHref ? (
          <Link
            href={reviewHref}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-50 border border-teal-200 text-teal-700 text-xs font-semibold hover:bg-teal-100 transition-colors"
          >
            <FileSearch size={12} /> Review documents
          </Link>
        ) : (
          <span className="text-xs text-stone-400">Review required</span>
        )}
        <span className="text-[11px] text-stone-400 text-right">
          {missingRequired.length} document
          {missingRequired.length === 1 ? "" : "s"} outstanding
        </span>
      </div>
    );
  }

  return (
    <div className={wrapper}>
      <div
        className={
          variant === "full"
            ? "flex flex-wrap gap-2"
            : "flex items-center gap-2 shrink-0"
        }
      >
        <button
          type="button"
          onClick={() => start("approve")}
          disabled={pending !== null || blocked}
          title={
            blocked
              ? `Blocked — no accepted document for: ${missingRequired.join(", ")}`
              : undefined
          }
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold hover:bg-emerald-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {pending === "approve" ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <CheckCircle size={12} />
          )}
          Approve
        </button>

        <button
          type="button"
          onClick={() => start("request_changes")}
          disabled={pending !== null}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors disabled:opacity-40 ${
            capturing === "request_changes"
              ? "bg-amber-100 border-amber-300 text-amber-800"
              : "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100"
          }`}
        >
          <MessageSquareWarning size={12} /> Request changes
        </button>

        <button
          type="button"
          onClick={() => start("reject")}
          disabled={pending !== null}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors disabled:opacity-40 ${
            capturing === "reject"
              ? "bg-rose-100 border-rose-300 text-rose-800"
              : "bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100"
          }`}
        >
          <XCircle size={12} /> Reject
        </button>
      </div>

      {blocked && (
        <p className="text-[11px] text-stone-500 text-left">
          Approval is blocked until an accepted document exists for:{" "}
          <span className="font-semibold text-stone-700">
            {missingRequired.join(", ")}
          </span>
          .
        </p>
      )}

      {status === "incomplete" && (
        <p className="text-[11px] text-stone-400 text-left">
          This applicant has not submitted for review.
        </p>
      )}

      {noteField}
      {messages}
    </div>
  );
}
