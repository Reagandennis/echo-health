"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, Loader2, X } from "lucide-react";

import { submitKycReview, type KycDocumentDecision } from "./kycReviewApi";

/** Matches `varchar(1000)` on `kyc_documents.review_note`. */
const NOTE_MAX = 1000;

interface Props {
  /** A `therapists.id` uuid — the application this document belongs to. */
  therapistDocId: string;
  documentId: string;
  /** What the reviewer is deciding about, used in the note prompt. */
  documentLabel: string;
  currentDecision: "pending" | "accepted" | "rejected";
}

/**
 * Accept or reject ONE document.
 *
 * Per-document decisions are the mechanism that makes an overall approval mean
 * something: the server refuses to verify a therapist until every required type
 * has an accepted document, and the only way to accept one is from here, beside
 * the file and the guidance for checking it.
 *
 * Rejecting requires a note because the therapist is shown it and has to know
 * what to fix. Accepting does not — "this is a valid practising certificate" is
 * adequately expressed by the decision itself.
 */
export default function KycDocumentActions({
  therapistDocId,
  documentId,
  documentLabel,
  currentDecision,
}: Readonly<Props>) {
  const router = useRouter();

  const [decision, setDecision] = useState(currentDecision);
  const [pending, setPending] = useState<KycDocumentDecision | null>(null);
  const [capturingNote, setCapturingNote] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function send(next: KycDocumentDecision, body: string) {
    setPending(next);
    setError(null);

    const trimmed = body.trim();
    const result = await submitKycReview({
      therapistDocId,
      action: "review_document",
      documentId,
      decision: next,
      ...(trimmed ? { note: trimmed } : {}),
    });

    setPending(null);

    if (!result.ok) {
      setError(result.error ?? "The decision was not recorded.");
      return;
    }

    setDecision(next);
    setCapturingNote(false);
    setNote("");
    // Refresh so the gap list, the overall approve button and the decision
    // trail above all recompute from the database rather than from this state.
    router.refresh();
  }

  const busy = pending !== null;

  return (
    <div className="flex flex-col gap-2 items-start">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void send("accepted", "")}
          disabled={busy || decision === "accepted"}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-semibold hover:bg-emerald-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {pending === "accepted" ? (
            <Loader2 size={11} className="animate-spin" />
          ) : (
            <Check size={11} />
          )}
          {decision === "accepted" ? "Accepted" : "Accept"}
        </button>

        <button
          type="button"
          onClick={() => {
            setError(null);
            setCapturingNote((open) => !open);
          }}
          disabled={busy}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold transition-colors disabled:opacity-40 ${
            capturingNote
              ? "bg-rose-100 border-rose-300 text-rose-800"
              : "bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100"
          }`}
        >
          <X size={11} /> {decision === "rejected" ? "Rejected" : "Reject"}
        </button>
      </div>

      {capturingNote && (
        <div className="w-full max-w-md bg-white border border-stone-200 rounded-xl p-3 shadow-sm">
          <label
            htmlFor={`doc-note-${documentId}`}
            className="block text-[11px] font-semibold uppercase tracking-wider text-stone-500 mb-1.5"
          >
            Why is this {documentLabel.toLowerCase()} not acceptable?
          </label>
          <textarea
            id={`doc-note-${documentId}`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={NOTE_MAX}
            rows={3}
            placeholder="e.g. Expired in March 2026. Upload the certificate covering the current period."
            className="w-full text-sm text-stone-800 border border-stone-200 rounded-lg px-2.5 py-2 outline-none focus:border-teal-400 resize-y"
          />
          <div className="flex items-center justify-between gap-2 mt-2">
            <span className="text-[11px] text-stone-400">
              {note.trim().length === 0 ? "Required — the therapist reads this" : `${note.length}/${NOTE_MAX}`}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setCapturingNote(false);
                  setNote("");
                }}
                className="px-2.5 py-1.5 text-[11px] font-medium text-stone-500 hover:text-stone-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void send("rejected", note)}
                disabled={note.trim().length === 0 || busy}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 text-white text-[11px] font-semibold hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {pending === "rejected" && <Loader2 size={11} className="animate-spin" />}
                Reject document
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="flex items-start gap-1.5 text-[11px] text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-2.5 py-1.5 max-w-md"
        >
          <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
