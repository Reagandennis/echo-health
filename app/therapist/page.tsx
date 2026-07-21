"use client";

import { useEffect, useState } from "react";
import { useUser } from "@/app/components/UserProvider";
import { 
  getTherapistDashboardAction,
  updateTherapySessionAction
} from "@/app/actions/database";
import {
  Users, CalendarCheck, FileText, Clock, TrendingUp,
  AlertCircle, CheckCircle2, ArrowRight, Sparkles,
  XCircle, ShieldCheck, ShieldAlert, Loader2, Video, MessageCircle,
  Calendar
} from "lucide-react";
import Link from "next/link";
import { KYC_STATUS_COPY, type KycStatus } from "@/lib/kyc";

/**
 * Presentation for each KYC state, keyed off the `tone` that `KYC_STATUS_COPY`
 * already declares. The WORDS come from `lib/kyc.ts` so this banner and the
 * onboarding flow cannot drift apart — they previously carried four hand-written
 * copies of the same four messages, and disagreed on what "rejected" meant.
 *
 * `cta` is absent for `pending` and `verified` on purpose: neither state has an
 * action the therapist can usefully take here.
 */
const KYC_BANNER: Record<
  KycStatus,
  {
    wrap: string;
    title: string;
    body: string;
    iconWrap: string;
    icon: string;
    Icon: typeof ShieldCheck;
    cta?: { href: string; label: string; className: string };
  }
> = {
  incomplete: {
    wrap: "bg-amber-50 border-amber-200",
    title: "text-amber-900",
    body: "text-amber-700",
    iconWrap: "bg-amber-100",
    icon: "text-amber-600",
    Icon: ShieldAlert,
    cta: {
      href: "/onboarding/therapist",
      label: "Continue setup",
      className: "text-amber-900 bg-amber-100 hover:bg-amber-200",
    },
  },
  pending: {
    wrap: "bg-amber-50 border-amber-200",
    title: "text-amber-900",
    body: "text-amber-700",
    iconWrap: "bg-amber-100",
    icon: "text-amber-600",
    Icon: Clock,
  },
  verified: {
    wrap: "bg-emerald-50 border-emerald-200",
    title: "text-emerald-900",
    body: "text-emerald-700",
    iconWrap: "bg-emerald-100",
    icon: "text-emerald-600",
    Icon: ShieldCheck,
  },
  rejected: {
    wrap: "bg-red-50 border-red-200",
    title: "text-red-900",
    body: "text-red-700",
    iconWrap: "bg-red-100",
    icon: "text-red-600",
    Icon: XCircle,
    cta: {
      href: "/onboarding/therapist",
      label: "Review and resubmit",
      className: "text-red-800 bg-red-100 hover:bg-red-200",
    },
  },
};

interface Session {
  $id: string;
  patientId: string;
  scheduledAt: string;
  status: string;
  /** Real column since the Postgres migration; was packed into `notes` before. */
  sessionType?: string;
  notes?: string;
}

function fmt(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
}

export default function TherapistHomePage() {
  const user = useUser();
  const [therapistName, setTherapistName] = useState("");
  /**
   * `null` means "not established yet" — still loading, or the load failed.
   *
   * It is NOT a fourth status and nothing renders for it, which is the point.
   * This used to default to "incomplete" and be assigned with
   * `?? "incomplete"`, so any path that failed to produce a value — a query
   * that did not select the column, a thrown action swallowed by the catch
   * below — presented as a definite "you have not submitted your KYC", with a
   * button inviting a fully verified clinician to start the process again.
   *
   * There is no safe default here. Guessing "incomplete" accuses the therapist;
   * guessing "verified" would show unearned access. So it does not guess.
   */
  const [kycStatus, setKycStatus] = useState<KycStatus | null>(null);
  const [todaySessions, setTodaySessions] = useState<Session[]>([]);
  const [pendingRequests, setPendingRequests] = useState<Session[]>([]);
  const [stats, setStats] = useState({ total: 0, thisWeek: 0, pending: 0 });
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState<string | null>(null);

  // Ticks every 30s. Calling Date.now() during render is impure — React may
  // render at any time, so the value is non-deterministic — and it also meant
  // the "starting soon" badge never updated until something else re-rendered.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setTherapistName(user.name?.split(" ")[0] ?? "Doctor");

      // One round-trip-efficient call instead of three. The therapist lookup used
      // to gate a second wave of queries, so nothing could start until it
      // resolved; this resolves and reads in a single transaction.
      try {
        const { therapist, stats: s, today, pending } = await getTherapistDashboardAction();

        if (!therapist) {
          setLoading(false);
          return;
        }

        // No `?? "incomplete"`. If the server did not return a status, the
        // honest state is "unknown" — see the note on `kycStatus` above.
        const status = therapist.kycStatus;
        if (status === "incomplete" || status === "pending" || status === "verified" || status === "rejected") {
          setKycStatus(status);
        } else {
          // Reaching here means the action's projection and this component have
          // drifted apart again. Loud in the console, silent in the UI.
          console.error("therapist dashboard: kycStatus missing from getTherapistDashboardAction", { status });
        }

        setTodaySessions(today);
        setPendingRequests(pending as unknown as Session[]);
        if (s) setStats({ total: s.all, thisWeek: s.thisWeek, pending: s.pending });
      } catch (err) {
        // Leaves kycStatus null, so a failed load shows no KYC banner at all
        // rather than defaulting to the one that tells a verified therapist to
        // start over.
        console.error("therapist dashboard load failed:", err);
      }
      setLoading(false);
    })();
  }, [user]);

  async function handleConfirm(sessionId: string) {
    setConfirming(sessionId);
    try {
      await updateTherapySessionAction(sessionId, { status: "confirmed" });
      setPendingRequests(prev => prev.filter(s => s.$id !== sessionId));
      setStats(prev => ({ ...prev, pending: prev.pending - 1 }));
      // Refresh today's agenda in case the confirmed session is today. Same
      // single-transaction call as the initial load rather than re-resolving the
      // therapist and re-querying stats separately.
      const { today } = await getTherapistDashboardAction();
      setTodaySessions(today);
    } catch (err) {
      console.error(err);
      alert("Failed to confirm session.");
    }
    setConfirming(null);
  }

  const statCards = [
    { label: "Total Sessions", value: stats.total, icon: CalendarCheck, color: "bg-brand/10 text-brand" },
    { label: "This Week", value: stats.thisWeek, icon: TrendingUp, color: "bg-emerald-100 text-emerald-600" },
    { label: "Pending Approval", value: stats.pending, icon: Clock, color: "bg-amber-100 text-amber-600" },
    { label: "Today's Sessions", value: todaySessions.length, icon: CheckCircle2, color: "bg-purple-100 text-purple-600" },
  ];

  const quickLinks = [
    { href: "/therapist/clients", label: "View Clients", icon: Users },
    { href: "/therapist/notes", label: "Write Note", icon: FileText },
    { href: "/therapist/sessions", label: "Full Calendar", icon: CalendarCheck },
    { href: "/therapist/assessments", label: "Assessments", icon: Sparkles },
  ];

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 rounded-full border-2 border-brand border-t-transparent animate-spin" />
    </div>
  );

  return (
    <div className="p-6 space-y-8 max-w-5xl mx-auto">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold text-stone-900">Good morning, {therapistName} 👋</h1>
        <p className="text-stone-500 mt-1">{fmtDate(new Date().toISOString())} — here&apos;s your day at a glance.</p>
      </div>

      {/*
        KYC / verification status card.

        Renders NOTHING while `kycStatus` is null. That is not an oversight — see
        the note on the state declaration. A null status means "we do not know",
        and the previous `?? "incomplete"` turned every failed load into an
        accusation that a verified clinician had skipped their KYC.
      */}
      {kycStatus !== null && (() => {
        const copy = KYC_STATUS_COPY[kycStatus];
        const b = KYC_BANNER[kycStatus];
        return (
          <div className={`border rounded-2xl p-5 flex items-start gap-4 ${b.wrap}`}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${b.iconWrap}`}>
              <b.Icon size={20} className={b.icon} />
            </div>
            <div className="flex-1 min-w-0">
              <p className={`font-semibold ${b.title}`}>{copy.title}</p>
              <p className={`text-sm mt-0.5 leading-relaxed ${b.body}`}>{copy.body}</p>
              {b.cta && (
                <Link
                  href={b.cta.href}
                  className={`inline-flex items-center gap-1.5 mt-3 text-sm font-semibold px-4 py-2 rounded-xl transition-colors ${b.cta.className}`}
                >
                  {b.cta.label} <ArrowRight size={14} />
                </Link>
              )}
            </div>
          </div>
        );
      })()}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-stone-200 p-5 shadow-sm">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${color}`}>
              <Icon size={18} />
            </div>
            <p className="text-2xl font-bold text-stone-900">{value}</p>
            <p className="text-xs text-stone-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Left Column: Pending Requests & Agenda */}
        <div className="space-y-6">
          {pendingRequests.length > 0 && (
            <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden border-l-4 border-l-amber-400">
              <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between bg-amber-50/30">
                <div className="flex items-center gap-2">
                  <Clock size={16} className="text-amber-600" />
                  <h2 className="font-bold text-stone-900 text-sm uppercase tracking-wider">Pending Requests</h2>
                </div>
                <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full">{pendingRequests.length}</span>
              </div>
              <div className="divide-y divide-stone-100">
                {pendingRequests.map((s) => (
                  <div key={s.$id} className="p-6 space-y-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-stone-50 flex items-center justify-center border border-stone-100">
                          <Calendar size={18} className="text-stone-400" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-stone-800">{new Date(s.scheduledAt).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p>
                          <p className="text-xs text-stone-500 font-medium">{new Date(s.scheduledAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleConfirm(s.$id)}
                          disabled={confirming === s.$id}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand text-white text-xs font-bold hover:bg-brand/90 transition-all shadow-md shadow-brand/10 disabled:opacity-50"
                        >
                          {confirming === s.$id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                          Confirm
                        </button>
                        <Link 
                          href={`/therapist/sessions/${s.$id}`}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-stone-100 text-stone-600 text-xs font-bold hover:bg-stone-200 transition-all"
                        >
                          Details
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Today's agenda */}
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm">
          <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between">
            <h2 className="font-semibold text-stone-900">Today&apos;s Agenda</h2>
            <Link href="/therapist/sessions" className="text-xs text-brand font-medium flex items-center gap-1 hover:underline">
              Full calendar <ArrowRight size={12} />
            </Link>
          </div>
          <div className="divide-y divide-stone-100">
            {todaySessions.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <CalendarCheck size={32} className="mx-auto text-stone-200 mb-2" />
                <p className="text-sm text-stone-400">No sessions scheduled for today</p>
              </div>
            ) : (
              todaySessions.map((s) => {
                const scheduledTime = new Date(s.scheduledAt).getTime();
                const diffMinutes = (scheduledTime - now) / (1000 * 60);
                const isSoon = diffMinutes <= 10 && diffMinutes >= -60; // 10 mins before to 1 hour after start
                // `sessionType` is a real column now. This used to sniff the
                // word "video" out of the free-text notes, because the booking
                // form packed the type into them as `${type}|${note}`.
                const isVideo = s.sessionType === "video";

                return (
                  <div key={s.$id} className="flex items-center gap-4 px-6 py-4 hover:bg-stone-50 transition-colors group">
                    <div className="text-xs font-mono text-stone-400 w-16 shrink-0">{fmt(s.scheduledAt)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-stone-800 truncate">Session #{s.$id.slice(-6)}</p>
                      <span className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold
                        ${s.status === "confirmed" ? "bg-emerald-100 text-emerald-700" : s.status === "pending" ? "bg-amber-100 text-amber-700" : "bg-stone-100 text-stone-500"}`}>
                        {s.status}
                      </span>
                    </div>
                    {isSoon && (s.status === "confirmed" || s.status === "pending") && (
                      <Link 
                        href={`/therapist/sessions/${s.$id}?autoStart=true`}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          isVideo ? "bg-brand text-white hover:opacity-90" : "bg-stone-900 text-white hover:bg-stone-800"
                        }`}
                      >
                        {isVideo ? <Video size={12} /> : <MessageCircle size={12} />}
                        Join {isVideo ? "Video" : "Chat"}
                      </Link>
                    )}
                    <Link href={`/therapist/sessions/${s.$id}`} aria-label="View details">
                      <ArrowRight size={14} className="text-stone-300 group-hover:text-brand transition-colors shrink-0" />
                    </Link>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Right Column: Quick actions & Alerts */}
      <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm">
            <div className="px-6 py-4 border-b border-stone-100">
              <h2 className="font-semibold text-stone-900">Quick Actions</h2>
            </div>
            <div className="grid grid-cols-2 gap-3 p-4">
              {quickLinks.map(({ href, label, icon: Icon }) => (
                <Link key={href} href={href}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl border border-stone-200 hover:border-brand/40 hover:bg-brand/5 transition-colors text-center group">
                  <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center group-hover:bg-brand group-hover:text-white transition-colors text-brand">
                    <Icon size={18} />
                  </div>
                  <span className="text-xs font-medium text-stone-700">{label}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Pending alert */}
          {stats.pending > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 flex items-start gap-3">
              <AlertCircle size={18} className="text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-800">{stats.pending} session{stats.pending > 1 ? "s" : ""} pending approval</p>
                <Link href="/therapist/sessions" className="text-xs text-amber-600 hover:underline">Review now →</Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
