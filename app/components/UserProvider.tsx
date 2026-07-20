"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import type { SessionUser } from "@/lib/auth/session";

/**
 * Auth0-backed user. Keeps the Appwrite-era field names (`$id`, `labels`) so the
 * 26 `useUser()` consumers did not need to change during the Auth0 migration.
 */
type AppUser = SessionUser | null;

interface UserContextType {
  user: AppUser;
  /**
   * True while the client-side hydration fetch is still in flight.
   *
   * This distinction is load-bearing. `user` is `null` both when nobody is
   * signed in AND during the first render of a hydrating provider, and a
   * consumer that reads `!user` as "signed out" will redirect a perfectly valid
   * session to the login page — which sends them back here, and loops. Anything
   * that redirects on a missing user MUST wait for this to be false.
   */
  loading: boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

interface UserProviderProps {
  children: React.ReactNode;
  /** Server-fetched user. When provided, no client fetch is made. */
  user?: AppUser;
  /** Set true on the root provider so it self-hydrates via /api/me when no user prop is given. */
  hydrate?: boolean;
}

export function UserProvider({ children, user: initialUser, hydrate = false }: UserProviderProps) {
  const [user, setUser] = useState<AppUser>(initialUser ?? null);

  // Only a hydrating provider with no server-supplied user has anything to wait
  // for; when a Server Layout passes `user` down, it is already authoritative.
  const willFetch = hydrate && initialUser === undefined;
  const [loading, setLoading] = useState(willFetch);

  useEffect(() => {
    if (!willFetch) return;
    let cancelled = false;
    fetch("/api/me", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data) setUser(data.user ?? null);
      })
      .catch(() => {})
      .finally(() => {
        // Cleared even on failure: a consumer blocked on `loading` would hang
        // forever otherwise, which is a worse failure than showing signed-out.
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [willFetch]);

  return (
    <UserContext.Provider value={{ user, loading }}>{children}</UserContext.Provider>
  );
}

/**
 * The user, or `null`.
 *
 * Signature unchanged so the ~26 existing consumers keep working. Note that
 * `null` is ambiguous during hydration — if you are about to redirect on a
 * missing user, use `useSession()` instead and wait for `loading` to clear.
 */
export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context.user;
}

/**
 * The user together with hydration state.
 *
 * Use this — not `useUser()` — anywhere a missing user triggers navigation.
 * Redirecting while `loading` is true bounces a valid session to the login page,
 * which returns here and loops.
 */
export function useSession(): { user: AppUser; loading: boolean } {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error("useSession must be used within a UserProvider");
  }
  return context;
}
