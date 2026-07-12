"use client";
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertOctagon, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class StudioErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = '/dashboard';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{ 
          height: '100vh', width: '100vw', background: '#050505', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', color: '#fff', textAlign: 'center', padding: '2rem'
        }}>
          <div style={{ 
            padding: '3rem', borderRadius: '32px', background: 'rgba(255,50,50,0.05)', 
            border: '1px solid rgba(255,50,50,0.1)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem',
            maxWidth: '500px', backdropFilter: 'blur(20px)'
          }}>
            <div style={{ 
              width: 64, height: 64, borderRadius: '20px', background: 'rgba(239, 68, 68, 0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <AlertOctagon size={32} color="#ef4444" />
            </div>
            
            <h1 style={{ fontSize: '1.5rem', fontWeight: 900, fontFamily: 'var(--font-headline)', letterSpacing: '-0.02em' }}>
              Studio Interrupted
            </h1>
            
            <p style={{ color: '#888', fontSize: '0.85rem', lineHeight: 1.6 }}>
              The Latexify environment encountered an unexpected runtime exception. Your file progress in IndexedDB is likely safe.
            </p>

            <div style={{ 
              width: '100%', padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '12px',
              border: '1px solid rgba(255,255,255,0.05)', fontSize: '0.7rem', color: '#666', 
              fontFamily: 'var(--font-mono)', textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis'
            }}>
              {this.state.error?.message}
            </div>

            <div style={{ display: 'flex', gap: '1rem', width: '100%', marginTop: '1rem' }}>
              <button 
                onClick={this.handleReset}
                style={{ 
                  flex: 1, padding: '0.8rem', borderRadius: '12px', background: 'var(--accent-primary)', 
                  color: '#fff', border: 'none', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
                }}
              >
                <RefreshCw size={14} /> SOFT RESET
              </button>
              <button 
                onClick={this.handleGoHome}
                style={{ 
                  padding: '0.8rem 1.5rem', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', 
                  color: '#fff', border: '1px solid rgba(255,255,255,0.06)', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
                }}
              >
                <Home size={14} /> EXIT
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
