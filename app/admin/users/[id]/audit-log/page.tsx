import { getLoggedInUser } from "@/lib/auth/session";
import { redirect, notFound } from "next/navigation";
import AdminPageHeader from "../../../_components/AdminPageHeader";
import { getProfileByUserId, getClientActivity, type ClientActivityEntry } from "../../../_lib/queries";
import AdminBadge from "../../../_components/AdminBadge";
import { Clock, CreditCard, CalendarCheck } from "lucide-react";

/**
 * Account activity for one client, read from `payments` and `therapy_sessions`.
 *
 * WHAT THIS PAGE USED TO BE. Seven hardcoded rows rendered under a real
 * client's real name, with invented IP addresses. Three of them were not merely
 * fake but describe things this platform does not do or did not happen:
 *
 *   • "Monthly subscription renewed" — there are no subscriptions. Plans are
 *     one-time bundles; nothing auto-renews.
 *   • "Failed login attempt (wrong pwd)" — the application never sees a
 *     password. Auth0 Universal Login means credentials are entered on Auth0's
 *     domain, so a failed attempt cannot be observed here even in principle.
 *   • "AI risk flag raised (mood drop)" — a fabricated CLINICAL event, on a
 *     named patient, in a mental-health record. `analyzeRisk` exists but has
 *     never written a row anywhere, and an administrator reading this had every
 *     reason to believe it and act on it.
 *
 * The IP column is gone rather than emptied: the platform does not record
 * request IPs, and a column of dashes implies data that is merely missing.
 *
 * WHAT IS NOT HERE, stated on the page as well as in this comment: sign-in
 * history. It lives in Auth0's log stream and is not in this database. A page
 * titled "audit log" that quietly covers less than its name suggests fails the
 * same way the fabricated rows did — it answers a question wrongly to someone
 * who has no reason to doubt it.
 */

const KIND_PRESENTATION = {
  payment: { Icon: CreditCard, iconWrap: "bg-emerald-50", icon: "text-emerald-600", label: "Payment" },
  session: { Icon: CalendarCheck, iconWrap: "bg-blue-50", icon: "text-blue-600", label: "Session" },
} as const;

/**
 * Status colouring. `pending` is amber rather than neutral deliberately — every
 * payment in this database is currently pending with no webhook ever received,
 * and that is a condition someone should notice rather than skim past.
 */
function statusVariant(status: string): "success" | "warning" | "danger" | "neutral" {
  switch (status) {
    case "success":
    case "completed":
    case "confirmed":
      return "success";
    case "pending":
      return "warning";
    case "failed":
    case "cancelled":
      return "danger";
    default:
      return "neutral";
  }
}

function formatWhen(value: Date) {
  return value.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ActivityRow({ entry }: { entry: ClientActivityEntry }) {
  const { Icon, iconWrap, icon, label } = KIND_PRESENTATION[entry.kind];

  return (
    <tr className="hover:bg-stone-50/50 transition-colors">
      <td className="px-5 py-4 whitespace-nowrap">
        <div className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${iconWrap}`}>
            <Icon className={`w-3.5 h-3.5 ${icon}`} />
          </div>
          <span className="text-xs font-semibold text-stone-700">{label}</span>
        </div>
      </td>
      <td className="px-5 py-4 text-sm text-stone-700">{entry.description}</td>
      <td className="px-5 py-4">
        <AdminBadge label={entry.status} variant={statusVariant(entry.status)} dot />
      </td>
      <td className="px-5 py-4 text-xs text-stone-500 whitespace-nowrap">
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {formatWhen(entry.at)}
        </div>
      </td>
    </tr>
  );
}

export default async function AuditLogPage({
  params,
}: {
  // Request-time API: a Promise in Next 16, not the plain object it was in 14.
  params: Promise<{ id: string }>;
}) {
  const user = await getLoggedInUser();
  if (!user || !user.labels?.includes("admin")) redirect("/dashboard");

  const { id } = await params;

  const [client, activity] = await Promise.all([
    getProfileByUserId(id),
    getClientActivity(id),
  ]);
  if (!client) notFound();

  return (
    <div>
      <AdminPageHeader
        title="Account activity"
        description="Payments and sessions recorded for this client, newest first."
        breadcrumbs={[
          { label: "Users", href: "/admin/users" },
          { label: client.name, href: `/admin/users/${id}` },
          { label: "Activity" },
        ]}
      />

      <div className="mb-5 rounded-2xl border border-stone-200 bg-stone-50 p-4">
        <p className="text-xs text-stone-600">
          Built from the <span className="font-mono text-[11px]">payments</span> and{" "}
          <span className="font-mono text-[11px]">therapy_sessions</span> tables.{" "}
          <strong className="font-semibold text-stone-700">Sign-in activity is not shown</strong> —
          authentication is handled by Auth0 and those events are held in its log stream, not in
          this database.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        {activity.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <Clock className="w-8 h-8 text-stone-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-stone-600">No recorded activity</p>
            <p className="text-xs text-stone-400 mt-1 max-w-sm mx-auto">
              This client has no payments or sessions on record. Entries appear here as they
              happen.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[640px]">
              <thead className="bg-stone-50 border-b border-stone-100">
                <tr>
                  {/* No IP column — see the note at the top of this file. */}
                  {["Type", "Detail", "Status", "When"].map((h) => (
                    <th
                      key={h}
                      className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-stone-500"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-50">
                {activity.map((entry) => (
                  <ActivityRow key={entry.id} entry={entry} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
