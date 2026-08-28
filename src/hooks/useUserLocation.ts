'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPb } from '@/lib/pb';
import { pbSubscribe } from '@/lib/pbRealtime';
import { isAuthBlocked, markAuthFailed, clearAuthFailed } from '@/lib/authBackoff';

export interface UserLocation {
  id: string;
  latitude: number;
  longitude: number;
  locationName: string;
  updatedAt: string;
}

export interface UserLocationState {
  location: UserLocation | null;
  loading: boolean;
  error: string | null;
  permissionDenied: boolean;
}

interface UseUserLocationOptions {
  pollIntervalMs?: number;
  enabled?: boolean;
  userId?: string;
  onLocationChange?: (loc: UserLocation) => void;
  onError?: (err: string) => void;
}

const ENDPOINT_KEY = 'location';

export function useUserLocation(options: UseUserLocationOptions = {}) {
  const {
    pollIntervalMs = 30000,
    enabled = true,
    userId,
    onLocationChange,
    onError,
  } = options;

  const isEffectivelyEnabled = enabled && (!('userId' in options) || !!userId);

  const [state, setState] = useState<UserLocationState>({
    location: null,
    loading: isEffectivelyEnabled,
    error: null,
    permissionDenied: false,
  });

  const mountedRef = useRef(true);
  const enabledRef = useRef(isEffectivelyEnabled);
  enabledRef.current = isEffectivelyEnabled;
  const unsubRef = useRef<(() => void) | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onLocationChangeRef = useRef(onLocationChange);
  const onErrorRef = useRef(onError);
  onLocationChangeRef.current = onLocationChange;
  onErrorRef.current = onError;

  const fetchLocation = useCallback(async (isBackground = false) => {
    if (!mountedRef.current || !enabledRef.current || isAuthBlocked(ENDPOINT_KEY)) return;

    // Don't attempt API call if no auth token is available yet
    const hasToken = typeof window !== "undefined" && !!localStorage.getItem("auth-token");
    if (!hasToken) return;

    if (!isBackground) setState(prev => ({ ...prev, loading: true }));

    try {
      const storedToken = typeof window !== "undefined" ? localStorage.getItem("auth-token") : null;
      const headers: Record<string, string> = {};
      if (storedToken) headers["Authorization"] = `Bearer ${storedToken}`;
      const res = await fetch('/api/user/location', { headers });
      if (res.status === 401) {
        markAuthFailed(ENDPOINT_KEY);
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
        if (mountedRef.current) setState(prev => ({ ...prev, loading: false, error: null }));
        return;
      }
      if (!res.ok) throw new Error(`Failed to fetch location (${res.status})`);
      const data = await res.json();
      if (!mountedRef.current) return;

      if (data.success) {
        clearAuthFailed(ENDPOINT_KEY);
        setState(prev => {
          const newLoc = data.location;
          if (newLoc && JSON.stringify(prev.location) !== JSON.stringify(newLoc)) {
            onLocationChangeRef.current?.(newLoc);
          }
          return { location: newLoc, loading: false, error: null, permissionDenied: false };
        });
      } else {
        setState(prev => ({ ...prev, loading: false, error: data.error || 'Unknown error' }));
        onErrorRef.current?.(data.error || 'Unknown error');
      }
    } catch (err: any) {
      if (!mountedRef.current) return;
      const msg = err?.message || 'Failed to fetch location';
      const isUnauth = msg.toLowerCase().includes('unauthorized') || msg.includes('401');
      if (!isUnauth) onErrorRef.current?.(msg);
      setState(prev => ({ ...prev, loading: false, error: isUnauth ? null : msg }));
    }
  }, []);

  const updateBrowserLocation = useCallback(async () => {
    if (!mountedRef.current || !enabledRef.current || isAuthBlocked(ENDPOINT_KEY)) return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setState(prev => ({ ...prev, permissionDenied: true, error: 'Geolocation not supported' }));
      return;
    }

    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: 3000,
          maximumAge: 120000,
        });
      });

      const { latitude, longitude } = pos.coords;

      const storedToken = typeof window !== "undefined" ? localStorage.getItem("auth-token") : null;
      const postHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
      if (storedToken) postHeaders["Authorization"] = `Bearer ${storedToken}`;
      const res = await fetch('/api/user/location', {
        method: 'POST',
        headers: postHeaders,
        body: JSON.stringify({ latitude, longitude }),
      });

      if (res.status === 401) {
        markAuthFailed(ENDPOINT_KEY);
        enabledRef.current = false;
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
        if (unsubRef.current) {
          try { unsubRef.current(); } catch {}
          unsubRef.current = null;
        }
        return;
      }

      if (!res.ok) throw new Error(`Failed to save location (${res.status})`);
      const data = await res.json();

      if (data.success && mountedRef.current) {
        clearAuthFailed(ENDPOINT_KEY);
        setState(prev => {
          const newLoc = data.location;
          if (newLoc && JSON.stringify(prev.location) !== JSON.stringify(newLoc)) {
            onLocationChangeRef.current?.(newLoc);
          }
          return { location: newLoc, loading: false, error: null, permissionDenied: false };
        });
      }
    } catch (err: any) {
      if (!mountedRef.current || !enabledRef.current) return;

      const errMsg = err?.message || '';
      const isUnauth = errMsg.toLowerCase().includes('unauthorized') || errMsg.includes('401');
      if (isUnauth) return;

      if (err.code === 1) {
        setState(prev => ({ ...prev, permissionDenied: true, loading: false }));
      } else {
        setState(prev => ({ ...prev, loading: false }));
      }
    }
  }, []);

  useEffect(() => {
    enabledRef.current = isEffectivelyEnabled;
    if (!isEffectivelyEnabled) {
      setState({ location: null, loading: false, error: null, permissionDenied: false });
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      if (unsubRef.current) {
        try { unsubRef.current(); } catch {}
        unsubRef.current = null;
      }
      return;
    }

    mountedRef.current = true;

    // Settle delay to let session state settle after login navigation
    const initialFetchTimer = setTimeout(() => {
      if (mountedRef.current && enabledRef.current) fetchLocation(true);
    }, 500);

    const geoTimer = setTimeout(() => {
      if (mountedRef.current && enabledRef.current) updateBrowserLocation();
    }, 2500);

    pollRef.current = setInterval(() => {
      if (enabledRef.current) fetchLocation(true);
    }, pollIntervalMs);

    if (typeof window !== 'undefined') {
      unsubRef.current = pbSubscribe('user_session_activities', '*', () => {
        if (mountedRef.current && enabledRef.current) fetchLocation(true);
      });
    }

    return () => {
      mountedRef.current = false;
      clearTimeout(geoTimer);
      clearTimeout(initialFetchTimer);
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      if (unsubRef.current) {
        try { unsubRef.current(); } catch {}
        unsubRef.current = null;
      }
    };
  }, [isEffectivelyEnabled, pollIntervalMs, fetchLocation, updateBrowserLocation]);

  const refetch = useCallback(() => {
    fetchLocation(false);
    updateBrowserLocation();
  }, [fetchLocation, updateBrowserLocation]);

  return { ...state, refetch, updateBrowserLocation };
}
