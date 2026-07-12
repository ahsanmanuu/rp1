'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Clock, Bot, RefreshCw, Zap } from 'lucide-react';
import toast from 'react-hot-toast';

interface CapStatus {
  isCapped: boolean;
  used: number;
  limit: number;
  percentage: number;
  remaining: number;
  planName: string;
  reactivateAt: string | null;
  capExpiresAt: string | null;
  quotaResetAt: string;
  msUntilReset: number;
  agentBreakdown: Record<string, number>;
  ruleName: string | null;
}

interface AiCapWarningProps {
  onStatusChange?: (status: CapStatus) => void;
}

const REFRESH_INTERVAL_CAPPED   = 30_000;
const REFRESH_INTERVAL_UNCAPPED = 60_000;
const WARNING_THRESHOLD         = 80;

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  } catch { return '—'; }
}

function formatCountdown(targetIso: string | null | undefined): string {
  if (!targetIso) return '';
  const diffMs = new Date(targetIso).getTime() - Date.now();
  if (diffMs <= 0) return 'Now';
  const totalSecs = Math.floor(diffMs / 1000);
  const hrs  = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;
  if (hrs > 0) return `${hrs}h ${mins}m`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

function agentLabel(key: string): string {
  const map: Record<string, string> = {
    'latex-review': 'AI Reviewer', 'chat': 'AI Chat', 'ai-fix': 'AI Fix',
    'diagram': 'Diagrams', 'extract': 'Doc Extract', 'doc2latex': 'Doc2LaTeX',
    'reviewer': 'Peer Review',
  };
  return map[key] || key.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export default function AiCapWarning({ onStatusChange }: AiCapWarningProps) {
  const [status, setStatus] = useState<CapStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [countdown, setCountdown] = useState('');

  const warningToastId   = useRef<string | null>(null);
  const hasBeenDismissed = useRef(false);
  const prevIsCapped     = useRef(false);
  const intervalRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef     = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/user/ai-cap/status', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const raw = await res.json();
      const rawDailyCap  = raw.dailyCap  ?? raw.limit  ?? 0;
      const rawUsedToday = raw.usedToday ?? raw.used   ?? 0;
      const quotaResetAt = raw.quotaResetAt ?? (() => {
        const t = new Date(); t.setUTCDate(t.getUTCDate() + 1); t.setUTCHours(0, 0, 0, 0);
        return t.toISOString();
      })();
      const normalized: CapStatus = {
        isCapped:       !!(raw.isCapped ?? raw.capped),
        used:           rawUsedToday,
        limit:          rawDailyCap,
        percentage:     raw.percentage ?? (rawDailyCap > 0 ? (rawUsedToday / rawDailyCap) * 100 : 0),
        remaining:      raw.remaining  ?? Math.max(0, rawDailyCap - rawUsedToday),
        planName:       raw.planName   ?? 'Free',
        reactivateAt:   raw.reactivateAt ?? raw.reactivatesAt ?? null,
        capExpiresAt:   raw.capExpiresAt ?? null,
        quotaResetAt,
        msUntilReset:   raw.msUntilReset ?? (new Date(quotaResetAt).getTime() - Date.now()),
        agentBreakdown: raw.agentBreakdown ?? {},
        ruleName:       raw.ruleName ?? null,
      };
      setStatus(normalized);
      setError(null);
      onStatusChange?.(normalized);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch AI cap status');
    } finally {
      setLoading(false);
    }
  }, [onStatusChange]);

  useEffect(() => { setMounted(true); fetchStatus(); }, [fetchStatus]);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    const interval = status?.isCapped ? REFRESH_INTERVAL_CAPPED : REFRESH_INTERVAL_UNCAPPED;
    intervalRef.current = setInterval(fetchStatus, interval);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [status?.isCapped, fetchStatus]);

  useEffect(() => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    if (!status) return;
    const target = status.capExpiresAt ?? status.quotaResetAt;
    const tick = () => setCountdown(formatCountdown(target));
    tick();
    countdownRef.current = setInterval(tick, 1000);
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, [status?.capExpiresAt, status?.quotaResetAt]);

  useEffect(() => {
    if (!status) return;
    if (status.percentage >= WARNING_THRESHOLD && status.percentage < 100 && !status.isCapped) {
      if (!warningToastId.current) {
        warningToastId.current = toast.custom(
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl border"
            style={{ background: 'rgba(15,23,42,0.95)', borderColor: 'rgba(249,115,22,0.4)', backdropFilter: 'blur(12px)' }}>
            <AlertTriangle size={18} style={{ color: '#f97316', flexShrink: 0 }} />
            <span className="text-sm font-medium" style={{ color: '#fdba74' }}>
              You&apos;ve used {Math.round(status.percentage)}% of your daily AI limit
            </span>
          </div>,
          { duration: 6000, position: 'top-center' }
        );
      }
    } else {
      if (warningToastId.current) { toast.dismiss(warningToastId.current); warningToastId.current = null; }
    }
  }, [status]);

  useEffect(() => {
    const nowCapped = !!(status?.isCapped || (status?.percentage ?? 0) >= 100);
    if (nowCapped) {
      if (!prevIsCapped.current) hasBeenDismissed.current = false;
      if (!hasBeenDismissed.current) setShowBlockModal(true);
    } else {
      hasBeenDismissed.current = false;
      setShowBlockModal(false);
    }
    prevIsCapped.current = nowCapped;
  }, [status]);

  if (!mounted || loading) return null;
  if (error || !status) return null;

  const agentEntries  = Object.entries(status.agentBreakdown).filter(([, v]) => v > 0).sort(([, a], [, b]) => b - a);
  const isAdminBlocked = !!status.capExpiresAt;

  const modal = (
    <AnimatePresence>
      {showBlockModal && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}
          style={{ position: 'fixed', inset: 0, zIndex: 2147483647, display: 'flex', alignItems: 'center',
            justifyContent: 'center', padding: '16px', backgroundColor: 'rgba(2,6,23,0.92)',
            backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
          <motion.div initial={{ opacity: 0, scale: 0.92, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 20 }} transition={{ duration: 0.3, ease: 'easeOut' }}
            style={{ background: 'linear-gradient(145deg, #1a1a2e, #16213e)', border: '1px solid rgba(239,68,68,0.25)',
              borderRadius: '20px', padding: '36px', maxWidth: '480px', width: '100%',
              boxShadow: '0 25px 60px rgba(0,0,0,0.7)', textAlign: 'center' }}>

            <div style={{ width: '72px', height: '72px', background: 'radial-gradient(circle,rgba(239,68,68,0.18),rgba(239,68,68,0.04))',
              border: '1px solid rgba(239,68,68,0.25)', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <Bot size={36} style={{ color: '#ef4444' }} />
            </div>

            <h2 style={{ margin: '0 0 4px', color: '#fff', fontSize: '20px', fontWeight: '700', letterSpacing: '-0.3px' }}>
              Daily AI Limit Reached
            </h2>
            <p style={{ margin: '0 0 20px', color: '#ef4444', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              {isAdminBlocked ? `Cap Rule: ${status.ruleName ?? 'Admin Override'}` : 'Usage cap exceeded'}
            </p>

            {/* Usage bar */}
            <div style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '14px', marginBottom: '14px', textAlign: 'left' }}>
              <div style={{ width: '100%', height: '8px', borderRadius: '4px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden', marginBottom: '10px' }}>
                <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(status.percentage, 100)}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  style={{ height: '100%', borderRadius: '4px', background: 'linear-gradient(90deg,#ef4444,#dc2626)' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={{ margin: 0, color: '#e5e7eb', fontSize: '13px', fontWeight: '600' }}>
                  {(status.used ?? 0).toLocaleString()} / {(status.limit ?? 0).toLocaleString()} tokens
                </p>
                <span style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '6px', border: '1px solid rgba(239,68,68,0.2)' }}>
                  {status.planName} Plan
                </span>
              </div>
            </div>

            {/* Quota schedule */}
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '14px', marginBottom: '14px', textAlign: 'left' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <RefreshCw size={14} style={{ color: 'var(--accent-primary,#10b981)', flexShrink: 0 }} />
                  <span style={{ color: '#9ca3af', fontSize: '12px' }}>
                    {isAdminBlocked ? 'Block expires in' : 'Quota resets in'}
                  </span>
                </div>
                <span style={{ color: '#d1d5db', fontSize: '15px', fontWeight: '800', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>
                  {countdown || '…'}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Clock size={13} style={{ color: '#6b7280', flexShrink: 0 }} />
                  <span style={{ color: '#9ca3af', fontSize: '11px' }}>Daily quota resets at</span>
                </div>
                <span style={{ color: '#9ca3af', fontSize: '11px', fontWeight: '600' }}>
                  {fmtDate(status.quotaResetAt)}
                </span>
              </div>
              {isAdminBlocked && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(239,68,68,0.12)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AlertTriangle size={13} style={{ color: '#ef4444', flexShrink: 0 }} />
                    <span style={{ color: '#9ca3af', fontSize: '11px' }}>Cap block lifts at</span>
                  </div>
                  <span style={{ color: '#ef4444', fontSize: '11px', fontWeight: '600' }}>{fmtDate(status.capExpiresAt)}</span>
                </div>
              )}
            </div>

            {/* Agent breakdown */}
            {agentEntries.length > 0 && (
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '12px', marginBottom: '14px', textAlign: 'left' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                  <Zap size={13} style={{ color: 'var(--accent-primary,#10b981)' }} />
                  <span style={{ color: '#6b7280', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Token Usage by Agent</span>
                </div>
                {agentEntries.map(([agent, tokens]) => {
                  const pct = status.limit > 0 ? Math.min((tokens / status.limit) * 100, 100) : 0;
                  return (
                    <div key={agent} style={{ marginBottom: '7px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                        <span style={{ color: '#9ca3af', fontSize: '11px' }}>{agentLabel(agent)}</span>
                        <span style={{ color: '#d1d5db', fontSize: '11px', fontWeight: '600' }}>{tokens.toLocaleString()}</span>
                      </div>
                      <div style={{ width: '100%', height: '3px', borderRadius: '2px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', borderRadius: '2px', background: 'linear-gradient(90deg,var(--accent-primary,#10b981),#059669)' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <button
              onClick={() => { hasBeenDismissed.current = true; setShowBlockModal(false); }}
              style={{ width: '100%', padding: '12px', background: 'var(--accent-primary,#10b981)', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '14px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'opacity 0.2s' }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
            >
              Return to Dashboard
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return createPortal(modal, document.body);
}
