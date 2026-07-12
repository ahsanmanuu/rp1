"use client";

import React, { useEffect } from "react";
import { usePbSession } from "./PocketBaseProvider";

export function SessionSyncProvider({ children }: { children: React.ReactNode }) {
  const { user, update } = usePbSession();

  useEffect(() => {
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
            await update({
              points: data.points,
              membership: data.membership,
            } as any);
          }
        }
      } catch (err) {
        console.error("[Sync] Polling check failed:", err);
      }
    };

    const intervalId = setInterval(checkSync, 10000);
    return () => clearInterval(intervalId);
  }, [user, update]);

  return <>{children}</>;
}
