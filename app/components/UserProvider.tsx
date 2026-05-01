"use client";

import React, { createContext, useContext } from "react";
import type { Models } from "appwrite";

interface UserContextType {
  user: Models.User<Models.Preferences> | null;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ 
  children, 
  user 
}: { 
  children: React.ReactNode;
  user: Models.User<Models.Preferences> | null;
}) {
  return (
    <UserContext.Provider value={{ user }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context.user;
}
