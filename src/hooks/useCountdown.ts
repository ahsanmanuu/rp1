'use client';

import { useEffect, useMemo, useState } from 'react';

export interface CountdownState {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
  expired: boolean;
  active: boolean;
  label: string;
  parts: { days: string; hours: string; minutes: string; seconds: string };
}

function pad(n: number): string {
  return String(Math.max(0, n)).padStart(2, '0');
}

/**
 * Live auto-counter that ticks every second toward a target expiry timestamp.
 * Returns days/hours/minutes/seconds parts for a silent realtime "remaining" display.
 */
export function useCountdown(targetIso?: string | null, tickMs = 1000): CountdownState {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setNow(Date.now());
    if (!targetIso) return;
    const id = setInterval(() => setNow(Date.now()), tickMs);
    return () => clearInterval(id);
  }, [targetIso, tickMs]);

  return useMemo(() => {
    if (!targetIso) {
      return {
        days: 0, hours: 0, minutes: 0, seconds: 0,
        totalMs: 0, expired: false, active: false, label: 'Lifetime',
        parts: { days: '00', hours: '00', minutes: '00', seconds: '00' },
      };
    }

    const target = new Date(targetIso).getTime();
    const totalMs = target - now;
    const expired = totalMs <= 0;

    const absMs = Math.max(0, totalMs);
    const days = Math.floor(absMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((absMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((absMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((absMs % (1000 * 60)) / 1000);

    return {
      days,
      hours,
      minutes,
      seconds,
      totalMs: absMs,
      expired,
      active: true,
      label: expired
        ? 'Expired'
        : `${days}d ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`,
      parts: { days: pad(days), hours: pad(hours), minutes: pad(minutes), seconds: pad(seconds) },
    };
  }, [targetIso, now]);
}

/** Day-level remaining count (matches server-side ceil semantics). */
export function daysUntil(targetIso?: string | null): number | null {
  if (!targetIso) return null;
  return Math.max(0, Math.ceil((new Date(targetIso).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
}
