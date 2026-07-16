"use client";

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Zap, GraduationCap, ArrowRight, LayoutDashboard, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface ProjectLimitModalProps {
  isOpen: boolean;
  onClose?: () => void;
}

export default function ProjectLimitModal({ isOpen, onClose }: ProjectLimitModalProps) {
  const router = useRouter();

  if (!isOpen) return null;

  const handleUpgrade = (planType: string) => {
    router.push(`/dashboard?upgrade=true&plan=${planType}`);
  };

  const handleGoToDashboard = () => {
    router.push('/dashboard');
  };

  return (
    <AnimatePresence>
      <div 
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem',
          background: 'rgba(3, 7, 18, 0.85)',
          backdropFilter: 'blur(16px)',
          fontFamily: 'var(--font-headline, system-ui, sans-serif)',
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: 'spring', duration: 0.5 }}
          style={{
            background: 'linear-gradient(145deg, #111827, #030712)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            borderRadius: '24px',
            maxWidth: '850px',
            width: '100%',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 40px rgba(239, 68, 68, 0.1)',
            padding: '2.5rem',
            position: 'relative',
            color: '#f9fafb',
            overflow: 'hidden',
          }}
        >
          {/* Decorative glows */}
          <div style={{ position: 'absolute', top: '-10%', left: '50%', transform: 'translateX(-50%)', width: '300px', height: '100px', background: 'radial-gradient(circle, rgba(239, 68, 68, 0.15), transparent 70%)', filter: 'blur(20px)', pointerEvents: 'none' }} />

          {/* Header Warning */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: '2rem' }}>
            <div style={{
              width: '60px', height: '60px', borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.4)',
              display: 'flex', alignItems: 'center',
              color: '#ef4444', marginBottom: '1rem',
              justifyContent: 'center',
            }}>
              <AlertCircle size={30} />
            </div>
            <h2 style={{ fontSize: '1.75rem', fontWeight: 800, margin: '0 0 0.5rem', letterSpacing: '-0.025em', color: '#fff' }}>
              Project Limit Reached
            </h2>
            <p style={{ color: '#9ca3af', fontSize: '0.95rem', margin: 0, maxWidth: '550px', lineHeight: 1.5 }}>
              Free membership is restricted to a total of 7 projects across all tools. Upgrade to a Premium plan to unlock unlimited project creation and advanced LaTeX tools.
            </p>
          </div>

          {/* Pricing Upgrade Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
            gap: '1.25rem',
            marginBottom: '2rem',
          }}>
            {/* PRO PLAN */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '16px', padding: '1.5rem',
              display: 'flex', flexDirection: 'column',
              transition: 'all 0.2s', position: 'relative',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <Zap size={18} style={{ color: '#a855f7' }} />
                <h4 style={{ fontWeight: 800, fontSize: '1rem', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#a855f7' }}>PRO PLAN</h4>
              </div>
              <p style={{ fontSize: '0.8rem', color: '#9ca3af', margin: '0 0 1.25rem', flex: 1, lineHeight: 1.4 }}>
                Unlimited projects, fast tectonic compilations, and full LaTeX styling support.
              </p>
              <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#fff', marginBottom: '1rem' }}>
                ₹250 <span style={{ fontSize: '0.8rem', fontWeight: 500, color: '#9ca3af' }}>/ month</span>
              </div>
              <button 
                onClick={() => handleUpgrade('pro')}
                style={{
                  width: '100%', padding: '0.65rem', borderRadius: '10px',
                  background: 'linear-gradient(135deg, #a855f7, #7c3aed)',
                  color: '#fff', border: 'none', fontWeight: 700, fontSize: '0.8rem',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem',
                  transition: 'opacity 0.2s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
                onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
              >
                <span>Upgrade to Pro</span>
                <ArrowRight size={13} />
              </button>
            </div>

            {/* MOD PLAN */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '16px', padding: '1.5rem',
              display: 'flex', flexDirection: 'column',
              transition: 'all 0.2s', position: 'relative',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <Shield size={18} style={{ color: '#3b82f6' }} />
                <h4 style={{ fontWeight: 800, fontSize: '1rem', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#3b82f6' }}>MOD PLAN</h4>
              </div>
              <p style={{ fontSize: '0.8rem', color: '#9ca3af', margin: '0 0 1.25rem', flex: 1, lineHeight: 1.4 }}>
                Advanced moderator controls, customizable compilation servers, and team editing.
              </p>
              <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#fff', marginBottom: '1rem' }}>
                ₹600 <span style={{ fontSize: '0.8rem', fontWeight: 500, color: '#9ca3af' }}>/ 3 months</span>
              </div>
              <button 
                onClick={() => handleUpgrade('mod')}
                style={{
                  width: '100%', padding: '0.65rem', borderRadius: '10px',
                  background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                  color: '#fff', border: 'none', fontWeight: 700, fontSize: '0.8rem',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem',
                  transition: 'opacity 0.2s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
                onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
              >
                <span>Upgrade to Mod</span>
                <ArrowRight size={13} />
              </button>
            </div>

            {/* INTERACTIVE LEARNING PLAN */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '16px', padding: '1.5rem',
              display: 'flex', flexDirection: 'column',
              transition: 'all 0.2s', position: 'relative',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <GraduationCap size={18} style={{ color: '#10b981' }} />
                <h4 style={{ fontWeight: 800, fontSize: '1rem', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#10b981' }}>LEARNING PLAN</h4>
              </div>
              <p style={{ fontSize: '0.8rem', color: '#9ca3af', margin: '0 0 1.25rem', flex: 1, lineHeight: 1.4 }}>
                Interactive step-by-step LaTeX courses, AI-tutor corrections, and learning tools.
              </p>
              <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#fff', marginBottom: '1rem' }}>
                ₹1000 <span style={{ fontSize: '0.8rem', fontWeight: 500, color: '#9ca3af' }}>/ 6 months</span>
              </div>
              <button 
                onClick={() => handleUpgrade('learning')}
                style={{
                  width: '100%', padding: '0.65rem', borderRadius: '10px',
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  color: '#fff', border: 'none', fontWeight: 700, fontSize: '0.8rem',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem',
                  transition: 'opacity 0.2s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
                onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
              >
                <span>Upgrade Plan</span>
                <ArrowRight size={13} />
              </button>
            </div>
          </div>

          {/* Footer Actions */}
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <button
              onClick={handleGoToDashboard}
              style={{
                padding: '0.65rem 1.5rem', borderRadius: '10px',
                background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#fff', fontWeight: 700, fontSize: '0.85rem',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
              }}
            >
              <LayoutDashboard size={15} />
              <span>Go to Dashboard</span>
            </button>

            {/* Cancel button removed to enforce mandatory upgrade block */}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
