"use client";

import { useState } from "react";
import { Search, UserCheck, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { assignTherapistToPatientAction } from "@/app/actions/database";

interface Profile {
  $id: string;
  name: string;
  goal?: string;
  therapistId?: string;
}

interface Therapist {
  $id: string;
  name: string;
  specialties: string[];
}

interface Props {
  patients: Profile[];
  therapists: Therapist[];
}

export default function AssignmentForm({ patients, therapists }: Props) {
  const router = useRouter();
  const [selectedPatient, setSelectedPatient] = useState("");
  const [selectedTherapist, setSelectedTherapist] = useState("");
  const [loading, setLoading] = useState(false);
  const [searchPatient, setSearchPatient] = useState("");
  const [searchTherapist, setSearchTherapist] = useState("");

  const filteredPatients = patients.filter(p => 
    p.name.toLowerCase().includes(searchPatient.toLowerCase()) ||
    (p.goal?.toLowerCase().includes(searchPatient.toLowerCase()))
  );

  const filteredTherapists = therapists.filter(t => 
    t.name.toLowerCase().includes(searchTherapist.toLowerCase()) ||
    t.specialties.some(s => s.toLowerCase().includes(searchTherapist.toLowerCase()))
  );

  async function handleAssign() {
    if (!selectedPatient || !selectedTherapist) return;
    setLoading(true);
    try {
      await assignTherapistToPatientAction(selectedPatient, selectedTherapist);
      router.push("/admin/matching");
      router.refresh();
    } catch (err) {
      console.error(err);
      alert("Failed to assign therapist.");
    }
    setLoading(false);
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Patient Selection */}
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-stone-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-stone-800">1. Select Client</h3>
            <div className="flex items-center gap-2 bg-stone-50 border border-stone-200 rounded-lg px-3 py-1.5">
              <Search className="w-3.5 h-3.5 text-stone-400" />
              <input 
                type="text" 
                placeholder="Search…" 
                value={searchPatient}
                onChange={(e) => setSearchPatient(e.target.value)}
                className="text-xs outline-none bg-transparent text-stone-700 placeholder-stone-400 w-28" 
              />
            </div>
          </div>
          <div className="divide-y divide-stone-50 max-h-[400px] overflow-y-auto">
            {filteredPatients.map((p) => (
              <label key={p.$id} className={`flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-teal-50/30 transition-colors ${selectedPatient === p.$id ? "bg-teal-50/50" : ""}`}>
                <input 
                  type="radio" 
                  name="patient" 
                  value={p.$id} 
                  checked={selectedPatient === p.$id}
                  onChange={(e) => setSelectedPatient(e.target.value)}
                  className="accent-teal-600" 
                />
                <div>
                  <p className="text-sm font-semibold text-stone-900">{p.name}</p>
                  <p className="text-xs text-stone-400">{p.goal || "No goal set"}</p>
                  {p.therapistId && (
                    <p className="text-[10px] text-amber-600 font-medium mt-0.5">Currently matched</p>
                  )}
                </div>
              </label>
            ))}
            {filteredPatients.length === 0 && (
              <div className="p-8 text-center text-sm text-stone-400">No patients found.</div>
            )}
          </div>
        </div>

        {/* Therapist Selection */}
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-stone-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-stone-800">2. Select Therapist</h3>
            <div className="flex items-center gap-2 bg-stone-50 border border-stone-200 rounded-lg px-3 py-1.5">
              <Search className="w-3.5 h-3.5 text-stone-400" />
              <input 
                type="text" 
                placeholder="Search…" 
                value={searchTherapist}
                onChange={(e) => setSearchTherapist(e.target.value)}
                className="text-xs outline-none bg-transparent text-stone-700 placeholder-stone-400 w-28" 
              />
            </div>
          </div>
          <div className="divide-y divide-stone-50 max-h-[400px] overflow-y-auto">
            {filteredTherapists.map((t) => (
              <label key={t.$id} className={`flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-teal-50/30 transition-colors ${selectedTherapist === t.$id ? "bg-teal-50/50" : ""}`}>
                <input 
                  type="radio" 
                  name="therapist" 
                  value={t.$id} 
                  checked={selectedTherapist === t.$id}
                  onChange={(e) => setSelectedTherapist(e.target.value)}
                  className="accent-teal-600" 
                />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-stone-900">{t.name}</p>
                  <p className="text-xs text-stone-400">{t.specialties?.join(", ") || "General Practice"}</p>
                </div>
              </label>
            ))}
            {filteredTherapists.length === 0 && (
              <div className="p-8 text-center text-sm text-stone-400">No therapists found.</div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 flex gap-3">
        <button 
          onClick={handleAssign}
          disabled={loading || !selectedPatient || !selectedTherapist}
          className="flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-xl transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />}
          Confirm Assignment
        </button>
        <button 
          onClick={() => router.back()}
          className="px-6 py-3 text-sm font-semibold text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-xl transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
