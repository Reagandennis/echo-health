"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle, ArrowRight, Download, Sparkles } from "lucide-react";
import { Suspense } from "react";
import { updatePrefs } from "@/lib/appwrite/auth";

function PaymentSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const plan = searchParams.get("plan") ?? "Plus";
  const [count, setCount] = useState(5);

  // Persist the chosen plan so signin can skip onboarding next time
  useEffect(() => {
    updatePrefs({ plan: plan.toLowerCase() }).catch(() => null);
  }, [plan]);

  useEffect(() => {
    if (count <= 0) { router.push("/dashboard"); return; }
    const t = setTimeout(() => setCount((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [count, router]);

  return (
    <div className="min-h-screen bg-cream flex flex-col items-center justify-center px-4">
      <div className="relative mb-8">
        <div className="w-24 h-24 rounded-full bg-brand/10 flex items-center justify-center animate-pulse">
          <div className="w-16 h-16 rounded-full bg-brand/20 flex items-center justify-center">
            <CheckCircle size={40} className="text-brand" strokeWidth={1.5} />
          </div>
        </div>
        <span className="absolute -top-1 -right-1 bg-amber-400 text-amber-900 text-xs font-bold px-2 py-0.5 rounded-full">
          ✓ Paid
        </span>
      </div>

      <div className="text-center max-w-md mb-10">
        <div className="inline-flex items-center gap-2 bg-brand/10 text-brand text-sm font-medium px-4 py-1.5 rounded-full mb-4">
          <Sparkles size={13} />
          Payment confirmed
        </div>
        <h1 className="text-3xl font-bold text-brand mb-3">You&apos;re all set!</h1>
        <p className="text-brand/60 text-base leading-relaxed">
          Your <span className="font-semibold text-brand">{plan} Plan</span> is now active.
          We&apos;re matching you with the right therapist and will notify you shortly.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-brand/10 shadow-sm p-6 w-full max-w-sm mb-8">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand/40">Receipt</p>
          <button className="flex items-center gap-1 text-xs text-brand/50 hover:text-brand transition-colors">
            <Download size={12} /> Download
          </button>
        </div>
        <div className="space-y-2 text-sm">
          {[
            { label: "Plan", value: `${plan} Plan` },
            { label: "Status", value: "Active" },
            { label: "Next billing", value: "In 30 days" },
            { label: "Support", value: "support@echohealth.com" },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between">
              <span className="text-brand/40">{label}</span>
              <span className={`font-medium ${label === "Status" ? "text-emerald-600" : "text-brand"}`}>
                {value}
              </span>
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={() => router.push("/dashboard")}
        className="flex items-center gap-2 bg-brand text-white font-semibold px-8 py-3.5 rounded-full shadow-md hover:bg-brand/90 active:scale-95 transition-all"
      >
        Go to dashboard
        <ArrowRight size={16} />
      </button>
      <p className="text-xs text-brand/35 mt-4">Redirecting automatically in {count}s…</p>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-cream flex items-center justify-center"><p className="text-brand/60">Loading...</p></div>}>
      <PaymentSuccessContent />
    </Suspense>
  );
}
