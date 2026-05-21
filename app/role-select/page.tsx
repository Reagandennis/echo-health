"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Heart, Stethoscope, ArrowRight, Loader2 } from "lucide-react";
import { Suspense } from "react";
import { useUser } from "@/app/components/UserProvider";
import SignOutButton from "@/app/components/SignOutButton";

type Role = "client" | "therapist";

const roles: {
  id: Role;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  description: string;
  perks: string[];
  accent: string;
  redirectTo: string;
}[] = [
  {
    id: "client",
    icon: <Heart size={32} strokeWidth={1.5} />,
    title: "I'm seeking support",
    subtitle: "Client",
    description:
      "Get matched with a licensed therapist, track your progress, and work toward your mental wellness goals.",
    perks: [
      "Matched with a licensed therapist",
      "Secure video & messaging sessions",
      "Progress & mood tracking",
      "Goal-setting with your therapist",
    ],
    accent: "brand",
    redirectTo: "/onboarding",
  },
  {
    id: "therapist",
    icon: <Stethoscope size={32} strokeWidth={1.5} />,
    title: "I'm a therapist",
    subtitle: "Therapist",
    description:
      "Join our network of licensed clinicians. Manage your clients, sessions, and clinical notes — all in one place.",
    perks: [
      "Full client management suite",
      "Clinical notes & SOAP templates",
      "Scheduling & availability tools",
      "Earnings & compliance dashboard",
    ],
    accent: "stone",
    redirectTo: "/therapist/onboarding",
  },
];

function RoleSelectContent() {
  const router = useRouter();
  const user = useUser();
  const [selected, setSelected] = useState<Role | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      router.replace("/signin");
      return;
    }
    const labels: string[] = user.labels ?? [];
    if (labels.includes("admin")) {
      router.replace("/admin");
    } else if (labels.includes("therapist")) {
      router.replace("/therapist");
    } else if (labels.includes("client")) {
      router.replace("/onboarding");
    }
  }, [user, router]);

  async function handleConfirm() {
    if (!selected || !user) return;
    setSubmitting(true);
    setError(null);

    try {
      // Clients self-assign the "client" label. Therapists do NOT receive a
      // label here — they complete /therapist/onboarding, an admin reviews
      // their KYC, and only then does /api/admin/therapist-kyc assign the
      // "therapist" label. This prevents self-promotion to a role with
      // access to clinical data.
      if (selected === "client") {
        const res = await fetch("/api/user/set-role", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: user.$id, role: "client" }),
        });

        if (!res.ok) {
          const data = await res.json() as { error?: string };
          throw new Error(data.error ?? "Failed to save role.");
        }
      }

      const target = roles.find((r) => r.id === selected)?.redirectTo ?? "/onboarding";
      router.push(target);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-brand border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-brand/10">
        <span className="text-xl font-bold text-brand tracking-tight">echo health</span>
        <SignOutButton />
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-14">
        {/* Hero */}
        <div className="text-center max-w-xl mb-12">
          <div className="inline-flex items-center gap-2 bg-brand/10 text-brand text-sm font-medium px-4 py-1.5 rounded-full mb-5">
            One quick question
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-brand leading-tight">
            How will you be using<br />Echo Health?
          </h1>
          <p className="mt-3 text-brand/55 text-base">
            Choose your role. You won&apos;t be able to change this later.
          </p>
        </div>

        {/* Role cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 w-full max-w-2xl">
          {roles.map((role) => {
            const isSelected = selected === role.id;
            return (
              <button
                key={role.id}
                onClick={() => setSelected(role.id)}
                className={`relative text-left rounded-2xl p-8 border-2 transition-all duration-200 focus:outline-none bg-white
                  ${isSelected
                    ? "border-brand ring-4 ring-brand/20 scale-[1.02] shadow-xl"
                    : "border-cream hover:border-brand/30 hover:shadow-md"
                  }`}
              >
                {/* Selected indicator */}
                {isSelected && (
                  <span className="absolute top-4 right-4 w-6 h-6 rounded-full bg-brand flex items-center justify-center">
                    <svg width="12" height="9" viewBox="0 0 12 9" fill="none">
                      <path d="M1 4L4.5 7.5L11 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                )}

                {/* Icon */}
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-5 transition-colors
                  ${isSelected ? "bg-brand text-white" : "bg-brand/10 text-brand"}`}>
                  {role.icon}
                </div>

                {/* Label */}
                <p className="text-xs font-semibold uppercase tracking-widest text-brand/40 mb-1">
                  {role.subtitle}
                </p>
                <h2 className="text-xl font-bold text-brand mb-3">{role.title}</h2>
                <p className="text-sm text-brand/60 leading-relaxed mb-5">{role.description}</p>

                {/* Perks */}
                <ul className="space-y-2">
                  {role.perks.map((perk) => (
                    <li key={perk} className="flex items-center gap-2 text-sm text-brand/70">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isSelected ? "bg-brand" : "bg-brand/30"}`} />
                      {perk}
                    </li>
                  ))}
                </ul>
              </button>
            );
          })}
        </div>

        {/* Error */}
        {error && (
          <p className="mt-6 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            {error}
          </p>
        )}

        {/* CTA */}
        <div className="mt-10 flex flex-col items-center gap-3">
          <button
            onClick={handleConfirm}
            disabled={!selected || submitting}
            className="flex items-center gap-2 bg-brand text-white font-semibold px-8 py-3.5 rounded-full shadow-md hover:bg-brand/90 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
          >
            {submitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Setting up your account…
              </>
            ) : (
               <>
                {selected
                  ? `Continue as ${roles.find((r) => r.id === selected)?.subtitle ?? selected}`
                  : "Select a role to continue"}
                {!submitting && selected && <ArrowRight size={16} />}
              </>
            )}
          </button>
          <p className="text-xs text-brand/35">This can&apos;t be changed once set.</p>
        </div>
      </main>
    </div>
  );
}

export default function RoleSelectPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-cream flex items-center justify-center"><div className="w-8 h-8 rounded-full border-2 border-brand border-t-transparent animate-spin" /></div>}>
      <RoleSelectContent />
    </Suspense>
  );
}
