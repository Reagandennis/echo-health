"use client";

import { useState } from "react";
import { Clock, Save } from "lucide-react";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const HOURS = Array.from({ length: 13 }, (_, i) => `${(i + 8).toString().padStart(2, "0")}:00`);

interface DaySchedule { enabled: boolean; from: string; to: string; }
type Schedule = Record<string, DaySchedule>;

const DEFAULT: Schedule = {
  Monday:    { enabled: true,  from: "09:00", to: "17:00" },
  Tuesday:   { enabled: true,  from: "09:00", to: "17:00" },
  Wednesday: { enabled: true,  from: "09:00", to: "17:00" },
  Thursday:  { enabled: true,  from: "09:00", to: "17:00" },
  Friday:    { enabled: true,  from: "09:00", to: "15:00" },
  Saturday:  { enabled: false, from: "10:00", to: "13:00" },
  Sunday:    { enabled: false, from: "10:00", to: "13:00" },
};

export default function AvailabilityPage() {
  const [schedule, setSchedule] = useState<Schedule>(DEFAULT);
  const [saved, setSaved] = useState(false);
  const [sessionDuration, setSessionDuration] = useState("50");
  const [bufferTime, setBufferTime] = useState("10");

  function toggle(day: string) {
    setSchedule((s) => ({ ...s, [day]: { ...s[day], enabled: !s[day].enabled } }));
  }

  function updateTime(day: string, field: "from" | "to", value: string) {
    setSchedule((s) => ({ ...s, [day]: { ...s[day], [field]: value } }));
  }

  function save() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-stone-900">Availability</h1>
        <button onClick={save} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand text-white text-sm font-semibold hover:opacity-90 transition-opacity">
          <Save size={14} /> {saved ? "Saved ✓" : "Save changes"}
        </button>
      </div>

      {/* Session settings */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6 grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label htmlFor="session-duration" className="text-sm font-medium text-stone-700">Session duration (min)</label>
          <select id="session-duration" value={sessionDuration} onChange={(e) => setSessionDuration(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-stone-200 text-sm outline-none focus:border-brand bg-white">
            {["25", "50", "60", "90"].map((v) => <option key={v} value={v}>{v} min</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="buffer-time" className="text-sm font-medium text-stone-700">Buffer between sessions (min)</label>
          <select id="buffer-time" value={bufferTime} onChange={(e) => setBufferTime(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-stone-200 text-sm outline-none focus:border-brand bg-white">
            {["0", "5", "10", "15", "20", "30"].map((v) => <option key={v} value={v}>{v} min</option>)}
          </select>
        </div>
      </div>

      {/* Weekly schedule */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-stone-100 flex items-center gap-2">
          <Clock size={14} className="text-brand" />
          <h2 className="font-semibold text-stone-800">Weekly Schedule</h2>
        </div>
        <div className="divide-y divide-stone-100">
          {DAYS.map((day) => (
            <div key={day} className={`flex items-center gap-4 px-6 py-4 transition-colors ${schedule[day].enabled ? "" : "opacity-50"}`}>
              <label className="flex items-center gap-3 w-32 cursor-pointer">
                <button type="button" onClick={() => toggle(day)} aria-label={`Toggle ${day}`} className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer ${schedule[day].enabled ? "bg-brand" : "bg-stone-200"}`}>
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${schedule[day].enabled ? "translate-x-5" : ""}`} />
                </button>
                <span className="text-sm font-medium text-stone-800">{day.slice(0, 3)}</span>
              </label>
              <select value={schedule[day].from} onChange={(e) => updateTime(day, "from", e.target.value)} disabled={!schedule[day].enabled}
                className="px-3 py-2 rounded-lg border border-stone-200 text-sm outline-none focus:border-brand bg-white disabled:cursor-not-allowed">
                {HOURS.map((h) => <option key={h}>{h}</option>)}
              </select>
              <span className="text-stone-400 text-sm">to</span>
              <select value={schedule[day].to} onChange={(e) => updateTime(day, "to", e.target.value)} disabled={!schedule[day].enabled}
                className="px-3 py-2 rounded-lg border border-stone-200 text-sm outline-none focus:border-brand bg-white disabled:cursor-not-allowed">
                {HOURS.map((h) => <option key={h}>{h}</option>)}
              </select>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
