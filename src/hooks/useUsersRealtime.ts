'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPb } from '@/lib/pb';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  membership: string;
  membershipRaw: string;
  membershipExpiresAt: string | null;
  points: number;
  aiTokensUsed: number;
  projectCount: number;
  status: string;
  blacklistReason: string | null;
  blacklistHistory: any[];
  blockedUntil: string | null;
  lastIp: string;
  lastLocation: string;
  lastLatitude: number | null;
  lastLongitude: number | null;
  joiningDate: string;
  paidTransactions: any[];
  role: string;
  createdAt: string;
  aiPlanStartsAt?: string | null;
  aiPlanExpiresAt?: string | null;
  aiCapPlanId?: string | null;
}

export interface ExpiryNotification {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  planType: string;
  expiresAt: string;
  daysRemaining: number;
  lastNotifiedAt: string | null;
  notifiedCount: number;
}

export interface UsersState {
  users: AdminUser[];
  expiryNotifications: ExpiryNotification[];
  loading: boolean;
  error: string | null;
}

interface UseUsersOptions {
  pollIntervalMs?: number;
  enabled?: boolean;
  onError?: (err: string) => void;
}

let globalUsersCache: AdminUser[] = [];
let globalNotificationsCache: ExpiryNotification[] = [];

export function useUsersRealtime(options: UseUsersOptions = {}) {
  const {
    pollIntervalMs = 10000,
    enabled = true,
    onError,
  } = options;

  const [state, setState] = useState<UsersState>({
    users: globalUsersCache,
    expiryNotifications: globalNotificationsCache,
    loading: globalUsersCache.length === 0,
    error: null,
  });
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(
    globalUsersCache.length > 0 ? globalUsersCache[0] : null
  );

  const mountedRef = useRef(true);
  const unsubRef = useRef<(() => void) | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const fetchUsers = useCallback(async (silent = false) => {
    try {
      const isSilent = silent || globalUsersCache.length > 0;
      if (!isSilent) setState(prev => ({ ...prev, loading: true }));
      const res = await fetch('/api/admin/users');
      const data = await res.json();
      if (!mountedRef.current) return;

      if (data.success) {
        const freshUsers = data.users || [];
        const notifs = data.expiryNotifications || [];
        globalUsersCache = freshUsers;
        globalNotificationsCache = notifs;

        setState(prev => {
          if (selectedUser) {
            const fresh = freshUsers.find((u: AdminUser) => u.id === selectedUser.id);
            if (fresh) setSelectedUser(fresh);
          } else if (freshUsers.length > 0) {
            setSelectedUser(freshUsers[0]);
          }

          return {
            users: freshUsers,
            expiryNotifications: notifs,
            loading: false,
            error: null,
          };
        });
      } else {
        if (!silent) {
          setState(prev => ({ ...prev, loading: false, error: data.error || 'Failed to load users' }));
          onErrorRef.current?.(data.error || 'Failed to load users');
        }
      }
    } catch (err: any) {
      if (!mountedRef.current) return;
      if (!silent) {
        const msg = err.message || 'Failed to load users';
        setState(prev => ({ ...prev, loading: false, error: msg }));
        onErrorRef.current?.(msg);
      }
    }
  }, [selectedUser]);

  useEffect(() => {
    if (!enabled) {
      setState({ users: [], expiryNotifications: [], loading: false, error: null });
      return;
    }

    mountedRef.current = true;

    fetchUsers(false);

    pollRef.current = setInterval(() => {
      fetchUsers(true);
    }, pollIntervalMs);

    if (typeof window !== 'undefined') {
      const setupSubscriptions = async () => {
        try {
          const pb = createPb();
          const tokenCookie = document.cookie.split('; ').find(c => c.startsWith('pb_token='));
          if (tokenCookie) {
            const token = tokenCookie.split('=')[1];
            pb.authStore.save(token, null);
          }

          const unsubFns: (() => void)[] = [];
          const triggerRefresh = () => {
            if (mountedRef.current) fetchUsers(true);
          };

          for (const col of ['users', 'projects', 'blacklist_records', 'membership_transactions', 'notifications']) {
            try {
              const unsub = await pb.collection(col).subscribe('*', triggerRefresh);
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
  }, [enabled, pollIntervalMs, fetchUsers]);

  const refetch = useCallback((silent = false) => {
    fetchUsers(silent);
  }, [fetchUsers]);

  return { ...state, selectedUser, setSelectedUser, refetch };
}
