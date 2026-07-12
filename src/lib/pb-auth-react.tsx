"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createPb } from "@/lib/pb";

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

export function SessionProvider({ children, refetchInterval = 30, refetchOnWindowFocus = false }: SessionProviderProps) {
  const [data, setData] = useState<PbServerSession | null>(null);
  const [status, setStatus] = useState<SessionStatus>("loading");
  
  const isFetching = useRef(false);
  const sessionTokenRef = useRef<string | null>(null);

  const update = useCallback(async () => {
    if (isFetching.current) return;
    isFetching.current = true;
    try {
      const res = await fetch("/api/auth/pb-session");
      if (res.ok) {
        const json = await res.json();
        if (json.user) {
          setData(json);
          setStatus("authenticated");
          sessionTokenRef.current = json.token || null;
        } else {
          setData(null);
          setStatus("unauthenticated");
          sessionTokenRef.current = null;
        }
      } else {
        setData(null);
        setStatus("unauthenticated");
        sessionTokenRef.current = null;
      }
    } catch {
      setData(null);
      setStatus("unauthenticated");
      sessionTokenRef.current = null;
    } finally {
      isFetching.current = false;
    }
  }, []);

  useEffect(() => {
    update();
  }, [update]);

  // Heartbeat poll every refetchInterval seconds
  useEffect(() => {
    const interval = setInterval(update, refetchInterval * 1000);
    return () => clearInterval(interval);
  }, [refetchInterval, update]);

  // Re-fetch on window focus
  useEffect(() => {
    if (!refetchOnWindowFocus) return;
    const onFocus = () => update();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refetchOnWindowFocus, update]);

  // PocketBase real-time subscription — auto sign-out when session is deleted remotely
  useEffect(() => {
    if (status !== "authenticated" || !sessionTokenRef.current) return;

    let unsub: (() => void) | null = null;
    let mounted = true;

    const setupSubscription = async () => {
      try {
        const pb = createPb();
        const token = typeof window !== "undefined" ? localStorage.getItem("auth-token") : null;
        if (token) pb.authStore.save(token, null);
        const currentToken = sessionTokenRef.current;

        unsub = await pb.collection("user_sessions").subscribe("*", (e) => {
          if (!mounted) return;
          // If session was deleted (force logout from another device)
          if (e.action === "delete") {
            const deletedToken = e.record?.sessionToken;
            if (deletedToken === currentToken) {
              setData(null);
              setStatus("unauthenticated");
              sessionTokenRef.current = null;
              // Clear cookie via logout endpoint
              fetch("/api/auth/pb-logout", { method: "POST" }).catch(() => {});
            }
          }
        });
      } catch {
        // Subscription failed — fallback to polling
      }
    };

    setupSubscription();

    return () => {
      mounted = false;
      if (unsub) try { unsub(); } catch {}
    };
  }, [status]);

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
