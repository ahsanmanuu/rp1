"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "@/lib/pb-auth-react";

const POLL_INTERVAL = 60000;

/**
 * useProjectLimit
 * Checks on mount (and polls silently) whether the current free-tier user has
 * hit the 7-project cap. Shows <ProjectLimitModal> the moment the cap is hit,
 * from any tool page, without reloading the page.
 * Also reacts to the `project-limit-triggered` window event (fired by other
 * parts of the app, e.g. the global quota tracker on the dashboard).
 */
export function useProjectLimit() {
  const { data: session, status } = useSession();
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [limitChecked, setLimitChecked] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isAuthenticated = status === "authenticated" && !!session?.user?.id;

  const checkLimit = useCallback(async () => {
    if (!isAuthenticated) return;
    if (typeof document !== "undefined" && document.hidden) return;

    const membership = (session?.user as any)?.membership || "free";
    if (membership !== "free") {
      setLimitChecked(true);
      return;
    }

    try {
      const storedToken = typeof window !== "undefined" ? localStorage.getItem("auth-token") : null;
      const authHeaders: Record<string, string> = {};
      if (storedToken) authHeaders["Authorization"] = `Bearer ${storedToken}`;
      const res = await fetch("/api/projects/limit-status", { headers: authHeaders });
      if (res.status === 401) {
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
        setLimitChecked(true);
        return;
      }
      const data = await res.json();
      if (data.limitReached) {
        setShowLimitModal(true);
      } else {
        setShowLimitModal(false);
      }
    } catch {
      /* silently ignore – don't block the tool */
    } finally {
      setLimitChecked(true);
    }
  }, [isAuthenticated, session?.user]);

  useEffect(() => {
    if (!isAuthenticated) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }

    checkLimit();
    pollRef.current = setInterval(checkLimit, POLL_INTERVAL);

    const handleProjectLimitTriggered = () => {
      setShowLimitModal(true);
    };
    let wakeTimer: ReturnType<typeof setTimeout> | null = null;
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        if (wakeTimer) clearTimeout(wakeTimer);
        wakeTimer = setTimeout(checkLimit, 1200);
      }
    };

    window.addEventListener("project-limit-triggered", handleProjectLimitTriggered);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (wakeTimer) clearTimeout(wakeTimer);
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      window.removeEventListener("project-limit-triggered", handleProjectLimitTriggered);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isAuthenticated, checkLimit]);

  return { showLimitModal, setShowLimitModal, limitChecked };
}