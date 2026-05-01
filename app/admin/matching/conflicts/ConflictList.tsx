"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle, Loader2 } from "lucide-react";
import AdminBadge from "../../_components/AdminBadge";
import { resolveMatchConflictAction } from "@/app/actions/database";
import { useRouter } from "next/navigation";

interface Conflict {
  $id: string;
  patientId: string;
  fromTherapistId?: string;
  toTherapistId?: string;
  reason: string;
  severity: string;
  createdAt: string;
  resolved: boolean;
}

interface Props {
  initialConflicts: Conflict[];
  profiles: any[];
  therapists: any[];
}

export default function ConflictList({ initialConflicts, profiles, therapists }: Props) {
  const router = useRouter();
  const [conflicts, setConflicts] = useState(initialConflicts);
  const [resolving, setResolving] = useState<string | null>(null);

  async function handleResolve(id: string) {
    setResolving(id);
    try {
      await resolveMatchConflictAction(id);
      setConflicts(prev => prev.map(c => c.$id === id ? { ...c, resolved: true } : c));
      router.refresh();
    } catch (err) {
      console.error(err);
      alert("Failed to resolve conflict.");
    }
    setResolving(null);
  }

  function getPatientName(id: string) {
    return profiles.find(p => p.$id === id)?.name || "Unknown Patient";
  }

  function getTherapistName(id?: string) {
    if (!id) return "Unassigned";
    return therapists.find(t => t.$id === id)?.name || "Unknown Therapist";
  }

  return (
    <div className="space-y-4">
      {conflicts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center">
          <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-3">
            <CheckCircle className="text-emerald-500 w-6 h-6" />
          </div>
          <p className="text-stone-500 font-medium">No match conflicts logged.</p>
        </div>
      ) : (
        conflicts.map((c) => (
          <div key={c.$id} className={`bg-white rounded-2xl border shadow-sm p-5 ${c.severity === "high" ? "border-rose-200" : c.severity === "medium" ? "border-amber-200" : "border-stone-200"}`}>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-start gap-4">
                <div className={`p-2.5 rounded-xl flex-shrink-0 ${c.severity === "high" ? "bg-rose-100" : c.severity === "medium" ? "bg-amber-100" : "bg-stone-100"}`}>
                  <AlertTriangle className={`w-4 h-4 ${c.severity === "high" ? "text-rose-600" : c.severity === "medium" ? "text-amber-600" : "text-stone-500"}`} />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-bold text-stone-900">{getPatientName(c.patientId)}</span>
                    <AdminBadge label={c.severity} variant={c.severity === "high" ? "danger" : c.severity === "medium" ? "warning" : "neutral"} />
                    {c.resolved && <AdminBadge label="Resolved" variant="success" />}
                  </div>
                  <p className="text-xs text-stone-500 mb-1">From: <strong>{getTherapistName(c.fromTherapistId)}</strong> → To: <strong>{getTherapistName(c.toTherapistId)}</strong></p>
                  <p className="text-sm text-stone-700">{c.reason}</p>
                  <p className="text-xs text-stone-400 mt-1">{new Date(c.createdAt).toLocaleString()}</p>
                </div>
              </div>
              {!c.resolved && (
                <div className="flex gap-2">
                  <a href={`/admin/matching/reassign?patientId=${c.patientId}&conflictId=${c.$id}`} className="px-3 py-1.5 text-xs font-semibold text-teal-600 bg-teal-100 hover:bg-teal-200 rounded-lg transition-colors">Reassign</a>
                  <button 
                    onClick={() => handleResolve(c.$id)}
                    disabled={resolving === c.$id}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-emerald-600 bg-emerald-100 hover:bg-emerald-200 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {resolving === c.$id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                    Resolve
                  </button>
                </div>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
