"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "@/lib/pb-auth-react";

const POLL_INTERVAL = 15000;

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

  const checkLimit = useCallback(async () => {
    if (status === "loading" || !session?.user) return;

    const membership = (session.user as any)?.membership || "free";
    if (membership !== "free") {
      setLimitChecked(true);
      return;
    }

    try {
      const res = await fetch("/api/projects/limit-status");
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
  }, [status, session?.user]);

  useEffect(() => {
    checkLimit();
    pollRef.current = setInterval(checkLimit, POLL_INTERVAL);

    const handleProjectLimitTriggered = () => {
      setShowLimitModal(true);
    };
    window.addEventListener("project-limit-triggered", handleProjectLimitTriggered);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      window.removeEventListener("project-limit-triggered", handleProjectLimitTriggered);
    };
  }, [checkLimit]);

  return { showLimitModal, setShowLimitModal, limitChecked };
}