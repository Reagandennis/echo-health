"use client";

import { useEffect, useState } from "react";
import { CreditCard, ChevronRight, CheckCircle2, Clock } from "lucide-react";
import { listPatientSessionsAction, listMyPaymentsAction } from "@/app/actions/database";
import { PLAN_LABELS, PLAN_PRICES, PLAN_SESSIONS, PLAN_CURRENCY } from "@/lib/constants";
import { useUser } from "@/app/components/UserProvider";
import posthog from "posthog-js";

type Plan = keyof typeof PLAN_SESSIONS;

/**
 * Real payment history replaces a hardcoded INVOICES array that showed every
 * user four USD invoices ("$99.00 Plus Plan – Monthly") they had never been
 * charged. Fabricated financial records in a live billing screen read as
 * unauthorised charges.
 */
type PaymentRow = {
  $id: string;
  reference: string;
  plan: string;
  amountMinor: number;
  currency: string;
  status: string;
  channel: string | null;
  paidAt: string | Date | null;
  createdAt: string | Date;
};

function money(minor: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(minor / 100);
  } catch {
    return `${currency} ${Math.round(minor / 100).toLocaleString()}`;
  }
}

export default function BillingPage() {
  const user = useUser();
  const [plan, setPlan]         = useState<Plan>("individual");
  const [used, setUsed]         = useState(0);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const rawPlan = user.prefs?.plan;
        if (rawPlan && rawPlan in PLAN_SESSIONS) setPlan(rawPlan as Plan);
        // Server Action, not the browser SDK: the browser Appwrite client has no
        // session, so the previous direct call always failed into the catch below
        // and silently reported 0 sessions used.
        // Both reads in parallel — separate Server Actions, so separate
        // transactions, and there is no dependency between them.
        const [sessions, history] = await Promise.all([
          listPatientSessionsAction(user.$id),
          listMyPaymentsAction(),
        ]);
        const completed = sessions.filter((s) => s.status === "completed").length;
        setUsed(completed);
        setPayments(history as unknown as PaymentRow[]);
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
        <p className="text-sm text-stone-500 mt-0.5">Manage your plan and payment details.</p>
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
                <p className="text-white/60 text-sm mt-0.5">
                  {money(PLAN_PRICES[plan] * 100, PLAN_CURRENCY)} · one-time
                </p>
              </div>
              <span className="text-xs font-bold bg-white/15 px-3 py-1 rounded-full">Active</span>
            </div>

            <div className="mb-1.5 flex items-center justify-between text-xs text-white/60">
              <span>Session credits</span>
              <span>{used} / {total} used</span>
            </div>
            <div className="w-full bg-white/15 rounded-full h-2 overflow-hidden mb-4">
              <div className="h-full bg-white rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>
            <p className="text-sm text-white/60">
              {remaining > 0
                ? <><span className="text-white font-semibold">{remaining} session{remaining > 1 ? "s" : ""}</span> remaining</>
                : <span className="text-red-200 font-semibold">No sessions left — buy more to keep going</span>}
            </p>
          </>
        )}
      </div>

      {/* Upgrade CTA */}
      {plan !== "plus" && (
        <a href="/onboarding"
          onClick={() => posthog.capture("plan_upgrade_clicked", { current_plan: plan })}
          className="flex items-center justify-between bg-white rounded-2xl border border-brand/10 hover:border-brand/25 p-5 mb-6 transition-colors group">
          <div>
            <p className="text-sm font-semibold text-brand">Upgrade your plan</p>
            <p className="text-xs text-stone-500 mt-0.5">Get more sessions and priority support.</p>
          </div>
          <ChevronRight size={16} className="text-stone-400 group-hover:text-brand transition-colors" />
        </a>
      )}

      {/* No stored payment method. Card details are handled entirely by
          Paystack's hosted checkout and never reach this application, so
          displaying a saved card here — as a hardcoded "•••• 4242" previously
          did — claims a relationship with the user's card that does not exist. */}
      {/* Invoices */}
      <div className="bg-white rounded-2xl border border-brand/10 overflow-hidden">
        <div className="px-5 py-4 border-b border-brand/8">
          <p className="text-sm font-semibold text-brand">Invoice history</p>
        </div>
        <div className="divide-y divide-brand/6">
          {payments.length === 0 && (
            <p className="px-5 py-6 text-sm text-stone-500">
              No payments yet. Your receipts will appear here after your first purchase.
            </p>
          )}
          {payments.map((p) => (
            <div key={p.$id} className="flex items-center justify-between px-5 py-3.5">
              <div className="flex items-center gap-3">
                {p.status === "success" ? (
                  <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                ) : (
                  <Clock size={14} className="text-amber-500 shrink-0" />
                )}
                <div>
                  <p className="text-sm font-medium text-brand">
                    {PLAN_LABELS[p.plan] ?? p.plan} · {PLAN_SESSIONS[p.plan] ?? 1} session
                    {(PLAN_SESSIONS[p.plan] ?? 1) > 1 ? "s" : ""}
                  </p>
                  <p className="text-xs text-stone-500">
                    {new Date(p.paidAt ?? p.createdAt).toLocaleDateString()}
                    {p.channel ? ` · ${p.channel}` : ""}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-brand">
                  {money(p.amountMinor, p.currency)}
                </p>
                <p className="text-xs text-stone-500 capitalize">{p.status}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
