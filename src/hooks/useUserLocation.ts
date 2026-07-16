'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPb } from '@/lib/pb';

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
  onLocationChange?: (loc: UserLocation) => void;
  onError?: (err: string) => void;
}

export function useUserLocation(options: UseUserLocationOptions = {}) {
  const {
    pollIntervalMs = 30000,
    enabled = true,
    onLocationChange,
    onError,
  } = options;

  const [state, setState] = useState<UserLocationState>({
    location: null,
    loading: true,
    error: null,
    permissionDenied: false,
  });

  const mountedRef = useRef(true);
  const unsubRef = useRef<(() => void) | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onLocationChangeRef = useRef(onLocationChange);
  const onErrorRef = useRef(onError);
  onLocationChangeRef.current = onLocationChange;
  onErrorRef.current = onError;

  const fetchLocation = useCallback(async (isBackground = false) => {
    if (!mountedRef.current) return;
    if (!isBackground) setState(prev => ({ ...prev, loading: true }));

    try {
      const res = await fetch('/api/user/location');
      if (!res.ok) throw new Error(`Failed to fetch location (${res.status})`);
      const data = await res.json();
      if (!mountedRef.current) return;

      if (data.success) {
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
      setState(prev => ({ ...prev, loading: false, error: msg }));
      onErrorRef.current?.(msg);
    }
  }, []);

  const updateBrowserLocation = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setState(prev => ({ ...prev, permissionDenied: true, error: 'Geolocation not supported' }));
      return;
    }

    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000,
        });
      });

      const { latitude, longitude } = pos.coords;

      const res = await fetch('/api/user/location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latitude, longitude }),
      });

      if (!res.ok) throw new Error(`Failed to save location (${res.status})`);
      const data = await res.json();

      if (data.success && mountedRef.current) {
        setState(prev => {
          const newLoc = data.location;
          if (newLoc && JSON.stringify(prev.location) !== JSON.stringify(newLoc)) {
            onLocationChangeRef.current?.(newLoc);
          }
          return { location: newLoc, loading: false, error: null, permissionDenied: false };
        });
      }
    } catch (err: any) {
      if (!mountedRef.current) return;

      // Exception handling: POST to notify server that geolocation access was denied/failed
      try {
        const res = await fetch('/api/user/location', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ latitude: null, longitude: null }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success && mountedRef.current) {
            setState(prev => ({
              location: data.location,
              loading: false,
              error: null,
              permissionDenied: true
            }));
            return;
          }
        }
      } catch (postErr) {
        console.error("Failed to post location block fallback:", postErr);
      }

      if (err.code === 1) {
        setState(prev => ({ ...prev, permissionDenied: true, loading: false }));
      } else {
        setState(prev => ({ ...prev, loading: false, error: err?.message || 'Geolocation failed' }));
        onErrorRef.current?.(err?.message || 'Geolocation failed');
      }
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setState({ location: null, loading: false, error: null, permissionDenied: false });
      return;
    }

    mountedRef.current = true;

    fetchLocation(true);

    updateBrowserLocation();

    pollRef.current = setInterval(() => {
      fetchLocation(true);
    }, pollIntervalMs);

    if (typeof window !== 'undefined') {
      const setupSubscription = async () => {
        try {
          const pb = createPb();
          const tokenCookie = document.cookie.split('; ').find(c => c.startsWith('pb_token='));
          if (tokenCookie) {
            const token = tokenCookie.split('=')[1];
            pb.authStore.save(token, null);
          }

          const unsub = await pb.collection('user_session_activities').subscribe('*', () => {
            if (mountedRef.current) fetchLocation(true);
          });

          unsubRef.current = unsub;
        } catch {}
      };
      setupSubscription();
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
  }, [enabled, pollIntervalMs, fetchLocation, updateBrowserLocation]);

  const refetch = useCallback(() => {
    fetchLocation(false);
    updateBrowserLocation();
  }, [fetchLocation, updateBrowserLocation]);

  return { ...state, refetch, updateBrowserLocation };
}
