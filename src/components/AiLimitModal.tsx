'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X, Zap, ArrowLeft, LayoutDashboard } from 'lucide-react';

interface AiLimitModalProps {
  open: boolean;
  onClose: () => void;
  data?: {
    dailyTokenCap: number;
    usedToday: number;
    percentage: number;
    planName: string;
    quotaResetAt: string;
  };
}

export default function AiLimitModal({ open, onClose, data }: AiLimitModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <AnimatePresence>
      {open && (
        <div
          onClick={(e) => e.target === e.currentTarget && onClose()}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            background: 'rgba(5, 7, 15, 0.75)',
            backdropFilter: 'blur(18px) saturate(150%)',
            fontFamily: 'var(--font-headline, system-ui, sans-serif)',
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', stiffness: 350, damping: 28 }}
            style={{
              background: 'var(--bg-primary, #ffffff)',
              border: '1px solid var(--border, rgba(148, 163, 184, 0.25))',
              borderRadius: '20px',
              maxWidth: '500px',
              width: '100%',
              maxHeight: '90vh',
              overflow: 'auto',
              padding: '2rem 2.5rem',
              position: 'relative',
              color: 'var(--text-primary, #0f172a)',
            }}
          >
            <button
              onClick={onClose}
              style={{
                position: 'absolute',
                top: '1rem',
                right: '1rem',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: 'var(--bg-tertiary, rgba(148, 163, 184, 0.08))',
                border: '1px solid var(--border, rgba(148, 163, 184, 0.25))',
                color: 'var(--text-secondary, #64748b)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--bg-tertiary, rgba(148, 163, 184, 0.15))';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--bg-tertiary, rgba(148, 163, 184, 0.08))';
              }}
            >
              <X size={18} />
            </button>

            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem',
              }}>
                <AlertTriangle size={32} style={{ color: '#f59e0b' }} />
              </div>
              <h3 style={{
                fontSize: '1.25rem',
                fontWeight: 800,
                margin: '0 0 0.5rem',
                fontFamily: 'var(--font-headline, system-ui)',
              }}>
                AI Token Limit Reached
              </h3>
              <p style={{
                color: 'var(--text-secondary, #64748b)',
                fontSize: '0.9rem',
                margin: 0,
              }}>
                You've used {data?.dailyTokenCap ? data.usedToday.toLocaleString() : '—'} of {data?.dailyTokenCap ? data.dailyTokenCap.toLocaleString() : '—'} tokens today ({Math.round(data?.percentage || 0)}%).
              </p>
            </div>

            <div style={{
              background: 'var(--bg-tertiary, rgba(148, 163, 184, 0.05))',
              borderRadius: '12px',
              padding: '1rem',
              marginBottom: '1.5rem',
            }}>
              <div style={{
                width: '100%',
                height: '6px',
                background: 'var(--bg-secondary, rgba(148, 163, 184, 0.1))',
                borderRadius: '4px',
                overflow: 'hidden',
              }}>
                <div
                  style={{
                    width: `${Math.min(data?.percentage || 0, 100)}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, #eab308, #f59e0b)',
                    borderRadius: '4px',
                  }}
                />
              </div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: '0.5rem',
                fontSize: '0.85rem',
              }}>
                <span style={{ color: 'var(--text-secondary, #64748b)' }}>Daily Usage</span>
                <span style={{ color: 'var(--text-primary, #0f172a)', fontWeight: 600 }}>
                  {Math.round(data?.percentage || 0)}%
                </span>
              </div>
            </div>

            <div style={{
              background: 'var(--bg-tertiary, rgba(148, 163, 184, 0.05))',
              borderRadius: '12px',
              padding: '1rem',
              marginBottom: '1.5rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <Zap size={14} style={{ color: '#eab308' }} />
                <span style={{ color: 'var(--text-secondary, #64748b)', fontSize: '0.85rem', fontWeight: 600 }}>
                  Reset in
                </span>
              </div>
              <p style={{
                margin: 0,
                color: 'var(--text-primary, #0f172a)',
                fontSize: '1rem',
                fontWeight: 600,
              }}>
                {data?.quotaResetAt ? new Date(data.quotaResetAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
              </p>
            </div>

            <p style={{
              color: 'var(--text-secondary, #64748b)',
              fontSize: '0.85rem',
              lineHeight: 1.4,
              marginBottom: '1.5rem',
            }}>
              Purchase an AI subscription to unlock more tokens and continue uninterrupted work.
            </p>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={onClose}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  borderRadius: '10px',
                  background: 'var(--bg-tertiary, rgba(148, 163, 184, 0.1))',
                  border: '1px solid var(--border, rgba(148, 163, 184, 0.25))',
                  color: 'var(--text-secondary, #64748b)',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--bg-tertiary, rgba(148, 163, 184, 0.15))';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--bg-tertiary, rgba(148, 163, 184, 0.1))';
                }}
              >
                Dismiss
              </button>
              <button
                onClick={() => {
                  onClose();
                  window.dispatchEvent(new CustomEvent('open-ai-subscription'));
                }}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  borderRadius: '10px',
                  background: 'var(--accent-primary, #0ea5e9)',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = '0.9';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '1';
                }}
              >
                Subscribe Now
              </button>
            </div>

            <button
              onClick={() => {
                onClose();
                window.location.href = '/dashboard';
              }}
              style={{
                marginTop: '1rem',
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                background: 'transparent',
                border: '1px solid var(--border, rgba(148, 163, 184, 0.25))',
                color: 'var(--text-secondary, #64748b)',
                fontSize: '0.8rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
                margin: '0 auto 1rem',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--bg-tertiary, rgba(148, 163, 184, 0.1))';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <LayoutDashboard size={14} />
              Back to Dashboard
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}