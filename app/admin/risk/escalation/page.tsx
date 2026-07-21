import { getLoggedInUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import Link from "next/link";
import AdminPageHeader from "../../_components/AdminPageHeader";
import { CheckCircle, AlertTriangle, Phone, FileText } from "lucide-react";

const STEPS = [
  { step: 1, title: "Identify the Crisis", description: "Review AI flags, therapist notes, and recent mood logs to confirm the risk level.", icon: AlertTriangle, done: true },
  { step: 2, title: "Contact Therapist", description: "Immediately reach out to the assigned therapist for their assessment.", icon: Phone, done: true },
  { step: 3, title: "Assess Immediate Safety", description: "Determine if the client needs emergency services or immediate intervention.", icon: CheckCircle, done: false },
  { step: 4, title: "Escalate Internally", description: "Notify the clinical supervisor and document in the incident log.", icon: FileText, done: false },
  { step: 5, title: "Follow-up Protocol", description: "Schedule a welfare check and assign daily monitoring for 7 days.", icon: CheckCircle, done: false },
];

export default async function EscalationWorkflowPage() {
  const user = await getLoggedInUser();
  if (!user || !user.labels?.includes("admin")) redirect("/dashboard");

  return (
    <div>
      <AdminPageHeader
        title="Crisis Escalation Workflow"
        description="Step-by-step guide for handling high-risk client situations."
        breadcrumbs={[{ label: "Risk & Crisis", href: "/admin/risk" }, { label: "Escalation" }]}
        actions={
          <a href="/admin/risk/incidents/new" className="px-4 py-2 text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors">
            Log Incident
          </a>
        }
      />

      <div className="max-w-2xl">
        <div className="relative space-y-0">
          <div className="absolute left-6 top-6 bottom-6 w-px bg-stone-200" />
          {STEPS.map((step, i) => (
            <div key={step.step} className="relative flex gap-5 pb-6">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 z-10 border-2 ${step.done ? "bg-teal-600 border-teal-600 text-white" : "bg-white border-stone-300 text-stone-400"}`}>
                {step.done ? <CheckCircle className="w-5 h-5" /> : <step.icon className="w-5 h-5" />}
              </div>
              <div className="flex-1 pt-2.5">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold text-stone-400 uppercase">Step {step.step}</span>
                  {step.done && <span className="text-[11px] bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full font-semibold">Complete</span>}
                </div>
                <h3 className="text-sm font-bold text-stone-900 mb-1">{step.title}</h3>
                <p className="text-sm text-stone-500">{step.description}</p>
                {!step.done && (
                  <button className="mt-3 px-4 py-1.5 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors">
                    Mark Complete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/*
          This block used to list "988 (Suicide & Crisis)", "911", and a clinical
          supervisor on +1 (555) 012-3456 — a reserved fictional number that
          connects to nothing. A staff member following this runbook during a
          live escalation would have dialled two numbers that do not work from
          Kenya and one that does not work anywhere.

          It now points at the maintained list rather than duplicating numbers
          that then drift out of sync with it, and the supervisor contact states
          plainly that it is unset instead of showing a placeholder that reads
          like a configured value.
        */}
        <div className="mt-4 p-5 bg-rose-50 border border-rose-200 rounded-2xl">
          <h3 className="text-sm font-bold text-rose-800 mb-2">Emergency Contacts</h3>
          <div className="space-y-3 text-sm">
            <div>
              <div className="flex justify-between gap-3">
                <span className="text-rose-700">Emergency services</span>
                <span className="font-semibold text-rose-900 text-right">Client&apos;s local number</span>
              </div>
              <p className="text-rose-600/80 text-xs mt-1">
                Kenya 999 / 112 / 911 · US 911. There is no universal number — confirm the
                client&apos;s location before advising one.
              </p>
            </div>

            <div>
              <div className="flex justify-between gap-3">
                <span className="text-rose-700">Crisis lines</span>
                <Link href="/crisis" className="font-semibold text-rose-900 underline text-right">
                  Verified list
                </Link>
              </div>
              <p className="text-rose-600/80 text-xs mt-1">
                Kenya has no free 24/7 suicide-prevention line. NACADA 1192 is free, national and
                round the clock; Befrienders Kenya closes at 17:00.
              </p>
            </div>

            <div className="flex justify-between gap-3 pt-1 border-t border-rose-200/70">
              <span className="text-rose-700">Clinical supervisor</span>
              <span className="font-semibold text-rose-900/60 text-right">Not configured</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
