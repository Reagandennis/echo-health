"use client";

import { ShieldCheck, FileText, AlertCircle, CheckCircle } from "lucide-react";

interface ComplianceItem { id: string; title: string; description: string; status: "ok" | "warning" | "required"; }

const ITEMS: ComplianceItem[] = [
  { id: "1", title: "Informed Consent on File", description: "Signed consent form must be obtained before treatment begins.", status: "ok" },
  { id: "2", title: "HIPAA Notice Provided", description: "Client must receive Notice of Privacy Practices.", status: "ok" },
  { id: "3", title: "License Verification", description: "Valid professional license must be uploaded and current.", status: "warning" },
  { id: "4", title: "Mandatory Reporting Awareness", description: "Therapist must be aware of mandatory reporting obligations.", status: "ok" },
  { id: "5", title: "Session Notes Completed Within 24 h", description: "Progress notes should be documented promptly after each session.", status: "warning" },
  { id: "6", title: "Supervision Log (if applicable)", description: "Supervised therapists must maintain a supervision log.", status: "ok" },
  { id: "7", title: "Emergency Contact / Safety Plan", description: "High-risk clients require a documented safety plan.", status: "required" },
];

const STATUS_CONFIG = {
  ok:       { icon: CheckCircle, color: "text-green-600 bg-green-50 border-green-200", label: "OK" },
  warning:  { icon: AlertCircle, color: "text-amber-600 bg-amber-50 border-amber-200", label: "Review" },
  required: { icon: AlertCircle, color: "text-red-600 bg-red-50 border-red-200", label: "Action required" },
};

export default function CompliancePage() {
  const ok = ITEMS.filter((i) => i.status === "ok").length;
  const total = ITEMS.length;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center">
          <ShieldCheck size={18} className="text-brand" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Compliance</h1>
          <p className="text-sm text-stone-500">{ok}/{total} items compliant</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="bg-stone-100 rounded-full h-2.5 overflow-hidden">
        <div className="h-full bg-brand rounded-full transition-all" style={{ width: `${(ok / total) * 100}%` }} />
      </div>

      <div className="space-y-3">
        {ITEMS.map((item) => {
          const cfg = STATUS_CONFIG[item.status];
          const Icon = cfg.icon;
          return (
            <div key={item.id} className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5 flex items-start gap-4">
              <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${cfg.color}`}>
                <Icon size={16} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-semibold text-stone-900 text-sm">{item.title}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${cfg.color}`}>{cfg.label}</span>
                </div>
                <p className="text-xs text-stone-500">{item.description}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-stone-50 border border-stone-200 rounded-2xl p-5 flex items-start gap-3">
        <FileText size={16} className="text-stone-400 mt-0.5 shrink-0" />
        <p className="text-xs text-stone-500 leading-relaxed">
          This compliance checklist is informational only and does not constitute legal or professional advice.
          Always consult your licensing board and applicable law for specific obligations in your jurisdiction.
        </p>
      </div>
    </div>
  );
}
