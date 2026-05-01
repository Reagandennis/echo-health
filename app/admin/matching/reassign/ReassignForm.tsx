"use client";

import { useState, useEffect } from "react";
import { ArrowRight, RefreshCw, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { 
  assignTherapistToPatientAction, 
  resolveMatchConflictAction,
  createNotificationAction
} from "@/app/actions/database";

interface Profile {
  $id: string;
  userId: string;
  name: string;
  therapistId?: string;
}

interface Therapist {
  $id: string;
  name: string;
}

interface Props {
  profiles: Profile[];
  therapists: Therapist[];
  initialPatientId?: string;
  conflictId?: string;
}

export default function ReassignForm({ profiles, therapists, initialPatientId, conflictId }: Props) {
  const router = useRouter();
  const [selectedPatientId, setSelectedPatientId] = useState(initialPatientId || "");
  const [selectedTherapistId, setSelectedTherapistId] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  const selectedPatient = profiles.find(p => p.$id === selectedPatientId);
  const currentTherapist = therapists.find(t => t.$id === selectedPatient?.therapistId);

  async function handleReassign() {
    if (!selectedPatientId || !selectedTherapistId) return;
    setLoading(true);
    try {
      // 1. Reassign
      await assignTherapistToPatientAction(selectedPatientId, selectedTherapistId);
      
      // 2. Resolve conflict if exists
      if (conflictId) {
        await resolveMatchConflictAction(conflictId);
      }

      // 3. Optional: log the reassignment reason somewhere or send a custom notification
      if (reason && selectedPatient) {
        await createNotificationAction({
          userId: selectedPatient.userId,
          title: "Therapist Match Updated",
          message: `Your therapist has been updated. Reason: ${reason}`,
          type: "info",
          link: "/dashboard/sessions"
        });
      }

      router.push("/admin/matching");
      router.refresh();
    } catch (err) {
      console.error(err);
      alert("Failed to reassign therapist.");
    }
    setLoading(false);
  }

  return (
    <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6 space-y-6">
      <div>
        <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wider">Select Client</label>
        <select 
          value={selectedPatientId} 
          onChange={(e) => setSelectedPatientId(e.target.value)}
          className="w-full px-4 py-2.5 border border-stone-200 rounded-xl text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
        >
          <option value="">Choose client…</option>
          {profiles.map((c) => (
            <option key={c.$id} value={c.$id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex-1 p-4 bg-stone-50 rounded-xl text-center border border-stone-200">
          <p className="text-xs text-stone-400 uppercase tracking-wider mb-1">Current</p>
          <p className="text-sm font-bold text-stone-700">{currentTherapist?.name || "Unassigned"}</p>
        </div>
        <ArrowRight className="w-5 h-5 text-stone-400 flex-shrink-0" />
        <div className="flex-1">
          <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wider">New Therapist</label>
          <select 
            value={selectedTherapistId} 
            onChange={(e) => setSelectedTherapistId(e.target.value)}
            className="w-full px-4 py-2.5 border border-stone-200 rounded-xl text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="">Choose therapist…</option>
            {therapists
              .filter(t => t.$id !== currentTherapist?.$id)
              .map((t) => (
                <option key={t.$id} value={t.$id}>{t.name}</option>
              ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wider">Reason for Reassignment</label>
        <textarea 
          rows={3} 
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Provide a reason for this reassignment…" 
          className="w-full px-4 py-2.5 border border-stone-200 rounded-xl text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none" 
        />
      </div>

      <div className="flex gap-3">
        <button 
          onClick={handleReassign}
          disabled={loading || !selectedPatientId || !selectedTherapistId}
          className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-xl transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Confirm Reassignment
        </button>
        <button 
          onClick={() => router.back()}
          className="px-5 py-2.5 text-sm font-semibold text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-xl transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
