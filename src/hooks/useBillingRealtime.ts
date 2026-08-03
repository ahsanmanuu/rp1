'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { pbSubscribe } from '@/lib/pbRealtime';

export interface BillingMetrics {
  monthlyRevenue: number;
  pendingPayments: number;
  totalRefunds: number;
  pendingRefunds: number;
  failedPaymentsCount: number;
  failedPaymentsAmount: number;
  totalPointsCredited: number;
  successfulCheckoutsCount: number;
  averageOrderValue: number;
  renewedCount: number;
  churnedCount: number;
}

export interface BillingCharts {
  revenue: { "7D": { label: string; value: number }[]; "30D": { label: string; value: number }[]; "ALL": { label: string; value: number }[] };
  userGrowth: { "7D": { label: string; value: number }[]; "30D": { label: string; value: number }[]; "ALL": { label: string; value: number }[] };
}

export interface BillingTransaction {
  id: string;
  userEmail: string;
  userName: string;
  amountCredits: number;
  amount: number;
  type: string;
  description: string;
  status: string;
  source: string;
  planType?: string;
  orderId?: string;
  createdAt: string;
}

export interface BillingData {
  metrics: BillingMetrics;
  charts: BillingCharts;
  transactions: BillingTransaction[];
}

export interface BillingState {
  data: BillingData | null;
  loading: boolean;
  error: string | null;
  isStale: boolean;
}

interface UseBillingOptions {
  pollIntervalMs?: number;
  enabled?: boolean;
  onError?: (err: string) => void;
}

const DEFAULT_METRICS: BillingMetrics = {
  monthlyRevenue: 0, pendingPayments: 0, totalRefunds: 0, pendingRefunds: 0,
  failedPaymentsCount: 0, failedPaymentsAmount: 0, totalPointsCredited: 0,
  successfulCheckoutsCount: 0, averageOrderValue: 0, renewedCount: 0, churnedCount: 0,
};

const DEFAULT_CHARTS: BillingCharts = {
  revenue: { "7D": [], "30D": [], "ALL": [] },
  userGrowth: { "7D": [], "30D": [], "ALL": [] },
};

export function useBillingRealtime(options: UseBillingOptions = {}) {
  const {
    pollIntervalMs = 10000,
    enabled = true,
    onError,
  } = options;

  const [state, setState] = useState<BillingState>({
    data: null,
    loading: true,
    error: null,
    isStale: false,
  });

  const mountedRef = useRef(true);
  const fetchRef = useRef<((bg?: boolean) => Promise<void>) | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const refetchRef = useRef<(() => void) | null>(null);

  if (fetchRef.current === null) {
    fetchRef.current = async (isBackground = false) => {
      if (!mountedRef.current) return;

      if (!isBackground) {
        setState(prev => ({ ...prev, loading: true, error: null }));
      }

      try {
        const res = await fetch('/api/admin/billings');
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error || `Failed to load billing data (${res.status})`);
        }

        const data = await res.json();
        if (!mountedRef.current) return;

        if (data.success) {
          setState({
            data: {
              metrics: data.metrics || DEFAULT_METRICS,
              charts: data.charts || DEFAULT_CHARTS,
              transactions: data.transactions || [],
            },
            loading: false,
            error: null,
            isStale: false,
          });
        } else {
          setState(prev => ({
            data: prev.data,
            loading: false,
            error: data?.error || 'Unknown error loading billing data',
            isStale: true,
          }));
          onErrorRef.current?.(data?.error || 'Unknown error');
        }
      } catch (err: any) {
        if (!mountedRef.current) return;
        const msg = err?.message || 'Failed to fetch billing data';
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
        data: null,
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

    // PB Realtime subscriptions for billing data (shared client manager)
    if (typeof window !== 'undefined') {
      const unsubFns: (() => void)[] = [];
      const triggerRefresh = () => {
        if (mountedRef.current) {
          fetchRef.current?.(true);
        }
      };

      for (const col of ['point_transactions', 'membership_transactions', 'membership_plans', 'offers', 'users']) {
        try {
          unsubFns.push(pbSubscribe(col, '*', triggerRefresh));
        } catch {}
      }

      unsubRef.current = () => { for (const fn of unsubFns) { try { fn(); } catch {} } };
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
