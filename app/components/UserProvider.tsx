"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
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
  /**
   * True once the session state is actually KNOWN: a server-supplied `user`
   * prop, or an `/api/me` probe that came back.
   *
   * This is NOT the inverse of `loading`. `loading` is cleared even when the
   * probe FAILS, because a consumer blocked on it would otherwise hang forever
   * — which leaves `user` null without anything having established that nobody
   * is signed in. That ambiguity is harmless for the ~26 consumers that only
   * want to render a name, and dangerous for anything whose safe default
   * depends on being signed in.
   *
   * The live case is PostHog session replay: replay is allowed to run on the
   * anonymous marketing funnel and must never run behind the login wall, so
   * `PostHogProvider` starts it only when this is true and `user` is null.
   * Reading a failed probe as "signed out" would start recording a clinician's
   * screen, which is exactly the leak `disable_session_recording` exists to
   * prevent.
   */
  resolved: boolean;
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
  // A provider handed an authoritative `user` prop knows the answer already;
  // only a hydrating one has to earn it.
  const [resolved, setResolved] = useState(!willFetch);

  useEffect(() => {
    if (!willFetch) return;
    let cancelled = false;
    fetch("/api/me", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        setUser(data.user ?? null);
        // Only a response that actually arrived settles the question. A thrown
        // fetch or a non-OK status leaves `resolved` false forever, which is
        // the fail-closed half of the pair documented on `UserContextType`.
        setResolved(true);
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

  const value = useMemo(() => ({ user, loading, resolved }), [user, loading, resolved]);

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
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
 * which returns here and loops. If the safe behaviour instead depends on being
 * signed IN, gate on `resolved` rather than `!loading` — see `UserContextType`.
 */
export function useSession(): UserContextType {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error("useSession must be used within a UserProvider");
  }
  return context;
}
