"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  CalendarCheck, TrendingUp, Clock, HeartHandshake, ChevronRight,
  Video, MessageCircle, Plus, AlertCircle, Star, Target,
} from "lucide-react";
import type { TherapySession, MoodLog, Goal } from "@/lib/types/documents";
import { MOOD_EMOJIS } from "@/lib/constants";
import { useUser } from "@/app/components/UserProvider";
import {
  listPatientSessionsAction,
  listMoodLogsAction,
  listGoalsAction,
  getTherapistAction,
  getProfileByUserIdAction,
  getSessionCreditsAction
} from "@/app/actions/database";

function MoodSparkline({ logs }: { readonly logs: MoodLog[] }) {
  if (logs.length < 2) return <p className="text-xs text-stone-400">Not enough data yet</p>;
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
      <polyline points={pts} fill="none" className="stroke-brand-600" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {scores.map((s, i) => {
        const x = pad + (i / (scores.length - 1)) * (w - pad * 2);
        const y = h - pad - ((s - min) / range) * (h - pad * 2);
        return <circle key={`${i}-${s}`} cx={x} cy={y} r="2.5" className="fill-brand-600" />;
      })}
    </svg>
  );
}

function CardLabel({ icon: Icon, children }: { readonly icon: typeof CalendarCheck; readonly children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <Icon size={15} className="text-brand-600" />
      <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">{children}</span>
    </div>
  );
}

const CARD = "rounded-2xl border border-stone-200/80 bg-white p-6 shadow-xs";

export default function DashboardHome() {
  const user = useUser();
  const [sessions, setSessions] = useState<TherapySession[]>([]);
  const [moodLogs, setMoodLogs] = useState<MoodLog[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [therapistName, setTherapistName] = useState<string | null>(null);
  const [credits, setCredits] = useState({ entitled: 0, used: 0, remaining: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    (async () => {
      try {
        const [creditData, sess, moods, goalList, profile] = await Promise.all([
          getSessionCreditsAction().catch(() => ({ entitled: 0, used: 0, remaining: 0 })),
          listPatientSessionsAction(user.$id).catch(() => [] as TherapySession[]),
          listMoodLogsAction(user.$id, 7).catch(() => [] as MoodLog[]),
          listGoalsAction(user.$id).catch(() => [] as Goal[]),
          getProfileByUserIdAction(user.$id).catch(() => null),
        ]);
        setCredits(creditData);
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
  // Credits come from the server so the display cannot disagree with what
  // booking actually enforces. Previously computed here from the current
  // plan and the calendar month, which was wrong on both counts.
  const allowance = credits.entitled;
  const now = new Date();
  const completed = sessions.filter((s) => s.status === "completed").length;
  const remaining = credits.remaining;
  const upcoming = sessions
    .filter((s) => s.status !== "cancelled" && s.status !== "completed" && new Date(s.scheduledAt) > now)
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  const nextSession = upcoming[0] ?? null;
  const activeGoals = goals.filter((g) => !g.completedAt);
  const latestMood = moodLogs.at(-1);
  const latestMoodEmoji = MOOD_EMOJIS.find((m) => m.score === latestMood?.score);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      {/* Welcome */}
      <div className="mb-8">
        <p className="text-sm font-medium text-brand-700">Your wellness dashboard</p>
        <h1 className="mt-1 font-display text-3xl tracking-tight text-stone-900 sm:text-4xl">
          Good to see you, {firstName} 👋
        </h1>
        <p className="mt-2 text-sm text-stone-500">Here&apos;s your mental wellness overview for today.</p>
      </div>

      {/* Next session + Therapist snapshot */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <section className={`flex flex-col ${CARD}`}>
          <CardLabel icon={CalendarCheck}>Next session</CardLabel>
          {nextSession ? (
            <div className="mt-4">
              <p className="text-lg font-semibold text-stone-900">
                {new Date(nextSession.scheduledAt).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
              </p>
              <p className="mb-3 text-sm text-stone-500">
                {new Date(nextSession.scheduledAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
              </p>
              <span className="mb-5 inline-flex items-center gap-1.5 rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-600">
                <Video size={12} /> Video call
              </span>
              <div className="flex gap-2">
                {/* Was a <button> with no handler. The session page is where
                    the call is joined from. */}
                <Link href={`/dashboard/sessions/${nextSession.$id}`}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-brand py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700">
                  <Video size={14} /> Join
                </Link>
                <Link href="/dashboard/sessions"
                  className="flex flex-1 items-center justify-center rounded-full py-2.5 text-sm font-semibold text-stone-700 ring-1 ring-inset ring-stone-300 transition hover:bg-stone-50">
                  Reschedule
                </Link>
              </div>
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 py-4 text-center">
              <Image src="/echo-logo-mark.png" alt="" width={48} height={48} loading="eager" className="opacity-40" />
              <p className="text-sm text-stone-500">No upcoming sessions scheduled.</p>
              <Link href="/dashboard/sessions"
                className="inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700">
                <Plus size={14} /> Book a session
              </Link>
            </div>
          )}
        </section>

        <section className={`flex flex-col ${CARD}`}>
          <CardLabel icon={HeartHandshake}>Your therapist</CardLabel>
          {therapistName ? (
            <div className="mb-5 mt-4 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-100 text-lg font-semibold text-brand-800">
                {therapistName[0]}
              </div>
              <div>
                <p className="text-base font-semibold text-stone-900">{therapistName}</p>
                {/* Said "Available" beside a green dot, on every render — it was
                    never derived from the therapist's actual availability. */}
                <p className="mt-0.5 text-xs text-stone-500">Your matched therapist</p>
              </div>
            </div>
          ) : (
            <div className="mb-5 mt-4 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-stone-100 text-lg font-semibold text-stone-400">?</div>
              <div>
                <p className="text-sm font-semibold text-stone-700">Not yet assigned</p>
                <p className="text-xs text-stone-500">Complete onboarding to match</p>
              </div>
            </div>
          )}
          <Link href="/dashboard/messages"
            className="mt-auto flex w-full items-center justify-center gap-2 rounded-full py-2.5 text-sm font-semibold text-stone-700 ring-1 ring-inset ring-stone-300 transition hover:bg-stone-50">
            <MessageCircle size={14} /> Send a message
          </Link>
        </section>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { icon: CalendarCheck, label: "Sessions left", value: `${remaining}/${allowance}`, accent: remaining > 0 },
          { icon: TrendingUp,    label: "Completed",     value: String(completed) },
          { icon: Clock,         label: "Hours",         value: `${(completed * 50 / 60).toFixed(1)}h` },
          { icon: Target,        label: "Active goals",  value: String(activeGoals.length) },
        ].map(({ icon: Icon, label, value, accent }) => (
          <div key={label} className={`rounded-2xl p-4 ${accent ? "bg-brand-gradient shadow-md shadow-brand-900/10" : "border border-stone-200/80 bg-white shadow-xs"}`}>
            <div className={`mb-3 flex h-8 w-8 items-center justify-center rounded-lg ${accent ? "bg-white/15" : "bg-brand-50"}`}>
              <Icon size={15} className={accent ? "text-white" : "text-brand-700"} />
            </div>
            <p className={`text-2xl font-semibold tracking-tight tabular-nums ${accent ? "text-white" : "text-stone-900"}`}>{value}</p>
            <p className={`mt-0.5 text-xs ${accent ? "text-white/80" : "text-stone-500"}`}>{label}</p>
          </div>
        ))}
      </div>

      {/* Mood trend + Alerts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className={`lg:col-span-2 ${CARD}`}>
          <div className="mb-5 flex items-center justify-between">
            <CardLabel icon={TrendingUp}>Mood — last 7 days</CardLabel>
            <Link href="/dashboard/progress" className="flex items-center gap-1 text-xs font-medium text-stone-500 transition-colors hover:text-brand-700">
              Full report <ChevronRight size={12} />
            </Link>
          </div>
          <div className="flex items-end gap-6">
            <MoodSparkline logs={moodLogs} />
            {latestMood && latestMoodEmoji ? (
              <div className="flex flex-col items-center">
                <span className="text-3xl">{latestMoodEmoji.emoji}</span>
                <span className="mt-1 text-xs font-medium text-stone-600">{latestMoodEmoji.label}</span>
                <span className="text-xs text-stone-400">Today</span>
              </div>
            ) : (
              <Link href="/dashboard/progress"
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-700 ring-1 ring-inset ring-brand-100 transition-colors hover:bg-brand-100">
                <Plus size={12} /> Log today&apos;s mood
              </Link>
            )}
          </div>
        </section>

        <section className={CARD}>
          <div className="mb-4">
            <CardLabel icon={AlertCircle}>Alerts</CardLabel>
          </div>
          <div className="space-y-2">
            {remaining === 0 && (
              <div className="flex items-start gap-2.5 rounded-xl bg-amber-50 p-3 ring-1 ring-inset ring-amber-200/70">
                <AlertCircle size={14} className="mt-0.5 shrink-0 text-amber-600" />
                <p className="text-xs leading-5 text-amber-800">No sessions left. <Link href="/dashboard/billing" className="font-semibold underline underline-offset-2">Upgrade plan</Link></p>
              </div>
            )}
            {activeGoals.length === 0 && (
              <div className="flex items-start gap-2.5 rounded-xl bg-stone-50 p-3 ring-1 ring-inset ring-stone-200/70">
                <Target size={14} className="mt-0.5 shrink-0 text-stone-400" />
                <p className="text-xs leading-5 text-stone-600">No active goals. <Link href="/dashboard/goals" className="font-semibold text-brand-700 underline underline-offset-2">Add a goal</Link></p>
              </div>
            )}
            <div className="flex items-start gap-2.5 rounded-xl bg-brand-50/70 p-3 ring-1 ring-inset ring-brand-100">
              <Star size={14} className="mt-0.5 shrink-0 text-brand-600" />
              <p className="text-xs leading-5 text-stone-600">Keep logging your mood daily for better insights.</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
