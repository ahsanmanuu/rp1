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

const CACHE_TTL = 15000;
const POLL_INTERVAL = 10000;

export function useGlobalQuotas() {
  const [status, setStatus] = useState<QuotaStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showProjectLimitModal, setShowProjectLimitModal] = useState(false);
  const [showAiLimitModal, setShowAiLimitModal] = useState(false);

  const cacheRef = useRef<{ data: QuotaStatus; expiry: number } | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasShownProjectModalRef = useRef(false);
  const hasShownAiDismissedRef = useRef(false);

  const fetchStatus = useCallback(async (fresh = false) => {
    try {
      if (!fresh && cacheRef.current && cacheRef.current.expiry > Date.now()) {
        setStatus(cacheRef.current.data);
        setLoading(false);
        return;
      }

      const url = fresh ? '/api/user/quota-status?fresh=1' : '/api/user/quota-status';
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: QuotaStatus = await res.json();

      if ('error' in data) throw new Error(String(data.error));

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
      setError(err?.message || 'Failed to fetch quota status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();

    pollIntervalRef.current = setInterval(fetchStatus, POLL_INTERVAL);

    const handleProjectLimitTriggered = () => setShowProjectLimitModal(true);
    const handleAiCapTriggered = () => {
      hasShownAiDismissedRef.current = true;
      setShowAiLimitModal(true);
    };
    const handleOpenAiSubscription = () => setShowAiLimitModal(true);

    window.addEventListener('project-limit-triggered', handleProjectLimitTriggered);
    window.addEventListener('ai-cap-triggered', handleAiCapTriggered);
    window.addEventListener('open-ai-subscription', handleOpenAiSubscription);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      window.removeEventListener('project-limit-triggered', handleProjectLimitTriggered);
      window.removeEventListener('ai-cap-triggered', handleAiCapTriggered);
      window.removeEventListener('open-ai-subscription', handleOpenAiSubscription);
    };
  }, [fetchStatus]);

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