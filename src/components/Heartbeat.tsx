'use client';

import { useEffect, useRef } from 'react';
import { useSession } from '@/lib/pb-auth-react';

export function Heartbeat() {
  const { data: session, update } = useSession();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!session?.user) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    const ping = () => {
      fetch('/api/user/heartbeat', { method: 'POST' }).then((res) => {
        if (res.status === 401) {
          // Session was deleted (force-logout) — refresh to sync state
          update();
        }
      }).catch(() => {});
    };

    ping();
    intervalRef.current = setInterval(ping, 120000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [session?.user, update]);

  return null;
}
