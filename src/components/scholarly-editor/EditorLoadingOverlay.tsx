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
            gap: '1.5rem',
            background: 'rgba(8, 8, 12, 0.88)',
            backdropFilter: 'blur(14px)',
          }}
        >
          {/* Orbiting icon ring */}
          <div style={{ position: 'relative', width: 88, height: 88 }}>
            {/* Outer orbit */}
            {ICON_STEPS.map((item, i) => {
              const angle = (i / ICON_STEPS.length) * 2 * Math.PI - Math.PI / 2;
              const r = 38;
              const x = r * Math.cos(angle);
              const y = r * Math.sin(angle);
              const isActive = i === step;
              return (
                <motion.div
                  key={i}
                  animate={{
                    opacity: isActive ? 1 : 0.18,
                    scale: isActive ? 1.35 : 0.85,
                  }}
                  transition={{ duration: 0.3 }}
                  style={{
                    position: 'absolute',
                    left: '50%',
                    top: '50%',
                    transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
                    color: item.color,
                    filter: isActive ? `drop-shadow(0 0 8px ${item.color})` : 'none',
                  }}
                >
                  <item.Icon size={14} />
                </motion.div>
              );
            })}

            {/* Centre pulsing icon */}
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ scale: 0.6, opacity: 0, rotate: -30 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                exit={{ scale: 0.6, opacity: 0, rotate: 30 }}
                transition={{ duration: 0.28, ease: 'easeOut' }}
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '50%',
                  background: `radial-gradient(circle, ${current.color}22 0%, transparent 70%)`,
                }}
              >
                <div style={{
                  width: 40,
                  height: 40,
                  borderRadius: '12px',
                  background: `linear-gradient(135deg, ${current.color}cc, ${ICON_STEPS[(step + 2) % ICON_STEPS.length].color}cc)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: `0 0 22px ${current.color}88, 0 0 50px ${current.color}33`,
                }}>
                  <CurrentIcon size={20} color="#fff" />
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Rotating ring border */}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 3, ease: 'linear' }}
              style={{
                position: 'absolute',
                inset: -2,
                borderRadius: '50%',
                border: `2px solid transparent`,
                borderTopColor: current.color,
                borderRightColor: ICON_STEPS[(step + 2) % ICON_STEPS.length].color,
                opacity: 0.7,
              }}
            />
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
                  color: current.color,
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

          {/* Multicolor segmented progress bar */}
          <div style={{ width: 200, height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
            <motion.div
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              style={{
                position: 'absolute',
                left: 0, top: 0, bottom: 0,
                borderRadius: 4,
                background: `linear-gradient(90deg, #6366f1, #a855f7, #06b6d4, #10b981, ${current.color})`,
                boxShadow: `0 0 10px ${current.color}88`,
              }}
            />
            {/* shimmer */}
            <motion.div
              animate={{ x: ['-100%', '300%'] }}
              transition={{ repeat: Infinity, duration: 1.6, ease: 'easeInOut', repeatDelay: 0.2 }}
              style={{
                position: 'absolute',
                top: 0, bottom: 0,
                width: '40%',
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)',
                borderRadius: 4,
              }}
            />
          </div>

          {/* Step dots */}
          <div style={{ display: 'flex', gap: '5px' }}>
            {ICON_STEPS.map((item, i) => (
              <motion.div
                key={i}
                animate={{ scale: i === step ? 1.4 : 1, opacity: i <= step ? 1 : 0.2 }}
                transition={{ duration: 0.2 }}
                style={{ width: 5, height: 5, borderRadius: '50%', background: item.color }}
              />
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
