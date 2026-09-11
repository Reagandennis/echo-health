"use client";

import { LogOut } from "lucide-react";
import { signOut } from "@/lib/auth/client";
import { useState } from "react";

interface SignOutButtonProps {
  className?: string;
  variant?: "sidebar" | "ghost";
  /** Icon only, for the collapsed admin sidebar — the label becomes an aria-label. */
  iconOnly?: boolean;
}

export default function SignOutButton({ className, variant = "ghost", iconOnly = false }: SignOutButtonProps) {
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
        type="button"
        onClick={handleSignOut}
        disabled={loading}
        aria-label={iconOnly ? "Sign out" : undefined}
        title={iconOnly ? "Sign out" : undefined}
        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-60 ${
          iconOnly ? "justify-center" : ""
        } ${className ?? ""}`}
      >
        <LogOut size={16} className={`shrink-0 ${loading ? "animate-pulse" : ""}`} />
        {!iconOnly && (loading ? "Signing out…" : "Sign out")}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={loading}
      className={`flex items-center gap-2 px-4 py-2 text-stone-600 font-semibold text-sm hover:text-stone-900 transition-colors disabled:opacity-60 ${className ?? ""}`}
    >
      <LogOut size={16} className={loading ? "animate-pulse" : ""} />
      {loading ? "…" : "Sign out"}
    </button>
  );
}
