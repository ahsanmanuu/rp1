"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Hash, BookOpen, GraduationCap, Cpu, Zap, Library } from 'lucide-react';

const LOADING_MESSAGES = [
  "Initializing Latexify Environment...",
  "Calibrating LaTeX compilation engine...",
  "Synchronizing manuscript templates...",
  "Optimizing extraction algorithms...",
  "Loading citation database...",
  "Preparing academic design tokens...",
  "Finalizing Latexify workspace..."
];

const SCHOLARLY_ICONS = [
  <Hash size={48} key="hash" />,
  <BookOpen size={48} key="book" />,
  <GraduationCap size={48} key="grad" />,
  <Cpu size={48} key="cpu" />,
  <Zap size={48} key="zap" />,
  <Library size={48} key="lib" />
];

export default function ScholarlySplashScreen() {
  const [messageIndex, setMessageIndex] = useState(0);
  const [iconIndex, setIconIndex] = useState(0);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const messageInterval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
    }, 2500);

    const iconInterval = setInterval(() => {
      setIconIndex((prev) => (prev + 1) % SCHOLARLY_ICONS.length);
    }, 5000);

    return () => {
      clearInterval(messageInterval);
      clearInterval(iconInterval);
    };
  }, []);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{ 
        height: '100vh', 
        width: '100%', 
        background: 'var(--background, #f5faf8)', 
        display: 'flex', 
        flexDirection: 'column',
        alignItems: 'center', 
        justifyContent: 'center', 
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: 9999,
        overflow: 'hidden'
      }}
    >
      {/* Decorative Background Elements */}
      {isMounted && (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.03 }}>
          {[...Array(15)].map((_, i) => (
            <motion.div
              key={i}
              initial={{ 
                x: Math.random() * 100 + '%', 
                y: Math.random() * 100 + '%',
                rotate: Math.random() * 360,
                scale: Math.random() * 0.5 + 0.5
              }}
              animate={{ 
                y: [null, (Math.random() * 100 - 50) + '%'],
                rotate: [null, Math.random() * 360]
              }}
              transition={{ 
                duration: 20 + Math.random() * 20, 
                repeat: Infinity, 
                repeatType: 'reverse',
                ease: "linear" 
              }}
              style={{ 
                position: 'absolute', 
                fontSize: '2rem', 
                fontFamily: 'serif',
                color: 'var(--accent-primary, #00685f)'
              }}
            >
              {['∑', '∫', 'π', 'Ω', '∂', 'Δ', '∞', 'λ', 'θ', 'Ψ'][i % 10]}
            </motion.div>
          ))}
        </div>
      )}

      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {/* Glowing Backlight */}
        <motion.div
          animate={{ 
            scale: [1, 1.2, 1],
            opacity: [0.1, 0.2, 0.1]
          }}
          transition={{ duration: 4, repeat: Infinity }}
          style={{ 
            position: 'absolute',
            width: '150px',
            height: '150px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, var(--accent-primary, #00685f) 0%, transparent 70%)',
            filter: 'blur(30px)',
            zIndex: -1
          }}
        />

        {/* Dynamic Icon */}
        <motion.div
          key={iconIndex}
          initial={{ scale: 0.8, opacity: 0, rotate: -20 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          exit={{ scale: 1.2, opacity: 0, rotate: 20 }}
          transition={{ duration: 0.8, ease: "backOut" }}
          style={{ color: 'var(--accent-primary, #00685f)', marginBottom: '2.5rem' }}
        >
          {SCHOLARLY_ICONS[iconIndex]}
        </motion.div>

        {/* Brand */}
        <motion.h2
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          style={{ 
            fontSize: '1rem', 
            fontWeight: 900, 
            letterSpacing: '0.4em', 
            color: 'var(--text-primary, #000)',
            textTransform: 'uppercase',
            marginBottom: '0.5rem',
            fontFamily: 'var(--font-outfit)'
          }}
        >
          Latexify
        </motion.h2>

        {/* Dynamic Message */}
        <div style={{ height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <AnimatePresence mode="wait">
            <motion.p
              key={messageIndex}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.4 }}
              style={{ 
                fontSize: '0.75rem', 
                fontWeight: 700, 
                color: 'var(--text-secondary, #666)', 
                letterSpacing: '0.05em',
                margin: 0
              }}
            >
              {LOADING_MESSAGES[messageIndex]}
            </motion.p>
          </AnimatePresence>
        </div>

        {/* Progress Line */}
        <div style={{ 
          marginTop: '2.5rem',
          width: '180px', 
          height: '2px', 
          background: 'rgba(0,0,0,0.03)', 
          borderRadius: '10px', 
          overflow: 'hidden',
          position: 'relative'
        }}>
          <motion.div 
            animate={{ 
              x: [-180, 180]
            }}
            transition={{ 
              duration: 2, 
              repeat: Infinity, 
              ease: "easeInOut" 
            }}
            style={{ 
              position: 'absolute',
              inset: 0,
              width: '100%',
              background: 'linear-gradient(90deg, transparent, var(--accent-primary, #00685f), transparent)'
            }}
          />
        </div>
      </div>
    </motion.div>
  );
}
