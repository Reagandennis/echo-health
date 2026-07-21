"use client";

import { useRef, useState } from "react";
import {
  Upload,
  FileText,
  Trash2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Lock,
} from "lucide-react";
import { KYC_DOCUMENT_SPECS, type KycDocReview, type KycDocumentSpec } from "@/lib/kyc";
import { uploadKycDocumentAction, deleteKycDocumentAction } from "@/app/actions/database";

/**
 * A `kyc_documents` row as the therapist is permitted to see it: metadata and
 * the reviewer's decision, never the stored bytes.
 */
export interface KycDocumentView {
  id: string;
  docType: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string | Date;
  reviewStatus: KycDocReview;
  reviewNote: string | null;
}

/**
 * Mirrors `ALLOWED_DOCUMENT_TYPES` / `MAX_DOCUMENT_BYTES` in
 * `app/actions/database.ts`. Duplicated on purpose rather than imported: that
 * module is `"use server"`, so importing a constant from it would drag the whole
 * server action graph into the client bundle.
 *
 * The server is still the authority — this copy exists so an oversized or
 * unsupported file fails immediately with a sentence the applicant can act on,
 * instead of being posted and dying inside the Server Action body limit, which
 * surfaces as an untraceable framework error.
 */
const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
const ACCEPTED_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatUploadedAt(value: string | Date): string {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

const REVIEW_BADGE: Record<
  KycDocReview,
  { label: string; className: string; Icon: typeof CheckCircle2 }
> = {
  pending: {
    label: "Awaiting review",
    className: "bg-amber-100 text-amber-800",
    Icon: Clock,
  },
  accepted: {
    label: "Accepted",
    className: "bg-emerald-100 text-emerald-800",
    Icon: CheckCircle2,
  },
  rejected: {
    label: "Rejected",
    className: "bg-red-100 text-red-800",
    Icon: XCircle,
  },
};

function ReviewBadge({ status }: { status: KycDocReview }) {
  const { label, className, Icon } = REVIEW_BADGE[status];
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${className}`}
    >
      <Icon size={11} /> {label}
    </span>
  );
}

interface SlotProps {
  spec: KycDocumentSpec;
  documents: KycDocumentView[];
  /** False while the application is with a reviewer or already approved. */
  editable: boolean;
  onChanged: () => void | Promise<void>;
  onError: (message: string | null) => void;
}

function DocumentSlot({ spec, documents, editable, onChanged, onError }: SlotProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"upload" | "delete" | null>(null);

  /**
   * Set when the file picker was opened by "Replace". The superseded document is
   * deleted only AFTER the replacement is stored, so an upload that fails leaves
   * the applicant holding the document they already had rather than nothing.
   */
  const [replacingId, setReplacingId] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset immediately so picking the same file twice still fires `change`.
    e.target.value = "";
    if (!file) return;

    const supersedes = replacingId;
    setReplacingId(null);

    if (file.size > MAX_DOCUMENT_BYTES) {
      onError(
        `“${file.name}” is ${formatBytes(file.size)} — the limit is 10 MB. Try a lower-resolution scan or a compressed PDF.`
      );
      return;
    }
    if (!ACCEPTED_MIME.includes(file.type)) {
      onError(
        `“${file.name}” is not a supported file type. Upload a PDF, JPG, PNG, WebP or GIF.`
      );
      return;
    }

    onError(null);
    setBusy("upload");
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("docType", spec.type);
      await uploadKycDocumentAction(formData);

      if (supersedes) {
        // A failure here is not worth surfacing as an upload error: the new
        // document is safely stored, and a stale duplicate is a tidiness problem
        // the reviewer can see through, not a blocked application.
        try {
          await deleteKycDocumentAction(supersedes);
        } catch (err) {
          console.error("failed to remove superseded KYC document", err);
        }
      }

      await onChanged();
    } catch (err: unknown) {
      onError(err instanceof Error ? err.message : `Could not upload ${spec.label}.`);
    } finally {
      setBusy(null);
    }
  }

  async function handleDelete(id: string) {
    onError(null);
    setBusy("delete");
    try {
      await deleteKycDocumentAction(id);
      await onChanged();
    } catch (err: unknown) {
      onError(err instanceof Error ? err.message : `Could not remove ${spec.label}.`);
    } finally {
      setBusy(null);
    }
  }

  function openPicker(supersedesId?: string) {
    setReplacingId(supersedesId ?? null);
    inputRef.current?.click();
  }

  const working = busy !== null;
  const hasDocuments = documents.length > 0;
  const satisfied = hasDocuments && documents.every((d) => d.reviewStatus !== "rejected");

  return (
    <div
      className={`rounded-2xl border p-4 transition-colors ${
        satisfied ? "border-emerald-200 bg-emerald-50/40" : "border-stone-200 bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-stone-900">{spec.label}</h3>
            {spec.required ? (
              <span className="text-[10px] font-bold uppercase tracking-wider bg-brand/10 text-brand px-2 py-0.5 rounded-full">
                Required
              </span>
            ) : (
              <span className="text-[10px] font-medium uppercase tracking-wider bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full">
                Optional
              </span>
            )}
          </div>
          <p className="text-xs text-stone-500 mt-1 leading-relaxed">{spec.help}</p>
        </div>
        {satisfied && <CheckCircle2 size={18} className="text-emerald-500 shrink-0 mt-0.5" />}
      </div>

      {hasDocuments && (
        <ul className="mt-3 space-y-2">
          {documents.map((doc) => {
            /*
             * An accepted document is KEPT — never re-requested. That is the
             * point of the resubmission flow.
             *
             * It stays replaceable, though. A practising certificate accepted in
             * March may well have expired by the time a rejected application
             * comes back, and `KYC_DOCUMENT_SPECS` asks the reviewer to confirm
             * that one covers TODAY. Migration 0014's delete policy admits the
             * owner while the application is incomplete or rejected precisely so
             * this is possible, and a replacement inserts at `pending`, so it
             * resurfaces as un-reviewed rather than inheriting the old decision.
             *
             * What it must not be is removable outright: dropping a check the
             * reviewer already passed, with nothing put in its place, is pure
             * loss for the applicant and the reviewer both.
             */
            const accepted = doc.reviewStatus === "accepted";
            return (
              <li
                key={doc.id}
                className="rounded-xl border border-stone-200 bg-white px-3 py-2.5"
              >
                <div className="flex items-start gap-3">
                  <FileText size={16} className="text-stone-400 shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-stone-800 truncate">
                      {doc.filename}
                    </p>
                    <p className="text-xs text-stone-400 mt-0.5">
                      {formatBytes(doc.sizeBytes)}
                      {formatUploadedAt(doc.uploadedAt) &&
                        ` · uploaded ${formatUploadedAt(doc.uploadedAt)}`}
                    </p>
                    <div className="mt-1.5">
                      <ReviewBadge status={doc.reviewStatus} />
                    </div>
                  </div>

                  {editable && (
                    <div className="flex items-center gap-1 shrink-0">
                      {accepted && (
                        <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-700 mr-1">
                          <Lock size={11} /> Kept
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => openPicker(doc.id)}
                        disabled={working}
                        title={
                          accepted
                            ? "This document has already been accepted. Replacing it sends the new file for review."
                            : undefined
                        }
                        className="flex items-center gap-1 text-xs font-medium text-brand hover:bg-brand/5 px-2 py-1 rounded-lg transition-colors disabled:opacity-40"
                      >
                        {busy === "upload" ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <RefreshCw size={12} />
                        )}
                        Replace
                      </button>
                      {!accepted && (
                        <button
                          type="button"
                          onClick={() => handleDelete(doc.id)}
                          disabled={working}
                          aria-label={`Remove ${doc.filename}`}
                          className="flex items-center gap-1 text-xs font-medium text-stone-500 hover:text-red-600 hover:bg-red-50 px-2 py-1 rounded-lg transition-colors disabled:opacity-40"
                        >
                          {busy === "delete" ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <Trash2 size={12} />
                          )}
                          Remove
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/*
                  The reviewer's note is the whole point of a per-document
                  decision — "rejected" without a reason sends the applicant
                  back to guess which of five files was wrong.
                */}
                {doc.reviewNote && (
                  <div
                    className={`mt-2.5 rounded-lg px-3 py-2 text-xs leading-relaxed ${
                      doc.reviewStatus === "rejected"
                        ? "bg-red-50 border border-red-100 text-red-700"
                        : "bg-stone-50 border border-stone-100 text-stone-600"
                    }`}
                  >
                    <span className="font-semibold">Reviewer&apos;s note:</span>{" "}
                    {doc.reviewNote}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {editable && (
        <>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_MIME.join(",")}
            className="hidden"
            onChange={handleFile}
          />
          {!hasDocuments && (
            <button
              type="button"
              onClick={() => openPicker()}
              disabled={working}
              className="mt-3 w-full flex flex-col items-center justify-center gap-1.5 border-2 border-dashed border-stone-200 rounded-xl py-6 hover:border-brand/40 hover:bg-brand/[0.02] transition-colors disabled:opacity-40"
            >
              {busy === "upload" ? (
                <Loader2 size={20} className="text-brand animate-spin" />
              ) : (
                <Upload size={20} className="text-stone-300" />
              )}
              <span className="text-sm text-stone-500">
                {busy === "upload" ? "Uploading…" : `Upload ${spec.label.toLowerCase()}`}
              </span>
              <span className="text-xs text-stone-400">PDF, JPG or PNG · max 10 MB</span>
            </button>
          )}
          {hasDocuments && (
            <button
              type="button"
              onClick={() => openPicker()}
              disabled={working}
              className="mt-2 text-xs font-medium text-brand hover:underline underline-offset-2 disabled:opacity-40"
            >
              + Add another file for this document
            </button>
          )}
        </>
      )}

      {!editable && !hasDocuments && (
        <p className="mt-3 text-xs text-stone-400 italic">Not provided.</p>
      )}
    </div>
  );
}

interface UploaderProps {
  documents: KycDocumentView[];
  editable: boolean;
  onChanged: () => void | Promise<void>;
  onError: (message: string | null) => void;
}

/**
 * One upload slot per entry in `KYC_DOCUMENT_SPECS`.
 *
 * The list of slots is derived from the spec rather than from what has been
 * uploaded, so a document the platform requires is visible as an empty slot
 * instead of being invisible by virtue of its own absence. That was the defect
 * in the previous form: a single optional file input, which let an application
 * through with no documents at all.
 */
export default function KycDocumentUploader({
  documents,
  editable,
  onChanged,
  onError,
}: UploaderProps) {
  return (
    <div className="space-y-3">
      {KYC_DOCUMENT_SPECS.map((spec) => (
        <DocumentSlot
          key={spec.type}
          spec={spec}
          // Grouped by type rather than assuming one row per type: nothing in
          // the schema enforces uniqueness, and silently hiding a second file
          // the reviewer can see would misrepresent what was submitted.
          documents={documents.filter((d) => d.docType === spec.type)}
          editable={editable}
          onChanged={onChanged}
          onError={onError}
        />
      ))}
    </div>
  );
}
