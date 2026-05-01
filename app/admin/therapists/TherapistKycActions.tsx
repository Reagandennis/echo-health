"use client";

import { useState } from "react";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

interface Props {
  therapistDocId: string;
  currentStatus: string;
}

export default function TherapistKycActions({ therapistDocId, currentStatus }: Readonly<Props>) {
  const [status, setStatus] = useState(currentStatus);
  const [loading, setLoading] = useState<"approve" | "reject" | null>(null);

  async function update(action: "approve" | "reject") {
    setLoading(action);
    try {
      const res = await fetch("/api/admin/therapist-kyc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ therapistDocId, action }),
      });
      if (res.ok) setStatus(action === "approve" ? "verified" : "rejected");
    } catch { /* empty */ }
    setLoading(null);
  }

  if (status === "verified") {
    return <span className="text-xs font-semibold bg-green-100 text-green-700 px-3 py-1 rounded-full">✓ Verified</span>;
  }
  if (status === "rejected") {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold bg-red-100 text-red-600 px-3 py-1 rounded-full">Rejected</span>
        <button onClick={() => void update("approve")} disabled={loading !== null}
          className="text-xs font-medium text-brand hover:underline disabled:opacity-50">
          {loading === "approve" ? <Loader2 size={12} className="animate-spin" /> : "Approve"}
        </button>
      </div>
    );
  }
  if (status === "incomplete") {
    return <span className="text-xs text-stone-400">Not submitted</span>;
  }

  // pending
  return (
    <div className="flex items-center gap-2 shrink-0">
      <button onClick={() => void update("approve")} disabled={loading !== null}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-green-50 border border-green-200 text-green-700 text-xs font-semibold hover:bg-green-100 transition-colors disabled:opacity-50">
        {loading === "approve" ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
        Approve
      </button>
      <button onClick={() => void update("reject")} disabled={loading !== null}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs font-semibold hover:bg-red-100 transition-colors disabled:opacity-50">
        {loading === "reject" ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={12} />}
        Reject
      </button>
    </div>
  );
}
