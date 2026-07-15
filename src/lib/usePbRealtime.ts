'use client';

import { useEffect, useRef } from 'react';
import { createPb } from '@/lib/pb';

export function usePbRealtime<T = any>(
  collection: string,
  onEvent: (action?: string, record?: T) => void,
  options?: { filter?: string; enabled?: boolean }
) {
  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (options?.enabled === false) return;

    let cancelled = false;

    async function setup() {
      try {
        const pb = createPb();
        const unsub = await pb.collection(collection).subscribe('*', (e) => {
          if (!cancelled) {
            const handler = onEvent as any;
            if (typeof handler.length === 'number' && handler.length === 0) {
              handler();
            } else {
              onEvent(e.action, e.record as unknown as T);
            }
          }
        }, options?.filter ? { filter: options.filter } : undefined);
        if (!cancelled) {
          unsubRef.current = unsub;
        } else {
          unsub();
        }
      } catch (err) {
        if (!cancelled) {
          console.warn(`PB realtime subscribe failed for ${collection}:`, err);
        }
      }
    }

    setup();

    return () => {
      cancelled = true;
      unsubRef.current?.();
      unsubRef.current = null;
    };
  }, [collection, options?.filter, options?.enabled]);
}
