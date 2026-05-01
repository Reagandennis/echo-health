"use client";

import { useState } from "react";
import { AlertTriangle, Clock, ArrowRight, Loader2, CheckCircle } from "lucide-react";
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
  createdAt: string;
  resolved: boolean;
}

interface Props {
  initialAlerts: RiskAlert[];
  profiles: any[];
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
    return profiles.find(p => p.$id === id)?.name || "Unknown Patient";
  }

  return (
    <div className="space-y-3">
      {alerts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center">
          <CheckCircle size={32} className="mx-auto text-emerald-400 mb-3" />
          <p className="text-stone-500 font-medium">No risk alerts found.</p>
        </div>
      ) : (
        alerts.map((alert) => (
          <div key={alert.$id} className={`bg-white rounded-2xl border shadow-sm p-5 ${alert.severity === "critical" ? "border-rose-200" : alert.severity === "high" ? "border-orange-200" : "border-stone-200"}`}>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-start gap-4">
                <div className={`p-2.5 rounded-xl flex-shrink-0 ${alert.severity === "critical" ? "bg-rose-100" : alert.severity === "high" ? "bg-orange-100" : "bg-amber-100"}`}>
                  <AlertTriangle className={`w-5 h-5 ${alert.severity === "critical" ? "text-rose-600" : alert.severity === "high" ? "text-orange-600" : "text-amber-500"}`} />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-sm font-bold text-stone-900">{getPatientName(alert.patientId)}</span>
                    <AdminBadge label={alert.severity} variant={alert.severity === "critical" || alert.severity === "high" ? "danger" : "warning"} />
                    <AdminBadge label={alert.type} variant="neutral" />
                    {alert.resolved && <AdminBadge label="Resolved" variant="success" />}
                  </div>
                  <p className="text-sm text-stone-700">{alert.description}</p>
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
