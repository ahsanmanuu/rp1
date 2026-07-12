"use client";
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot } from 'lucide-react';

const LOADING_MESSAGES = [
  "Initializing Latexify Environment...",
  "Calibrating LaTeX engine...",
  "Loading manuscript templates...",
  "Synchronizing citation database...",
  "Preparing academic design tokens..."
];

export default function StudioLoadingScreen() {
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ 
      height: '100vh', width: '100vw', background: '#050505', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', color: '#fff', gap: '2rem'
    }}>
      <motion.div
        animate={{ 
          scale: [1, 1.2, 1],
          rotate: [0, 10, -10, 0],
          filter: ['drop-shadow(0 0 10px var(--accent-primary))', 'drop-shadow(0 0 30px var(--accent-primary))', 'drop-shadow(0 0 10px var(--accent-primary))']
        }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        style={{ color: 'var(--accent-primary)' }}
      >
        <Bot size={64} />
      </motion.div>
      
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 800, letterSpacing: '0.1em', color: 'var(--accent-primary)' }}>LATEXIFY STUDIO</h2>
        <div style={{ height: '1.5rem', display: 'flex', alignItems: 'center' }}>
          <AnimatePresence mode="wait">
            <motion.p 
              key={messageIndex}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.3 }}
              style={{ fontSize: '0.75rem', color: '#888', fontWeight: 500, margin: 0 }}
            >
              {LOADING_MESSAGES[messageIndex]}
            </motion.p>
          </AnimatePresence>
        </div>
      </div>

      <div style={{ 
        width: '200px', height: '2px', background: 'rgba(255,255,255,0.05)', borderRadius: '1px', overflow: 'hidden', position: 'relative' 
      }}>
        <motion.div 
          animate={{ x: [-200, 200] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
          style={{ 
            position: 'absolute', inset: 0, width: '100%', background: 'linear-gradient(90deg, transparent, var(--accent-primary), transparent)' 
          }}
        />
      </div>
    </div>
  );
}
