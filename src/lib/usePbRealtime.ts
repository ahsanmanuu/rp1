'use client';

import { useEffect, useRef } from 'react';
import { createPb } from '@/lib/pb';

export function usePbRealtime<T = any>(
  collection: string,
  onEvent: (action?: string, record?: T) => void,
  options?: { filter?: string; enabled?: boolean }
) {
  // Keep the latest onEvent in a stable ref so that a new callback reference
  // (which happens on every parent render) does NOT tear down and recreate the
  // SSE/WebSocket subscription — that was the root cause of:
  //   "The ReadableStream is locked" → cascading Fast Refresh full-reloads.
  const onEventRef = useRef(onEvent);
  useEffect(() => {
    onEventRef.current = onEvent;
  });

  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (options?.enabled === false) return;

    let cancelled = false;

    async function setup() {
      try {
        const pb = createPb();
        const unsub = await pb.collection(collection).subscribe('*', (e) => {
          if (!cancelled) {
            const handler = onEventRef.current as any;
            if (typeof handler.length === 'number' && handler.length === 0) {
              handler();
            } else {
              onEventRef.current(e.action, e.record as unknown as T);
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
  // Only re-subscribe when the collection, filter, or enabled flag actually changes.
  // onEvent intentionally omitted — it is captured via onEventRef above.
   
  }, [collection, options?.filter, options?.enabled]);
}
