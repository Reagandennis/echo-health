import { createAdminClient, getLoggedInUser } from "@/lib/appwrite/server";
import { appwriteConfig } from "@/lib/appwrite/config";
import { redirect } from "next/navigation";
import Link from "next/link";
import AdminStatCard from "./_components/AdminStatCard";
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
  Activity,
  Clock,
  CheckCircle2,
  XCircle,
} from "lucide-react";

const LIVE_EVENTS = [
  { type: "session_start", user: "Sarah M.", therapist: "Dr. Osei", time: "2m ago", color: "bg-emerald-400" },
  { type: "session_end", user: "James K.", therapist: "Dr. Patel", time: "5m ago", color: "bg-stone-400" },
  { type: "new_signup", user: "Amara L.", therapist: "—", time: "8m ago", color: "bg-blue-400" },
  { type: "flag_raised", user: "Daniel T.", therapist: "Dr. Müller", time: "12m ago", color: "bg-rose-400" },
  { type: "session_start", user: "Priya V.", therapist: "Dr. Santos", time: "15m ago", color: "bg-emerald-400" },
  { type: "kyc_submitted", user: "Dr. Nguyen", therapist: "—", time: "22m ago", color: "bg-purple-400" },
  { type: "session_start", user: "Ethan R.", therapist: "Dr. Lee", time: "31m ago", color: "bg-emerald-400" },
  { type: "payment", user: "Monica J.", therapist: "—", time: "40m ago", color: "bg-teal-400" },
];

const EVENT_LABEL: Record<string, string> = {
  session_start:  "Session started",
  session_end:    "Session ended",
  new_signup:     "New signup",
  flag_raised:    "Risk flag raised",
  kyc_submitted:  "KYC submitted",
  payment:        "Payment received",
};

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
  const pendingKyc = therapists.documents.filter(t => t.kycStatus === "pending" || t.kycStatus === "incomplete").length;
  const criticalAlerts = riskAlerts.documents.filter(a => a.severity === "critical").length;

  const stats = [
    {
      label: "Total Clients",
      value: userList.total.toString(),
      change: "Active users",
      trend: "up" as const,
      icon: Users,
      iconColor: "bg-blue-100 text-blue-700",
      subtext: "Platform users",
    },
    {
      label: "Active Sessions",
      value: activeSessions.toString(),
      change: "Confirmed",
      trend: "up" as const,
      icon: Calendar,
      iconColor: "bg-teal-100 text-teal-700",
      subtext: "Live/Upcoming",
    },
    {
      label: "Monthly Revenue",
      value: `$${(completedSessions * 50).toLocaleString()}`, // Placeholder logic
      change: "+8.2%",
      trend: "up" as const,
      icon: CreditCard,
      iconColor: "bg-emerald-100 text-emerald-700",
      subtext: "Estimated",
    },
    {
      label: "Risk Alerts",
      value: riskAlerts.total.toString(),
      change: `${criticalAlerts} critical`,
      trend: "down" as const,
      icon: AlertTriangle,
      iconColor: "bg-rose-100 text-rose-700",
      subtext: "Needs attention",
    },
    {
      label: "Pending KYC",
      value: pendingKyc.toString(),
      change: "Awaiting review",
      trend: "neutral" as const,
      icon: ShieldCheck,
      iconColor: "bg-purple-100 text-purple-700",
      subtext: "Therapist queue",
    },
    {
      label: "Support Chats",
      value: supportChats.total.toString(),
      change: "Active sessions",
      trend: "up" as const,
      icon: HeadphonesIcon,
      iconColor: "bg-amber-100 text-amber-700",
      subtext: "Customer care",
    },
    {
      label: "Total Therapists",
      value: therapists.total.toString(),
      change: "Clinicians",
      trend: "up" as const,
      icon: UserCheck,
      iconColor: "bg-indigo-100 text-indigo-700",
      subtext: "Verified & pending",
    },
    {
      label: "Sessions Completed",
      value: completedSessions.toString(),
      change: "Total volume",
      trend: "up" as const,
      icon: TrendingUp,
      iconColor: "bg-orange-100 text-orange-700",
      subtext: "All time",
    },
  ];

  const recentUsers = userList.users.slice(0, 8);

  return (
    <div className="space-y-8">
      {/* ... Welcome section remains same ... */}
      <div>
        <h1 className="text-2xl font-bold text-stone-900">System Overview</h1>
        <p className="text-sm text-stone-500 mt-0.5">
          Real-time platform health, activity feed &amp; key metrics
        </p>
      </div>

      {/* Stat grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((s) => (
          <AdminStatCard key={s.label} {...s} />
        ))}
      </div>

      {/* ... middle section ... */}

      {/* Quick action cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
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
