'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, ExternalLink, LayoutDashboard, X } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface CreditLimitModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CreditLimitModal({ isOpen, onClose }: CreditLimitModalProps) {
  const router = useRouter();

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
            backgroundColor: 'rgba(2, 6, 23, 0.85)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 280 }}
            style={{
              position: 'relative',
              background: 'linear-gradient(145deg, #1e1e38, #15152b)',
              border: '1px solid rgba(249, 115, 22, 0.25)',
              borderRadius: '24px',
              padding: '2.5rem',
              maxWidth: '480px',
              width: '100%',
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(249, 115, 22, 0.05)',
              textAlign: 'center',
              overflow: 'hidden',
            }}
          >
            {/* Background Glow Effect */}
            <div
              style={{
                position: 'absolute',
                top: '-50px',
                left: '50%',
                transform: 'translateX(-50%)',
                width: '180px',
                height: '180px',
                background: 'radial-gradient(circle, rgba(249, 115, 22, 0.15) 0%, rgba(249, 115, 22, 0) 70%)',
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
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
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
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#9ca3af';
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
              }}
              title="Close and View Only"
            >
              <X size={14} />
            </button>

            {/* Warning Icon */}
            <div
              style={{
                width: '64px',
                height: '64px',
                background: 'radial-gradient(circle, rgba(249, 115, 22, 0.15) 0%, rgba(249, 115, 22, 0.03) 100%)',
                border: '1px solid rgba(249, 115, 22, 0.25)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1.5rem',
              }}
            >
              <AlertTriangle size={28} style={{ color: '#f97316' }} />
            </div>

            {/* Title & Badge */}
            <h2
              style={{
                margin: '0 0 0.5rem',
                color: '#fff',
                fontSize: '1.35rem',
                fontWeight: 800,
                fontFamily: 'var(--font-headline)',
                letterSpacing: '-0.02em',
              }}
            >
              Free Limit Reached
            </h2>
            <div
              style={{
                display: 'inline-block',
                background: 'rgba(249, 115, 22, 0.1)',
                border: '1px solid rgba(249, 115, 22, 0.2)',
                borderRadius: '6px',
                padding: '0.15rem 0.6rem',
                fontSize: '0.62rem',
                fontWeight: 900,
                color: '#f97316',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: '1.25rem',
                fontFamily: 'var(--font-headline)',
              }}
            >
              0 Credits Remaining
            </div>

            {/* Description */}
            <p
              style={{
                margin: '0 0 2rem',
                color: '#9ca3af',
                fontSize: '0.85rem',
                lineHeight: '1.5',
                fontFamily: 'var(--font-body)',
              }}
            >
              Your free credit limit has been reached. Please upgrade to the Premium Plan to modify documents. You can still see, share, print, and download all your existing projects and reports.
            </p>

            {/* Button Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button
                onClick={() => router.push('/dashboard?upgrade=true')}
                style={{
                  width: '100%',
                  padding: '0.85rem',
                  background: 'linear-gradient(90deg, #f97316, #ea580c)',
                  border: 'none',
                  borderRadius: '12px',
                  color: '#fff',
                  fontSize: '0.8rem',
                  fontWeight: 900,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  boxShadow: '0 4px 15px rgba(249, 115, 22, 0.3)',
                  transition: 'opacity 0.2s',
                  fontFamily: 'var(--font-headline)',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
              >
                <ExternalLink size={14} strokeWidth={2.5} />
                Upgrade to Premium
              </button>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  onClick={() => router.push('/dashboard')}
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    background: 'rgba(255, 255, 255, 0.02)',
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
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
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
                    background: 'rgba(255, 255, 255, 0.02)',
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
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                    e.currentTarget.style.color = '#fff';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
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
