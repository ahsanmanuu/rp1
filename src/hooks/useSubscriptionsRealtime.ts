'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPb } from '@/lib/pb';

export interface SubscriptionSnapshot {
  membership: any;
  aiPlan: any;
  availableAiPlans: any[];
}

export interface SubscriptionsState {
  data: SubscriptionSnapshot | null;
  loading: boolean;
  error: string | null;
}

interface UseSubscriptionsOptions {
  pollIntervalMs?: number;
  enabled?: boolean;
  userId?: string;
  onError?: (err: string) => void;
}

const FALLBACK: SubscriptionSnapshot = {
  membership: null,
  aiPlan: null,
  availableAiPlans: [],
};

/**
 * Silent realtime subscription data source for dashboard subscription cards.
 * Polls the lightweight /api/user/subscriptions endpoint in the background and
 * refreshes instantly on PocketBase `users` / `ai_cap_plans` /
 * `ai_usage_daily_summaries` events — never reloads the dashboard.
 */
export function useSubscriptionsRealtime(options: UseSubscriptionsOptions = {}) {
  const {
    pollIntervalMs = 30000,
    enabled = true,
    userId,
    onError,
  } = options;

  const [state, setState] = useState<SubscriptionsState>({
    data: null,
    loading: true,
    error: null,
  });

  const mountedRef = useRef(true);
  const unsubRef = useRef<(() => void) | null>(null);
  const fetchRef = useRef<((bg?: boolean, fresh?: boolean) => void) | null>(null);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const userIdRef = useRef(userId);
  userIdRef.current = userId;

  if (fetchRef.current === null) {
    fetchRef.current = async (isBackground = false, fresh = false) => {
      if (!mountedRef.current) return;

      if (!isBackground) {
        setState(prev => ({ ...prev, loading: true, error: null }));
      }

      try {
        const url = fresh
          ? '/api/user/subscriptions?fresh=1'
          : '/api/user/subscriptions';
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error || `Failed to load subscriptions (${res.status})`);
        }

        const data = await res.json();
        if (!mountedRef.current) return;

        if (data.success) {
          setState(prev => ({
            data: {
              membership: data.membership ?? prev.data?.membership ?? null,
              aiPlan: data.aiPlan ?? prev.data?.aiPlan ?? null,
              availableAiPlans: data.availableAiPlans ?? prev.data?.availableAiPlans ?? [],
            },
            loading: false,
            error: null,
          }));
        } else {
          throw new Error(data.error || 'Subscriptions returned unsuccessful status');
        }
      } catch (err: any) {
        if (!mountedRef.current) return;
        const msg = err.message || 'Failed to sync subscriptions';
        console.warn('[SubscriptionsRealtime] Sync error:', msg);
        onErrorRef.current?.(msg);
        setState(prev => ({
          ...prev,
          loading: false,
          error: msg,
          data: prev.data || FALLBACK,
        }));
      }
    };
  }

  const refetch = useCallback((fresh = true) => {
    fetchRef.current?.(true, fresh);
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    if (!enabled) {
      setState({ data: FALLBACK, loading: false, error: null });
      return;
    }

    fetchRef.current?.(false);

    const id = setInterval(() => {
      fetchRef.current?.(true);
    }, pollIntervalMs);

    // PB Realtime: user record + AI cap plans + daily usage summaries
    if (typeof window !== 'undefined') {
      const setupSubscription = async () => {
        try {
          const pb = createPb();
          const tokenCookie = document.cookie.split('; ').find(c => c.startsWith('pb_token='));
          if (tokenCookie) {
            const token = tokenCookie.split('=')[1];
            pb.authStore.save(token, null);
          }

          const unsubFns: (() => void)[] = [];
          const onEvent = () => {
            if (mountedRef.current) fetchRef.current?.(true, true);
          };

          try {
            if (userIdRef.current) {
              const unsubUser = await pb.collection('users').subscribe(userIdRef.current, onEvent);
              unsubFns.push(unsubUser);
            }
          } catch {}

          try {
            const unsubPlans = await pb.collection('ai_cap_plans').subscribe('*', onEvent);
            unsubFns.push(unsubPlans);
          } catch {}

          try {
            if (userIdRef.current) {
              const unsubUsage = await pb.collection('ai_usage_daily_summaries').subscribe('*', onEvent, {
                filter: `userId = "${userIdRef.current}"`,
              });
              unsubFns.push(unsubUsage);
            }
          } catch {}

          unsubRef.current = () => {
            for (const fn of unsubFns) {
              try { fn(); } catch {}
            }
          };
        } catch {}
      };
      setupSubscription();
    }

    return () => {
      mountedRef.current = false;
      clearInterval(id);
      if (unsubRef.current) {
        try { unsubRef.current(); } catch {}
        unsubRef.current = null;
      }
    };
  }, [enabled, pollIntervalMs]);

  return { ...state, refetch };
}
