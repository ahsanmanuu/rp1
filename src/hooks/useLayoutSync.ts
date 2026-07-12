'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from '@/lib/pb-auth-react';

export interface LayoutSettingsData {
  pages: Record<string, any>;
  windows: Record<string, any>;
  panels: Record<string, any>;
  cards: Record<string, any>;
}

export function useLayoutSync(isAdmin: boolean = false) {
  const { data: session } = useSession();
  const [token, setToken] = useState<string | null>(null);
  const [activeUserId, setActiveUserId] = useState<string | null>(null);

  const [settings, setSettings] = useState<LayoutSettingsData>({
    pages: {},
    windows: {},
    panels: {},
    cards: {},
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const prevSettingsRef = useRef<string>('');
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const apiEndpoint = isAdmin ? '/api/admin/layout-settings' : '/api/user/layout-settings';
  const localKey = isAdmin ? 'latexify_admin_layout_settings' : 'latexify_user_layout_settings';

  // Load and sync token/userId
  useEffect(() => {
    if (isAdmin) {
      setActiveUserId('admin');
      const t = typeof window !== 'undefined' ? localStorage.getItem('latexify-admin-token') : null;
      if (t) {
        setToken(t);
      } else {
        fetch('/api/admin/session')
          .then(r => r.json())
          .then(data => {
            if (data.success && data.token) {
              localStorage.setItem('latexify-admin-token', data.token);
              setToken(data.token);
            }
          })
          .catch(() => {});
      }
    } else {
      if (session?.user?.id) {
        setActiveUserId(session.user.id);
      }
      if (session?.token) {
        setToken(session.token);
      }
    }
  }, [isAdmin, session]);

  // 1. Fetch layout settings
  const fetchSettings = useCallback(async () => {
    setLoading(true);
    // Load local storage fallback first (instant load)
    let localData: any = null;
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(localKey);
        if (stored) {
          localData = JSON.parse(stored);
          setSettings(localData);
        }
      } catch (e) {
        console.warn('[useLayoutSync] Local storage parse failed:', e);
      }
    }

    try {
      const res = await fetch(apiEndpoint, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.settings) {
          const remoteSettings: LayoutSettingsData = {
            pages: data.settings.pages || {},
            windows: data.settings.windows || {},
            panels: data.settings.panels || {},
            cards: data.settings.cards || {},
          };
          setSettings(remoteSettings);
          prevSettingsRef.current = JSON.stringify(remoteSettings);

          // Update local cache
          if (typeof window !== 'undefined') {
            localStorage.setItem(localKey, JSON.stringify(remoteSettings));
          }
        }
      }
    } catch (err) {
      console.warn('[useLayoutSync] Remote fetch failed, using local storage cache:', err);
    } finally {
      setLoading(false);
    }
  }, [apiEndpoint, localKey]);

  // 2. Save layout settings to remote
  const saveSettings = useCallback(async (currentSettings: LayoutSettingsData) => {
    const settingsStr = JSON.stringify(currentSettings);
    if (settingsStr === prevSettingsRef.current) return; // Skip if unchanged

    setSaving(true);
    try {
      const res = await fetch(apiEndpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: settingsStr,
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          prevSettingsRef.current = JSON.stringify(currentSettings);
        }
      }
    } catch (err) {
      console.error('[useLayoutSync] Save settings failed:', err);
    } finally {
      setSaving(false);
    }
  }, [apiEndpoint]);

  // 3. Debounced save trigger
  const triggerDebouncedSave = useCallback((newSettings: LayoutSettingsData) => {
    // Save to local storage immediately
    if (typeof window !== 'undefined') {
      localStorage.setItem(localKey, JSON.stringify(newSettings));
    }

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(() => {
      saveSettings(newSettings);
    }, 2000);
  }, [saveSettings, localKey]);

  // Load settings on mount
  useEffect(() => {
    fetchSettings();
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [fetchSettings]);

  // Realtime PocketBase layout settings subscription
  useEffect(() => {
    if (!activeUserId || !token) return;

    let isSubscribed = false;
    let pbClient: any = null;

    const setupSubscription = async () => {
      try {
        const { createPb } = await import('@/lib/pb');
        pbClient = createPb();
        pbClient.authStore.save(token, null);
        
        await pbClient.collection('layout_settings').subscribe('*', (e: any) => {
          if (e.action === 'update' || e.action === 'create') {
            const record = e.record;
            const targetUserId = isAdmin ? 'admin' : activeUserId;
            if (record.userId === targetUserId) {
              const remoteSettings: LayoutSettingsData = {
                pages: record.pages || {},
                windows: record.windows || {},
                panels: record.panels || {},
                cards: record.cards || {},
              };
              
              setSettings((current) => {
                const currentStr = JSON.stringify(current);
                const remoteStr = JSON.stringify(remoteSettings);
                if (currentStr !== remoteStr) {
                  prevSettingsRef.current = remoteStr;
                  if (typeof window !== 'undefined') {
                    localStorage.setItem(localKey, remoteStr);
                  }
                  return remoteSettings;
                }
                return current;
              });
            }
          }
        });
        isSubscribed = true;
        console.log('[useLayoutSync] Subscribed to realtime layout_settings updates');
      } catch (err) {
        console.warn('[useLayoutSync] Failed to subscribe to realtime updates:', err);
      }
    };

    setupSubscription();

    return () => {
      if (isSubscribed && pbClient) {
        pbClient.collection('layout_settings').unsubscribe('*').catch(() => {});
      }
    };
  }, [activeUserId, token, localKey, isAdmin]);

  // Helper updates
  const updateLayout = useCallback((
    type: 'pages' | 'windows' | 'panels' | 'cards',
    keyOrData: string | Record<string, any>,
    value?: any
  ) => {
    setSettings((prev) => {
      let updatedSection = { ...prev[type] };
      if (typeof keyOrData === 'string') {
        updatedSection[keyOrData] = value;
      } else {
        updatedSection = { ...updatedSection, ...keyOrData };
      }

      const newSettings = {
        ...prev,
        [type]: updatedSection,
      };

      triggerDebouncedSave(newSettings);
      return newSettings;
    });
  }, [triggerDebouncedSave]);

  const updatePages = useCallback((keyOrData: string | Record<string, any>, value?: any) => {
    updateLayout('pages', keyOrData, value);
  }, [updateLayout]);

  const updateWindows = useCallback((keyOrData: string | Record<string, any>, value?: any) => {
    updateLayout('windows', keyOrData, value);
  }, [updateLayout]);

  const updatePanels = useCallback((keyOrData: string | Record<string, any>, value?: any) => {
    updateLayout('panels', keyOrData, value);
  }, [updateLayout]);

  const updateCards = useCallback((keyOrData: string | Record<string, any>, value?: any) => {
    updateLayout('cards', keyOrData, value);
  }, [updateLayout]);

  return {
    settings,
    loading,
    saving,
    updatePages,
    updateWindows,
    updatePanels,
    updateCards,
    refetch: fetchSettings,
  };
}
