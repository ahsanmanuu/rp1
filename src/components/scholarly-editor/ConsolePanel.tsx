"use client";
import './editor-shared.css';
import React, { useState, useEffect } from 'react';
import { Terminal, AlertCircle, AlertTriangle, Info, ChevronUp, ChevronDown, ChevronRight, XCircle, Copy, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { type DiagnosticError } from '@/lib/studio-core/compiler-utils';
import toast from 'react-hot-toast';

interface ConsolePanelProps {
  errors: DiagnosticError[];
  log: string;
  isOpen: boolean;
  onToggle: () => void;
  onJumpToLine: (line: number, path?: string) => void;
  projectId: string;
  title?: string;
  compiling?: boolean;
}

export default function ConsolePanel({ 
  errors, 
  log, 
  isOpen, 
  onToggle, 
  onJumpToLine, 
  projectId,
  title = "LATEXIFY DIAGNOSTIC CORE",
  compiling = false
}: ConsolePanelProps) {
  const [height, setHeight] = useState(300);
  const [isResizing, setIsResizing] = useState(false);
  const [activeTab, setActiveTab] = useState<'problems' | 'log'>('problems');
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!log) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(log);
        setCopied(true);
        toast.success("Log copied to clipboard", { id: 'console-copy' });
        setTimeout(() => setCopied(false), 2000);
        return;
      }
    } catch (err) {
      console.warn("Failed to copy log with navigator.clipboard:", err);
    }

    try {
      const textarea = document.createElement("textarea");
      textarea.value = log;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      const success = document.execCommand("copy");
      document.body.removeChild(textarea);
      if (success) {
        setCopied(true);
        toast.success("Log copied to clipboard", { id: 'console-copy' });
        setTimeout(() => setCopied(false), 2000);
        return;
      }
    } catch (fallbackErr) {
      console.error("Fallback copy failed:", fallbackErr);
    }

    toast.error("Failed to copy log. Please select and copy manually.", { id: 'console-copy' });
  };

  useEffect(() => {
    const savedHeight = localStorage.getItem(`console_height_${projectId}`);
    if (savedHeight) setHeight(parseInt(savedHeight));
  }, [projectId]);

  useEffect(() => {
    if (errors.length > 0 && activeTab === 'log') {
      setActiveTab('problems');
    }
  }, [errors, activeTab]);

  useEffect(() => {
    if (isResizing) {
      const handleMouseMove = (e: MouseEvent) => {
        const newHeight = Math.max(100, Math.min(window.innerHeight * 0.7, window.innerHeight - e.clientY));
        setHeight(newHeight);
      };
      const handleMouseUp = () => {
        setIsResizing(false);
        localStorage.setItem(`console_height_${projectId}`, height.toString());
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isResizing]);

  const errorCount = errors.filter(e => e.type === 'error').length;
  const warningCount = errors.filter(e => e.type === 'warning').length;

  const renderLinkedLog = (rawLog: string) => {
    if (!rawLog) return '\u003E Diagnostic stream empty.';
    
    const lines = rawLog.split('\n');
    return lines.map((line, i) => {
      const match = line.match(/^(.*?):(\d+):/);
      if (match) {
        const filePath = match[1].replace(/^\.\//, '');
        const lineNum = parseInt(match[2]);
        const rest = line.substring(match[0].length);
        
        return (
          <div key={i} style={{ whiteSpace: 'pre-wrap' }}>
            <span 
              onClick={() => onJumpToLine(lineNum, filePath)}
              className="log-link"
              style={{ 
                color: 'var(--accent-primary)', 
                cursor: 'pointer', 
                fontWeight: 700,
                textDecoration: 'underline',
                textDecorationStyle: 'dotted'
              }}
            >
              {match[1]}:{match[2]}:
            </span>
            {rest}
          </div>
        );
      }
      return <div key={i}>{line}</div>;
    });
  };

  return (
    <div style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-primary)', position: 'relative', width: '100%', zIndex: 50 }}>
      {/* Resizer Handle */}
      {isOpen && (
        <div 
          onMouseDown={() => setIsResizing(true)}
          style={{ 
            position: 'absolute', top: -3, left: 0, right: 0, height: 6, cursor: 'ns-resize', zIndex: 60,
            background: isResizing ? 'var(--accent-primary)' : 'var(--ide-divider)'
          }} 
        />
      )}

      {/* Header Bar */}
      <div 
        onClick={onToggle}
        style={{ 
          height: '40px', padding: '0 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer',
          background: 'var(--bg-secondary)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <div style={{ 
            display: 'flex', alignItems: 'center', gap: '0.6rem', 
            color: compiling ? 'var(--text-primary)' : 'var(--accent-primary)', 
            fontSize: '0.8rem', fontWeight: 900, letterSpacing: '0.1em', 
            fontFamily: 'var(--font-headline)',
            animation: compiling ? 'pulse-core 1.5s infinite ease-in-out' : 'none'
          }}>
             <Terminal size={14} strokeWidth={2} className={compiling ? 'spinner' : ''} style={{ opacity: compiling ? 1 : 0.8 }} /> 
             {compiling ? "GRAFTING SOURCE..." : title.toUpperCase()}
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', pointerEvents: 'none' }}>
              <XCircle size={12} color={errorCount > 0 ? '#ef4444' : '#333'} />
              <span style={{ fontSize: '0.65rem', color: errorCount > 0 ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: 700 }}>{errorCount}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', pointerEvents: 'none' }}>
              <AlertTriangle size={12} color={warningCount > 0 ? '#f59e0b' : '#333'} />
              <span style={{ fontSize: '0.65rem', color: warningCount > 0 ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: 700 }}>{warningCount}</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {log && (
            <button
               onClick={(e) => handleCopy(e)}
               title="Copy Raw Log"
               style={{ 
                 display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'var(--ide-btn-bg)', 
                 border: '1px solid var(--ide-btn-border)', borderRadius: '6px', padding: '0.2rem 0.5rem', 
                 cursor: 'pointer', color: copied ? 'var(--accent-primary)' : 'var(--text-secondary)', transition: 'all 0.2s',
                 fontSize: '0.6rem', fontWeight: 800
               }}
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? "COPIED" : "COPY LOG"}
            </button>
          )}

          <div style={{ display: 'flex', borderRadius: '6px', background: 'var(--ide-group-bg)', padding: '2px', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
            <button 
              onClick={() => setActiveTab('problems')}
              style={{ padding: '0.3rem 0.8rem', fontSize: '0.75rem', fontWeight: 800, background: activeTab === 'problems' ? 'var(--ide-btn-bg)' : 'transparent', color: activeTab === 'problems' ? 'var(--text-primary)' : 'var(--text-secondary)', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              PROBLEMS
            </button>
            <button 
              onClick={() => setActiveTab('log')}
              style={{ padding: '0.3rem 0.8rem', fontSize: '0.75rem', fontWeight: 800, background: activeTab === 'log' ? 'var(--ide-btn-bg)' : 'transparent', color: activeTab === 'log' ? 'var(--text-primary)' : 'var(--text-secondary)', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              RAW LOG
            </button>
          </div>
          <ChevronRight size={14} style={{ transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.3s', opacity: 0.4, color: 'var(--text-primary)' }} />
        </div>
      </div>

      {/* Content Area */}
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ height: 0 }}
            animate={{ height }}
            exit={{ height: 0 }}
            style={{ overflow: 'hidden', borderTop: '1px solid var(--border)' }}
          >
            {activeTab === 'problems' ? (
              <div className="custom-scroll" style={{ height: '100%', overflowY: 'auto' }}>
                {errors.length === 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', opacity: 0.2, gap: '0.5rem' }}>
                    <Info size={32} />
                    <span style={{ fontSize: '0.7rem', fontWeight: 700 }}>No issues detected in current build</span>
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-secondary)', zIndex: 10, borderBottom: '1px solid var(--border)' }}>
                      <tr>
                        <th style={{ textAlign: 'left', padding: '0.6rem 1.25rem', color: 'var(--text-secondary)', fontWeight: 900, fontSize: '0.7rem' }}>TYPE</th>
                        <th style={{ textAlign: 'left', padding: '0.6rem 1.25rem', color: 'var(--text-secondary)', fontWeight: 900, fontSize: '0.7rem' }}>FILE : LINE</th>
                        <th style={{ textAlign: 'left', padding: '0.6rem 1.25rem', color: 'var(--text-secondary)', fontWeight: 900, fontSize: '0.7rem' }}>DESCRIPTION</th>
                      </tr>
                    </thead>
                    <tbody>
                      {errors.map((err, i) => (
                        <tr 
                          key={i} 
                          onClick={() => err.line > 0 && onJumpToLine(err.line, err.file)}
                          style={{ borderBottom: '1px solid var(--border)', cursor: err.line > 0 ? 'pointer' : 'default', transition: 'all 0.15s' }}
                          className="hover-row"
                        >
                          <td style={{ padding: '0.75rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            {err.type === 'error' ? <AlertCircle size={14} color="#ef4444" /> : <AlertTriangle size={14} color="#f59e0b" />}
                            <span style={{ color: err.type === 'error' ? '#ef4444' : '#f59e0b', fontWeight: 800, textTransform: 'uppercase', fontSize: '0.7rem' }}>{err.type}</span>
                          </td>
                          <td style={{ padding: '0.75rem 1.25rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                            {err.file ? <span style={{ color: 'var(--accent-primary)', fontWeight: 700, marginRight: '4px' }}>{err.file}</span> : ''}
                            {err.line > 0 ? `L${err.line}` : '--'}
                          </td>
                          <td style={{ padding: '0.75rem 1.25rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                            {err.message}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ) : (
              <div className="custom-scroll" style={{ margin: 0, padding: '1.25rem', height: '100%', overflowY: 'auto', fontSize: '0.8rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                {renderLinkedLog(log)}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>


    </div>
  );
}
