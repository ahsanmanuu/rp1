"use client";

import React, { useEffect } from "react";
import { useSession } from "@/lib/pb-auth-react";

export function SessionSyncProvider({ children }: { children: React.ReactNode }) {
  const { data: session, update } = useSession();

  useEffect(() => {
    const user = session?.user;
    if (!user?.id) return;

    const checkSync = async () => {
      try {
        const res = await fetch("/api/user/check-membership");
        if (!res.ok) return;
        const data = await res.json();
        if (data.success) {
          const currentPoints = user?.points;
          const currentMembership = user?.membership;
          if (data.points !== currentPoints || data.membership !== currentMembership) {
            await update();
          }
        }
      } catch (err) {
        console.error("[Sync] Polling check failed:", err);
      }
    };

    const intervalId = setInterval(checkSync, 30000);
    return () => clearInterval(intervalId);
  }, [session, update]);

  return <>{children}</>;
}
