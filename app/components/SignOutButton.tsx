"use client";

import { LogOut } from "lucide-react";
import { signOut } from "@/lib/auth/client";
import { useState } from "react";

interface SignOutButtonProps {
  className?: string;
  variant?: "sidebar" | "ghost";
}

export default function SignOutButton({ className, variant = "ghost" }: SignOutButtonProps) {
  const [loading, setLoading] = useState(false);

  /**
   * `signOut()` is a full-page navigation to `/auth/logout`, not a promise — Auth0
   * clears the session cookie and redirects on its own, so there is no router
   * push to make and nothing to await. `loading` stays true for the brief moment
   * before the browser leaves the page, which also debounces double clicks.
   */
  function handleSignOut() {
    if (loading) return;
    setLoading(true);
    signOut();
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
