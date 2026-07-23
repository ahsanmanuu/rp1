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
  { Icon: FileText,  color: '#6366f1', label: 'Reading source', desc: 'Fetching latest local manuscript files...' },
  { Icon: Cpu,       color: '#a855f7', label: 'Parsing AST', desc: 'Analyzing LaTeX document hierarchy...' },
  { Icon: Code2,     color: '#06b6d4', label: 'Loading syntax', desc: 'Initializing Tokenizers and Monarch Grammars...' },
  { Icon: Layers,    color: '#10b981', label: 'Resolving imports', desc: 'Resolving relative package dependencies...' },
  { Icon: Database,  color: '#f59e0b', label: 'Syncing assets', desc: 'Updating project asset resources...' },
  { Icon: BookOpen,  color: '#ec4899', label: 'Index bibliography', desc: 'Caching citations and reference maps...' },
  { Icon: Zap,       color: '#14b8a6', label: 'Injecting themes', desc: 'Applying selected workspace aesthetics...' },
  { Icon: Sparkles,  color: '#8b5cf6', label: 'Finalizing editor', desc: 'Ready to write LaTeX code!' },
];

const HIDE_DEBOUNCE_MS = 300;

export default function EditorLoadingOverlay({ visible, label = 'LOADING LATEX SOURCE', sublabel }: EditorLoadingOverlayProps) {
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
      setStep(s => {
        const next = s + 1;
        if (next < total) {
          return next;
        }
        return s;
      });
      setProgress(p => {
        if (p < 95) {
          const increment = 100 / total + Math.random() * 5;
          return Math.min(p + increment, 95);
        }
        return p;
      });
    }, 450);
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
          transition={{ duration: 0.25 }}
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 100,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '1.75rem',
            background: 'rgba(9, 9, 14, 0.92)',
            backdropFilter: 'blur(16px) saturate(180%)',
            overflow: 'hidden',
          }}
        >
          {/* Style tag for animations */}
          <style dangerouslySetInnerHTML={{ __html: `
            @keyframes panGradient {
              0% { background-position: 0% 50%; }
              50% { background-position: 100% 50%; }
              100% { background-position: 0% 50%; }
            }
            @keyframes pulseGlow {
              0%, 100% { transform: scale(1); opacity: 0.15; filter: blur(35px); }
              50% { transform: scale(1.2); opacity: 0.25; filter: blur(45px); }
            }
            .shimmer-bg {
              background: linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.25) 50%, rgba(255,255,255,0) 100%);
              background-size: 200% 100%;
              animation: panGradient 1.5s infinite linear;
            }
          ` }} />

          {/* Radial Glowing Ambient Backdrop */}
          <div
            style={{
              position: 'absolute',
              width: '300px',
              height: '300px',
              borderRadius: '50%',
              background: `radial-gradient(circle, ${current.color}88 0%, transparent 70%)`,
              opacity: 0.2,
              pointerEvents: 'none',
              animation: 'pulseGlow 4s infinite ease-in-out',
            }}
          />

          {/* Orbit Ring Layout */}
          <div style={{ position: 'relative', width: 100, height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            
            {/* Spinning Outer Rainbow Border */}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 2.5, ease: 'linear' }}
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '50%',
                padding: '2px',
                background: 'linear-gradient(0deg, #6366f1, #a855f7, #06b6d4, #10b981, #f59e0b, #ec4899, #6366f1)',
                WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                WebkitMaskComposite: 'xor',
                maskComposite: 'exclude',
                opacity: 0.85,
              }}
            />

            {/* Orbiting Icons Track */}
            {ICON_STEPS.map((item, i) => {
              const angle = (i / ICON_STEPS.length) * 2 * Math.PI - Math.PI / 2;
              const radius = 48; // distance from center
              const x = radius * Math.cos(angle);
              const y = radius * Math.sin(angle);
              const isActive = i === step;

              return (
                <motion.div
                  key={i}
                  animate={{
                    scale: isActive ? 1.4 : 0.85,
                    opacity: isActive ? 1 : 0.25,
                  }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  style={{
                    position: 'absolute',
                    transform: `translate(${x}px, ${y}px)`,
                    color: item.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: isActive ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                    boxShadow: isActive ? `0 0 15px ${item.color}66` : 'none',
                    borderRadius: '50%',
                    width: 22,
                    height: 22,
                  }}
                >
                  <item.Icon size={12} strokeWidth={isActive ? 2.5 : 2} />
                </motion.div>
              );
            })}

            {/* Center Morphing Stage */}
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ scale: 0.7, opacity: 0, rotate: -45 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                exit={{ scale: 0.7, opacity: 0, rotate: 45 }}
                transition={{ duration: 0.28, ease: 'backOut' }}
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: '16px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: `0 0 25px ${current.color}44, inset 0 0 10px rgba(255,255,255,0.02)`,
                }}
              >
                <CurrentIcon size={24} color={current.color} strokeWidth={2.5} />
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Titles & Step Information */}
          <div style={{ textAlign: 'center', zIndex: 10, userSelect: 'none', padding: '0 1rem' }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              borderRadius: '99px',
              padding: '0.2rem 0.6rem',
              marginBottom: '0.75rem',
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: current.color, boxShadow: `0 0 8px ${current.color}` }} />
              <span style={{ fontSize: '0.58rem', fontWeight: 800, color: 'var(--text-secondary, #9ca3af)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                STAGE {step + 1} OF {ICON_STEPS.length}: {current.label}
              </span>
            </div>

            <h4 style={{
              fontSize: '0.85rem',
              fontWeight: 800,
              color: '#ffffff',
              margin: '0 0 0.35rem 0',
              fontFamily: 'var(--font-headline, system-ui)',
              letterSpacing: '0.05em',
              textShadow: '0 2px 10px rgba(0,0,0,0.5)',
            }}>
              {label.toUpperCase()}
            </h4>

            <p style={{
              fontSize: '0.68rem',
              color: 'var(--text-secondary, #9ca3af)',
              maxWidth: '280px',
              margin: '0 auto',
              lineHeight: '1.4',
              fontFamily: 'var(--font-body, system-ui)',
            }}>
              {sublabel || current.desc}
            </p>
          </div>

          {/* Progressive Multicolor Progress Bar */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem', width: 220, zIndex: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: '0.62rem', fontWeight: 700, color: '#f3f4f6', fontFamily: 'monospace' }}>
              <span style={{ opacity: 0.5 }}>SYNCHRONIZING</span>
              <span style={{ color: current.color }}>{Math.round(progress)}%</span>
            </div>

            <div style={{ width: '100%', height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 8, overflow: 'hidden', position: 'relative', border: '1px solid rgba(255, 255, 255, 0.03)' }}>
              <motion.div
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
                style={{
                  position: 'absolute',
                  left: 0, top: 0, bottom: 0,
                  borderRadius: 8,
                  background: 'linear-gradient(90deg, #6366f1, #a855f7, #06b6d4, #10b981)',
                  boxShadow: `0 0 8px ${current.color}66`,
                }}
              />
              {/* Shimmer overlay */}
              <div className="shimmer-bg" style={{ position: 'absolute', inset: 0, mixBlendMode: 'overlay', opacity: 0.6 }} />
            </div>
          </div>

          {/* Stage Dot Indicators */}
          <div style={{ display: 'flex', gap: '6px', zIndex: 10 }}>
            {ICON_STEPS.map((item, i) => (
              <motion.div
                key={i}
                animate={{
                  scale: i === step ? 1.4 : 1,
                  backgroundColor: i <= step ? item.color : 'rgba(255,255,255,0.1)',
                  boxShadow: i === step ? `0 0 10px ${item.color}` : 'none',
                }}
                transition={{ duration: 0.25 }}
                style={{ width: 6, height: 6, borderRadius: '50%' }}
              />
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
