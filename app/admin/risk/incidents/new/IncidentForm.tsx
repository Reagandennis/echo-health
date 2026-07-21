"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save, Loader2 } from "lucide-react";
import { createRiskAlertAction } from "@/app/actions/database";

/**
 * Files a real `risk_alerts` row.
 *
 * The previous version of this form was inert: "Submit Incident Report" was a
 * `<button>` with no handler, the inputs had no state, and nothing was ever
 * written anywhere. That is a dangerous thing to leave in a crisis runbook —
 * staff fill it in during an escalation, see it clear, and believe the incident
 * is on record when no trace of it exists.
 *
 * The fields are exactly the columns `risk_alerts` has. Two fields from the old
 * mock are gone because there is nowhere to put them, and a form that discards
 * what you typed is the same lie in a smaller box:
 *   - "Reporting Party" — the table stores no author.
 *   - "Actions Taken" — the table stores no follow-up narrative.
 * Both belong in the description until the schema carries them.
 */
const TYPES = [
  { value: "crisis", label: "Crisis — risk to life or safety" },
  { value: "flag", label: "Flag — safeguarding or conduct concern" },
  { value: "mood", label: "Mood — sustained deterioration" },
  { value: "engagement", label: "Engagement — disengagement or non-attendance" },
] as const;

const SEVERITIES = ["low", "medium", "high", "critical"] as const;

/** Matches the `varchar(1000)` column, so the UI cannot compose a failing insert. */
const DESCRIPTION_MAX = 1000;

interface Props {
  clients: { userId: string; name: string }[];
}

export default function IncidentForm({ clients }: Props) {
  const router = useRouter();
  const [patientId, setPatientId] = useState("");
  const [type, setType] = useState<string>("crisis");
  const [severity, setSeverity] = useState<string>("high");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = patientId !== "" && description.trim() !== "" && !saving;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setSaving(true);
    setError(null);
    try {
      await createRiskAlertAction({ patientId, type, severity, description });
      router.push("/admin/risk/incidents");
      router.refresh();
    } catch (err) {
      // Surfaced, never swallowed: an admin must not walk away believing an
      // incident was recorded when the write failed.
      setError(
        err instanceof Error ? err.message : "Could not save the incident."
      );
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-2xl bg-white rounded-2xl border border-stone-200 shadow-sm p-6 space-y-5"
    >
      <div>
        <label htmlFor="client" className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wider">
          Client
        </label>
        <select
          id="client"
          value={patientId}
          onChange={(e) => setPatientId(e.target.value)}
          required
          className="w-full px-4 py-2.5 border border-stone-200 rounded-xl text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
        >
          <option value="">Select a client…</option>
          {clients.map((c) => (
            <option key={c.userId} value={c.userId}>
              {c.name}
            </option>
          ))}
        </select>
        {/* A picker, not a free-text box: `patient_id` has no foreign key, so a
            typo would file the incident against an id belonging to nobody and
            it would never surface on any client's record. */}
        <p className="text-xs text-stone-400 mt-1.5">
          The incident is filed against this client&apos;s record.
        </p>
      </div>

      <div>
        <label htmlFor="type" className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wider">
          Incident Type
        </label>
        <select
          id="type"
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="w-full px-4 py-2.5 border border-stone-200 rounded-xl text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
        >
          {TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <span className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wider">
          Severity
        </span>
        <div className="flex flex-wrap gap-3">
          {SEVERITIES.map((s) => (
            <label key={s} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="severity"
                value={s}
                checked={severity === s}
                onChange={(e) => setSeverity(e.target.value)}
                className="accent-teal-600"
              />
              <span className="text-sm capitalize text-stone-700">{s}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="description" className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wider">
          What happened
        </label>
        <textarea
          id="description"
          rows={6}
          required
          maxLength={DESCRIPTION_MAX}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What happened, who was involved, and what was done in response."
          className="w-full px-4 py-2.5 border border-stone-200 rounded-xl text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
        />
        <p className="text-xs text-stone-400 mt-1.5">
          {description.length} / {DESCRIPTION_MAX} characters. This is the only
          narrative field stored — include the reporter and any actions taken.
        </p>
      </div>

      {error && (
        <p className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-4 py-2.5">
          {error}
        </p>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={!canSubmit}
          className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? "Saving…" : "Submit Incident Report"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/admin/risk/incidents")}
          className="px-5 py-2.5 text-sm font-semibold text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-xl transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
