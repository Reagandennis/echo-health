import { getLoggedInUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import Link from "next/link";
import AdminStatCard from "./_components/AdminStatCard";
import AdminBadge, { sessionStatusBadge } from "./_components/AdminBadge";
import {
  listAllSessions,
  listProfiles,
  listTherapists,
} from "./_lib/queries";
import {
  listChatSessionsAction,
  listRiskAlertsAction,
} from "@/app/actions/database";
import {
  Users,
  UserCheck,
  Calendar,
  TrendingUp,
  AlertTriangle,
  CreditCard,
  ShieldCheck,
  HeadphonesIcon,
  ArrowRight,
  ArrowUpRight,
  Clock,
} from "lucide-react";

/** Relative "time ago". Timestamps are real `Date`s now, not ISO strings. */
function timeAgo(at?: Date | null): string {
  if (!at) return "—";
  const diff = Date.now() - at.getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return at.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Short date + time for scheduled sessions. */
function fmtDateTime(at?: Date | null): string {
  if (!at) return "Unscheduled";
  return at.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Replaces the old `roleBadge(labels)`.
 *
 * Roles are no longer readable here: they live in the Auth0 token
 * (`scripts/auth0-roles-action.js` → `ROLES_CLAIM`) and there is no server-side
 * user directory to enumerate them from. `profiles` carries no role column, so
 * rendering a role for another user would mean inventing one. Match state is
 * the real signal available on the same row.
 */
function matchBadge(therapistId: string | null) {
  return therapistId
    ? <AdminBadge label="Matched" variant="teal" dot />
    : <AdminBadge label="Unmatched" variant="neutral" />;
}

function initials(name?: string): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default async function AdminDashboardPage() {
  const user = await getLoggedInUser();
  if (!user || !user.labels?.includes("admin")) redirect("/dashboard");

  // `profiles` is the user roster now; `users.list()` enumerated Appwrite users,
  // which no longer exist, so every user-derived figure here read as zero.
  const [profiles, sessions, therapists, allRiskAlerts, supportChats] = await Promise.all([
    listProfiles(),
    listAllSessions(),
    listTherapists(),
    listRiskAlertsAction(),
    listChatSessionsAction(100),
  ]);

  // `listRiskAlertsAction` returns resolved and unresolved alike; the dashboard
  // only ever counted open ones.
  const openRiskAlerts = allRiskAlerts.filter((a: { resolved: boolean }) => !a.resolved);

  const completedSessions = sessions.filter((s) => s.status === "completed").length;
  const activeSessions = sessions.filter((s) => s.status === "confirmed").length;
  const pendingSessions = sessions.filter((s) => s.status === "pending").length;
  const cancelledSessions = sessions.filter((s) => s.status === "cancelled").length;
  const totalSessions = sessions.length;
  const pendingKyc = therapists.filter((t) => t.kycStatus === "pending" || t.kycStatus === "incomplete").length;
  const criticalAlerts = openRiskAlerts.filter((a: { severity: string }) => a.severity === "critical").length;

  // Resolve display names for patient / therapist IDs on session rows.
  // `therapy_sessions.patient_id` is an Auth0 sub; `therapy_sessions.therapist_id`
  // is a `therapists.id` row reference — two different key spaces, so they get
  // two different maps rather than one merged lookup.
  const nameByUserId = new Map(profiles.map((p) => [p.userId, p.name] as const));
  const therapistById = new Map(therapists.map((t) => [t.id, t.name] as const));
  const resolvePatient = (id?: string) => (id && nameByUserId.get(id)) || "Unknown";
  const resolveTherapist = (id?: string) => (id && therapistById.get(id)) || "Unknown";

  const stats = [
    { label: "Total Clients", value: profiles.length.toString(), change: "Active users", trend: "up" as const, icon: Users, iconColor: "bg-brand-50 text-brand-700", subtext: "Platform users" },
    { label: "Active Sessions", value: activeSessions.toString(), change: "Confirmed", trend: "up" as const, icon: Calendar, iconColor: "bg-brand-50 text-brand-700", subtext: "Live / Upcoming" },
    { label: "Monthly Revenue", value: `$${(completedSessions * 50).toLocaleString()}`, change: "+8.2%", trend: "up" as const, icon: CreditCard, iconColor: "bg-emerald-50 text-emerald-700", subtext: "Estimated" },
    { label: "Risk Alerts", value: openRiskAlerts.length.toString(), change: `${criticalAlerts} critical`, trend: "down" as const, icon: AlertTriangle, iconColor: "bg-rose-50 text-rose-700", subtext: "Needs attention" },
    { label: "Pending KYC", value: pendingKyc.toString(), change: "Awaiting review", trend: "neutral" as const, icon: ShieldCheck, iconColor: "bg-amber-50 text-amber-700", subtext: "Therapist queue" },
    { label: "Support Chats", value: supportChats.length.toString(), change: "Active sessions", trend: "up" as const, icon: HeadphonesIcon, iconColor: "bg-sky-50 text-sky-700", subtext: "Customer care" },
    { label: "Total Therapists", value: therapists.length.toString(), change: "Clinicians", trend: "up" as const, icon: UserCheck, iconColor: "bg-brand-50 text-brand-700", subtext: "Verified & pending" },
    { label: "Sessions Completed", value: completedSessions.toString(), change: "Total volume", trend: "up" as const, icon: TrendingUp, iconColor: "bg-brand-50 text-brand-700", subtext: "All time" },
  ];

  // `createdAt` is a real Date — compare with getTime(), never localeCompare.
  const recentSignups = [...profiles]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 6);

  const recentSessions = [...sessions]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 6);

  const statusBreakdown = [
    { label: "Completed", count: completedSessions, color: "bg-teal-500" },
    { label: "Active", count: activeSessions, color: "bg-emerald-500" },
    { label: "Pending", count: pendingSessions, color: "bg-amber-500" },
    { label: "Cancelled", count: cancelledSessions, color: "bg-rose-500" },
  ];

  const attention = [
    { label: "Therapists awaiting KYC", value: pendingKyc, href: "/admin/therapists/verification-queue", icon: ShieldCheck, tone: "text-amber-700 bg-amber-50" },
    { label: "Critical risk alerts", value: criticalAlerts, href: "/admin/risk", icon: AlertTriangle, tone: "text-rose-700 bg-rose-50" },
    { label: "Open support chats", value: supportChats.length, href: "/admin/customer-care", icon: HeadphonesIcon, tone: "text-sky-700 bg-sky-50" },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900">System Overview</h1>
          <p className="text-sm text-stone-500 mt-0.5">
            Welcome back, {user.name.split(" ")[0]} — real-time platform health &amp; key metrics
          </p>
        </div>
        <span className="inline-flex items-center gap-2 self-start rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-700">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          Live
        </span>
      </div>

      {/* Stat grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((s) => (
          <AdminStatCard key={s.label} {...s} />
        ))}
      </div>

      {/* Main two-column area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: recent activity */}
        <div className="lg:col-span-2 space-y-6">
          {/* Recent sessions */}
          <section className="bg-white rounded-2xl border border-stone-200/80 shadow-xs">
            <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100">
              <h2 className="text-sm font-bold text-stone-900">Recent Sessions</h2>
              <Link href="/admin/sessions" className="text-xs font-semibold text-teal-600 hover:text-teal-700 inline-flex items-center gap-1">
                View all <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="divide-y divide-stone-50">
              {recentSessions.length === 0 ? (
                <p className="px-6 py-10 text-center text-sm text-stone-400">No sessions yet.</p>
              ) : (
                recentSessions.map((s) => (
                  <div key={s.$id} className="flex items-center gap-3 px-6 py-3.5 hover:bg-stone-50/60 transition-colors">
                    <div className="w-9 h-9 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {initials(resolvePatient(s.patientId))}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-stone-900 truncate">
                        {resolvePatient(s.patientId)}
                        <span className="font-normal text-stone-400"> with </span>
                        {resolveTherapist(s.therapistId)}
                      </p>
                      <p className="text-xs text-stone-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {fmtDateTime(s.scheduledAt)}
                      </p>
                    </div>
                    {sessionStatusBadge(s.status)}
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Recent signups */}
          <section className="bg-white rounded-2xl border border-stone-200/80 shadow-xs">
            <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100">
              <h2 className="text-sm font-bold text-stone-900">Recent Signups</h2>
              <Link href="/admin/users" className="text-xs font-semibold text-teal-600 hover:text-teal-700 inline-flex items-center gap-1">
                Manage users <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="divide-y divide-stone-50">
              {recentSignups.length === 0 ? (
                <p className="px-6 py-10 text-center text-sm text-stone-400">No users yet.</p>
              ) : (
                recentSignups.map((p) => (
                  <Link
                    key={p.$id}
                    href={`/admin/users/${encodeURIComponent(p.userId)}`}
                    className="flex items-center gap-3 px-6 py-3.5 hover:bg-teal-50/50 transition-colors"
                  >
                    <div className="w-9 h-9 rounded-full bg-stone-100 text-stone-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {initials(p.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-stone-900 truncate">{p.name || "Unnamed user"}</p>
                      <p className="text-xs text-stone-400 truncate">{p.email}</p>
                    </div>
                    {matchBadge(p.therapistId)}
                    <span className="text-xs text-stone-400 w-16 text-right flex-shrink-0">{timeAgo(p.createdAt)}</span>
                  </Link>
                ))
              )}
            </div>
          </section>
        </div>

        {/* Right: action panel + breakdown */}
        <div className="space-y-6">
          {/* Needs attention */}
          <section className="bg-white rounded-2xl border border-stone-200/80 shadow-xs p-6">
            <h2 className="text-sm font-bold text-stone-900 mb-4">Needs Attention</h2>
            <div className="space-y-2">
              {attention.map((a) => (
                <Link
                  key={a.label}
                  href={a.href}
                  className="flex items-center gap-3 rounded-xl border border-stone-200/70 px-3 py-3 hover:border-brand-200 hover:bg-brand-50/50 transition-colors group"
                >
                  <span className={`p-2 rounded-lg ${a.tone}`}>
                    <a.icon className="w-4 h-4" />
                  </span>
                  <span className="text-sm text-stone-600 flex-1">{a.label}</span>
                  <span className="text-lg font-bold text-stone-900">{a.value}</span>
                  <ArrowUpRight className="w-4 h-4 text-stone-300 group-hover:text-teal-500 transition-colors" />
                </Link>
              ))}
            </div>
          </section>

          {/* Session breakdown */}
          <section className="bg-white rounded-2xl border border-stone-200/80 shadow-xs p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-stone-900">Session Breakdown</h2>
              <span className="text-xs text-stone-400">{totalSessions} total</span>
            </div>
            <div className="space-y-3">
              {statusBreakdown.map((row) => {
                const pct = totalSessions ? Math.round((row.count / totalSessions) * 100) : 0;
                return (
                  <div key={row.label}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-medium text-stone-600">{row.label}</span>
                      <span className="text-stone-400">{row.count} · {pct}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-stone-100 overflow-hidden">
                      <div className={`h-full rounded-full ${row.color}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>

      {/* Quick action cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Verify Therapists", desc: `${pendingKyc} pending`, href: "/admin/therapists/verification-queue", icon: ShieldCheck, tone: "bg-amber-50 text-amber-700" },
          { label: "Review Risk Alerts", desc: `${openRiskAlerts.length} active`, href: "/admin/risk", icon: AlertTriangle, tone: "bg-rose-50 text-rose-700" },
          { label: "Support Queue", desc: `${supportChats.length} chats`, href: "/admin/customer-care", icon: HeadphonesIcon, tone: "bg-sky-50 text-sky-700" },
          { label: "Export Report", desc: "Analytics", href: "/admin/analytics/export", icon: TrendingUp, tone: "bg-brand-50 text-brand-700" },
        ].map((action) => (
          <Link
            key={action.label}
            href={action.href}
            className="group flex flex-col rounded-2xl border border-stone-200/80 bg-white p-5 shadow-xs transition hover:border-brand-200 hover:shadow-md"
          >
            <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${action.tone}`}>
              <action.icon className="h-4 w-4" />
            </span>
            <p className="mt-4 text-sm font-semibold text-stone-900">{action.label}</p>
            <p className="mt-0.5 text-xs text-stone-500">{action.desc}</p>
            <ArrowRight className="mt-3 h-4 w-4 text-stone-300 transition group-hover:translate-x-0.5 group-hover:text-brand-600" />
          </Link>
        ))}
      </div>
    </div>
  );
}
