"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";

export interface PbSessionUser {
  id: string;
  email: string;
  name: string;
  image: string | null;
  points: number;
  theme: string;
  membership: string;
  role: string;
}

export interface PbServerSession {
  user: PbSessionUser;
  token?: string;
}

export type SessionStatus = "loading" | "authenticated" | "unauthenticated";

interface SessionContextValue {
  data: PbServerSession | null;
  status: SessionStatus;
  update: (data?: any) => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

interface SessionProviderProps {
  children: ReactNode;
  refetchInterval?: number;
  refetchOnWindowFocus?: boolean;
}

export function SessionProvider({ children, refetchInterval, refetchOnWindowFocus = false }: SessionProviderProps) {
  const [data, setData] = useState<PbServerSession | null>(null);
  const [status, setStatus] = useState<SessionStatus>("loading");
  
  const isFetching = useRef(false);

  const update = useCallback(async (data?: any) => {
    if (isFetching.current) return;
    isFetching.current = true;
    try {
      const res = await fetch("/api/auth/pb-session");
      if (res.ok) {
        const json = await res.json();
        if (json.user) {
          setData(json);
          setStatus("authenticated");
        } else {
          setData(null);
          setStatus("unauthenticated");
        }
      } else {
        setData(null);
        setStatus("unauthenticated");
      }
    } catch (err) {
      setData(null);
      setStatus("unauthenticated");
    } finally {
      isFetching.current = false;
    }
  }, []);

  useEffect(() => {
    update();
  }, [update]);

  useEffect(() => {
    if (!refetchInterval) return;
    const interval = setInterval(update, refetchInterval * 1000);
    return () => clearInterval(interval);
  }, [refetchInterval, update]);

  useEffect(() => {
    if (!refetchOnWindowFocus) return;
    const onFocus = () => update();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refetchOnWindowFocus, update]);

  return (
    <SessionContext.Provider value={{ data, status, update }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(options?: { required?: boolean; onUnauthenticated?: () => void }) {
  const context = useContext(SessionContext);
  const router = useRouter();

  if (!context) {
    throw new Error("useSession must be used within a SessionProvider");
  }

  useEffect(() => {
    if (options?.required && context.status === "unauthenticated") {
      if (options.onUnauthenticated) {
        options.onUnauthenticated();
      } else {
        router.push("/login");
      }
    }
  }, [context.status, options, router]);

  return context;
}

export async function signOut(options?: { callbackUrl?: string }) {
  // Set a global flag so AutoLogoutWatcher in both providers knows
  // this is an explicit user-initiated logout and should NOT race
  // with router.push("/login") against the full page navigation below.
  if (typeof window !== "undefined") {
    (window as any).__latexy_signOutInProgress = true;
  }
  try {
    await fetch("/api/auth/pb-logout", { method: "POST" });
  } catch { }
  if (typeof window !== "undefined") {
    window.location.href = options?.callbackUrl || "/login";
  }
}

export function signIn() {
  if (typeof window !== "undefined") {
    window.location.href = "/login";
  }
}
