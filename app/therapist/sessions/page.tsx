"use client";

import { useEffect, useState } from "react";
import { listTherapistSessionsAction, getTherapistByUserIdAction, updateTherapySessionAction } from "@/app/actions/database";
import { Calendar, Clock, ArrowRight, ChevronLeft, ChevronRight, Video, CheckCircle2, Loader2 } from "lucide-react";
import Link from "next/link";
import { useUser } from "@/app/components/UserProvider";

interface Session { $id: string; userId: string; scheduledAt: string; status: string; sessionType?: string; notes?: string; }

function startOfWeek(d: Date) {
  const day = new Date(d);
  const diff = day.getDay();
  day.setDate(day.getDate() - diff);
  day.setHours(0, 0, 0, 0);
  return day;
}

function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

const STATUS_COLORS: Record<string, string> = {
  confirmed: "bg-brand/10 text-brand border-brand/20",
  completed: "bg-green-50 text-green-700 border-green-200",
  cancelled: "bg-red-50 text-red-600 border-red-200",
  pending: "bg-amber-50 text-amber-700 border-amber-200",
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function SessionsPage() {
  const user = useUser();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));

  useEffect(() => {
    if (!user?.$id) return;
    (async () => {
      try {
        const therapist = await getTherapistByUserIdAction(user.$id);
        if (therapist) {
          const sess = await listTherapistSessionsAction(therapist.$id);
          setSessions(sess as unknown as Session[]);
        }
      } catch { /* empty */ }
      setLoading(false);
    })();
  }, [user?.$id]);

  async function handleConfirm(sessionId: string) {
    setConfirming(sessionId);
    try {
      await updateTherapySessionAction(sessionId, { status: "confirmed" });
      setSessions(prev => prev.map(s => s.$id === sessionId ? { ...s, status: "confirmed" } : s));
    } catch (err) {
      console.error(err);
      alert("Failed to confirm session.");
    }
    setConfirming(null);
  }

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  function sessionsForDay(d: Date) {
    return sessions.filter((s) => {
      const sd = new Date(s.scheduledAt);
      return sd.getFullYear() === d.getFullYear() && sd.getMonth() === d.getMonth() && sd.getDate() === d.getDate();
    });
  }

  const today = new Date();

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 rounded-full border-2 border-brand border-t-transparent animate-spin" /></div>;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Sessions</h1>
          <p className="text-stone-500 text-sm mt-0.5">{sessions.length} total</p>
        </div>
      </div>

      {/* Week nav */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setWeekStart(addDays(weekStart, -7))} className="p-2 rounded-lg hover:bg-stone-100 transition-colors">
            <ChevronLeft size={18} className="text-stone-600" />
          </button>
          <p className="text-sm font-semibold text-stone-700">
            {weekStart.toLocaleDateString("en-US", { month: "long", day: "numeric" })} – {addDays(weekStart, 6).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </p>
          <button onClick={() => setWeekStart(addDays(weekStart, 7))} className="p-2 rounded-lg hover:bg-stone-100 transition-colors">
            <ChevronRight size={18} className="text-stone-600" />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-2">
          {weekDays.map((d) => {
            const isToday = d.toDateString() === today.toDateString();
            const daySessions = sessionsForDay(d);
            return (
              <div key={d.toDateString()} className={`rounded-xl border p-2 min-h-22.5 transition-colors ${isToday ? "border-brand bg-brand/5" : "border-stone-100 bg-stone-50"}`}>
                <p className={`text-xs font-semibold text-center mb-1 ${isToday ? "text-brand" : "text-stone-400"}`}>{DAYS[d.getDay()]}</p>
                <p className={`text-sm font-bold text-center mb-2 ${isToday ? "text-brand" : "text-stone-700"}`}>{d.getDate()}</p>
                <div className="space-y-1">
                  {daySessions.map((s) => (
                    <Link key={s.$id} href={`/therapist/sessions/${s.$id}`}
                      className={`block text-[10px] font-medium px-1.5 py-0.5 rounded border truncate hover:opacity-80 transition-opacity ${STATUS_COLORS[s.status] ?? "bg-stone-100 text-stone-500 border-stone-200"}`}>
                      {new Date(s.scheduledAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Upcoming list */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-stone-100">
          <h2 className="font-semibold text-stone-800">Upcoming Sessions</h2>
        </div>
        {sessions.filter((s) => new Date(s.scheduledAt) >= today && s.status !== "cancelled").length === 0 ? (
          <div className="py-12 text-center">
            <Calendar size={32} className="mx-auto text-stone-200 mb-2" />
            <p className="text-sm text-stone-400">No upcoming sessions</p>
          </div>
        ) : (
          <div className="divide-y divide-stone-100">
            {sessions.filter((s) => new Date(s.scheduledAt) >= today && s.status !== "cancelled").slice(0, 10).map((s) => (
              <Link key={s.$id} href={`/therapist/sessions/${s.$id}`}
                className="flex items-center gap-4 px-6 py-4 hover:bg-stone-50 transition-colors group">
                <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center shrink-0">
                  <Clock size={16} className="text-brand" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-stone-900">{new Date(s.scheduledAt).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</p>
                  <p className="text-xs text-stone-400">{new Date(s.scheduledAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} · {s.sessionType ?? "1-on-1"}</p>
                </div>
                <div className="flex items-center gap-3">
                  {(() => {
                    const scheduledTime = new Date(s.scheduledAt).getTime();
                    const now = Date.now();
                    const diffMinutes = (scheduledTime - now) / (1000 * 60);
                    const isSoon = diffMinutes <= 15 && diffMinutes >= -60;
                    
                    if (s.status === "pending") {
                      return (
                        <button 
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); void handleConfirm(s.$id); }}
                          disabled={confirming === s.$id}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold bg-amber-100 text-amber-700 hover:bg-amber-200 transition-all shadow-sm border border-amber-200 disabled:opacity-50"
                        >
                          {confirming === s.$id ? <Loader2 size={10} className="animate-spin" /> : <CheckCircle2 size={10} />}
                          Confirm
                        </button>
                      );
                    }

                    if (isSoon && s.status === "confirmed") {
                      return (
                        <Link 
                          href={`/therapist/sessions/${s.$id}?autoStart=true`}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold bg-brand text-white hover:opacity-90 transition-all shadow-sm"
                        >
                          <Video size={10} /> Join Call
                        </Link>
                      );
                    }
                    return <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${STATUS_COLORS[s.status] ?? "bg-stone-100 text-stone-500 border-stone-200"}`}>{s.status}</span>;
                  })()}
                  <ArrowRight size={14} className="text-stone-300 group-hover:text-brand transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
