"use client";
import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Cpu, Sparkles, Code2, BookOpen, Layers, Zap, Database } from 'lucide-react';

interface EditorLoadingOverlayProps {
  visible: boolean;
  label?: string;
  sublabel?: string;
}

const ICON_STEPS = [
  { Icon: FileText,  color: '#6366f1', label: 'Reading source' },
  { Icon: Cpu,       color: '#a855f7', label: 'Parsing structure' },
  { Icon: Code2,     color: '#06b6d4', label: 'Loading syntax' },
  { Icon: Layers,    color: '#10b981', label: 'Resolving includes' },
  { Icon: Database,  color: '#f59e0b', label: 'Syncing assets' },
  { Icon: BookOpen,  color: '#ec4899', label: 'Indexing packages' },
  { Icon: Zap,       color: '#14b8a6', label: 'Preparing editor' },
  { Icon: Sparkles,  color: '#8b5cf6', label: 'Almost ready' },
];

const HIDE_DEBOUNCE_MS = 400;

export default function EditorLoadingOverlay({ visible, label = 'LOADING LATEX SOURCE', sublabel = 'Parsing files and populating editor...' }: EditorLoadingOverlayProps) {
  const [step, setStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [show, setShow] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible) {
      if (hideTimerRef.current) { clearTimeout(hideTimerRef.current); hideTimerRef.current = null; }
      setShow(true);
      setStep(0);
      setProgress(0);
    } else {
      setProgress(100);
      hideTimerRef.current = setTimeout(() => {
        hideTimerRef.current = null;
        setShow(false);
        setStep(0);
        setProgress(0);
      }, HIDE_DEBOUNCE_MS);
    }
    return () => { if (hideTimerRef.current) { clearTimeout(hideTimerRef.current); hideTimerRef.current = null; } };
  }, [visible]);

  useEffect(() => {
    if (!show) return;
    const total = ICON_STEPS.length;
    const interval = setInterval(() => {
      setStep(s => s < total - 1 ? s + 1 : s);
      setProgress(p => p < 95 ? Math.min(p + 100 / total + Math.random() * 4, 95) : p);
    }, 380);
    return () => clearInterval(interval);
  }, [show]);

  const current = ICON_STEPS[step];
  const CurrentIcon = current.Icon;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="editor-loading-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 50,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '1.25rem',
            background: 'rgba(8, 8, 12, 0.88)',
            backdropFilter: 'blur(14px)',
          }}
        >
          {/* Single calm loader: rotating accent ring with center icon */}
          <div style={{ position: 'relative', width: 72, height: 72 }}>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1.1, ease: 'linear' }}
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '50%',
                border: '3px solid transparent',
                borderTopColor: 'var(--accent-primary, #00a395)',
                borderRightColor: 'var(--accent-secondary, #06b6d4)',
                opacity: 0.9,
              }}
            />
            <div
              style={{
                position: 'absolute',
                inset: 10,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(255,255,255,0.04)',
              }}
            >
              <motion.div
                key={step}
                initial={{ scale: 0.8, opacity: 0.5 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                style={{ color: 'var(--accent-primary, #00a395)', display: 'flex' }}
              >
                <CurrentIcon size={24} />
              </motion.div>
            </div>
          </div>

          {/* Step label */}
          <div style={{ textAlign: 'center', userSelect: 'none' }}>
            <AnimatePresence mode="wait">
              <motion.p
                key={`step-${step}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
                style={{
                  fontSize: '0.62rem',
                  fontWeight: 700,
                  color: 'var(--accent-primary, #00a395)',
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  margin: '0 0 0.35rem 0',
                  fontFamily: 'var(--font-headline)',
                }}
              >
                {current.label}
              </motion.p>
            </AnimatePresence>
            <h4 style={{
              fontSize: '0.78rem',
              fontWeight: 800,
              color: 'var(--text-primary, #f0f0f0)',
              margin: '0 0 0.25rem 0',
              fontFamily: 'var(--font-headline)',
              letterSpacing: '0.06em',
            }}>
              {label}
            </h4>
            <p style={{
              fontSize: '0.6rem',
              color: 'var(--text-secondary, #888)',
              margin: 0,
              fontFamily: 'var(--font-body)',
            }}>
              {sublabel}
            </p>
          </div>

          {/* Single smooth progress bar (no shimmer) */}
          <div style={{ width: 200, height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
            <motion.div
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              style={{
                position: 'absolute',
                left: 0, top: 0, bottom: 0,
                borderRadius: 4,
                background: 'linear-gradient(90deg, var(--accent-primary, #00a395), var(--accent-secondary, #06b6d4))',
              }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
