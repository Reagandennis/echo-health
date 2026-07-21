import { getLoggedInUser } from "@/lib/auth/session";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import AdminPageHeader from "../../_components/AdminPageHeader";
import AdminBadge from "../../_components/AdminBadge";
import { getProfileByUserId, listTherapists } from "../../_lib/queries";
import { listPatientSessionsAction } from "@/app/actions/database";
import {
  Calendar, ShieldAlert, MessageSquare,
  FileText, CreditCard, Edit, Ban, Clock,
  Activity, ChevronRight,
} from "lucide-react";

const SUB_LINKS = [
  { label: "Therapy History",   href: "therapy-history",   icon: Calendar },
  { label: "Session Timeline",  href: "session-timeline",  icon: Activity },
  { label: "Risk Profile",      href: "risk-profile",      icon: ShieldAlert },
  { label: "Messages",          href: "messages",          icon: MessageSquare },
  { label: "Billing",           href: "billing",           icon: CreditCard },
  { label: "Notes",             href: "notes",             icon: FileText },
  { label: "Edit Profile",      href: "edit",              icon: Edit },
  // "Audit Log" promised a complete activity record including sign-ins, which
  // are held by Auth0 and are not in this database. The page shows payments and
  // sessions; the tab now says so. Route path unchanged so links keep working.
  { label: "Activity",          href: "audit-log",         icon: Clock },
];

/**
 * `[id]` is an Auth0 `sub` (`auth0|68f…`), NOT a uuid — it is never cast.
 *
 * This page used to resolve the client through the Appwrite Users API. Appwrite
 * holds no users since the Auth0 migration, so that call threw on every request
 * and this route 404'd for every client. `profiles` is the user store now.
 *
 * Fields the Appwrite user object carried that `profiles` cannot supply —
 * account status (active/suspended), MFA enrolment, and roles — are marked as
 * unavailable below rather than guessed. Roles in particular live only in the
 * Auth0 token (see `scripts/auth0-roles-action.js`) and are not queryable here.
 */
export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getLoggedInUser();
  if (!user || !user.labels?.includes("admin")) redirect("/dashboard");

  const { id } = await params;

  const client = await getProfileByUserId(id);
  if (!client) notFound();

  const [clientSessions, therapists] = await Promise.all([
    listPatientSessionsAction(id),
    listTherapists(),
  ]);

  const therapistName = client.therapistId
    ? therapists.find((t) => t.id === client.therapistId)?.name ?? "Unknown"
    : "Unassigned";

  const therapistNameById = new Map(therapists.map((t) => [t.id, t.name]));

  return (
    <div>
      <AdminPageHeader
        title={client.name}
        description={client.email}
        breadcrumbs={[
          { label: "Clients", href: "/admin/users" },
          { label: client.name },
        ]}
        actions={
          <div className="flex gap-2">
            <Link
              href={`/admin/users/${id}/edit`}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-stone-600 bg-white border border-stone-200 rounded-xl hover:bg-stone-50 transition-colors"
            >
              <Edit className="w-4 h-4" /> Edit
            </Link>
            <button className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-rose-600 rounded-xl hover:bg-rose-700 transition-colors">
              <Ban className="w-4 h-4" /> Suspend
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile card */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6">
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-teal-400 to-blue-500 flex items-center justify-center text-white text-3xl font-bold mb-3">
                {client.name.charAt(0).toUpperCase()}
              </div>
              <h2 className="text-lg font-bold text-stone-900">{client.name}</h2>
              <p className="text-sm text-stone-500">{client.email}</p>
              <div className="mt-3">
                <AdminBadge
                  label={client.therapistId ? "Matched" : "Unmatched"}
                  variant={client.therapistId ? "success" : "neutral"}
                  dot
                />
              </div>
            </div>

            <div className="space-y-3 text-sm">
              {[
                { label: "User ID",     value: client.userId },
                { label: "Profile since", value: client.createdAt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) },
                { label: "Therapist",   value: therapistName },
                { label: "Goal",        value: client.goal || "—" },
                // Account status, MFA and roles lived on the Appwrite user
                // record. Auth0 owns them now and there is no server-side
                // directory query available — see the file header.
                { label: "Role",        value: "Managed in Auth0" },
              ].map((row) => (
                <div key={row.label} className="flex justify-between gap-2">
                  <span className="text-stone-400">{row.label}</span>
                  <span className="text-stone-700 font-medium text-right truncate max-w-[160px]">{row.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Risk summary */}
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-3">Risk Profile</h3>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-stone-600">Overall Risk</span>
              <AdminBadge label="Low" variant="success" dot />
            </div>
            <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-400 rounded-full w-[15%]" />
            </div>
            <p className="text-xs text-stone-400 mt-2">Score: 15 / 100</p>
            <Link
              href={`/admin/users/${id}/risk-profile`}
              className="flex items-center gap-1 text-xs text-teal-600 font-semibold mt-3 hover:text-teal-700 transition-colors"
            >
              View full risk profile <ChevronRight className="w-3 h-3" />
            </Link>
          </div>

          {/* Session summary */}
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-3">Sessions</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Total",     value: clientSessions.length },
                { label: "Active",    value: clientSessions.filter((s) => s.status === "confirmed").length },
                { label: "Completed", value: clientSessions.filter((s) => s.status === "completed").length },
                { label: "Cancelled", value: clientSessions.filter((s) => s.status === "cancelled").length },
              ].map((m) => (
                <div key={m.label} className="bg-stone-50 rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-stone-900">{m.value}</p>
                  <p className="text-[11px] text-stone-500">{m.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sub-navigation & quick preview */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-2">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1">
              {SUB_LINKS.map((item) => (
                <Link
                  key={item.href}
                  href={`/admin/users/${id}/${item.href}`}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl hover:bg-teal-50 text-stone-600 hover:text-teal-700 transition-colors group"
                >
                  <item.icon className="w-5 h-5 text-stone-400 group-hover:text-teal-500 transition-colors" />
                  <span className="text-xs font-medium text-center leading-tight">{item.label}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Recent sessions */}
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-stone-100">
              <h3 className="text-sm font-bold text-stone-800">Recent Sessions</h3>
              <Link
                href={`/admin/users/${id}/therapy-history`}
                className="text-xs text-teal-600 font-semibold hover:text-teal-700 transition-colors"
              >
                See all →
              </Link>
            </div>
            {clientSessions.length === 0 ? (
              <div className="py-12 text-center text-sm text-stone-400">No sessions recorded yet.</div>
            ) : (
              <div className="divide-y divide-stone-50">
                {clientSessions.slice(0, 5).map((s) => (
                  <div key={s.$id} className="flex items-center gap-4 px-5 py-3.5">
                    <div className="w-2 h-2 rounded-full bg-teal-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-stone-800 truncate">
                        Session with {therapistNameById.get(s.therapistId) ?? "therapist"}
                      </p>
                      <p className="text-xs text-stone-400">
                        {s.scheduledAt.toLocaleString("en-US", {
                          month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
                        })}
                      </p>
                    </div>
                    <AdminBadge
                      label={s.status}
                      variant={
                        s.status === "completed" ? "teal"
                        : s.status === "confirmed" ? "success"
                        : s.status === "cancelled" ? "danger"
                        : "warning"
                      }
                    />
                    <Link
                      href={`/admin/sessions/${s.$id}`}
                      className="text-xs text-stone-400 hover:text-teal-600 transition-colors"
                    >
                      →
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Account actions */}
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
            <h3 className="text-sm font-bold text-stone-800 mb-4">Account Actions</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Reset Password",  color: "bg-stone-100 text-stone-700 hover:bg-stone-200" },
                { label: "Send Warning",    color: "bg-amber-100 text-amber-700 hover:bg-amber-200" },
                { label: "Suspend Account", color: "bg-orange-100 text-orange-700 hover:bg-orange-200" },
                { label: "Ban Account",     color: "bg-rose-100 text-rose-700 hover:bg-rose-200" },
              ].map((action) => (
                <button
                  key={action.label}
                  className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${action.color}`}
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
