"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

interface AuthContextValue {
  user: string | null;
  login: (name: string) => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("av_user");
  });

  const login = (name: string) => {
    const trimmer = name.trim() || "JUGADOR";
    localStorage.setItem("av_user", trimmer);
    setUser(trimmer);
  };

  const signOut = () => {
    setUser(null);
    localStorage.removeItem("av_user");
  };

  return (
    <AuthContext.Provider value={{ user, login, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}
