'use client';

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, RefreshCw, Home, ShieldAlert } from 'lucide-react';
import Link from 'next/link';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('[GLOBAL_ERROR_BOUNDARY]', error);
  }, [error]);

  const isPrismaLock = error.message?.includes('locked') || error.message?.includes('EBUSY');

  return (
    <div style={{
      height: '100vh',
      width: '100vw',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#050505',
      color: '#fff',
      fontFamily: 'Inter, system-ui, sans-serif',
      padding: '2rem',
      textAlign: 'center'
    }}>
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.05)',
          borderRadius: '24px',
          padding: '3rem',
          maxWidth: '600px',
          boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1.5rem'
        }}
      >
        <div style={{
          width: '80px',
          height: '80px',
          borderRadius: '20px',
          background: isPrismaLock ? 'rgba(56, 189, 248, 0.1)' : 'rgba(239, 68, 68, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '1rem'
        }}>
          {isPrismaLock ? (
            <ShieldAlert size={40} color="#38bdf8" />
          ) : (
            <AlertTriangle size={40} color="#ef4444" />
          )}
        </div>

        <h1 style={{ fontSize: '1.75rem', fontWeight: 900, letterSpacing: '-0.03em', margin: 0 }}>
          {isPrismaLock ? 'Infrastructure Interruption' : 'Scholarly Pipeline Exception'}
        </h1>

        <p style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.6, margin: 0 }}>
          {isPrismaLock 
            ? 'The database is currently undergoing maintenance or is locked by another process. This is common in development environments.'
            : 'An unexpected exception occurred in the scholarly engine. Our diagnostics have been notified.'}
        </p>

        <div style={{
          background: 'rgba(0,0,0,0.3)',
          padding: '1rem',
          borderRadius: '12px',
          width: '100%',
          fontSize: '0.85rem',
          fontFamily: 'monospace',
          color: '#ef4444',
          border: '1px solid rgba(239, 68, 68, 0.1)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          {typeof error?.message === 'string' ? error.message : (error?.message ? JSON.stringify(error.message) : 'Unknown Runtime Exception')}
        </div>

        <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => reset()}
            style={{
              background: 'var(--accent-primary, #10b981)',
              color: '#fff',
              border: 'none',
              padding: '0.75rem 1.5rem',
              borderRadius: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <RefreshCw size={18} />
            Try Again
          </motion.button>

          <Link href="/" style={{ textDecoration: 'none' }}>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              style={{
                background: 'rgba(255,255,255,0.05)',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.1)',
                padding: '0.75rem 1.5rem',
                borderRadius: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              <Home size={18} />
              Return Home
            </motion.button>
          </Link>
        </div>
      </motion.div>
      
      <div style={{ marginTop: '2rem', fontSize: '0.75rem', opacity: 0.3, letterSpacing: '0.1em', fontWeight: 600 }}>
        LATEXIFY SCHOLARLY SUITE &copy; 2026
      </div>
    </div>
  );
}
