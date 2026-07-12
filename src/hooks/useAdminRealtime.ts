'use client';

import { useEffect, useRef, useCallback } from 'react';
import { createPb } from '@/lib/pb';

type PbEvent = { action: string; record?: any };

interface SubscriptionDef {
  collection: string;
  filter?: string;
  onEvent?: (e: PbEvent) => void;
}

interface UseAdminRealtimeOptions {
  subscriptions?: SubscriptionDef[];
  /** Collections to subscribe to that trigger `onRefresh` */
  triggerCollections?: string[];
  /** Called when any trigger collection changes */
  onRefresh?: () => void;
  /** Custom subscriptions with their own handlers */
  customSubscriptions?: SubscriptionDef[];
  /** Polling fallback interval (0 = disable) */
  pollIntervalMs?: number;
  /** Polling callback */
  onPoll?: () => void;
  /** Enable/disable */
  enabled?: boolean;
}

export function useAdminRealtime(options: UseAdminRealtimeOptions = {}) {
  const {
    triggerCollections = [],
    onRefresh,
    customSubscriptions = [],
    pollIntervalMs = 0,
    onPoll,
    enabled = true,
  } = options;

  const mountedRef = useRef(true);
  const unsubRef = useRef<(() => void) | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onRefreshRef = useRef(onRefresh);
  const onPollRef = useRef(onPoll);
  onRefreshRef.current = onRefresh;
  onPollRef.current = onPoll;

  const triggerRefresh = useCallback(() => {
    if (mountedRef.current) onRefreshRef.current?.();
  }, []);

  useEffect(() => {
    if (!enabled) return;
    mountedRef.current = true;

    if (pollIntervalMs > 0 && onPoll) {
      pollRef.current = setInterval(() => {
        if (mountedRef.current) onPollRef.current?.();
      }, pollIntervalMs);
    }

    if (typeof window !== 'undefined') {
      const setupSubscriptions = async () => {
        try {
          const pb = createPb();

          const tokenCookie = document.cookie.split('; ').find(c => c.startsWith('pb_token='));
          const adminToken = localStorage.getItem('latexify-admin-token');
          if (adminToken) {
            pb.authStore.save(adminToken, null);
          } else if (tokenCookie) {
            pb.authStore.save(tokenCookie.split('=')[1], null);
          }

          const unsubFns: (() => void)[] = [];

          for (const col of triggerCollections) {
            try {
              const unsub = await pb.collection(col).subscribe('*', triggerRefresh);
              unsubFns.push(unsub);
            } catch {}
          }

          for (const sub of customSubscriptions) {
            try {
              const handler = (e: PbEvent) => {
                if (mountedRef.current) sub.onEvent?.(e);
              };
              const unsub = await pb.collection(sub.collection).subscribe(sub.filter || '*', handler as any);
              unsubFns.push(unsub);
            } catch {}
          }

          unsubRef.current = () => {
            for (const fn of unsubFns) {
              try { fn(); } catch {}
            }
          };
        } catch {}
      };
      setupSubscriptions();
    }

    return () => {
      mountedRef.current = false;
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      if (unsubRef.current) {
        try { unsubRef.current(); } catch {}
        unsubRef.current = null;
      }
    };
  }, [enabled, pollIntervalMs, triggerRefresh, triggerCollections.join(','), customSubscriptions.length]);
}
