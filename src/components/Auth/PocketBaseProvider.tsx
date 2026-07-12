"use client";

import { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from "react";
import { useRouter } from "next/navigation";

interface PbUser {
  id: string;
  email: string;
  name: string;
  image: string | null;
  theme: string;
  points: number;
  membership: string;
  role: string;
}

interface PbSession {
  user: PbUser | null;
  status: "loading" | "authenticated" | "unauthenticated";
}

interface PbSessionContext extends PbSession {
  update: (data?: Partial<PbUser>) => Promise<void>;
  signOut: () => Promise<void>;
}

const PbSessionCtx = createContext<PbSessionContext>({
  user: null,
  status: "loading",
  update: async () => {},
  signOut: async () => {},
});

export function usePbSession() {
  return useContext(PbSessionCtx);
}

function AutoLogoutWatcher() {
  const { status } = usePbSession();
  const router = useRouter();
  const prevStatus = useRef<typeof status>("loading");

  useEffect(() => {
    if (
      prevStatus.current === "authenticated" &&
      status === "unauthenticated" &&
      !(typeof window !== "undefined" && (window as any).__latexy_signOutInProgress)
    ) {
      router.push("/login");
    }
    prevStatus.current = status;
  }, [status, router]);

  return null;
}

export function PocketBaseProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<PbSession>({ user: null, status: "loading" });
  const router = useRouter();

  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/pb-session");
      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          setSession((prev) => {
            const u = data.user;
            const p = prev.user;
            if (
              p &&
              p.id === u.id &&
              p.email === u.email &&
              p.name === u.name &&
              p.points === u.points &&
              p.membership === u.membership &&
              p.role === u.role &&
              p.image === u.image &&
              p.theme === u.theme &&
              prev.status === "authenticated"
            ) {
              return prev;
            }
            return { user: u, status: "authenticated" };
          });
        } else {
          setSession((prev) => (prev.status === "unauthenticated" && prev.user === null ? prev : { user: null, status: "unauthenticated" }));
        }
      } else {
        setSession((prev) => (prev.status === "unauthenticated" && prev.user === null ? prev : { user: null, status: "unauthenticated" }));
      }
    } catch {
      setSession((prev) => (prev.status === "unauthenticated" && prev.user === null ? prev : { user: null, status: "unauthenticated" }));
    }
  }, []);

  useEffect(() => {
    fetchSession();
    const interval = setInterval(fetchSession, 15000);
    return () => clearInterval(interval);
  }, [fetchSession]);

  const update = useCallback(async (data?: Partial<PbUser>) => {
    if (data) {
      setSession((prev) => ({
        ...prev,
        user: prev.user ? { ...prev.user, ...data } : null,
      }));
    }
    await fetchSession();
  }, [fetchSession]);

  const signOut = useCallback(async () => {
    await fetch("/api/auth/pb-logout", { method: "POST" });
    setSession({ user: null, status: "unauthenticated" });
    router.push("/login");
  }, [router]);

  return (
    <PbSessionCtx.Provider value={{ ...session, update, signOut }}>
      <AutoLogoutWatcher />
      {children}
    </PbSessionCtx.Provider>
  );
}
