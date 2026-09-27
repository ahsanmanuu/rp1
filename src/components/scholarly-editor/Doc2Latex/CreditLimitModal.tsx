'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, ExternalLink, LayoutDashboard, X, Clock, Sparkles, Shield, Zap } from 'lucide-react';
import { useRouter } from 'next/navigation';

export interface CreditLimitModalProps {
  isOpen: boolean;
  onClose: () => void;
  reason?: 'project_limit' | 'ai_tokens_exhausted' | 'credits';
  currentCount?: number;
  max?: number;
  reactivateAt?: string | null;
  quotaResetAt?: string | null;
}

export default function CreditLimitModal({
  isOpen,
  onClose,
  reason = 'project_limit',
  currentCount = 7,
  max = 7,
  reactivateAt = null,
  quotaResetAt = null,
}: CreditLimitModalProps) {
  const router = useRouter();
  const [timeLeft, setTimeLeft] = useState<string>('');

  // Countdown timer for AI Token refresh / reactivate
  useEffect(() => {
    if (!isOpen || reason !== 'ai_tokens_exhausted') return;

    const targetDateStr = reactivateAt || quotaResetAt;
    if (!targetDateStr) {
      setTimeLeft('Quota resets at midnight UTC');
      return;
    }

    const target = new Date(targetDateStr).getTime();

    const updateTimer = () => {
      const now = Date.now();
      const diff = target - now;
      if (diff <= 0) {
        setTimeLeft('Refreshing now...');
        return;
      }
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [isOpen, reason, reactivateAt, quotaResetAt]);

  const handleSubscribePlan = () => {
    router.push('/pricing');
  };

  const handleDashboard = () => {
    router.push('/dashboard');
  };

  const isProjectLimit = reason === 'project_limit';
  const isAiExhausted = reason === 'ai_tokens_exhausted';

  const modalTitle = isProjectLimit
    ? 'Free Project Limit Reached'
    : isAiExhausted
    ? 'Daily AI Tokens Exhausted'
    : 'Free Credit Limit Reached';

  const modalBadge = isProjectLimit
    ? `${currentCount} / ${max} Projects Created`
    : isAiExhausted
    ? '0 LLM Tokens Remaining'
    : '0 Credits Remaining';

  const modalDescription = isProjectLimit
    ? 'You have reached the maximum of 7 cumulative projects allowed on the Free Plan across all tools. To create, edit, compile, or copy-paste code, please subscribe to a Premium Plan.'
    : isAiExhausted
    ? 'You have consumed all your daily LLM tokens. Editor actions and paste options are paused. They will automatically reactivate once your quota refreshes or immediately when you subscribe to a Premium AI Plan.'
    : 'Your free credit limit has been reached. Please upgrade to the Premium Plan to modify documents. You can still see, share, print, and download your existing files.';

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
            backgroundColor: 'rgba(2, 6, 23, 0.88)',
            backdropFilter: 'blur(14px)',
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 280 }}
            style={{
              position: 'relative',
              background: 'linear-gradient(145deg, #18182e, #0f0f20)',
              border: isProjectLimit
                ? '1px solid rgba(239, 68, 68, 0.35)'
                : isAiExhausted
                ? '1px solid rgba(168, 85, 247, 0.35)'
                : '1px solid rgba(249, 115, 22, 0.35)',
              borderRadius: '24px',
              padding: '2.5rem',
              maxWidth: '500px',
              width: '100%',
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.9), 0 0 0 1px rgba(255, 255, 255, 0.05)',
              textAlign: 'center',
              overflow: 'hidden',
            }}
          >
            {/* Background Glow */}
            <div
              style={{
                position: 'absolute',
                top: '-60px',
                left: '50%',
                transform: 'translateX(-50%)',
                width: '220px',
                height: '220px',
                background: isProjectLimit
                  ? 'radial-gradient(circle, rgba(239, 68, 68, 0.18) 0%, rgba(239, 68, 68, 0) 70%)'
                  : isAiExhausted
                  ? 'radial-gradient(circle, rgba(168, 85, 247, 0.20) 0%, rgba(168, 85, 247, 0) 70%)'
                  : 'radial-gradient(circle, rgba(249, 115, 22, 0.18) 0%, rgba(249, 115, 22, 0) 70%)',
                pointerEvents: 'none',
              }}
            />

            {/* Close Button */}
            <button
              onClick={onClose}
              style={{
                position: 'absolute',
                top: '1.25rem',
                right: '1.25rem',
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#9ca3af',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#fff';
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#9ca3af';
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
              }}
              title="Close and View Only"
            >
              <X size={14} />
            </button>

            {/* Icon */}
            <div
              style={{
                width: '68px',
                height: '68px',
                background: isProjectLimit
                  ? 'radial-gradient(circle, rgba(239, 68, 68, 0.2) 0%, rgba(239, 68, 68, 0.05) 100%)'
                  : isAiExhausted
                  ? 'radial-gradient(circle, rgba(168, 85, 247, 0.2) 0%, rgba(168, 85, 247, 0.05) 100%)'
                  : 'radial-gradient(circle, rgba(249, 115, 22, 0.2) 0%, rgba(249, 115, 22, 0.05) 100%)',
                border: isProjectLimit
                  ? '1px solid rgba(239, 68, 68, 0.3)'
                  : isAiExhausted
                  ? '1px solid rgba(168, 85, 247, 0.3)'
                  : '1px solid rgba(249, 115, 22, 0.3)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1.25rem',
              }}
            >
              {isAiExhausted ? (
                <Zap size={30} style={{ color: '#c084fc' }} />
              ) : (
                <AlertTriangle size={30} style={{ color: isProjectLimit ? '#f87171' : '#f97316' }} />
              )}
            </div>

            {/* Title & Badge */}
            <h2
              style={{
                margin: '0 0 0.5rem',
                color: '#fff',
                fontSize: '1.4rem',
                fontWeight: 900,
                fontFamily: 'var(--font-headline)',
                letterSpacing: '-0.02em',
              }}
            >
              {modalTitle}
            </h2>
            <div
              style={{
                display: 'inline-block',
                background: isProjectLimit
                  ? 'rgba(239, 68, 68, 0.12)'
                  : isAiExhausted
                  ? 'rgba(168, 85, 247, 0.12)'
                  : 'rgba(249, 115, 22, 0.12)',
                border: isProjectLimit
                  ? '1px solid rgba(239, 68, 68, 0.3)'
                  : isAiExhausted
                  ? '1px solid rgba(168, 85, 247, 0.3)'
                  : '1px solid rgba(249, 115, 22, 0.3)',
                borderRadius: '6px',
                padding: '0.2rem 0.75rem',
                fontSize: '0.65rem',
                fontWeight: 900,
                color: isProjectLimit ? '#f87171' : isAiExhausted ? '#c084fc' : '#f97316',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: '1rem',
                fontFamily: 'var(--font-headline)',
              }}
            >
              {modalBadge}
            </div>

            {/* Quota reset countdown for AI tokens */}
            {isAiExhausted && timeLeft && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '10px',
                  padding: '0.5rem 0.8rem',
                  margin: '0 auto 1.25rem',
                  fontSize: '0.75rem',
                  color: '#e2e8f0',
                  fontWeight: 700,
                  maxWidth: '300px',
                }}
              >
                <Clock size={14} style={{ color: '#c084fc' }} />
                <span>Auto-Reactivates in: <strong>{timeLeft}</strong></span>
              </div>
            )}

            {/* Description */}
            <p
              style={{
                margin: '0 0 1.75rem',
                color: '#94a3b8',
                fontSize: '0.86rem',
                lineHeight: '1.55',
                fontFamily: 'var(--font-body)',
              }}
            >
              {modalDescription}
            </p>

            {/* Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button
                onClick={handleSubscribePlan}
                style={{
                  width: '100%',
                  padding: '0.85rem',
                  background: isProjectLimit
                    ? 'linear-gradient(90deg, #ef4444, #dc2626)'
                    : isAiExhausted
                    ? 'linear-gradient(90deg, #8b5cf6, #7c3aed)'
                    : 'linear-gradient(90deg, #f97316, #ea580c)',
                  border: 'none',
                  borderRadius: '12px',
                  color: '#fff',
                  fontSize: '0.85rem',
                  fontWeight: 900,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  boxShadow: isProjectLimit
                    ? '0 4px 18px rgba(239, 68, 68, 0.35)'
                    : isAiExhausted
                    ? '0 4px 18px rgba(139, 92, 246, 0.35)'
                    : '0 4px 18px rgba(249, 115, 22, 0.35)',
                  transition: 'opacity 0.2s',
                  fontFamily: 'var(--font-headline)',
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.92')}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
              >
                <Sparkles size={15} strokeWidth={2.5} />
                {isProjectLimit ? 'Subscribe to Plan (₹ INR)' : isAiExhausted ? 'Upgrade to Premium AI Plan' : 'Upgrade to Premium'}
                <ExternalLink size={14} />
              </button>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  onClick={handleDashboard}
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '10px',
                    color: '#e5e7eb',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.4rem',
                    transition: 'all 0.2s',
                    fontFamily: 'var(--font-headline)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.16)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                  }}
                >
                  <LayoutDashboard size={14} />
                  Dashboard
                </button>

                <button
                  onClick={onClose}
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '10px',
                    color: '#9ca3af',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    fontFamily: 'var(--font-headline)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                    e.currentTarget.style.color = '#fff';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                    e.currentTarget.style.color = '#9ca3af';
                  }}
                >
                  View Only
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
