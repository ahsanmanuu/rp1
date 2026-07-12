'use client';

import { useState, useEffect, useRef } from 'react';
import { createPb } from '@/lib/pb';

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

export function useMembershipRealtime(options: UseMembershipOptions = {}) {
  const {
    pollIntervalMs = 10000,
    enabled = true,
    userId,
    onMembershipChange,
    onError,
  } = options;

  const [state, setState] = useState<MembershipState>({
    data: null,
    loading: true,
    error: null,
    isStale: false,
  });

  const prevPlanRef = useRef<string | null>(null);
  const mountedRef = useRef(true);
  const fetchRef = useRef<((bg?: boolean) => void) | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);
  const onMembershipChangeRef = useRef(onMembershipChange);
  const onErrorRef = useRef(onError);
  onMembershipChangeRef.current = onMembershipChange;
  onErrorRef.current = onError;
  const userIdRef = useRef(userId);
  userIdRef.current = userId;

  const refetchRef = useRef<(() => void) | null>(null);

  if (fetchRef.current === null) {
    fetchRef.current = async (isBackground = false) => {
      if (!mountedRef.current) return;

      if (!isBackground) {
        setState(prev => ({ ...prev, loading: true, error: null }));
      }

      try {
        const res = await fetch('/api/user/check-membership');
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error || `Failed to load membership (${res.status})`);
        }

        const data = await res.json();
        if (!mountedRef.current) return;

        if (data.success) {
          setState({
            data: data as MembershipData,
            loading: false,
            error: null,
            isStale: false,
          });

          const currentPlan = (data as MembershipData).membership;
          if (prevPlanRef.current !== null && prevPlanRef.current !== currentPlan) {
            onMembershipChangeRef.current?.(prevPlanRef.current, currentPlan);
          }
          prevPlanRef.current = currentPlan;
        } else {
          setState({
            data: null,
            loading: false,
            error: data?.error || 'Unknown error loading membership',
            isStale: true,
          });
          onErrorRef.current?.(data?.error || 'Unknown error');
        }
      } catch (err: any) {
        if (!mountedRef.current) return;
        const msg = err?.message || 'Failed to fetch membership';
        setState(prev => ({
          data: prev.data,
          loading: false,
          error: msg,
          isStale: true,
        }));
        onErrorRef.current?.(msg);
      }
    };

    refetchRef.current = () => {
      fetchRef.current?.(false);
    };
  }

  useEffect(() => {
    mountedRef.current = true;

    if (!enabled) {
      setState({
        data: FALLBACK_MEMBERSHIP,
        loading: false,
        error: null,
        isStale: false,
      });
      return;
    }

    fetchRef.current?.(false);

    const id = setInterval(() => {
      fetchRef.current?.(true);
    }, pollIntervalMs);

    // PB Realtime subscription to users + membership_transactions
    if (typeof window !== 'undefined' && userIdRef.current) {
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
            if (mountedRef.current) {
              fetchRef.current?.(true);
            }
          };

          // Subscribe to user record changes
          try {
            const unsubUser = await pb.collection('users').subscribe(userIdRef.current!, () => { onEvent(); });
            unsubFns.push(unsubUser);
          } catch {}

          // Subscribe to membership_transactions for this user
          try {
            const unsubTx = await pb.collection('membership_transactions').subscribe('*', () => { onEvent(); }, {
              filter: `userId = "${userIdRef.current}"`,
            });
            unsubFns.push(unsubTx);
          } catch {}

          unsubRef.current = () => { for (const fn of unsubFns) { try { fn(); } catch {} } };
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

  return { ...state, refetch: refetchRef.current! };
}
