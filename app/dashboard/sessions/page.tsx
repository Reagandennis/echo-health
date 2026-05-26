"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, X, Video, Phone, MessageCircle, CalendarCheck,
  Clock, ChevronDown, Star, Bell,
} from "lucide-react";
import type { TherapySession, Therapist } from "@/lib/appwrite/database";
import {
  PLAN_SESSIONS, PLACEHOLDER_THERAPIST_ID
} from "@/lib/constants";
import { useUser } from "@/app/components/UserProvider";
import appwriteClient from "@/lib/appwrite/client";
import { appwriteConfig } from "@/lib/appwrite/config";
import { 
  createSessionAction, 
  listPatientSessionsAction, 
  updateTherapySessionAction,
  listTherapistsAction,
  getProfileByUserIdAction
} from "@/app/actions/database";

// ─── Types ────────────────────────────────────────────────────────────────────
type ModalView = "book" | "feedback" | "detail" | null;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function statusColor(s: TherapySession["status"]) {
  return {
    pending:   "bg-amber-100 text-amber-700",
    confirmed: "bg-brand/10 text-brand",
    "in-progress": "bg-blue-100 text-blue-700",
    completed: "bg-emerald-100 text-emerald-700",
    cancelled: "bg-red-100 text-red-500",
  }[s] ?? "bg-cream text-brand/50";
}

function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }),
    time: d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
  };
}

// ─── Book Session Modal ───────────────────────────────────────────────────────
function BookModal({
  onClose,
  canBook,
  therapists,
  userId,
  onBooked,
}: {
  readonly onClose: () => void;
  readonly canBook: boolean;
  readonly therapists: Therapist[];
  readonly userId: string;
  readonly onBooked: (s: TherapySession) => void;
}) {
  const [date, setDate]       = useState("");
  const [time, setTime]       = useState("");
  const [type, setType]       = useState("video");
  const [note, setNote]       = useState("");
  const [tid, setTid]         = useState(therapists[0]?.$id ?? PLACEHOLDER_THERAPIST_ID);

  useEffect(() => {
    if (therapists.length > 0) {
      setTid(therapists[0].$id);
    }
  }, [therapists]);
  const [saving, setSaving]   = useState(false);
  const [done, setDone]       = useState(false);

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canBook) return;
    setSaving(true);
    try {
      const scheduled = new Date(`${date}T${time}`).toISOString();
      const session = await createSessionAction({
        patientId: userId,
        therapistId: tid,
        status: "pending",
        scheduledAt: scheduled,
        notes: `${type}|${note}`,
      }) as unknown as TherapySession;
      onBooked(session);
      setDone(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <dialog open className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-transparent m-0 max-w-none max-h-none w-full h-full">
      <button type="button" className="absolute inset-0 w-full h-full bg-brand/20 backdrop-blur-sm cursor-default" onClick={onClose} aria-label="Close" />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 z-10">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-brand">Book a session</h2>
          <button onClick={onClose} className="text-brand/40 hover:text-brand transition-colors" aria-label="Close"><X size={17} /></button>
        </div>
        {done ? (
          <div className="flex flex-col items-center py-10 text-center gap-3">
            <div className="w-14 h-14 rounded-full bg-brand/10 flex items-center justify-center">
              <CalendarCheck size={26} className="text-brand" />
            </div>
            <p className="text-base font-semibold text-brand">Request sent!</p>
            <p className="text-sm text-brand/50 max-w-xs">Your therapist will confirm shortly. Check your email for updates.</p>
            <button onClick={onClose} className="mt-2 bg-brand text-white text-sm font-semibold px-6 py-2.5 rounded-full hover:bg-brand/90 transition-colors">Done</button>
          </div>
        ) : (
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            {!canBook && (
              <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                No sessions remaining this month. Upgrade your plan to book more.
              </div>
            )}
            
            {therapists.length === 0 && (
              <div className="text-xs text-stone-500 bg-stone-50 border border-stone-200 rounded-xl px-4 py-3">
                We&apos;re currently matching you with a therapist. Please check back shortly.
              </div>
            )}

            {/* Therapist selector */}
            {therapists.length > 1 && (
              <div>
                <label htmlFor="therapist" className="block text-xs font-semibold text-brand/60 uppercase tracking-wide mb-1.5">Select Therapist</label>
                <div className="relative">
                  <select id="therapist" value={tid} onChange={(e) => setTid(e.target.value)}
                    className="w-full rounded-xl border border-brand/15 px-3 py-2.5 text-sm text-brand focus:outline-none focus:ring-2 focus:ring-brand/30 appearance-none">
                    {therapists.map((t) => (
                      <option key={t.$id} value={t.$id}>{t.name} · {t.specialties.slice(0, 2).join(", ")}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-brand/40 pointer-events-none" />
                </div>
              </div>
            )}

            {therapists.length === 1 && (
              <div className="bg-brand/5 border border-brand/10 rounded-xl px-4 py-3">
                <p className="text-[10px] font-semibold text-brand/60 uppercase tracking-wide mb-1">Assigned Therapist</p>
                <p className="text-sm font-bold text-brand">{therapists[0].name}</p>
                <p className="text-xs text-brand/50 mt-0.5">{therapists[0].specialties.slice(0, 2).join(", ")}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="sess-date" className="block text-xs font-semibold text-brand/60 uppercase tracking-wide mb-1.5">Date</label>
                <input id="sess-date" type="date" required value={date} onChange={(e) => setDate(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                  className="w-full rounded-xl border border-brand/15 px-3 py-2.5 text-sm text-brand focus:outline-none focus:ring-2 focus:ring-brand/30" />
              </div>
              <div>
                <label htmlFor="sess-time" className="block text-xs font-semibold text-brand/60 uppercase tracking-wide mb-1.5">Time</label>
                <input id="sess-time" type="time" required value={time} onChange={(e) => setTime(e.target.value)}
                  className="w-full rounded-xl border border-brand/15 px-3 py-2.5 text-sm text-brand focus:outline-none focus:ring-2 focus:ring-brand/30" />
              </div>
            </div>
            <div>
              <label htmlFor="sess-type" className="block text-xs font-semibold text-brand/60 uppercase tracking-wide mb-1.5">Format</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { v: "video", icon: Video,         label: "Video" },
                  { v: "audio", icon: Phone,          label: "Audio" },
                  { v: "chat",  icon: MessageCircle,  label: "Chat" },
                ].map(({ v, icon: Icon, label }) => (
                  <button type="button" key={v} onClick={() => setType(v)}
                    className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border text-xs font-semibold transition-colors
                      ${type === v ? "bg-brand text-white border-brand" : "border-brand/15 text-brand/60 hover:border-brand/30"}`}>
                    <Icon size={15} />
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label htmlFor="sess-note" className="block text-xs font-semibold text-brand/60 uppercase tracking-wide mb-1.5">
                Note <span className="normal-case font-normal text-brand/35">(optional)</span>
              </label>
              <textarea id="sess-note" value={note} onChange={(e) => setNote(e.target.value)} rows={3}
                placeholder="Anything you'd like your therapist to know…"
                className="w-full rounded-xl border border-brand/15 px-3 py-2.5 text-sm text-brand placeholder:text-brand/30 focus:outline-none focus:ring-2 focus:ring-brand/30 resize-none" />
            </div>
            <button type="submit" disabled={!canBook || saving || (therapists.length === 0 && !tid)}
              className="w-full bg-brand text-white font-semibold py-3 rounded-full hover:bg-brand/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              {saving ? "Booking…" : "Request session"}
            </button>
          </form>
        )}
      </div>
    </dialog>
  );
}

// ─── Feedback Modal ───────────────────────────────────────────────────────────
function FeedbackModal({ session, onClose }: { readonly session: TherapySession; readonly onClose: () => void }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [done, setDone] = useState(false);

  function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setDone(true);
  }

  const { date, time } = fmtDateTime(session.scheduledAt);

  return (
    <dialog open className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-transparent m-0 max-w-none max-h-none w-full h-full">
      <button type="button" className="absolute inset-0 w-full h-full bg-brand/20 backdrop-blur-sm cursor-default" onClick={onClose} aria-label="Close" />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 z-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-brand">Rate your session</h2>
          <button onClick={onClose} className="text-brand/40 hover:text-brand transition-colors" aria-label="Close"><X size={17} /></button>
        </div>
        <p className="text-xs text-brand/40 mb-5">{date} · {time}</p>
        {done ? (
          <div className="flex flex-col items-center py-8 text-center gap-3">
            <span className="text-4xl">🙏</span>
            <p className="text-sm font-semibold text-brand">Thank you for your feedback!</p>
            <button onClick={onClose} className="mt-1 bg-brand text-white text-sm font-semibold px-6 py-2.5 rounded-full hover:bg-brand/90 transition-colors">Done</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <p className="text-xs font-semibold text-brand/60 uppercase tracking-wide mb-3">How was this session?</p>
              <div className="flex gap-2 justify-center">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button type="button" key={n} onClick={() => setRating(n)} aria-label={`Rate ${n}`}>
                    <Star size={28} className={`transition-colors ${n <= rating ? "fill-amber-400 text-amber-400" : "text-brand/20"}`} />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label htmlFor="feedback-comment" className="block text-xs font-semibold text-brand/60 uppercase tracking-wide mb-1.5">
                Comments <span className="normal-case font-normal text-brand/35">(optional)</span>
              </label>
              <textarea id="feedback-comment" rows={3} value={comment} onChange={(e) => setComment(e.target.value)}
                placeholder="Share anything about the session…"
                className="w-full rounded-xl border border-brand/15 px-3 py-2.5 text-sm text-brand placeholder:text-brand/30 focus:outline-none focus:ring-2 focus:ring-brand/30 resize-none" />
            </div>
            <button type="submit" disabled={rating === 0}
              className="w-full bg-brand text-white font-semibold py-3 rounded-full hover:bg-brand/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              Submit feedback
            </button>
          </form>
        )}
      </div>
    </dialog>
  );
}

// ─── Session Row ──────────────────────────────────────────────────────────────
function SessionCard({
  session,
  onFeedback,
  onCancel,
  onJoin,
}: {
  readonly session: TherapySession;
  readonly onFeedback: (s: TherapySession) => void;
  readonly onCancel: (id: string) => void;
  readonly onJoin: (s: TherapySession) => void;
}) {
  const { date, time } = fmtDateTime(session.scheduledAt);
  const isPast = new Date(session.scheduledAt) < new Date();
  const isCancellable = !isPast && session.status !== "cancelled" && session.status !== "completed";

  return (
    <div className="bg-white rounded-2xl border border-brand/10 p-5 flex items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-brand/8 flex items-center justify-center shrink-0 mt-0.5">
          <CalendarCheck size={18} className="text-brand/50" />
        </div>
        <div>
          <p className="text-sm font-bold text-brand">{date}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <Clock size={11} className="text-brand/35" />
            <span className="text-xs text-brand/50">{time}</span>
          </div>
          <span className={`inline-block mt-2 text-xs font-semibold px-2.5 py-0.5 rounded-full capitalize ${statusColor(session.status)}`}>
            {session.status}
          </span>
        </div>
      </div>
      <div className="flex flex-col items-end gap-2 shrink-0">
        {session.status === "completed" && (
          <button onClick={() => onFeedback(session)}
            className="text-xs font-semibold text-brand bg-brand/10 hover:bg-brand/15 px-3 py-1.5 rounded-full transition-colors flex items-center gap-1">
            <Star size={11} /> Rate
          </button>
        )}
        {session.status === "confirmed" && (
          <button onClick={() => onJoin(session)}
            className="text-xs font-semibold text-white bg-brand hover:bg-brand/90 px-3 py-1.5 rounded-full transition-colors flex items-center gap-1 shadow-lg shadow-brand/20">
            <Video size={11} /> Join Video
          </button>
        )}
        {isCancellable && (
          <button onClick={() => onCancel(session.$id)}
            className="text-xs font-semibold text-red-500 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-full transition-colors">
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function SessionsPage() {
  const user = useUser();
  const router = useRouter();
  const [sessions, setSessions]   = useState<TherapySession[]>([]);
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [modal, setModal]         = useState<ModalView>(null);
  const [feedbackSess, setFeedbackSess] = useState<TherapySession | null>(null);
  const [loading, setLoading]     = useState(true);
  const [tab, setTab]             = useState<"upcoming" | "past">("upcoming");
  const [liveSessionId, setLiveSessionId] = useState<string | null>(null);
  const unsubscribesRef = useRef<Array<() => void>>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const profile = await getProfileByUserIdAction(user.$id);
        const [sess, therapistList] = await Promise.all([
          listPatientSessionsAction(user.$id).catch(() => [] as TherapySession[]),
          listTherapistsAction(profile?.therapistId).catch(() => [] as Therapist[]),
        ]);
        setSessions(sess);
        setTherapists(therapistList);

        // Subscribe to confirmed sessions to detect when therapist goes live
        const confirmed = (sess as TherapySession[]).filter((s: TherapySession) => s.status === "confirmed");
        const unsubs = confirmed.map((s: TherapySession) => {
          // If therapist is already live (page reload mid-call)
          if ((s as unknown as Record<string, unknown>).therapistTracks) {
            setLiveSessionId(s.$id);
          }
          const channel = `databases.${appwriteConfig.databaseId}.collections.${appwriteConfig.collections.sessions}.documents.${s.$id}`;
          const id = s.$id;
          return appwriteClient.subscribe(channel, (response: { payload: Record<string, unknown> }) => {
            if (response.payload?.therapistTracks) {
              setLiveSessionId(id);
            }
          });
        });
        unsubscribesRef.current = unsubs;
      } finally {
        setLoading(false);
      }
    })();

    return () => {
      unsubscribesRef.current.forEach((u) => u());
      unsubscribesRef.current = [];
    };
  }, [user]);

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="w-7 h-7 rounded-full border-2 border-brand border-t-transparent animate-spin" />
      </div>
    );
  }

  const plan = (user?.prefs as Record<string, string> | undefined)?.plan ?? "free";
  const allowance = PLAN_SESSIONS[plan] ?? 1;
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const used = sessions.filter((s) => s.status !== "cancelled" && new Date(s.scheduledAt) >= monthStart).length;
  const remaining = Math.max(0, allowance - used);
  const upcoming = sessions.filter((s) => s.status !== "cancelled" && s.status !== "completed" && new Date(s.scheduledAt) > now);
  const past = sessions.filter((s) => s.status === "completed" || s.status === "cancelled" || new Date(s.scheduledAt) <= now);

  function handleBooked(s: TherapySession) {
    setSessions((prev) => [s, ...prev]);
    setModal(null);
  }

  async function handleCancel(id: string) {
    await updateTherapySessionAction(id, { status: "cancelled" });
    setSessions((prev) => prev.map((s) => (s.$id === id ? { ...s, status: "cancelled" } : s)));
  }

  function openFeedback(s: TherapySession) { setFeedbackSess(s); setModal("feedback"); }

  function handleJoin(s: TherapySession) {
    router.push(`/dashboard/sessions/${s.$id}`);
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {modal === "book" && user && (
        <BookModal
          onClose={() => setModal(null)}
          canBook={remaining > 0}
          therapists={therapists}
          userId={user.$id}
          onBooked={handleBooked}
        />
      )}
      {modal === "feedback" && feedbackSess && (
        <FeedbackModal session={feedbackSess} onClose={() => setModal(null)} />
      )}

      {/* Live session banner */}
      {liveSessionId && (
        <div className="bg-brand text-white rounded-2xl px-5 py-4 mb-2 flex items-center justify-between gap-4 shadow-lg shadow-brand/20 animate-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
              <Bell size={15} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-bold">Your therapist is ready!</p>
              <p className="text-xs text-white/70">Your session is live — join now.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push(`/dashboard/sessions/${liveSessionId}`)}
              className="flex items-center gap-1.5 bg-white text-brand text-xs font-bold px-4 py-2 rounded-full hover:bg-white/90 transition-all shadow-md"
            >
              <Video size={12} /> Join Now
            </button>
            <button onClick={() => setLiveSessionId(null)} className="text-white/60 hover:text-white transition-colors" aria-label="Dismiss">
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-7">
        <div>
          <h1 className="text-xl font-bold text-brand">Sessions</h1>
          <p className="text-sm text-brand/45 mt-0.5">{remaining} of {allowance} sessions remaining this month</p>
        </div>
        <button onClick={() => setModal("book")} disabled={remaining === 0}
          className="flex items-center gap-2 bg-brand text-white text-sm font-semibold px-4 py-2.5 rounded-full hover:bg-brand/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
          <Plus size={14} /> Book session
        </button>
      </div>

      {/* Usage bar */}
      <div className="bg-white rounded-2xl border border-brand/10 p-5 mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-brand/60">Monthly usage</span>
          <span className="text-xs text-brand/40">{used}/{allowance} used</span>
        </div>
        <div className="w-full bg-cream rounded-full h-2">
          <div className="bg-brand h-2 rounded-full transition-all" style={{ width: `${Math.min(100, (used / allowance) * 100)}%` }} />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white rounded-2xl border border-brand/10 p-1.5 mb-5">
        {(["upcoming", "past"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors capitalize
              ${tab === t ? "bg-brand text-white" : "text-brand/50 hover:text-brand hover:bg-cream"}`}>
            {t} ({t === "upcoming" ? upcoming.length : past.length})
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-16"><div className="w-7 h-7 rounded-full border-2 border-brand border-t-transparent animate-spin" /></div>
      ) : (
        <div className="space-y-3">
          {(tab === "upcoming" ? upcoming : past).length === 0 ? (
            <div className="flex flex-col items-center py-16 text-center">
              <div className="w-12 h-12 rounded-2xl bg-brand/8 flex items-center justify-center mb-3">
                <CalendarCheck size={20} className="text-brand/30" />
              </div>
              <p className="text-sm text-brand/50">No {tab} sessions</p>
              {tab === "upcoming" && (
                <button onClick={() => setModal("book")} disabled={remaining === 0}
                  className="mt-4 flex items-center gap-2 bg-brand text-white text-sm font-semibold px-5 py-2.5 rounded-full hover:bg-brand/90 transition-colors disabled:opacity-50">
                  <Plus size={14} /> Book your first session
                </button>
              )}
            </div>
          ) : (
            (tab === "upcoming" ? upcoming : past).map((s) => (
              <SessionCard key={s.$id} session={s} onFeedback={openFeedback} onCancel={(id) => void handleCancel(id)} onJoin={handleJoin} />
            ))
          )}
        </div>
      )}
    </div>
  );
}
