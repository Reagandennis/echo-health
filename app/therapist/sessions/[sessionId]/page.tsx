"use client";

import { useEffect, useState, Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { 
  getSessionAction, 
  getProfileByUserIdAction, 
  updateTherapySessionAction,
  getTherapistByUserIdAction
} from "@/app/actions/database";
import { ArrowLeft, Clock, User, FileText, CheckCircle, XCircle, Video, Maximize2, Minimize2, Loader2 } from "lucide-react";
import Link from "next/link";
import VideoRoom from "@/app/components/video/VideoRoom";
import { useUser } from "@/app/components/UserProvider";
import type { TherapySession } from "@/lib/appwrite/database";

interface Profile { $id: string; name: string; email: string; }

const STATUS_COLORS: Record<string, string> = {
  confirmed: "bg-brand/10 text-brand",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-600",
  pending: "bg-amber-100 text-amber-700",
  "in-progress": "bg-blue-100 text-blue-700",
};

function SessionDetailContent() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const searchParams = useSearchParams();
  const autoStart = searchParams.get("autoStart") === "true";
  const user = useUser();

  const [session, setSession] = useState<TherapySession | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [fullScreenVideo, setFullScreenVideo] = useState(false);
  const [videoStarted, setVideoStarted] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const sess = await getSessionAction(sessionId) as TherapySession;

        // Access control — sess.therapistId is the therapist *document* $id,
        // not the auth user $id. Resolve the therapist doc first, then compare.
        if (user) {
          const therapistDoc = await getTherapistByUserIdAction(user.$id);
          if (!therapistDoc || therapistDoc.$id !== sess.therapistId) {
            globalThis.location.replace("/therapist/sessions");
            return;
          }
        }

        setSession(sess);
        setNotes(sess.notes ?? "");

        // Handle auto-start: just open video locally, no DB write needed
        if (autoStart && sess.status !== "completed" && sess.status !== "cancelled") {
          setVideoStarted(true);
        }

        if (sess.patientId) {
          const prof = await getProfileByUserIdAction(sess.patientId) as unknown as Profile;
          setProfile(prof);
        }
      } catch (err) {
        console.error("Fetch session detail error:", err);
      }
      setLoading(false);
    })();
  }, [sessionId, autoStart, user]);

  async function saveNotes() {
    if (!session) return;
    setSaving(true);
    try {
      await updateTherapySessionAction(session.$id, { notes });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch { /* empty */ }
    setSaving(false);
  }

  async function updateStatus(status: TherapySession["status"], id?: string) {
    const targetId = id || session?.$id;
    if (!targetId) return;
    setUpdating(true);
    try {
      const updated = await updateTherapySessionAction(targetId, { status });
      setSession(updated as TherapySession);
    } catch (err) {
      console.error("Failed to update session status:", err);
      alert("Could not update session status. Please try again.");
    }
    setUpdating(false);
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 rounded-full border-2 border-brand border-t-transparent animate-spin" /></div>;
  if (!session) return <div className="p-8 text-center text-stone-500">Session not found.</div>;

  const isInProgress = videoStarted;

  return (
    <div className={`p-6 mx-auto space-y-6 ${isInProgress && !fullScreenVideo ? "max-w-6xl" : "max-w-3xl"}`}>
      <div className="flex items-center justify-between">
        <Link href="/therapist/sessions" className="inline-flex items-center gap-2 text-sm text-stone-500 hover:text-brand transition-colors">
          <ArrowLeft size={14} /> All sessions
        </Link>
        {isInProgress && (
          <button 
            onClick={() => setFullScreenVideo(!fullScreenVideo)}
            className="text-xs font-semibold text-stone-500 hover:text-brand flex items-center gap-1.5 bg-white border border-stone-200 px-3 py-1.5 rounded-lg shadow-sm transition-all"
          >
            {fullScreenVideo ? <><Minimize2 size={13} /> Exit Full View</> : <><Maximize2 size={13} /> Focus Video</>}
          </button>
        )}
      </div>

      <div className={`grid gap-6 ${isInProgress && !fullScreenVideo ? "lg:grid-cols-3" : "grid-cols-1"}`}>
        {/* Main Content (Video or Header/Actions) */}
        <div className={`${isInProgress && !fullScreenVideo ? "lg:col-span-2" : ""}`}>
          <div className="space-y-6 h-full flex flex-col">
            {session.status === "pending" && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                    <Clock size={20} className="text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-amber-800">Pending Appointment</p>
                    <p className="text-xs text-amber-600">This session needs your confirmation before it can start.</p>
                  </div>
                </div>
                <button 
                  disabled={updating}
                  onClick={() => updateStatus("confirmed")}
                  className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-brand text-white text-sm font-bold hover:bg-brand/90 transition-all shadow-md shadow-brand/10 disabled:opacity-50"
                >
                  {updating ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                  Confirm Now
                </button>
              </div>
            )}

            <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden flex flex-col h-full flex-1">
              {/* Session Header (Internal) */}
              <div className="p-6 border-b border-stone-100 bg-stone-50/50">
                <div className="flex items-start justify-between">
                  <div>
                    <h1 className="text-xl font-bold text-stone-900">Therapy Session</h1>
                    <div className="flex items-center gap-2 mt-1">
                      <Clock size={13} className="text-stone-400" />
                      <span className="text-sm text-stone-500">{new Date(session.scheduledAt).toLocaleString()}</span>
                      <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-bold ${STATUS_COLORS[session.status] ?? "bg-stone-100 text-stone-600"}`}>{session.status}</span>
                    </div>
                  </div>
                  {profile && (
                    <Link href={`/therapist/clients/${session.patientId}`} className="flex items-center gap-2 bg-white border border-stone-200 rounded-xl px-3 py-2 hover:bg-stone-50 transition-colors shadow-sm">
                      <div className="w-8 h-8 rounded-full bg-brand/10 text-brand flex items-center justify-center font-bold text-xs">{profile.name.charAt(0)}</div>
                      <div>
                        <p className="text-xs font-bold text-stone-800">{profile.name}</p>
                        <p className="text-[10px] text-stone-400">{profile.email}</p>
                      </div>
                    </Link>
                  )}
                </div>

                {/* Actions */}
                {(session.status === "confirmed" || session.status === "pending") && !videoStarted && (
                  <div className="flex gap-2 mt-6">
                    <button 
                      disabled={updating}
                      onClick={() => setVideoStarted(true)} 
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand text-white text-sm font-bold hover:opacity-90 shadow-md shadow-brand/20 transition-all disabled:opacity-50"
                    >
                      {updating ? <Loader2 className="animate-spin w-4 h-4" /> : <Video size={16} />} 
                      Start Video Session
                    </button>
                    <button 
                      disabled={updating}
                      onClick={() => updateStatus("cancelled")} 
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-red-600 border border-red-100 text-sm font-semibold hover:bg-red-50 transition-all disabled:opacity-50"
                    >
                      <XCircle size={16} /> Cancel
                    </button>
                  </div>
                )}
              </div>

              {/* Video Room Section */}
              {isInProgress ? (
                <div className="flex-1 bg-stone-900 min-h-[500px]">
                  <VideoRoom sessionId={session.$id} userId={user?.$id ?? ""} role="therapist" onLeave={() => updateStatus("completed")} />
                </div>
              ) : (
                <div className="p-12 text-center flex-1 flex flex-col items-center justify-center text-stone-400 bg-stone-50/20 min-h-[300px]">
                  <Video size={48} strokeWidth={1} className="mb-4 opacity-20" />
                  <p className="text-sm font-medium">Video call will appear here when started.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar (Notes & Feedback) */}
        <div className={`space-y-6 ${isInProgress && !fullScreenVideo ? "lg:col-span-1" : ""}`}>
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6 space-y-4">
            <div className="flex items-center gap-2">
              <FileText size={16} className="text-brand" />
              <label htmlFor="session-notes" className="text-sm font-bold text-stone-700">Clinical Notes</label>
            </div>
            <textarea 
              id="session-notes" 
              value={notes} 
              onChange={(e) => setNotes(e.target.value)} 
              rows={isInProgress && !fullScreenVideo ? 15 : 8}
              placeholder="Document the session progress, observations, and next steps…"
              className="w-full rounded-xl border border-stone-200 p-4 text-sm text-stone-800 outline-none focus:border-brand focus:ring-4 focus:ring-brand/10 transition-all resize-none placeholder:text-stone-300" 
            />
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium text-stone-400 uppercase tracking-widest">{notes.length} characters</span>
              <button onClick={saveNotes} disabled={saving}
                className="px-5 py-2 rounded-full bg-stone-900 text-white text-xs font-bold hover:bg-stone-800 transition-all disabled:opacity-50">
                {saving ? "Saving…" : saved ? "Saved ✓" : "Save Notes"}
              </button>
            </div>
          </div>

          {/* Client feedback */}
          {session.feedback && (
            <div className="bg-emerald-50 rounded-2xl border border-emerald-100 p-5">
              <div className="flex items-center gap-2 mb-3">
                <User size={14} className="text-emerald-600" />
                <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Client Feedback</p>
              </div>
              <p className="text-sm text-emerald-800 leading-relaxed font-medium">&ldquo;{session.feedback}&rdquo;</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SessionDetailPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen"><div className="w-8 h-8 rounded-full border-2 border-brand border-t-transparent animate-spin" /></div>}>
      <SessionDetailContent />
    </Suspense>
  );
}
