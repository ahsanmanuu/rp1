"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createPb } from "@/lib/pb";
import { pbSubscribe } from "@/lib/pbRealtime";
import { clearAllAuthFailed } from "@/lib/authBackoff";

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
  const [status, setStatus] = useState<SessionStatus>(() => {
    if (typeof window !== "undefined") {
      const hasToken = !!localStorage.getItem("auth-token");
      const hasCookie = document.cookie.includes("pb_token") || document.cookie.includes("pb_auth");
      if (!hasToken && !hasCookie) return "unauthenticated";
    }
    return "loading";
  });
  
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
        clearAllAuthFailed();
      } else {
        setData(null);
        setStatus("unauthenticated");
        statusRef.current = "unauthenticated";
        sessionTokenRef.current = null;
        if (typeof window !== "undefined") localStorage.removeItem("auth-token");
      }
      return;
    }

    // Never re-authenticate (or resurrect a token into localStorage) while a
    // logout is in progress. This closes a race where an in-flight session
    // refresh completes after signOut() has cleared storage but before the
    // server has deleted the DB session, bouncing the user back into the app.
    if (typeof window !== "undefined" && (window as any).__latexy_signOutInProgress) {
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
          clearAllAuthFailed();
        } else {
          setData(null);
          setStatus("unauthenticated");
          statusRef.current = "unauthenticated";
          sessionTokenRef.current = null;
          if (typeof window !== "undefined") localStorage.removeItem("auth-token");
        }
      } else if (res.status === 401) {
        // If we have a stored token or were authenticated, retry once before declaring unauthenticated
        // This prevents transient server restarts / HMR cycles from abruptly wiping the user session
        const hasStoredToken = typeof window !== "undefined" && !!localStorage.getItem("auth-token");
        if (hasStoredToken && retryCount.current < 1) {
          retryCount.current++;
          isFetching.current = false;
          setTimeout(update, 1200);
          return;
        }

        // Confirmed 401 after retry: token is genuinely invalid or expired
        setData(null);
        setStatus("unauthenticated");
        statusRef.current = "unauthenticated";
        sessionTokenRef.current = null;
        if (typeof window !== "undefined") localStorage.removeItem("auth-token");
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

    // 1. Immediately purge client tokens and storage
    const storedToken = localStorage.getItem("auth-token");
    try {
      localStorage.removeItem("auth-token");
      localStorage.removeItem("pb_token");
      sessionStorage.clear();
      // Note: pb_token is an HttpOnly cookie and cannot be cleared from JS —
      // the server /api/auth/pb-logout endpoint clears it unconditionally.
      // Writing document.cookie here would only create a stray non-HttpOnly
      // pb_token, so we deliberately do not touch cookies from the client.
    } catch {}

    const logoutHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache, no-store, must-revalidate",
    };
    if (storedToken) logoutHeaders["Authorization"] = `Bearer ${storedToken}`;

    // 2. Fire the logout request to purge the server session + HttpOnly cookies
    try {
      await fetch("/api/auth/pb-logout", {
        method: "POST",
        headers: logoutHeaders,
        body: JSON.stringify({ token: storedToken }),
        cache: "no-store",
        // Generous timeout: an aborted request could leave the DB session (and
        // the HttpOnly pb_token cookie) intact, which would make /login
        // immediately redirect back into the app.
        signal: AbortSignal.timeout(15000),
      });
    } catch {}

    // 3. Confirm the server session is actually gone before navigating. This
    // guarantees we never land on /login while the session is still valid
    // (which triggers its auto-redirect to /dashboard). While still
    // authenticated, re-fire pb-logout so a slow/flaky delete is self-healing.
    // The loop is bounded so a stuck server can never hang logout.
    for (let attempt = 0; attempt < 20; attempt++) {
      try {
        const res = await fetch(`/api/auth/pb-session?_=${Date.now()}`, {
          cache: "no-store",
          headers: { "Cache-Control": "no-cache, no-store, must-revalidate" },
        });
        if (res.ok) {
          const json = await res.json();
          if (!json.user) break;
          await fetch("/api/auth/pb-logout", {
            method: "POST",
            headers: logoutHeaders,
            body: JSON.stringify({ token: storedToken }),
            cache: "no-store",
          }).catch(() => {});
        } else {
          break;
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 300));
    }

    // 4. Clean navigation to callback destination (default to /login)
    const targetUrl = options?.callbackUrl || "/login";
    window.location.href = targetUrl;
  }
}

export function signIn() {
  if (typeof window !== "undefined") {
    window.location.href = "/login";
  }
}
