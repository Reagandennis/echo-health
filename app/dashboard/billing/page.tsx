"use client";

import { useEffect, useState } from "react";
import { CreditCard, ChevronRight, CheckCircle2, Clock } from "lucide-react";
import { listPatientSessions } from "@/lib/appwrite/database";
import { PLAN_LABELS, PLAN_PRICES, PLAN_SESSIONS } from "@/lib/constants";
import { useUser } from "@/app/components/UserProvider";

type Plan = keyof typeof PLAN_SESSIONS;

const INVOICES = [
  { id: "inv-001", date: "Jun 1, 2025",  description: "Plus Plan – Monthly",     amount: "$99.00",  status: "paid"    },
  { id: "inv-002", date: "May 1, 2025",  description: "Plus Plan – Monthly",     amount: "$99.00",  status: "paid"    },
  { id: "inv-003", date: "Apr 1, 2025",  description: "Individual Plan – Monthly", amount: "$59.00", status: "paid"    },
  { id: "inv-004", date: "Mar 31, 2025", description: "Individual Plan – Monthly", amount: "$59.00", status: "overdue" },
];

export default function BillingPage() {
  const user = useUser();
  const [plan, setPlan]         = useState<Plan>("individual");
  const [used, setUsed]         = useState(0);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const rawPlan = (user.prefs as Record<string, string> | undefined)?.plan;
        if (rawPlan && rawPlan in PLAN_SESSIONS) setPlan(rawPlan as Plan);
        const sessions = await listPatientSessions(user.$id);
        const completed = sessions.filter((s) => s.status === "completed").length;
        setUsed(completed);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="w-7 h-7 rounded-full border-2 border-brand border-t-transparent animate-spin" />
      </div>
    );
  }

  const total     = PLAN_SESSIONS[plan] ?? 1;
  const remaining = Math.max(0, total - used);
  const pct       = Math.round((used / total) * 100);

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-xl font-bold text-brand">Billing</h1>
        <p className="text-sm text-brand/45 mt-0.5">Manage your plan and payment details.</p>
      </div>

      {/* Current plan card */}
      <div className="bg-brand rounded-2xl p-6 mb-6 text-white">
        {loading ? (
          <div className="h-20 animate-pulse bg-white/10 rounded-xl" />
        ) : (
          <>
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-xs font-semibold text-white/50 uppercase tracking-wide mb-1">Current plan</p>
                <p className="text-2xl font-bold">{PLAN_LABELS[plan]}</p>
                <p className="text-white/60 text-sm mt-0.5">{PLAN_PRICES[plan]} / month</p>
              </div>
              <span className="text-xs font-bold bg-white/15 px-3 py-1 rounded-full">Active</span>
            </div>

            <div className="mb-1.5 flex items-center justify-between text-xs text-white/60">
              <span>Session usage this month</span>
              <span>{used} / {total} used</span>
            </div>
            <div className="w-full bg-white/15 rounded-full h-2 overflow-hidden mb-4">
              <div className="h-full bg-white rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>
            <p className="text-sm text-white/60">
              {remaining > 0
                ? <><span className="text-white font-semibold">{remaining} session{remaining > 1 ? "s" : ""}</span> remaining this month</>
                : <span className="text-red-200 font-semibold">No sessions remaining — upgrade for more</span>}
            </p>
          </>
        )}
      </div>

      {/* Upgrade CTA */}
      {plan !== "plus" && (
        <a href="/onboarding"
          className="flex items-center justify-between bg-white rounded-2xl border border-brand/10 hover:border-brand/25 p-5 mb-6 transition-colors group">
          <div>
            <p className="text-sm font-semibold text-brand">Upgrade your plan</p>
            <p className="text-xs text-brand/45 mt-0.5">Get more sessions and priority support.</p>
          </div>
          <ChevronRight size={16} className="text-brand/30 group-hover:text-brand transition-colors" />
        </a>
      )}

      {/* Payment method */}
      <div className="bg-white rounded-2xl border border-brand/10 p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold text-brand">Payment method</p>
          <button className="text-xs font-semibold text-brand/50 hover:text-brand transition-colors">Update</button>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-10 h-7 bg-brand/10 rounded flex items-center justify-center">
            <CreditCard size={14} className="text-brand" />
          </div>
          <div>
            <p className="text-sm font-medium text-brand">•••• •••• •••• 4242</p>
            <p className="text-xs text-brand/40">Expires 08 / 27</p>
          </div>
        </div>
      </div>

      {/* Invoices */}
      <div className="bg-white rounded-2xl border border-brand/10 overflow-hidden">
        <div className="px-5 py-4 border-b border-brand/8">
          <p className="text-sm font-semibold text-brand">Invoice history</p>
        </div>
        <div className="divide-y divide-brand/6">
          {INVOICES.map((inv) => (
            <div key={inv.id} className="flex items-center justify-between px-5 py-3.5">
              <div className="flex items-center gap-3">
                {inv.status === "paid" ? (
                  <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                ) : (
                  <Clock size={14} className="text-amber-500 shrink-0" />
                )}
                <div>
                  <p className="text-sm font-medium text-brand">{inv.description}</p>
                  <p className="text-xs text-brand/40">{inv.date}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-brand">{inv.amount}</p>
                <p className={`text-xs font-semibold ${inv.status === "paid" ? "text-emerald-500" : "text-amber-500"}`}>
                  {inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
