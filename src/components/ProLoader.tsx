'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, Brain, BookOpen, GraduationCap, Cpu, Zap, Library,
  FileSearch, FileText, Atom, Sigma, Trophy, Loader2
} from 'lucide-react';

const ICON_SET = [
  { icon: Brain, color: '#8b5cf6', label: 'Neural Engine' },
  { icon: BookOpen, color: '#06b6d4', label: 'Knowledge Base' },
  { icon: GraduationCap, color: '#10b981', label: 'Academic Core' },
  { icon: Cpu, color: '#f59e0b', label: 'Processing Unit' },
  { icon: Zap, color: '#ef4444', label: 'Accelerator' },
  { icon: Library, color: '#6366f1', label: 'Digital Library' },
  { icon: FileSearch, color: '#ec4899', label: 'Deep Search' },
  { icon: FileText, color: '#14b8a6', label: 'Document Engine' },
  { icon: Atom, color: '#a855f7', label: 'Quantum Core' },
  { icon: Sigma, color: '#f97316', label: 'Math Engine' },
  { icon: Sparkles, color: '#eab308', label: 'AI Studio' },
  { icon: Trophy, color: '#22c55e', label: 'Achievement' },
];

const LOADING_MESSAGES = [
  'Initializing Neural Workspace...',
  'Authenticating Secure Session...',
  'Calibrating AI Engines...',
  'Loading Academic Assets...',
  'Synchronizing Cloud Data...',
  'Optimizing Performance...',
  'Connecting to Knowledge Graph...',
  'Warming Up Compilers...',
  'Readying Your Dashboard...',
  'Almost There...',
];

interface ProLoaderProps {
  fullScreen?: boolean;
  mini?: boolean;
  overlay?: boolean;
  message?: string;
  progress?: number;
  iconSize?: number;
  variant?: 'default' | 'login' | 'admin';
}

export default function ProLoader({
  fullScreen = true,
  mini = false,
  overlay = false,
  message,
  progress,
  iconSize = 56,
  variant = 'default',
}: ProLoaderProps) {
  const [msgIndex, setMsgIndex] = useState(0);
  const [iconIndex, setIconIndex] = useState(0);
  const [simProgress, setSimProgress] = useState(0);

  const isIndeterminate = progress === undefined;

  useEffect(() => {
    const msgTimer = setInterval(() => {
      setMsgIndex(p => (p + 1) % LOADING_MESSAGES.length);
    }, 2200);
    const iconTimer = setInterval(() => {
      setIconIndex(p => (p + 1) % ICON_SET.length);
    }, 3200);
    return () => { clearInterval(msgTimer); clearInterval(iconTimer); };
  }, []);

  useEffect(() => {
    if (!isIndeterminate) return;
    const timer = setInterval(() => {
      setSimProgress(p => {
        if (p >= 95) return 95;
        return p + (95 - p) * 0.03 + Math.random() * 0.5;
      });
    }, 400);
    return () => clearInterval(timer);
  }, [isIndeterminate]);

  const displayProgress = Math.round(progress ?? simProgress);
  const currentIcon = ICON_SET[iconIndex];
  const IconComponent = currentIcon.icon;
  const currentMessage = message || LOADING_MESSAGES[msgIndex];

  const gradientFrom = useMemo(() => {
    const colors = ['#0f172a', '#1e1b4b', '#0c1223', '#0b1326'];
    return colors[iconIndex % colors.length];
  }, [iconIndex]);

  const container: React.CSSProperties = {
    height: fullScreen ? '100vh' : mini ? 'auto' : '100%',
    width: '100%',
    background: overlay ? 'rgba(0,0,0,0.6)' : fullScreen
      ? `linear-gradient(135deg, ${gradientFrom} 0%, #1a1a2e 50%, #16213e 100%)`
      : 'transparent',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    position: overlay ? 'fixed' : 'relative',
    top: 0,
    left: 0,
    zIndex: overlay ? 9999 : fullScreen ? 50 : 1,
    overflow: 'hidden',
    backdropFilter: overlay ? 'blur(8px)' : 'none',
    padding: mini ? '2rem' : 0,
    gap: mini ? '0.75rem' : 0,
  };

  if (mini) {
    return (
      <div style={container}>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
        >
          <Loader2 size={24} color={currentIcon.color} />
        </motion.div>
        {message && <span style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8' }}>{message}</span>}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={container}
    >
      {/* Background Orbs */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden',
      }}>
        {[0, 1, 2].map(i => (
          <motion.div
            key={i}
            animate={{
              x: [0, (i + 1) * 40, 0],
              y: [0, (i + 1) * -30, 0],
              scale: [1, 1.15, 1],
            }}
            transition={{ duration: 6 + i * 2, repeat: Infinity, ease: 'easeInOut' }}
            style={{
              position: 'absolute',
              top: `${25 + i * 25}%`,
              left: `${15 + i * 30}%`,
              width: `${200 + i * 80}px`,
              height: `${200 + i * 80}px`,
              borderRadius: '50%',
              background: `radial-gradient(circle, ${currentIcon.color}15 0%, transparent 70%)`,
              filter: 'blur(60px)',
            }}
          />
        ))}
      </div>

      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {/* Icon with rotating ring */}
        <div style={{ position: 'relative', width: iconSize + 40, height: iconSize + 40, marginBottom: '1.5rem' }}>
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 3, ease: 'linear' }}
            style={{
              position: 'absolute', inset: 0, borderRadius: '50%',
              border: '2px solid transparent',
              borderTopColor: currentIcon.color,
              borderRightColor: `${currentIcon.color}88`,
            }}
          />
          <motion.div
            key={iconIndex}
            initial={{ scale: 0.7, opacity: 0, rotate: -30 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            exit={{ scale: 1.3, opacity: 0, rotate: 30 }}
            transition={{ duration: 0.6, ease: 'backOut' }}
            style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <IconComponent size={iconSize} color={currentIcon.color} />
          </motion.div>
          {/* Glow */}
          <motion.div
            animate={{ scale: [1, 1.15, 1], opacity: [0.15, 0.25, 0.15] }}
            transition={{ duration: 3, repeat: Infinity }}
            style={{
              position: 'absolute', inset: '-10px', borderRadius: '50%',
              background: `radial-gradient(circle, ${currentIcon.color}30 0%, transparent 70%)`,
              filter: 'blur(15px)',
            }}
          />
        </div>

        {/* Brand */}
        <motion.h2
          initial={{ y: 15, opacity: 0 }}
          animate={{ y: 0, opacity: 0.9 }}
          style={{
            fontSize: '0.7rem', fontWeight: 900, letterSpacing: '0.5em',
            color: '#e2e8f0', textTransform: 'uppercase', marginBottom: '0.25rem',
          }}
        >
          Latexify
        </motion.h2>

        {/* Status message */}
        <div style={{ height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.5rem' }}>
          <AnimatePresence mode="wait">
            <motion.p
              key={msgIndex + currentMessage}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 0.8, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35 }}
              style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', margin: 0, whiteSpace: 'nowrap' }}
            >
              {currentMessage}
            </motion.p>
          </AnimatePresence>
        </div>

        {/* Tag */}
        <motion.span
          animate={{ opacity: [0.4, 0.7, 0.4] }}
          transition={{ duration: 2.5, repeat: Infinity }}
          style={{
            fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.15em',
            color: currentIcon.color, marginBottom: '1.5rem',
            textTransform: 'uppercase',
          }}
        >
          {currentIcon.label} · v4.2
        </motion.span>

        {/* Progress */}
        <div style={{
          width: 200, height: 3,
          background: 'rgba(255,255,255,0.06)',
          borderRadius: 4, overflow: 'hidden', position: 'relative',
        }}>
          <motion.div
            animate={isIndeterminate ? { x: [-200, 400] } : {}}
            transition={isIndeterminate ? { duration: 2, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.5 }}
            style={{
              position: 'absolute', inset: 0,
              width: isIndeterminate ? '60%' : `${displayProgress}%`,
              background: `linear-gradient(90deg, ${currentIcon.color}, ${currentIcon.color}88, ${currentIcon.color})`,
              borderRadius: 4,
              transition: 'width 0.4s ease',
            }}
          />
        </div>

        {/* Percentage */}
        {!isIndeterminate && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.7 }}
            style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748b', marginTop: '0.5rem' }}
          >
            {displayProgress}%
          </motion.p>
        )}
      </div>
    </motion.div>
  );
}
