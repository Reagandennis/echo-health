import { getLoggedInUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import Link from "next/link";
import AdminPageHeader from "../../_components/AdminPageHeader";
import { CheckCircle, AlertTriangle, Phone, FileText } from "lucide-react";

/**
 * A reference procedure, not tracked state.
 *
 * WHAT WAS DELETED AND WHY. Steps 1 and 2 carried `done: true`, so this page
 * always rendered a green "Complete" badge against "Identify the Crisis" and
 * "Contact Therapist" — for every admin, on every visit, with no escalation in
 * progress. Nothing anywhere records escalation progress; the flags were
 * literals. During a live crisis that display asserts that someone has already
 * confirmed the risk level and already spoken to the assigned therapist, which
 * is the single most dangerous thing this page could get wrong: the two steps
 * most likely to be skipped are the two it marked done.
 *
 * The "Mark Complete" buttons under the remaining steps had no handler and
 * wrote nothing, so the state could not be corrected either.
 *
 * Since there is no escalation-tracking table, this is presented as what it
 * is — a numbered runbook to work through — rather than as a checklist that
 * appears to remember anything. Restoring per-escalation progress needs somewhere
 * to store it; until then, honest static beats fake dynamic.
 *
 * Step 1 also said "Review AI flags". There is no AI: `lib/clinical/risk.ts`
 * matches substrings against a fixed word list.
 */
const STEPS = [
  { step: 1, title: "Identify the Crisis", description: "Review the risk alert, the therapist's notes and recent mood logs to judge the risk level yourself. Alerts come from keyword matching and are frequently false positives — read the source message.", icon: AlertTriangle },
  { step: 2, title: "Contact Therapist", description: "Immediately reach out to the assigned therapist for their assessment.", icon: Phone },
  { step: 3, title: "Assess Immediate Safety", description: "Determine if the client needs emergency services or immediate intervention.", icon: CheckCircle },
  { step: 4, title: "Escalate Internally", description: "Notify the clinical supervisor and document in the incident log.", icon: FileText },
  { step: 5, title: "Follow-up Protocol", description: "Schedule a welfare check and assign daily monitoring for 7 days.", icon: CheckCircle },
];

export default async function EscalationWorkflowPage() {
  const user = await getLoggedInUser();
  if (!user || !user.labels?.includes("admin")) redirect("/dashboard");

  return (
    <div>
      <AdminPageHeader
        title="Crisis Escalation Workflow"
        description="Reference procedure for handling high-risk client situations. Progress is not tracked — record what you did in the incident log."
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
          {STEPS.map((step) => (
            <div key={step.step} className="relative flex gap-5 pb-6">
              <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 z-10 border-2 bg-white border-stone-300 text-stone-500">
                <step.icon className="w-5 h-5" />
              </div>
              <div className="flex-1 pt-2.5">
                <span className="text-xs font-bold text-stone-400 uppercase">Step {step.step}</span>
                <h3 className="text-sm font-bold text-stone-900 mb-1 mt-1">{step.title}</h3>
                <p className="text-sm text-stone-500">{step.description}</p>
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
