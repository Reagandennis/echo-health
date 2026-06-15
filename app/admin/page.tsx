import { createAdminClient, getLoggedInUser } from "@/lib/appwrite/server";
import { appwriteConfig } from "@/lib/appwrite/config";
import { redirect } from "next/navigation";
import Link from "next/link";
import AdminStatCard from "./_components/AdminStatCard";
import AdminBadge, { sessionStatusBadge } from "./_components/AdminBadge";
import { Query } from "node-appwrite";
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

/** Relative "time ago" for an ISO timestamp, server-rendered. */
function timeAgo(iso?: string): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Short date + time for scheduled sessions. */
function fmtDateTime(iso?: string): string {
  if (!iso) return "Unscheduled";
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function roleBadge(labels?: string[]) {
  const role = labels?.[0];
  if (role === "admin") return <AdminBadge label="Admin" variant="purple" dot />;
  if (role === "therapist") return <AdminBadge label="Therapist" variant="teal" dot />;
  if (role === "client") return <AdminBadge label="Client" variant="info" dot />;
  return <AdminBadge label="No role" variant="neutral" />;
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

  const { users, databases } = createAdminClient();

  const [userList, sessionList, therapists, riskAlerts, supportChats] = await Promise.all([
    users.list(),
    databases.listDocuments(appwriteConfig.databaseId, appwriteConfig.collections.sessions, [Query.limit(100)]),
    databases.listDocuments(appwriteConfig.databaseId, appwriteConfig.collections.therapists, [Query.limit(100)]),
    databases.listDocuments(appwriteConfig.databaseId, appwriteConfig.collections.riskAlerts, [Query.equal("resolved", false), Query.limit(100)]),
    databases.listDocuments(appwriteConfig.databaseId, appwriteConfig.collections.chatSessions, [Query.limit(100)]),
  ]);

  const completedSessions = sessionList.documents.filter((s) => s.status === "completed").length;
  const activeSessions = sessionList.documents.filter((s) => s.status === "confirmed" || s.status === "in-progress").length;
  const pendingSessions = sessionList.documents.filter((s) => s.status === "pending").length;
  const cancelledSessions = sessionList.documents.filter((s) => s.status === "cancelled").length;
  const totalSessions = sessionList.documents.length;
  const pendingKyc = therapists.documents.filter((t) => t.kycStatus === "pending" || t.kycStatus === "incomplete").length;
  const criticalAlerts = riskAlerts.documents.filter((a) => a.severity === "critical").length;

  // Resolve display names for patient / therapist IDs on session rows.
  const userById = new Map(userList.users.map((u) => [u.$id, u.name] as const));
  const therapistById = new Map(therapists.documents.map((t) => [t.$id, t.name as string] as const));
  const therapistByUserId = new Map(therapists.documents.map((t) => [t.userId as string, t.name as string] as const));
  const resolveName = (id?: string) =>
    (id && (userById.get(id) || therapistByUserId.get(id) || therapistById.get(id))) || "Unknown";

  const stats = [
    { label: "Total Clients", value: userList.total.toString(), change: "Active users", trend: "up" as const, icon: Users, iconColor: "bg-blue-100 text-blue-700", subtext: "Platform users" },
    { label: "Active Sessions", value: activeSessions.toString(), change: "Confirmed", trend: "up" as const, icon: Calendar, iconColor: "bg-teal-100 text-teal-700", subtext: "Live / Upcoming" },
    { label: "Monthly Revenue", value: `$${(completedSessions * 50).toLocaleString()}`, change: "+8.2%", trend: "up" as const, icon: CreditCard, iconColor: "bg-emerald-100 text-emerald-700", subtext: "Estimated" },
    { label: "Risk Alerts", value: riskAlerts.total.toString(), change: `${criticalAlerts} critical`, trend: "down" as const, icon: AlertTriangle, iconColor: "bg-rose-100 text-rose-700", subtext: "Needs attention" },
    { label: "Pending KYC", value: pendingKyc.toString(), change: "Awaiting review", trend: "neutral" as const, icon: ShieldCheck, iconColor: "bg-purple-100 text-purple-700", subtext: "Therapist queue" },
    { label: "Support Chats", value: supportChats.total.toString(), change: "Active sessions", trend: "up" as const, icon: HeadphonesIcon, iconColor: "bg-amber-100 text-amber-700", subtext: "Customer care" },
    { label: "Total Therapists", value: therapists.total.toString(), change: "Clinicians", trend: "up" as const, icon: UserCheck, iconColor: "bg-indigo-100 text-indigo-700", subtext: "Verified & pending" },
    { label: "Sessions Completed", value: completedSessions.toString(), change: "Total volume", trend: "up" as const, icon: TrendingUp, iconColor: "bg-orange-100 text-orange-700", subtext: "All time" },
  ];

  const recentSignups = [...userList.users]
    .sort((a, b) => new Date(b.$createdAt).getTime() - new Date(a.$createdAt).getTime())
    .slice(0, 6);

  const recentSessions = [...sessionList.documents]
    .sort((a, b) => new Date(b.$createdAt).getTime() - new Date(a.$createdAt).getTime())
    .slice(0, 6);

  const statusBreakdown = [
    { label: "Completed", count: completedSessions, color: "bg-teal-500" },
    { label: "Active", count: activeSessions, color: "bg-emerald-500" },
    { label: "Pending", count: pendingSessions, color: "bg-amber-500" },
    { label: "Cancelled", count: cancelledSessions, color: "bg-rose-500" },
  ];

  const attention = [
    { label: "Therapists awaiting KYC", value: pendingKyc, href: "/admin/therapists/verification-queue", icon: ShieldCheck, tone: "text-purple-700 bg-purple-100" },
    { label: "Critical risk alerts", value: criticalAlerts, href: "/admin/risk", icon: AlertTriangle, tone: "text-rose-700 bg-rose-100" },
    { label: "Open support chats", value: supportChats.total, href: "/admin/customer-care", icon: HeadphonesIcon, tone: "text-amber-700 bg-amber-100" },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">System Overview</h1>
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
          <section className="bg-white rounded-2xl border border-stone-200 shadow-sm">
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
                      {initials(resolveName(s.patientId as string))}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-stone-900 truncate">
                        {resolveName(s.patientId as string)}
                        <span className="font-normal text-stone-400"> with </span>
                        {resolveName(s.therapistId as string)}
                      </p>
                      <p className="text-xs text-stone-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {fmtDateTime(s.scheduledAt as string)}
                      </p>
                    </div>
                    {sessionStatusBadge(s.status as string)}
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Recent signups */}
          <section className="bg-white rounded-2xl border border-stone-200 shadow-sm">
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
                recentSignups.map((u) => (
                  <Link
                    key={u.$id}
                    href={`/admin/users/${u.$id}`}
                    className="flex items-center gap-3 px-6 py-3.5 hover:bg-teal-50/50 transition-colors"
                  >
                    <div className="w-9 h-9 rounded-full bg-stone-100 text-stone-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {initials(u.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-stone-900 truncate">{u.name || "Unnamed user"}</p>
                      <p className="text-xs text-stone-400 truncate">{u.email}</p>
                    </div>
                    {roleBadge(u.labels)}
                    <span className="text-xs text-stone-400 w-16 text-right flex-shrink-0">{timeAgo(u.$createdAt)}</span>
                  </Link>
                ))
              )}
            </div>
          </section>
        </div>

        {/* Right: action panel + breakdown */}
        <div className="space-y-6">
          {/* Needs attention */}
          <section className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6">
            <h2 className="text-sm font-bold text-stone-900 mb-4">Needs Attention</h2>
            <div className="space-y-2">
              {attention.map((a) => (
                <Link
                  key={a.label}
                  href={a.href}
                  className="flex items-center gap-3 rounded-xl border border-stone-100 px-3 py-3 hover:border-teal-200 hover:bg-teal-50/40 transition-colors group"
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
          <section className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6">
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
          { label: "Verify Therapists", desc: `${pendingKyc} pending`, href: "/admin/therapists/verification-queue", color: "from-purple-500 to-indigo-600" },
          { label: "Review Risk Alerts", desc: `${riskAlerts.total} active`, href: "/admin/risk", color: "from-rose-500 to-rose-700" },
          { label: "Support Queue", desc: `${supportChats.total} chats`, href: "/admin/customer-care", color: "from-amber-500 to-orange-600" },
          { label: "Export Report", desc: "Analytics", href: "/admin/analytics/export", color: "from-teal-500 to-teal-700" },
        ].map((action) => (
          <Link
            key={action.label}
            href={action.href}
            className={`bg-gradient-to-br ${action.color} rounded-2xl p-5 text-white hover:opacity-90 transition-opacity group`}
          >
            <p className="font-bold text-sm">{action.label}</p>
            <p className="text-xs opacity-80 mt-0.5">{action.desc}</p>
            <ArrowRight className="w-4 h-4 mt-4 opacity-60 group-hover:opacity-100 transition-opacity" />
          </Link>
        ))}
      </div>
    </div>
  );
}
