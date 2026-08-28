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
    const handleVisibilityChange = () => {
      if (!document.hidden) checkSync();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [userId, currentPoints, currentMembership, update]);

  return <>{children}</>;
}
