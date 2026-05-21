"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import type { Models } from "appwrite";

type AppUser = Models.User<Models.Preferences> | null;

interface UserContextType {
  user: AppUser;
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

  useEffect(() => {
    if (!hydrate || initialUser !== undefined) return;
    let cancelled = false;
    fetch("/api/me", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data) setUser(data.user ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [hydrate, initialUser]);

  return <UserContext.Provider value={{ user }}>{children}</UserContext.Provider>;
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context.user;
}
