"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, ArrowLeft, Loader2, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import AuthInput from "@/app/components/AuthInput";
import { sendPasswordReset } from "@/lib/appwrite/auth";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await sendPasswordReset(email);
      setSent(true);
    } catch (err: any) {
      setError(err.message || "Failed to send reset email. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="flex flex-col gap-6 text-center">
        <div className="flex justify-center">
          <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
            <CheckCircle2 size={28} />
          </div>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-brand">Check your email</h1>
          <p className="mt-2 text-sm text-brand/55 leading-relaxed">
            We&apos;ve sent a password reset link to <span className="font-semibold text-brand">{email}</span>. 
            Please check your inbox and follow the instructions.
          </p>
        </div>
        <Link 
          href="/signin" 
          className="mt-2 inline-flex items-center justify-center gap-2 text-sm font-semibold text-brand hover:opacity-75 transition-opacity"
        >
          <ArrowLeft size={16} />
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold text-brand">Reset password</h1>
        <p className="mt-1 text-sm text-brand/55">
          Enter your email address and we&apos;ll send you a link to reset your password.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <AuthInput
          id="email"
          label="Email address"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          icon={Mail}
        />

        <button
          type="submit"
          disabled={loading || !email}
          className="mt-1 w-full rounded-xl bg-brand py-3 text-sm font-semibold text-white hover:opacity-90 transition-opacity shadow-sm disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading && <Loader2 size={16} className="animate-spin" />}
          {loading ? "Sending link…" : "Send reset link"}
        </button>

        <Link 
          href="/signin" 
          className="inline-flex items-center justify-center gap-2 text-sm font-semibold text-brand/60 hover:text-brand transition-colors"
        >
          <ArrowLeft size={16} />
          Back to sign in
        </Link>
      </form>
    </div>
  );
}
