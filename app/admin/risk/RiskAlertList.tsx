"use client";

import { useState } from "react";
import { AlertTriangle, Clock, ArrowRight, Loader2, CheckCircle, Inbox } from "lucide-react";
import Link from "next/link";
import AdminBadge from "../_components/AdminBadge";
import { resolveRiskAlertAction } from "@/app/actions/database";
import { useRouter } from "next/navigation";

interface RiskAlert {
  $id: string;
  patientId: string;
  type: string;
  description: string;
  severity: string;
  /*
   * `created_at` is a real `timestamptz` and arrives as a `Date` from Drizzle.
   * It was typed `string` here as a holdover from Appwrite's ISO strings; the
   * union keeps both callers honest rather than lying about the runtime type.
   */
  createdAt: string | Date;
  resolved: boolean;
}

/**
 * Only the two fields this component reads. `userId` is the Auth0 sub that
 * `risk_alerts.patient_id` joins against — narrowing to it here is what makes
 * the `p.$id` mistake noted in `getPatientName` impossible to reintroduce.
 */
interface ProfileRef {
  userId: string;
  name: string | null;
}

interface Props {
  initialAlerts: RiskAlert[];
  profiles: ProfileRef[];
}

export default function RiskAlertList({ initialAlerts, profiles }: Props) {
  const router = useRouter();
  const [alerts, setAlerts] = useState(initialAlerts);
  const [resolving, setResolving] = useState<string | null>(null);

  async function handleResolve(id: string) {
    setResolving(id);
    try {
      await resolveRiskAlertAction(id);
      setAlerts(prev => prev.map(a => a.$id === id ? { ...a, resolved: true } : a));
      router.refresh();
    } catch (err) {
      console.error(err);
      alert("Failed to resolve alert.");
    }
    setResolving(null);
  }

  function getPatientName(id: string) {
    // `patientId` holds an Auth0 sub, not a profile row id — matching it against
    // `p.$id` never found anyone and every alert rendered "Unknown Patient".
    // When no profile matches, show the raw id: on a crisis alert, an
    // unidentifiable subject is the one thing an admin cannot work with, and the
    // sub is at least traceable.
    return profiles.find(p => p.userId === id)?.name || `Unidentified account (${id})`;
  }

  return (
    <div className="space-y-3">
      {alerts.length === 0 ? (
        /*
          The empty state used to be a green tick over "No risk alerts found",
          which reads as an all-clear — a clinical claim this page cannot make.
          Zero rows means nothing has been flagged by a keyword matcher that only
          reads client-authored messages; it says nothing about whether anyone is
          at risk. The copy now states what populates the list and what its
          silence does and does not mean.
        */
        <div className="bg-white rounded-2xl border border-stone-200 p-10 text-center">
          <Inbox size={28} className="mx-auto text-stone-300 mb-3" />
          <p className="text-stone-700 font-semibold">No risk alerts have been filed.</p>
          <p className="text-sm text-stone-500 mt-2 max-w-lg mx-auto leading-relaxed">
            This queue fills when the keyword scan matches a high-risk term in a
            message sent by a client, or when an admin logs an incident manually.
            Moderate matches deliberately do not raise alerts.
          </p>
          <p className="text-xs text-stone-400 mt-3 max-w-lg mx-auto leading-relaxed">
            An empty queue is not an all-clear. Nothing here monitors sessions,
            journals or mood scores, and the scanner misses any wording outside
            its fixed list.
          </p>
          <Link
            href="/admin/risk/incidents/new"
            className="inline-block mt-5 px-4 py-2 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors"
          >
            Log an incident
          </Link>
        </div>
      ) : (
        alerts.map((alert) => (
          <div key={alert.$id} className={`bg-white rounded-2xl border shadow-sm p-5 ${alert.severity === "critical" ? "border-rose-200" : alert.severity === "high" ? "border-orange-200" : "border-stone-200"}`}>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-start gap-4">
                <div className={`p-2.5 rounded-xl flex-shrink-0 ${alert.severity === "critical" ? "bg-rose-100" : alert.severity === "high" ? "bg-orange-100" : "bg-amber-100"}`}>
                  <AlertTriangle className={`w-5 h-5 ${alert.severity === "critical" ? "text-rose-600" : alert.severity === "high" ? "text-orange-600" : "text-amber-500"}`} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    {/*
                      Links straight to the subject's risk profile. Triaging an
                      alert means reading it in the context of that person's
                      history, and making the admin go and find them by hand is
                      friction in exactly the wrong place.
                    */}
                    <Link
                      href={`/admin/users/${encodeURIComponent(alert.patientId)}/risk-profile`}
                      className="text-sm font-bold text-stone-900 hover:text-teal-700 hover:underline"
                    >
                      {getPatientName(alert.patientId)}
                    </Link>
                    <AdminBadge label={alert.severity} variant={alert.severity === "critical" || alert.severity === "high" ? "danger" : "warning"} />
                    <AdminBadge label={alert.type} variant="neutral" />
                    {alert.resolved && <AdminBadge label="Resolved" variant="success" />}
                  </div>
                  <p className="text-sm text-stone-700 break-words">{alert.description}</p>
                  <div className="flex items-center gap-1 text-xs text-stone-400 mt-1">
                    <Clock className="w-3 h-3" />{new Date(alert.createdAt).toLocaleString()}
                  </div>
                </div>
              </div>
              {!alert.resolved && (
                <div className="flex gap-2 flex-shrink-0">
                  <button 
                    onClick={() => handleResolve(alert.$id)}
                    disabled={resolving === alert.$id}
                    className="px-3 py-1.5 text-xs font-semibold text-emerald-600 bg-emerald-100 hover:bg-emerald-200 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1"
                  >
                    {resolving === alert.$id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                    Resolve
                  </button>
                  <Link href="/admin/risk/escalation" className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors">
                    Escalate <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
