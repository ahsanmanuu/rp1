'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

export interface MembershipStatus {
  planType: string;
  expiresAt: string | null;
  daysRemaining: number | null;
  isPremium: boolean;
}

export interface ProjectsStatus {
  count: number;
  max: number;
  limitReached: boolean;
}

export interface AiStatus {
  planId: string | null;
  planType: string;
  dailyTokenCap: number;
  usedToday: number;
  remaining: number;
  percentage: number;
  isCapped: boolean;
  reactivateAt: string | null;
  quotaResetAt: string;
  planName: string;
}

export interface QuotaStatus {
  success: boolean;
  membership: MembershipStatus;
  projects: ProjectsStatus;
  ai: AiStatus;
}

export interface UseGlobalQuotasOptions {
  enabled?: boolean;
  pollIntervalMs?: number;
}

const CACHE_TTL = 30000;
const DEFAULT_POLL_INTERVAL = 60000;

export function useGlobalQuotas(options: UseGlobalQuotasOptions = {}) {
  const { enabled = true, pollIntervalMs = DEFAULT_POLL_INTERVAL } = options;

  const [status, setStatus] = useState<QuotaStatus | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [showProjectLimitModal, setShowProjectLimitModal] = useState(false);
  const [showAiLimitModal, setShowAiLimitModal] = useState(false);

  const cacheRef = useRef<{ data: QuotaStatus; expiry: number } | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasShownProjectModalRef = useRef(false);
  const hasShownAiDismissedRef = useRef(false);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const authFailedRef = useRef(false);

  const fetchStatus = useCallback(async (fresh = false) => {
    if (!enabledRef.current || (authFailedRef.current && !fresh)) {
      setLoading(false);
      return;
    }

    // Don't attempt API call if no auth token is available yet
    const hasToken = typeof window !== "undefined" && !!localStorage.getItem("auth-token");
    if (!hasToken) {
      setLoading(false);
      return;
    }

    if (typeof document !== "undefined" && document.hidden && !fresh) {
      return;
    }

    try {
      if (!fresh && cacheRef.current && cacheRef.current.expiry > Date.now()) {
        setStatus(cacheRef.current.data);
        setLoading(false);
        return;
      }

      const url = fresh ? '/api/user/quota-status?fresh=1' : '/api/user/quota-status';
      const storedToken = typeof window !== "undefined" ? localStorage.getItem("auth-token") : null;
      const headers: Record<string, string> = {};
      if (storedToken) headers["Authorization"] = `Bearer ${storedToken}`;
      const res = await fetch(url, { cache: 'no-store', headers });
      if (res.status === 401) {
        authFailedRef.current = true;
        setLoading(false);
        setError(null);
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: QuotaStatus = await res.json();

      if ('error' in data) throw new Error(String(data.error));

      authFailedRef.current = false;
      cacheRef.current = { data, expiry: Date.now() + CACHE_TTL };
      setStatus(data);
      setError(null);

      if (data.projects.limitReached && !hasShownProjectModalRef.current) {
        setShowProjectLimitModal(true);
        hasShownProjectModalRef.current = true;
      }

      if (!data.projects.limitReached) {
        hasShownProjectModalRef.current = false;
      }

      if (data.ai.isCapped && !hasShownAiDismissedRef.current) {
        window.dispatchEvent(new CustomEvent('ai-cap-triggered'));
      } else if (!data.ai.isCapped) {
        hasShownAiDismissedRef.current = false;
      }
    } catch (err: any) {
      const msg = err?.message || 'Failed to fetch quota status';
      const isUnauth = msg.includes('401') || msg.toLowerCase().includes('unauthorized');
      setError(isUnauth ? null : msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    authFailedRef.current = false;

    // Settle delay to let session state settle after login navigation
    const initialTimer = setTimeout(() => fetchStatus(), 500);

    pollIntervalRef.current = setInterval(fetchStatus, pollIntervalMs);

    const handleProjectLimitTriggered = () => setShowProjectLimitModal(true);
    const handleAiCapTriggered = () => {
      hasShownAiDismissedRef.current = true;
      setShowAiLimitModal(true);
    };
    const handleOpenAiSubscription = () => setShowAiLimitModal(true);
    let wakeTimer: ReturnType<typeof setTimeout> | null = null;
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        if (wakeTimer) clearTimeout(wakeTimer);
        wakeTimer = setTimeout(() => fetchStatus(), 1200);
      }
    };

    window.addEventListener('project-limit-triggered', handleProjectLimitTriggered);
    window.addEventListener('ai-cap-triggered', handleAiCapTriggered);
    window.addEventListener('open-ai-subscription', handleOpenAiSubscription);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearTimeout(initialTimer);
      if (wakeTimer) clearTimeout(wakeTimer);
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      window.removeEventListener('project-limit-triggered', handleProjectLimitTriggered);
      window.removeEventListener('ai-cap-triggered', handleAiCapTriggered);
      window.removeEventListener('open-ai-subscription', handleOpenAiSubscription);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, pollIntervalMs, fetchStatus]);

  return {
    status,
    loading,
    error,
    refetch: () => fetchStatus(true),
    showProjectLimitModal,
    showAiLimitModal,
    setShowProjectLimitModal,
    setShowAiLimitModal,
  };
}