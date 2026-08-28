"use client";

import React, { useEffect } from "react";
import { useSession } from "@/lib/pb-auth-react";

export function SessionSyncProvider({ children }: { children: React.ReactNode }) {
  const { data: session, update } = useSession();
  const user = session?.user;
  const userId = user?.id;
  const currentPoints = user?.points;
  const currentMembership = user?.membership;

  useEffect(() => {
    if (!userId) return;

    const checkSync = async () => {
      if (typeof document !== "undefined" && document.hidden) return;
      try {
        const storedToken = typeof window !== "undefined" ? localStorage.getItem("auth-token") : null;
        const headers: Record<string, string> = {};
        if (storedToken) headers["Authorization"] = `Bearer ${storedToken}`;
        const res = await fetch("/api/user/check-membership", { headers });
        if (!res.ok) return;
        const data = await res.json();
        if (data.success) {
          if (data.points !== currentPoints || data.membership !== currentMembership) {
            await update();
          }
        }
      } catch {
        // Silently ignore sync poll errors
      }
    };

    const intervalId = setInterval(checkSync, 60000);
    let wakeTimer: ReturnType<typeof setTimeout> | null = null;
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        if (wakeTimer) clearTimeout(wakeTimer);
        wakeTimer = setTimeout(checkSync, 1200);
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (wakeTimer) clearTimeout(wakeTimer);
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [userId, currentPoints, currentMembership, update]);

  return <>{children}</>;
}
