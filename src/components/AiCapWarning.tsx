'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Clock, Bot, RefreshCw, Zap, ArrowLeft } from 'lucide-react';
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

function fmtDateFull(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(undefined, {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
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
    'citation-enrich': 'Citation Enrich', 'citation-validate': 'Citation Validate',
    'citation-format': 'Citation Format',
  };
  return map[key] || key.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export default function AiCapWarning({ onStatusChange }: AiCapWarningProps) {
  const pathname = usePathname();
  const isForceBlockPage = !!pathname && (pathname.startsWith('/doc2latex') || pathname.startsWith('/reviewer'));

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
    const handleCapTrigger = () => { fetchStatus(); };
    window.addEventListener('ai-cap-triggered', handleCapTrigger);
    return () => { window.removeEventListener('ai-cap-triggered', handleCapTrigger); };
  }, [fetchStatus]);

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
  const isFreeTier = status.planName === 'Free' || status.planName === 'free';

  const consumedAtStr = (() => {
    const now = new Date();
    now.setHours(now.getHours() - 1);
    return fmtDateFull(now.toISOString());
  })();

  const resetAtStr = fmtDateFull(status.quotaResetAt);

  const modal = (
    <AnimatePresence>
      {showBlockModal && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}
          style={{ position: 'fixed', inset: 0, zIndex: 2147483647, display: 'flex', alignItems: 'center',
            justifyContent: 'center', padding: '16px', backgroundColor: 'rgba(0,0,0,0.82)',
            backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
          <motion.div initial={{ opacity: 0, scale: 0.92, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 20 }} transition={{ duration: 0.3, ease: 'easeOut' }}
            style={{ background: 'var(--bg-primary, #1e1e1e)', border: '1px solid var(--border, rgba(255,255,255,0.1))',
              borderRadius: '20px', padding: '36px', maxWidth: '500px', width: '100%',
              boxShadow: '0 25px 60px rgba(0,0,0,0.5)', textAlign: 'center' }}>

            <div style={{ width: '72px', height: '72px', background: 'var(--bg-secondary, rgba(255,255,255,0.03))',
              border: `1px solid ${isAdminBlocked ? 'var(--color-admin-error, #ef4444)' : 'var(--accent-primary, #10b981)'}`,
              borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px',
              boxShadow: `0 0 20px ${isAdminBlocked ? 'rgba(239,68,68,0.1)' : 'var(--accent-glow, rgba(16,185,129,0.1))'}` }}>
              <Bot size={36} style={{ color: isAdminBlocked ? 'var(--color-admin-error, #ef4444)' : 'var(--accent-primary, #10b981)' }} />
            </div>

            <h2 style={{ margin: '0 0 6px', color: 'var(--text-primary, #fff)', fontSize: '20px', fontWeight: '700', letterSpacing: '-0.3px', fontFamily: 'var(--font-headline)' }}>
              {isAdminBlocked ? 'AI Access Blocked' : 'Daily AI Limit Reached'}
            </h2>
            <p style={{ margin: '0 0 20px', color: 'var(--color-admin-error, #ef4444)', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'var(--font-headline)' }}>
              {isAdminBlocked ? `Cap Rule: ${status.ruleName ?? 'Admin Override'}` : isFreeTier ? 'Free tier token limit exhausted' : 'Usage cap exceeded'}
            </p>

            {/* Token Exhaustion Message */}
            <div style={{ background: 'var(--bg-secondary, rgba(0,0,0,0.15))', border: '1px solid var(--border, rgba(255,255,255,0.05))', borderRadius: '14px', padding: '16px', marginBottom: '16px', textAlign: 'left' }}>
              <p style={{ margin: '0 0 10px', color: 'var(--text-primary, #e5e7eb)', fontSize: '13px', lineHeight: '1.6' }}>
                You have consumed all your {status.planName} plan tokens. Your AI quota was fully used earlier today.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: 'var(--text-secondary, #9ca3af)', fontWeight: 600, minWidth: '90px' }}>Used from:</span>
                  <span style={{ color: 'var(--text-primary, #d1d5db)', fontWeight: 500 }}>{consumedAtStr}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: 'var(--text-secondary, #9ca3af)', fontWeight: 600, minWidth: '90px' }}>Resets on:</span>
                  <span style={{ color: 'var(--accent-primary, #10b981)', fontWeight: 700 }}>{resetAtStr}</span>
                </div>
              </div>
              <p style={{ margin: '12px 0 0', color: 'var(--text-secondary, #9ca3af)', fontSize: '12px', lineHeight: '1.5', fontStyle: 'italic' }}>
                You can continue your work without AI agent. All non-AI features remain fully available.
              </p>
            </div>

            {/* Usage bar */}
            <div style={{ background: 'var(--bg-secondary, rgba(0,0,0,0.2))', border: '1px solid var(--border, rgba(255,255,255,0.05))', borderRadius: '12px', padding: '14px', marginBottom: '14px', textAlign: 'left' }}>
              <div style={{ width: '100%', height: '8px', borderRadius: '4px', background: 'var(--bg-tertiary, rgba(255,255,255,0.08))', overflow: 'hidden', marginBottom: '10px' }}>
                <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(status.percentage, 100)}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  style={{ height: '100%', borderRadius: '4px', background: 'linear-gradient(90deg, var(--accent-primary, #10b981), var(--accent-secondary, var(--accent-primary, #10b981)))' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={{ margin: 0, color: 'var(--text-primary, #fff)', fontSize: '13px', fontWeight: '600' }}>
                  {(status.used ?? 0).toLocaleString()} / {(status.limit ?? 0).toLocaleString()} tokens
                </p>
                <span style={{ background: 'var(--bg-tertiary, rgba(255,255,255,0.05))', color: 'var(--text-secondary, #9ca3af)', fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '6px', border: '1px solid var(--border, rgba(255,255,255,0.05))' }}>
                  {status.planName} Plan
                </span>
              </div>
            </div>

            {/* Quota countdown */}
            <div style={{ background: 'var(--bg-secondary, rgba(0,0,0,0.1))', border: '1px solid var(--border, rgba(255,255,255,0.05))', borderRadius: '12px', padding: '14px', marginBottom: '14px', textAlign: 'left' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <RefreshCw size={14} style={{ color: 'var(--accent-primary,#10b981)', flexShrink: 0 }} />
                  <span style={{ color: 'var(--text-secondary, #9ca3af)', fontSize: '12px' }}>
                    {isAdminBlocked ? 'Block expires in' : 'Quota resets in'}
                  </span>
                </div>
                <span style={{ color: 'var(--accent-primary, #10b981)', fontSize: '15px', fontWeight: '800', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>
                  {countdown || '…'}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid var(--border, rgba(255,255,255,0.05))' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Clock size={13} style={{ color: 'var(--text-secondary, #6b7280)', flexShrink: 0 }} />
                  <span style={{ color: 'var(--text-secondary, #9ca3af)', fontSize: '11px' }}>Daily quota resets at</span>
                </div>
                <span style={{ color: 'var(--text-secondary, #9ca3af)', fontSize: '11px', fontWeight: '600' }}>
                  {fmtDate(status.quotaResetAt)}
                </span>
              </div>
              {isAdminBlocked && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--border, rgba(255,255,255,0.05))' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AlertTriangle size={13} style={{ color: 'var(--color-admin-error, #ef4444)', flexShrink: 0 }} />
                    <span style={{ color: 'var(--text-secondary, #9ca3af)', fontSize: '11px' }}>Cap block lifts at</span>
                  </div>
                  <span style={{ color: 'var(--color-admin-error, #ef4444)', fontSize: '11px', fontWeight: '600' }}>{fmtDate(status.capExpiresAt)}</span>
                </div>
              )}
            </div>

            {/* Agent breakdown */}
            {agentEntries.length > 0 && (
              <div style={{ background: 'var(--bg-secondary, rgba(0,0,0,0.1))', border: '1px solid var(--border, rgba(255,255,255,0.05))', borderRadius: '12px', padding: '12px', marginBottom: '14px', textAlign: 'left' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                  <Zap size={13} style={{ color: 'var(--accent-primary,#10b981)' }} />
                  <span style={{ color: 'var(--text-secondary, #6b7280)', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Token Usage by Agent</span>
                </div>
                {agentEntries.map(([agent, tokens]) => {
                  const pct = status.limit > 0 ? Math.min((tokens / status.limit) * 100, 100) : 0;
                  return (
                    <div key={agent} style={{ marginBottom: '7px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                        <span style={{ color: 'var(--text-secondary, #9ca3af)', fontSize: '11px' }}>{agentLabel(agent)}</span>
                        <span style={{ color: 'var(--text-primary, #d1d5db)', fontSize: '11px', fontWeight: '600' }}>{tokens.toLocaleString()}</span>
                      </div>
                      <div style={{ width: '100%', height: '3px', borderRadius: '2px', background: 'var(--bg-tertiary, rgba(255,255,255,0.06))', overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', borderRadius: '2px', background: 'linear-gradient(90deg, var(--accent-primary, #10b981), var(--accent-secondary, var(--accent-primary, #10b981)))' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Upgrade plan options for free tier */}
            {isFreeTier && (
              <div style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: '12px', padding: '14px', marginBottom: '14px', textAlign: 'left' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <Zap size={14} style={{ color: '#fbbf24' }} />
                  <span style={{ color: '#fbbf24', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Upgrade for More Tokens
                  </span>
                </div>
                <p style={{ margin: '0 0 10px', color: '#d1d5db', fontSize: '12px', lineHeight: '1.4' }}>
                  Unlock higher daily token limits and continuous agent access.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px', color: '#9ca3af' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '4px' }}>
                    <span>Starter AI Plan:</span>
                    <span style={{ color: '#fff', fontWeight: '600' }}>100,000 tokens/day</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '4px' }}>
                    <span>Pro AI Plan:</span>
                    <span style={{ color: '#fff', fontWeight: '600' }}>500,000 tokens/day</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Max Premium Cap:</span>
                    <span style={{ color: '#fff', fontWeight: '600' }}>Unlimited API Access</span>
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                onClick={() => {
                  hasBeenDismissed.current = true;
                  setShowBlockModal(false);
                }}
                style={{
                  width: '100%', padding: '12px',
                  background: 'var(--accent-primary, #10b981)', border: 'none',
                  borderRadius: '12px', color: '#fff', fontSize: '14px',
                  fontWeight: '700', cursor: 'pointer', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', gap: '8px',
                  boxShadow: '0 4px 12px var(--accent-glow, rgba(16,185,129,0.15))',
                  transition: 'opacity 0.2s', fontFamily: 'var(--font-headline)'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
              >
                Continue Without AI
              </button>

              <button
                onClick={() => {
                  hasBeenDismissed.current = true;
                  setShowBlockModal(false);
                  window.location.href = '/dashboard';
                }}
                style={{
                  width: '100%', padding: '10px',
                  background: 'transparent', border: '1px solid var(--border, rgba(255,255,255,0.1))',
                  borderRadius: '12px', color: 'var(--text-secondary, #9ca3af)', fontSize: '12px',
                  fontWeight: '600', cursor: 'pointer', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', gap: '6px',
                  transition: 'all 0.2s', fontFamily: 'var(--font-headline)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--bg-secondary, rgba(255,255,255,0.05))';
                  e.currentTarget.style.color = 'var(--text-primary, #fff)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--text-secondary, #9ca3af)';
                }}
              >
                <ArrowLeft size={14} /> Return to Dashboard
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return createPortal(modal, document.body);
}
