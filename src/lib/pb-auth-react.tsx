"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createPb } from "@/lib/pb";
import { pbSubscribe } from "@/lib/pbRealtime";

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

export function SessionProvider({ children, refetchInterval = 120, refetchOnWindowFocus = false }: SessionProviderProps) {
  const [data, setData] = useState<PbServerSession | null>(null);
  const [status, setStatus] = useState<SessionStatus>("loading");
  
  const isFetching = useRef(false);
  const sessionTokenRef = useRef<string | null>(null);
  const statusRef = useRef<SessionStatus>("loading");
  const retryCount = useRef(0);
  const MAX_RETRIES = 3;

  const update = useCallback(async (newData?: PbServerSession | null) => {
    if (newData !== undefined) {
      if (newData) {
        setData(newData);
        setStatus("authenticated");
        statusRef.current = "authenticated";
        sessionTokenRef.current = newData.token || null;
        retryCount.current = 0;
        if (newData.token && typeof window !== "undefined") {
          localStorage.setItem("auth-token", newData.token);
        }
      } else {
        setData(null);
        setStatus("unauthenticated");
        statusRef.current = "unauthenticated";
        sessionTokenRef.current = null;
        if (typeof window !== "undefined") localStorage.removeItem("auth-token");
      }
      return;
    }

    if (isFetching.current) return;
    isFetching.current = true;
    try {
      const storedToken = typeof window !== "undefined" ? localStorage.getItem("auth-token") : null;
      const headers: Record<string, string> = {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache"
      };
      if (storedToken) {
        headers["Authorization"] = `Bearer ${storedToken}`;
      }
      const res = await fetch(`/api/auth/pb-session?_=${Date.now()}`, {
        signal: AbortSignal.timeout(30000),
        headers
      });
      if (res.ok) {
        const json = await res.json();
        retryCount.current = 0;
        if (json.user) {
          setData(prev => {
            if (prev && JSON.stringify(prev) === JSON.stringify(json)) return prev;
            return json;
          });
          setStatus("authenticated");
          statusRef.current = "authenticated";
          sessionTokenRef.current = json.token || null;
          if (json.token && typeof window !== "undefined") {
            localStorage.setItem("auth-token", json.token);
          }
        } else {
          setData(null);
          setStatus("unauthenticated");
          statusRef.current = "unauthenticated";
          sessionTokenRef.current = null;
          if (typeof window !== "undefined") localStorage.removeItem("auth-token");
        }
      } else if (res.status === 401) {
        const hasStoredToken = typeof window !== "undefined" && !!localStorage.getItem("auth-token");
        if (!hasStoredToken) {
          setData(null);
          setStatus("unauthenticated");
          statusRef.current = "unauthenticated";
          sessionTokenRef.current = null;
        } else if (retryCount.current < MAX_RETRIES) {
          retryCount.current++;
          isFetching.current = false;
          setTimeout(update, 1000 * retryCount.current);
          return;
        } else {
          // Retries exhausted — token is genuinely invalid, clear it
          setData(null);
          setStatus("unauthenticated");
          statusRef.current = "unauthenticated";
          sessionTokenRef.current = null;
          if (typeof window !== "undefined") localStorage.removeItem("auth-token");
        }
      } else {
        const hasStoredToken = typeof window !== "undefined" && !!localStorage.getItem("auth-token");
        if (!hasStoredToken) {
          setStatus(prev => prev === 'loading' ? 'unauthenticated' : prev);
          if (statusRef.current === 'loading') statusRef.current = 'unauthenticated';
        }
      }
    } catch (err: any) {
      const isTimeout = err?.name === 'TimeoutError' || err?.name === 'AbortError';
      const msg = isTimeout ? 'Request timed out' : (err?.message || String(err));

      if (retryCount.current < MAX_RETRIES) {
        retryCount.current++;
        const delay = Math.min(retryCount.current * 2000, 10000);
        isFetching.current = false;
        setTimeout(update, delay);
        return;
      }

      const hasStoredToken = typeof window !== "undefined" && !!localStorage.getItem("auth-token");
      if (!hasStoredToken) {
        setStatus(prev => prev === 'loading' ? 'unauthenticated' : prev);
      }
    } finally {
      isFetching.current = false;
    }
  }, []);

  useEffect(() => {
    update();
  }, [update]);

  // Heartbeat poll every refetchInterval seconds ONLY when authenticated
  useEffect(() => {
    if (status !== "authenticated") return;
    const interval = setInterval(update, refetchInterval * 1000);
    return () => clearInterval(interval);
  }, [refetchInterval, status, update]);

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

    let mounted = true;
    const currentToken = sessionTokenRef.current;

    const unsub = pbSubscribe("user_sessions", "*", (e) => {
      try {
        if (!mounted) return;
        // If session was deleted (force logout from another device)
        if (e.action === "delete") {
          const deletedToken = e.record?.sessionToken;
          if (deletedToken === currentToken) {
            setData(null);
            setStatus("unauthenticated");
            sessionTokenRef.current = null;
            // Clear cookie via logout endpoint
            fetch("/api/auth/pb-logout", { method: "POST", signal: AbortSignal.timeout(10000) }).catch(() => {});
          }
        }
      } catch (subErr) {
        console.warn("[PB Session Provider] Subscription callback error:", subErr);
      }
    }, {
      tokenProvider: () => (typeof window !== "undefined" ? localStorage.getItem("auth-token") : null),
    });

    return () => {
      mounted = false;
      unsub();
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
  if (typeof window !== "undefined") {
    (window as any).__latexy_signOutInProgress = true;
  }

  if (typeof window !== "undefined") {
    // Fire the logout request (server purges cookies + revokes sessions).
    // Retried once: a slow backend must not leave the HttpOnly pb_token cookie
    // (which client JS cannot delete) in the browser.
    const attemptLogout = () =>
      fetch("/api/auth/pb-logout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      }).then(
        () => {},
        () => {}
      );

    try {
      await attemptLogout();
      await attemptLogout();
    } catch {}

    // Final safety net: one round-trip to /api/auth/pb-session. If the cookie
    // survived (timeout race, in-flight poll re-setting it, etc.), the server
    // treats the missing UserSession row as logged-out and purges the cookie.
    try {
      await fetch(`/api/auth/pb-session?_=${Date.now()}`, {
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
      });
    } catch {}

    try {
      localStorage.removeItem("auth-token");
      sessionStorage.clear();
      document.cookie = "pb_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0";
      document.cookie = "admin_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0";
      document.cookie = "next-auth.session-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0";
      document.cookie = "__Secure-next-auth.session-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0";
    } catch {}
    window.location.href = options?.callbackUrl || "/login";
  }
}

export function signIn() {
  if (typeof window !== "undefined") {
    window.location.href = "/login";
  }
}
