"use client";

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Layout, Upload, Download, RefreshCw, Lock, Sparkles } from 'lucide-react';
import { FileItem } from './FileItem';
import toast from 'react-hot-toast';

interface DocSidebarProps {
  sidebarWidth: number;
  files: any[];
  activeFile: string;
  switchTab: (path: string) => void;
  deleteFile: (path: string) => void;
  renameFile: (path: string) => void;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  exportProjectZip: () => void;
  isReadOnly?: boolean;
  compiling?: boolean;
  isLocked?: boolean;
  lockReason?: 'project_limit' | 'ai_tokens_exhausted' | 'credits' | null;
  onLockedAction?: () => void;
}

export const DocSidebar: React.FC<DocSidebarProps> = ({
  sidebarWidth,
  files,
  activeFile,
  switchTab,
  deleteFile,
  renameFile,
  handleFileUpload,
  exportProjectZip,
  isReadOnly = false,
  compiling = false,
  isLocked = false,
  lockReason = null,
  onLockedAction,
}) => {
  const handleLockedClick = (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    if (onLockedAction) {
      onLockedAction();
    }
    if (lockReason === 'project_limit') {
      toast.error('Free plan limit of 7 projects reached. Please subscribe to a plan to continue.', { id: 'sidebar-limit-toast' });
    } else if (lockReason === 'ai_tokens_exhausted') {
      toast.error('Daily LLM tokens exhausted. Actions paused until quota refreshes or upgrade to premium.', { id: 'sidebar-ai-toast' });
    } else {
      toast.error('Credit limit reached. Please upgrade to Premium.', { id: 'sidebar-credit-toast' });
    }
  };

  const effectivelyReadOnly = isReadOnly || isLocked;

  // ── Standard Academic Manuscript File Categories ───────────────
  const categorizedPaths = new Set<string>();

  const categories = [
    {
      name: 'TITLE & METADATA',
      files: files.filter(f => {
        const m = /^metadata\/.+\.(tex|json)$/i.test(f.path);
        if (m) categorizedPaths.add(f.path);
        return m;
      }),
    },
    {
      name: 'BODY SECTIONS',
      files: files.filter(f => {
        const m = /^(?:sections|chapters|paragraphs)\//i.test(f.path) && f.path.endsWith('.tex');
        if (m) categorizedPaths.add(f.path);
        return m;
      }),
    },
    {
      name: 'TABLES',
      files: files.filter(f => {
        const m = /^(?:tables\/|floats\/tables?)/i.test(f.path) && f.path.endsWith('.tex');
        if (m) categorizedPaths.add(f.path);
        return m;
      }),
    },
    {
      name: 'FIGURES',
      files: files.filter(f => {
        const m = /^(?:figures\/|floats\/figures?)/i.test(f.path) && f.path.endsWith('.tex');
        if (m) categorizedPaths.add(f.path);
        return m;
      }),
    },
    {
      name: 'ALGORITHMS',
      files: files.filter(f => {
        const m = /^(?:algorithms\/|floats\/algorithms?)/i.test(f.path) && f.path.endsWith('.tex');
        if (m) categorizedPaths.add(f.path);
        return m;
      }),
    },
    {
      name: 'EQUATIONS',
      files: files.filter(f => {
        const m = /^(?:equations\/|floats\/equations?)/i.test(f.path) && f.path.endsWith('.tex');
        if (m) categorizedPaths.add(f.path);
        return m;
      }),
    },
    {
      name: 'REFERENCES',
      files: files.filter(f => {
        const m = /^references\//i.test(f.path);
        if (m) categorizedPaths.add(f.path);
        return m;
      }),
    },
    {
      name: 'TEMPLATE FILES',
      files: files.filter(f => {
        const m = /\.(cls|sty|bib|bst|cfg|clo|def|ldf)$/i.test(f.path) || /^components\//i.test(f.path);
        if (m) categorizedPaths.add(f.path);
        return m;
      }),
    },
    {
      name: 'IMAGE ASSETS',
      files: (() => {
        const imageFiles = files.filter(f => {
          const isImg = /\.(png|jpg|jpeg|svg|pdf|eps)$/i.test(f.path) || f.path.startsWith('figures/');
          if (isImg) categorizedPaths.add(f.path);
          return isImg;
        });

        const hasRfFigures = imageFiles.some(f => /^rf_fig_\d+/i.test(f.path) || /\/rf_fig_\d+/i.test(f.path));
        const seenBases = new Set<string>();
        const seenContents = new Set<string>();
        const displayed: any[] = [];

        for (const f of imageFiles) {
          const isRf = /^rf_fig_\d+/i.test(f.path) || /\/rf_fig_\d+/i.test(f.path);
          if (isRf) {
            const base = (f.path.split('/').pop() || f.path).toLowerCase();
            if (!seenBases.has(base)) {
              seenBases.add(base);
              if (f.content && typeof f.content === 'string' && f.content.length > 200) {
                seenContents.add(f.content.substring(0, 500));
              }
              displayed.push(f);
            }
          }
        }

        for (const f of imageFiles) {
          const isRf = /^rf_fig_\d+/i.test(f.path) || /\/rf_fig_\d+/i.test(f.path);
          if (!isRf) {
            const base = (f.path.split('/').pop() || f.path).toLowerCase();
            const isInternalDocxAlias = /^image\d+\.(png|jpg|jpeg)$/i.test(base);
            if (hasRfFigures && isInternalDocxAlias) {
              continue;
            }
            if (f.content && typeof f.content === 'string' && f.content.length > 200 && seenContents.has(f.content.substring(0, 500))) {
              continue;
            }
            if (!seenBases.has(base)) {
              seenBases.add(base);
              if (f.content && typeof f.content === 'string' && f.content.length > 200) {
                seenContents.add(f.content.substring(0, 500));
              }
              displayed.push(f);
            }
          }
        }
        return displayed;
      })(),
    },
  ];

  const uncategorized = files.filter(f => !categorizedPaths.has(f.path) && f.path !== 'main.tex');
  const mainFile = files.find(f => f.path === 'main.tex');

  return (
    <motion.aside 
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      style={{ width: sidebarWidth, display: 'flex', flexDirection: 'column', gap: '0.75rem', flexShrink: 0 }}
    >
      <div className="glass-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid var(--border)', borderRadius: '16px', background: 'var(--bg-primary)', backdropFilter: 'blur(10px)' }}>
        
        {/* Workspace header */}
        <div style={{ padding: '0.85rem 1rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Layout size={14} strokeWidth={2} style={{ color: isLocked ? '#ef4444' : 'var(--accent-primary)' }} />
            <span style={{ fontSize: '0.6rem', fontWeight: 900, color: 'var(--ide-icon-muted)', letterSpacing: '0.15em', fontFamily: 'var(--font-headline)' }}>
              WORKSPACE {isLocked ? '(LOCKED)' : ''}
            </span>
          </div>
          {isLocked ? (
            <button
              onClick={handleLockedClick}
              title="Locked under plan limit"
              style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
            >
              <Lock size={14} strokeWidth={2} />
            </button>
          ) : !effectivelyReadOnly ? (
            <label style={{ cursor: 'pointer', color: 'var(--ide-icon-muted)' }}>
              <input type="file" multiple onChange={handleFileUpload} style={{ display: 'none' }} />
              <Upload size={14} strokeWidth={2} />
            </label>
          ) : null}
        </div>

        {/* Locked banner inside sidebar */}
        {isLocked && (
          <div 
            onClick={handleLockedClick}
            style={{
              padding: '0.6rem 0.8rem',
              background: lockReason === 'project_limit' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(168, 85, 247, 0.1)',
              borderBottom: `1px solid ${lockReason === 'project_limit' ? 'rgba(239, 68, 68, 0.25)' : 'rgba(168, 85, 247, 0.25)'}`,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.4rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0 }}>
              <Lock size={13} style={{ color: lockReason === 'project_limit' ? '#ef4444' : '#c084fc', flexShrink: 0 }} />
              <span style={{ fontSize: '0.65rem', fontWeight: 800, color: lockReason === 'project_limit' ? '#f87171' : '#c084fc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {lockReason === 'project_limit' ? '7 Projects Reached' : 'AI Tokens Exhausted'}
              </span>
            </div>
            <span style={{ fontSize: '0.58rem', fontWeight: 900, color: '#fff', background: lockReason === 'project_limit' ? '#ef4444' : '#8b5cf6', padding: '0.15rem 0.4rem', borderRadius: '4px', textTransform: 'uppercase', flexShrink: 0 }}>
              UPGRADE
            </span>
          </div>
        )}

        {/* Modern progressive compiling loader card */}
        <AnimatePresence>
          {compiling && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              style={{ 
                overflow: 'hidden',
                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12), rgba(168, 85, 247, 0.12))',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <div style={{ padding: '0.75rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <RefreshCw className="spinner" size={14} style={{ color: 'var(--accent-primary)' }} />
                    <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '0.08em', fontFamily: 'var(--font-headline)' }}>COMPILING FILES</span>
                  </div>
                  <span className="pulsing-text" style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--accent-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Processing</span>
                </div>
                <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden', position: 'relative' }}>
                  <motion.div 
                    initial={{ left: '-100%' }}
                    animate={{ left: '100%' }}
                    transition={{ repeat: Infinity, duration: 1.6, ease: 'easeInOut' }}
                    style={{ 
                      position: 'absolute', 
                      top: 0, 
                      bottom: 0, 
                      width: '50%', 
                      background: 'linear-gradient(90deg, transparent, var(--accent-primary), var(--accent-secondary), transparent)',
                    }}
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="custom-scroll" style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
          {mainFile && (
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.6rem', fontWeight: 900, color: 'var(--ide-icon-muted)', letterSpacing: '0.1em', padding: '0 0.75rem 0.25rem', textTransform: 'uppercase' }}>DOC2LATEX SOURCE</div>
              <FileItem f={mainFile} activeFile={activeFile} onClick={switchTab} onRename={renameFile} isReadOnly={effectivelyReadOnly} isLocked={isLocked} />
            </div>
          )}
          {categories.map(cat => cat.files.length > 0 && (
            <div key={cat.name} style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.6rem', fontWeight: 900, color: 'var(--ide-icon-muted)', letterSpacing: '0.1em', padding: '0 0.75rem 0.25rem', textTransform: 'uppercase' }}>{cat.name}</div>
              {cat.files.sort((a,b) => {
                const aNum = parseInt(a.path.match(/\d+/)?.[0] || '0');
                const bNum = parseInt(b.path.match(/\d+/)?.[0] || '0');
                return aNum - bNum || a.path.localeCompare(b.path);
              }).map(f => (
                <FileItem key={f.path} f={f} activeFile={activeFile} onClick={switchTab} onDelete={deleteFile} onRename={renameFile} isReadOnly={effectivelyReadOnly} isLocked={isLocked} />
              ))}
            </div>
          ))}
          {uncategorized.length > 0 && (
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.6rem', fontWeight: 900, color: 'var(--ide-icon-muted)', letterSpacing: '0.1em', padding: '0 0.75rem 0.25rem', textTransform: 'uppercase' }}>OTHER FILES</div>
              {uncategorized.sort((a,b) => a.path.localeCompare(b.path)).map(f => (
                <FileItem key={f.path} f={f} activeFile={activeFile} onClick={switchTab} onDelete={deleteFile} onRename={renameFile} isReadOnly={effectivelyReadOnly} isLocked={isLocked} />
              ))}
            </div>
          )}
        </div>
      </div>
      
      <div className="glass-card" style={{ padding: '0.75rem', borderRadius: '16px', border: '1px solid var(--border)', background: 'var(--bg-primary)' }}>
        <button 
          onClick={isLocked ? handleLockedClick : exportProjectZip} 
          style={{ 
            width: '100%', padding: '0.7rem', 
            background: isLocked ? 'rgba(255,255,255,0.03)' : 'var(--ide-btn-bg)', 
            border: `1px solid ${isLocked ? 'rgba(255,255,255,0.08)' : 'var(--ide-btn-border)'}`, 
            borderRadius: '10px', 
            color: isLocked ? '#94a3b8' : 'var(--ide-btn-text)', 
            fontSize: '0.7rem', fontWeight: 800, 
            cursor: isLocked ? 'not-allowed' : 'pointer', 
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem', 
            fontFamily: 'var(--font-headline)', letterSpacing: '0.05em',
            opacity: isLocked ? 0.6 : 1,
          }}
        >
          {isLocked ? <Lock size={14} style={{ color: '#ef4444' }} /> : <Download size={14} strokeWidth={2} style={{ color: 'var(--accent-primary)' }} />} 
          {isLocked ? 'EXPORT LOCKED' : 'EXPORT ARTIFACTS'}
        </button>
      </div>
    </motion.aside>
  );
};
