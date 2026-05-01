"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CalendarCheck, TrendingUp, Clock, HeartHandshake, ChevronRight,
  Sparkles, Video, MessageCircle, Plus, AlertCircle, Star, Target,
} from "lucide-react";
import type { TherapySession, MoodLog, Goal } from "@/lib/appwrite/database";
import { PLAN_SESSIONS, MOOD_EMOJIS, PLACEHOLDER_THERAPIST_ID } from "@/lib/constants";
import { useUser } from "@/app/components/UserProvider";
import { 
  listPatientSessionsAction, 
  listMoodLogsAction, 
  listGoalsAction,
  getTherapistAction,
  getProfileByUserIdAction
} from "@/app/actions/database";

function MoodSparkline({ logs }: { readonly logs: MoodLog[] }) {
  if (logs.length < 2) return <p className="text-xs text-brand/35">Not enough data yet</p>;
  const w = 160; const h = 40; const pad = 4;
  const scores = logs.map((l) => l.score);
  const min = Math.min(...scores); const max = Math.max(...scores);
  const range = max - min || 1;
  const pts = scores.map((s, i) => {
    const x = pad + (i / (scores.length - 1)) * (w - pad * 2);
    const y = h - pad - ((s - min) / range) * (h - pad * 2);
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      <polyline points={pts} fill="none" stroke="#35858E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {scores.map((s, i) => {
        const x = pad + (i / (scores.length - 1)) * (w - pad * 2);
        const y = h - pad - ((s - min) / range) * (h - pad * 2);
        return <circle key={`${i}-${s}`} cx={x} cy={y} r="2.5" fill="#35858E" />;
      })}
    </svg>
  );
}

export default function DashboardHome() {
  const user = useUser();
  const [sessions, setSessions] = useState<TherapySession[]>([]);
  const [moodLogs, setMoodLogs] = useState<MoodLog[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [therapistName, setTherapistName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    
    (async () => {
      try {
        const [sess, moods, goalList, profile] = await Promise.all([
          listPatientSessionsAction(user.$id).catch(() => [] as TherapySession[]),
          listMoodLogsAction(user.$id, 7).catch(() => [] as MoodLog[]),
          listGoalsAction(user.$id).catch(() => [] as Goal[]),
          getProfileByUserIdAction(user.$id).catch(() => null),
        ]);
        setSessions(sess);
        setMoodLogs(moods);
        setGoals(goalList);
        
        const tid = profile?.therapistId || sess[0]?.therapistId;
        if (tid) {
          try {
            const t = await getTherapistAction(tid);
            setTherapistName(t.name);
          } catch {
            setTherapistName(null);
          }
        } else {
          setTherapistName(null);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  if (!user || loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="w-7 h-7 rounded-full border-2 border-brand border-t-transparent animate-spin" />
      </div>
    );
  }

  const firstName = user.name?.split(" ")[0] ?? "there";
  const plan = ((user.prefs as Record<string, string> | undefined)?.plan) ?? "free";
  const allowance = PLAN_SESSIONS[plan] ?? 1;
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const completed = sessions.filter((s) => s.status === "completed").length;
  const used = sessions.filter((s) => s.status !== "cancelled" && new Date(s.scheduledAt) >= monthStart).length;
  const remaining = Math.max(0, allowance - used);
  const upcoming = sessions
    .filter((s) => s.status !== "cancelled" && s.status !== "completed" && new Date(s.scheduledAt) > now)
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  const nextSession = upcoming[0] ?? null;
  const activeGoals = goals.filter((g) => !g.completedAt);
  const latestMood = moodLogs.at(-1);
  const latestMoodEmoji = MOOD_EMOJIS.find((m) => m.score === latestMood?.score);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Welcome */}
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 bg-brand/10 text-brand text-sm font-medium px-4 py-1.5 rounded-full mb-3">
          <Sparkles size={13} /> Your wellness dashboard
        </div>
        <h1 className="text-2xl font-bold text-brand">Good to see you, {firstName} 👋</h1>
        <p className="text-brand/50 text-sm mt-1">Here&apos;s your mental wellness overview for today.</p>
      </div>

      {/* Next session + Therapist snapshot */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-brand/10 p-6">
          <div className="flex items-center gap-2 mb-4">
            <CalendarCheck size={15} className="text-brand" />
            <span className="text-xs font-bold text-brand uppercase tracking-wide">Next Session</span>
          </div>
          {nextSession ? (
            <>
              <p className="text-lg font-bold text-brand">
                {new Date(nextSession.scheduledAt).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
              </p>
              <p className="text-sm text-brand/50 mb-1">
                {new Date(nextSession.scheduledAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
              </p>
              <span className="inline-flex items-center gap-1 text-xs text-brand/50 bg-cream px-2.5 py-1 rounded-full mb-4">
                <Video size={11} /> Video call
              </span>
              <div className="flex gap-2">
                <button className="flex-1 flex items-center justify-center gap-1.5 bg-brand text-white text-xs font-semibold py-2 rounded-full hover:bg-brand/90 transition-colors">
                  <Video size={12} /> Join
                </button>
                <Link href="/dashboard/sessions"
                  className="flex-1 flex items-center justify-center text-xs font-semibold text-brand border border-brand/20 py-2 rounded-full hover:bg-cream transition-colors">
                  Reschedule
                </Link>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-4 py-4">
              {/* Butterfly illustration — echoes the logo */}
              <svg viewBox="0 0 80 60" className="w-16 h-12 opacity-25" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M40 30 C30 20 10 18 8 28 C6 38 20 42 40 30Z" fill="#33b2a1" />
                <path d="M40 30 C50 20 70 18 72 28 C74 38 60 42 40 30Z" fill="#1BB8C8" />
                <path d="M40 30 C32 36 18 44 20 52 C22 58 34 54 40 30Z" fill="#4BC96A" />
                <path d="M40 30 C48 36 62 44 60 52 C58 58 46 54 40 30Z" fill="#33b2a1" />
                <ellipse cx="40" cy="28" rx="2" ry="5" fill="#1BB8C8" />
              </svg>
              <p className="text-sm text-brand/50 text-center">No upcoming sessions scheduled.</p>
              <Link href="/dashboard/sessions"
                className="flex items-center gap-1.5 bg-brand text-white text-xs font-semibold px-4 py-2 rounded-full hover:bg-brand/90 transition-colors">
                <Plus size={12} /> Book a session
              </Link>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-brand/10 p-6">
          <div className="flex items-center gap-2 mb-4">
            <HeartHandshake size={15} className="text-brand" />
            <span className="text-xs font-bold text-brand uppercase tracking-wide">Your Therapist</span>
          </div>
          {therapistName ? (
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-brand/10 flex items-center justify-center text-brand font-bold text-lg">
                {therapistName[0]}
              </div>
              <div>
                <p className="text-base font-bold text-brand">{therapistName}</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span className="text-xs text-brand/40">Available</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-cream flex items-center justify-center text-brand/30 font-bold text-lg">?</div>
              <div>
                <p className="text-sm font-semibold text-brand/60">Not yet assigned</p>
                <p className="text-xs text-brand/35">Complete onboarding to match</p>
              </div>
            </div>
          )}
          <Link href="/dashboard/messages"
            className="flex items-center justify-center gap-2 w-full border border-brand/20 text-brand text-xs font-semibold py-2 rounded-full hover:bg-cream transition-colors">
            <MessageCircle size={13} /> Send a message
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { icon: CalendarCheck, label: "Sessions left", value: `${remaining}/${allowance}`, accent: remaining > 0 },
          { icon: TrendingUp,    label: "Completed",     value: String(completed) },
          { icon: Clock,         label: "Hours",         value: `${(completed * 50 / 60).toFixed(1)}h` },
          { icon: Target,        label: "Active goals",  value: String(activeGoals.length) },
        ].map(({ icon: Icon, label, value, accent }) => (
          <div key={label} className={`rounded-2xl border p-4 ${accent ? "bg-brand border-brand" : "bg-white border-brand/10"}`}>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center mb-2 ${accent ? "bg-white/20" : "bg-brand/10"}`}>
              <Icon size={15} className={accent ? "text-white" : "text-brand"} />
            </div>
            <p className={`text-xl font-bold ${accent ? "text-white" : "text-brand"}`}>{value}</p>
            <p className={`text-xs mt-0.5 ${accent ? "text-white/55" : "text-brand/40"}`}>{label}</p>
          </div>
        ))}
      </div>

      {/* Mood trend + Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-brand/10 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp size={15} className="text-brand" />
              <span className="text-xs font-bold text-brand uppercase tracking-wide">Mood — last 7 days</span>
            </div>
            <Link href="/dashboard/progress" className="flex items-center gap-1 text-xs text-brand/50 hover:text-brand transition-colors">
              Full report <ChevronRight size={12} />
            </Link>
          </div>
          <div className="flex items-end gap-6">
            <MoodSparkline logs={moodLogs} />
            {latestMood && latestMoodEmoji ? (
              <div className="flex flex-col items-center">
                <span className="text-3xl">{latestMoodEmoji.emoji}</span>
                <span className="text-xs text-brand/50 mt-1">{latestMoodEmoji.label}</span>
                <span className="text-xs text-brand/30">Today</span>
              </div>
            ) : (
              <Link href="/dashboard/progress"
                className="flex items-center gap-1.5 text-xs text-brand bg-brand/10 px-3 py-2 rounded-full hover:bg-brand/15 transition-colors whitespace-nowrap">
                <Plus size={11} /> Log today&apos;s mood
              </Link>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-brand/10 p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle size={15} className="text-brand" />
            <span className="text-xs font-bold text-brand uppercase tracking-wide">Alerts</span>
          </div>
          <div className="space-y-2">
            {remaining === 0 && (
              <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-xl border border-amber-100">
                <AlertCircle size={13} className="text-amber-500 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-700">No sessions left. <Link href="/dashboard/billing" className="underline font-semibold">Upgrade plan</Link></p>
              </div>
            )}
            {activeGoals.length === 0 && (
              <div className="flex items-start gap-2 p-3 bg-brand/5 rounded-xl">
                <Target size={13} className="text-brand/50 mt-0.5 shrink-0" />
                <p className="text-xs text-brand/60">No active goals. <Link href="/dashboard/goals" className="underline font-semibold">Add a goal</Link></p>
              </div>
            )}
            <div className="flex items-start gap-2 p-3 bg-brand/5 rounded-xl">
              <Star size={13} className="text-brand mt-0.5 shrink-0" />
              <p className="text-xs text-brand/70">Keep logging your mood daily for better insights.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
