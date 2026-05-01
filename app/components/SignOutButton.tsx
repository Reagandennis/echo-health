"use client";

import { LogOut } from "lucide-react";
import { signOut } from "@/lib/appwrite/auth";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface SignOutButtonProps {
  className?: string;
  variant?: "sidebar" | "ghost";
}

export default function SignOutButton({ className, variant = "ghost" }: SignOutButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSignOut() {
    if (loading) return;
    setLoading(true);
    try {
      await signOut();
      router.push("/signin");
      router.refresh();
    } catch (error) {
      console.error("Sign out failed:", error);
    } finally {
      setLoading(false);
    }
  }

  if (variant === "sidebar") {
    return (
      <button
        onClick={handleSignOut}
        disabled={loading}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${className}`}
      >
        <LogOut size={16} className={loading ? "animate-pulse" : ""} />
        {loading ? "Signing out..." : "Sign out"}
      </button>
    );
  }

  return (
    <button
      onClick={handleSignOut}
      disabled={loading}
      className={`flex items-center gap-2 px-4 py-2 text-stone-600 font-bold text-sm hover:text-stone-900 transition-colors ${className}`}
    >
      <LogOut size={16} className={loading ? "animate-pulse" : ""} />
      {loading ? "..." : "Sign out"}
    </button>
  );
}
