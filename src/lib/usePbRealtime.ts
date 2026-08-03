'use client';

import { useEffect, useRef } from 'react';
import { pbSubscribe } from '@/lib/pbRealtime';

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

    // Shared realtime client manager — one SSE connection per auth token,
    // auto re-subscribe on token change.
    unsubRef.current = pbSubscribe(collection, '*', (e) => {
      const handler = onEventRef.current as any;
      if (typeof handler.length === 'number' && handler.length === 0) {
        handler();
      } else {
        onEventRef.current(e.action, e.record as unknown as T);
      }
    }, options?.filter ? { filter: options.filter } : undefined);

    return () => {
      unsubRef.current?.();
      unsubRef.current = null;
    };
    // Only re-subscribe when the collection, filter, or enabled flag actually changes.
    // onEvent intentionally omitted — it is captured via onEventRef above.
  }, [collection, options?.filter, options?.enabled]);
}
