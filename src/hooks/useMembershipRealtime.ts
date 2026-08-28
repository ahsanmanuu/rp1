'use client';

import { useState, useEffect, useRef } from 'react';
import { pbSubscribe } from '@/lib/pbRealtime';
import { isAuthBlocked, markAuthFailed, clearAuthFailed } from '@/lib/authBackoff';

export interface MembershipData {
  membership: string;
  membershipExpiresAt: string | null;
  memberSince: string;
  joiningDate: string;
  totalDays: number;
  points: number;
  subscriptionCount: number;
  projectsCount: number;
  showReminder: boolean;
  daysLeft?: number;
  expiryDate?: string;
  expired?: boolean;
  success: boolean;
}

export interface MembershipState {
  data: MembershipData | null;
  loading: boolean;
  error: string | null;
  isStale: boolean;
}

interface UseMembershipOptions {
  pollIntervalMs?: number;
  enabled?: boolean;
  userId?: string;
  onMembershipChange?: (prev: string | null, next: string) => void;
  onError?: (err: string) => void;
}

const FALLBACK_MEMBERSHIP: MembershipData = {
  membership: 'free',
  membershipExpiresAt: null,
  memberSince: '',
  joiningDate: '',
  totalDays: 0,
  points: 0,
  subscriptionCount: 0,
  projectsCount: 0,
  showReminder: false,
  success: true,
};

const ENDPOINT_KEY = 'membership';

export function useMembershipRealtime(options: UseMembershipOptions = {}) {
  const {
    pollIntervalMs = 60000,
    enabled = true,
    userId,
    onMembershipChange,
    onError,
  } = options;

  const isEffectivelyEnabled = enabled && !!userId;

  const [state, setState] = useState<MembershipState>({
    data: null,
    loading: isEffectivelyEnabled,
    error: null,
    isStale: false,
  });

  const prevPlanRef = useRef<string | null>(null);
  const mountedRef = useRef(true);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fetchRef = useRef<((bg?: boolean, fresh?: boolean) => void) | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);
  const onMembershipChangeRef = useRef(onMembershipChange);
  const onErrorRef = useRef(onError);
  onMembershipChangeRef.current = onMembershipChange;
  onErrorRef.current = onError;
  const userIdRef = useRef(userId);
  userIdRef.current = userId;

  const refetchRef = useRef<(() => void) | null>(null);

  if (fetchRef.current === null) {
    fetchRef.current = async (isBackground = false, fresh = false) => {
      if (!mountedRef.current || !userIdRef.current || (isAuthBlocked(ENDPOINT_KEY) && !fresh)) return;
      if (typeof document !== "undefined" && document.hidden && !fresh) return;

      const hasToken = typeof window !== "undefined" && !!localStorage.getItem("auth-token");
      if (!hasToken) return;

      if (!isBackground && !prevPlanRef.current) {
        setState(prev => ({ ...prev, loading: true, error: null }));
      }

      try {
        const url = fresh ? '/api/user/check-membership?fresh=1' : '/api/user/check-membership';
        const storedToken = typeof window !== "undefined" ? localStorage.getItem("auth-token") : null;
        const headers: Record<string, string> = {};
        if (storedToken) headers["Authorization"] = `Bearer ${storedToken}`;
        const res = await fetch(url, { headers });
        if (res.status === 401) {
          markAuthFailed(ENDPOINT_KEY);
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
          if (mountedRef.current) {
            setState(prev => ({
              ...prev,
              loading: false,
              error: null,
              data: prev.data || FALLBACK_MEMBERSHIP,
            }));
          }
          return;
        }
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error || `Failed to load membership (${res.status})`);
        }

        const data = await res.json();
        if (!mountedRef.current) return;

        if (data.success) {
          clearAuthFailed(ENDPOINT_KEY);
          setState({
            data: data as MembershipData,
            loading: false,
            error: null,
            isStale: false,
          });

          const newPlan = data.membership || 'free';
          if (prevPlanRef.current && prevPlanRef.current !== newPlan) {
            onMembershipChangeRef.current?.(prevPlanRef.current, newPlan);
          }
          prevPlanRef.current = newPlan;
        } else {
          throw new Error(data.error || 'Check membership returned unsuccessful status');
        }
      } catch (err: any) {
        if (!mountedRef.current) return;
        const msg = err.message || 'Failed to sync membership';
        const lower = msg.toLowerCase();
        const isUnauthOrOffline = lower.includes('unauthorized') || msg.includes('401') || lower.includes('offline') || msg.includes('503');
        if (!isUnauthOrOffline) {
          console.warn('[MembershipRealtime] Sync error:', msg);
          onErrorRef.current?.(msg);
        }
        setState(prev => ({
          ...prev,
          loading: false,
          error: isUnauthOrOffline ? null : msg,
          data: prev.data || FALLBACK_MEMBERSHIP,
        }));
      }
    };

    refetchRef.current = () => {
      fetchRef.current?.(true, true);
    };
  }

  useEffect(() => {
    mountedRef.current = true;

    if (!isEffectivelyEnabled) {
      setState({
        data: FALLBACK_MEMBERSHIP,
        loading: false,
        error: null,
        isStale: false,
      });
      return;
    }

    // Settle delay to let session state settle after login navigation
    const initialTimer = setTimeout(() => fetchRef.current?.(false), 500);

    pollIntervalRef.current = setInterval(() => {
      fetchRef.current?.(true);
    }, pollIntervalMs);

    // PB Realtime subscription to users + membership_transactions
    // (via the shared realtime client manager)
    if (typeof window !== 'undefined' && userIdRef.current) {
      const unsubFns: (() => void)[] = [];
      const onEvent = () => {
        if (mountedRef.current) {
          fetchRef.current?.(true, true);
        }
      };

      // Subscribe to user record changes
      try {
        unsubFns.push(pbSubscribe('users', userIdRef.current!, onEvent));
      } catch {}

      // Subscribe to membership_transactions for this user
      try {
        unsubFns.push(pbSubscribe('membership_transactions', '*', onEvent, {
          filter: `userId = "${userIdRef.current}"`,
        }));
      } catch {}

      unsubRef.current = () => { for (const fn of unsubFns) { try { fn(); } catch {} } };
    }

    return () => {
      mountedRef.current = false;
      clearTimeout(initialTimer);
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      if (unsubRef.current) {
        try { unsubRef.current(); } catch {}
        unsubRef.current = null;
      }
    };
  }, [isEffectivelyEnabled, pollIntervalMs]);

  return { ...state, refetch: () => refetchRef.current?.() };
}
