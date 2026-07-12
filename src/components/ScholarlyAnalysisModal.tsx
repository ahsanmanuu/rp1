"use client";
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileSearch, Sparkles, Database, Cpu, SearchCode, Wand2 } from 'lucide-react';

const ANALYSIS_STEPS = [
  { id: 'parsing',    text: "Parsing Document DNA...",        icon: <FileSearch size={28} />, color: 'var(--accent-primary)' },
  { id: 'extracting',text: "Extracting Visual Assets...",     icon: <SearchCode size={28} />, color: '#0ea5e9' },
  { id: 'synthesizing', text: "Synthesizing LaTeX Structure...",icon: <Cpu size={28} />,       color: '#10b981' },
  { id: 'mapping',   text: "Mapping Latexify Identity...",    icon: <Database size={28} />,  color: '#f59e0b' },
  { id: 'finalizing',text: "Finalizing Intelligence Report...",icon: <Sparkles size={28} />,  color: '#ec4899' },
  { id: 'ai_agent',  text: "Doc2LaTeX AI Agent Running...",   icon: <Wand2 size={28} />,     color: '#8b5cf6' },
];

export default function ScholarlyAnalysisModal({ isOpen, progress = 0, activeModel }: { isOpen: boolean; progress?: number; activeModel?: string }) {
  // Ensure progress is safely bounded between 0 and 100
  const safeProgress = Math.max(0, Math.min(100, progress));
  
  // Calculate step dynamically based on true progress
  const stepIndex = Math.min(
    ANALYSIS_STEPS.length - 1,
    Math.floor((safeProgress / 100) * ANALYSIS_STEPS.length)
  );

  const currentStep = ANALYSIS_STEPS[stepIndex];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            background: 'rgba(0, 0, 0, 0.2)', // Slightly darker for better contrast
            backdropFilter: 'blur(30px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem'
          }}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: -10 }}
            className="bg-[var(--joy-surface)] border border-slate-200 dark:border-white/20 shadow-2xl"
            style={{
              width: '100%',
              maxWidth: '440px',
              borderRadius: '24px',
              padding: '3rem 2rem',
              position: 'relative',
              overflow: 'hidden',
              textAlign: 'center'
            }}
          >
            {/* Dynamic Glow */}
            <motion.div 
              animate={{ 
                  opacity: [0.15, 0.25, 0.15],
                  scale: [1, 1.1, 1]
              }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              style={{ 
                  position: 'absolute', top: '-10%', left: '-10%', width: '120%', height: '120%', 
                  background: `radial-gradient(circle at center, ${currentStep.color} 0%, transparent 70%)`,
                  pointerEvents: 'none', zIndex: 0, filter: 'blur(40px)'
              }} 
            />

            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ position: 'relative', width: '120px', height: '120px', margin: '0 auto 2.5rem' }}>
                  {/* Outer Rotating Ring */}
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                    style={{
                      position: 'absolute', inset: 0, border: '1px dashed rgba(0, 104, 95, 0.3)', borderRadius: '50%'
                    }}
                  />
                  
                  {/* True Progress Circle */}
                  <svg width="120" height="120" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)', position: 'absolute', top: 0, left: 0 }}>
                      <circle cx="50" cy="50" r="48" fill="none" stroke="rgba(0,0,0,0.05)" strokeWidth="2" />
                      <motion.circle 
                          cx="50" cy="50" r="48" fill="none" 
                          stroke={currentStep.color} 
                          strokeWidth="3" 
                          strokeDasharray="301.6"
                          animate={{ strokeDashoffset: 301.6 - (301.6 * safeProgress / 100) }}
                          transition={{ duration: 0.1, ease: "linear" }}
                          strokeLinecap="round"
                      />
                  </svg>

                  {/* Document Icon with Scanning Line */}
                  <div 
                    className="bg-white dark:bg-black/40 border border-slate-100 dark:border-white/10"
                    style={{ 
                      position: 'absolute', inset: '15px', borderRadius: '50%', 
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: '0 10px 25px rgba(0,0,0,0.08)',
                      overflow: 'hidden'
                  }}>
                      <AnimatePresence mode="wait">
                          <motion.div
                              key={stepIndex}
                              initial={{ opacity: 0, scale: 0.8, rotate: -10 }}
                              animate={{ opacity: 1, scale: 1, rotate: 0 }}
                              exit={{ opacity: 0, scale: 0.8, rotate: 10 }}
                              transition={{ duration: 0.4 }}
                              style={{ color: currentStep.color }}
                          >
                              {currentStep.icon}
                          </motion.div>
                      </AnimatePresence>
                      
                      {/* Scanning Animation Line */}
                      <motion.div
                        animate={{ top: ['0%', '100%', '0%'] }}
                        transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
                        style={{
                          position: 'absolute', left: 0, right: 0, height: '2px',
                          background: `linear-gradient(90deg, transparent, ${currentStep.color}, transparent)`,
                          boxShadow: `0 0 15px ${currentStep.color}`,
                          zIndex: 2,
                          opacity: 0.8
                        }}
                      />
                  </div>
              </div>

              <h2 style={{ 
                  fontSize: '1.75rem', fontWeight: 900, color: 'var(--joy-on-surface)', 
                  marginBottom: '0.75rem', letterSpacing: '-0.04em', fontFamily: 'var(--font-inter)' 
              }}>
                Latexify AI Analysis
              </h2>

              <div style={{ height: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AnimatePresence mode="wait">
                  <motion.p
                    key={stepIndex}
                    initial={{ opacity: 0, filter: 'blur(4px)', y: 5 }}
                    animate={{ opacity: 1, filter: 'blur(0px)', y: 0 }}
                    exit={{ opacity: 0, filter: 'blur(4px)', y: -5 }}
                    transition={{ duration: 0.3 }}
                    style={{ 
                      fontSize: '0.9rem', color: 'var(--joy-secondary)', fontWeight: 700, margin: 0,
                      fontFamily: 'var(--font-inter)', textTransform: 'uppercase', letterSpacing: '0.05em'
                    }}
                  >
                    {currentStep.text}
                  </motion.p>
                </AnimatePresence>
              </div>

              <div 
                className="bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10"
                style={{ marginTop: '3rem', padding: '1rem', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}
              >
                  <div style={{ fontSize: '0.7rem', fontWeight: 900, color: currentStep.color, letterSpacing: '0.1em' }}>
                      ENGINE STATUS: {safeProgress >= 100 ? 'COMPLETE' : 'OPTIMIZING'}
                  </div>
                  <motion.div 
                    animate={{ opacity: [1, 0.4, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                    style={{ width: '6px', height: '6px', borderRadius: '50%', background: currentStep.color, boxShadow: `0 0 8px ${currentStep.color}` }} 
                  />
                  <div style={{ fontSize: '0.7rem', fontWeight: 900, color: 'var(--joy-secondary)', opacity: 0.8 }}>
                      {Math.round(safeProgress)}% COMPLETE
                  </div>
                  {activeModel && (
                    <div style={{ fontSize: '0.65rem', color: 'var(--joy-secondary)', opacity: 0.6, width: '100%', textAlign: 'center', marginTop: '4px' }}>
                      AI Model: {activeModel}
                    </div>
                  )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
