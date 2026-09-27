"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "@/lib/pb-auth-react";
import { isAuthBlocked, markAuthFailed, clearAuthFailed } from "@/lib/authBackoff";
import { authFetch } from "@/lib/authFetch";

const POLL_INTERVAL = 30000;
const ENDPOINT_KEY = "projects-limit";

export type LockReason = "project_limit" | "ai_tokens_exhausted" | "credits" | null;

export interface ProjectLimitState {
  showLimitModal: boolean;
  setShowLimitModal: (val: boolean) => void;
  limitChecked: boolean;
  isProjectLimitReached: boolean;
  isAiTokensExhausted: boolean;
  isLocked: boolean;
  lockReason: LockReason;
  count: number;
  max: number | null;
  isPremium: boolean;
  membership: string;
  aiRemaining: number;
  aiDailyCap: number;
  reactivateAt: string | null;
  quotaResetAt: string | null;
  isOutOfCredits: boolean;
  points: number;
  checkLimit: () => Promise<void>;
}

/**
 * useProjectLimit
 * Monitors project limits (7-project cap across all tools for free users)
 * and LLM token exhaustion (daily token quota reset / premium plan).
 * Reactively sets `isLocked`, disables buttons, triggers modals,
 * and auto-reactivates when quota refreshes or upon plan subscription.
 */
export function useProjectLimit(): ProjectLimitState {
  const { data: session, status } = useSession();
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [limitChecked, setLimitChecked] = useState(false);

  const [isProjectLimitReached, setIsProjectLimitReached] = useState(false);
  const [isAiTokensExhausted, setIsAiTokensExhausted] = useState(false);
  const [count, setCount] = useState(0);
  const [max, setMax] = useState<number | null>(7);
  const [isPremium, setIsPremium] = useState(false);
  const [membership, setMembership] = useState("free");
  const [aiRemaining, setAiRemaining] = useState(10000);
  const [aiDailyCap, setAiDailyCap] = useState(10000);
  const [reactivateAt, setReactivateAt] = useState<string | null>(null);
  const [quotaResetAt, setQuotaResetAt] = useState<string | null>(null);
  const [isOutOfCredits, setIsOutOfCredits] = useState(false);
  const [points, setPoints] = useState(50);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoReactivateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isAuthenticated = status === "authenticated" && !!session?.user?.id;

  const isLocked = isProjectLimitReached || isAiTokensExhausted;
  const lockReason: LockReason = isProjectLimitReached
    ? "project_limit"
    : isAiTokensExhausted
    ? "ai_tokens_exhausted"
    : isOutOfCredits
    ? "credits"
    : null;

  const checkLimit = useCallback(async () => {
    if (!isAuthenticated || isAuthBlocked(ENDPOINT_KEY)) return;
    if (typeof document !== "undefined" && document.hidden) return;

    try {
      const res = await authFetch("/api/projects/limit-status");
      if (res.status === 401) {
        markAuthFailed(ENDPOINT_KEY);
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
        setLimitChecked(true);
        return;
      }
      if (res.ok) {
        clearAuthFailed(ENDPOINT_KEY);
      }
      const data = await res.json();
      if (!data || data.error) return;

      const projectLimitReached = !!data.isProjectLimitReached || (data.max !== null && data.count >= data.max);
      const aiExhausted = !!data.isAiTokensExhausted;

      setIsProjectLimitReached(projectLimitReached);
      setIsAiTokensExhausted(aiExhausted);
      setCount(typeof data.count === "number" ? data.count : 0);
      setMax(data.max ?? (data.isPremium ? null : 7));
      setIsPremium(!!data.isPremium);
      setMembership(data.membership || "free");
      setAiRemaining(typeof data.aiRemaining === "number" ? data.aiRemaining : 0);
      setAiDailyCap(typeof data.aiDailyCap === "number" ? data.aiDailyCap : 10000);
      setReactivateAt(data.reactivateAt || null);
      setQuotaResetAt(data.quotaResetAt || null);
      setIsOutOfCredits(!!data.isOutOfCredits);
      setPoints(typeof data.points === "number" ? data.points : 0);

      // Auto-popup modal when project limit reached
      if (projectLimitReached) {
        setShowLimitModal(true);
      }

      // Schedule proactive reactivation check if tokens are exhausted
      if (autoReactivateTimerRef.current) {
        clearTimeout(autoReactivateTimerRef.current);
        autoReactivateTimerRef.current = null;
      }

      if (aiExhausted) {
        const nextTime = data.reactivateAt || data.quotaResetAt;
        if (nextTime) {
          const msUntilReset = new Date(nextTime).getTime() - Date.now();
          if (msUntilReset > 0 && msUntilReset < 86400000) {
            // Re-check 1.5s after reset timestamp
            autoReactivateTimerRef.current = setTimeout(() => {
              checkLimit();
            }, msUntilReset + 1500);
          }
        }
      }
    } catch {
      /* silently ignore network hiccups */
    } finally {
      setLimitChecked(true);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      if (autoReactivateTimerRef.current) {
        clearTimeout(autoReactivateTimerRef.current);
        autoReactivateTimerRef.current = null;
      }
      return;
    }

    checkLimit();
    pollRef.current = setInterval(checkLimit, POLL_INTERVAL);

    const handleProjectLimitTriggered = () => {
      setIsProjectLimitReached(true);
      setShowLimitModal(true);
      checkLimit();
    };

    const handleAiCapTriggered = () => {
      setIsAiTokensExhausted(true);
      checkLimit();
    };

    const handlePlanUpdated = () => {
      checkLimit();
    };

    let wakeTimer: ReturnType<typeof setTimeout> | null = null;
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        if (wakeTimer) clearTimeout(wakeTimer);
        wakeTimer = setTimeout(checkLimit, 800);
      }
    };

    window.addEventListener("project-limit-triggered", handleProjectLimitTriggered);
    window.addEventListener("ai-cap-triggered", handleAiCapTriggered);
    window.addEventListener("user-plan-updated", handlePlanUpdated);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (wakeTimer) clearTimeout(wakeTimer);
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      if (autoReactivateTimerRef.current) {
        clearTimeout(autoReactivateTimerRef.current);
        autoReactivateTimerRef.current = null;
      }
      window.removeEventListener("project-limit-triggered", handleProjectLimitTriggered);
      window.removeEventListener("ai-cap-triggered", handleAiCapTriggered);
      window.removeEventListener("user-plan-updated", handlePlanUpdated);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isAuthenticated, checkLimit]);

  return {
    showLimitModal,
    setShowLimitModal,
    limitChecked,
    isProjectLimitReached,
    isAiTokensExhausted,
    isLocked,
    lockReason,
    count,
    max,
    isPremium,
    membership,
    aiRemaining,
    aiDailyCap,
    reactivateAt,
    quotaResetAt,
    isOutOfCredits,
    points,
    checkLimit,
  };
}