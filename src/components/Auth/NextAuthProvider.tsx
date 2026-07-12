"use client";

import { useEffect, useRef } from "react";
import { useSession, SessionProvider } from "@/lib/pb-auth-react";
import { useRouter } from "next/navigation";
import { SessionSyncProvider } from "./SessionSyncProvider";

/**
 * Watches for an "authenticated → unauthenticated" transition and redirects
 * to /login. This catches force-logouts from other devices, session expiry,
 * and any other invalidation that the server-side session() callback detects.
 */
function AutoLogoutWatcher() {
  const { status } = useSession();
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

export const NextAuthProvider = ({ children }: { children: React.ReactNode }) => {
  return (
    <SessionProvider
      // Poll aggressively so force-logout from another device is detected quickly
      refetchInterval={15}
      refetchOnWindowFocus={true}
    >
      <AutoLogoutWatcher />
      <SessionSyncProvider>
        {children}
      </SessionSyncProvider>
    </SessionProvider>
  );
};
