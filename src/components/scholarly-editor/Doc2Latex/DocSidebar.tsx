"use client";

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Layout, Upload, Download, RefreshCw } from 'lucide-react';
import { FileItem } from './FileItem';

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
  compiling = false
}) => {
  // ── Standard Academic Manuscript File Categories ───────────────
  // Track which files matched a known category so uncategorized ones can be shown
  const categorizedPaths = new Set<string>();

  const categories = [
    {
      name: 'TITLE & METADATA',
      files: files.filter(f => {
        const m = /^metadata\/(?:title|authors|affiliations|abstract|keywords|acknowledgements|frontmatter|organizations)\.tex$/i.test(f.path);
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
        const m = /^floats\/tables\.tex$/i.test(f.path) || /^tables\/table_\d+\.tex$/i.test(f.path);
        if (m) categorizedPaths.add(f.path);
        return m;
      }),
    },
    {
      name: 'FIGURES',
      files: files.filter(f => {
        const m = /^floats\/figures\.tex$/i.test(f.path) || /^figures\/figure_\d+\.tex$/i.test(f.path);
        if (m) categorizedPaths.add(f.path);
        return m;
      }),
    },
    {
      name: 'ALGORITHMS',
      files: files.filter(f => {
        const m = /^floats\/algorithms\.tex$/i.test(f.path) || /^algorithms\/algo_\d+\.tex$/i.test(f.path);
        if (m) categorizedPaths.add(f.path);
        return m;
      }),
    },
    {
      name: 'EQUATIONS',
      files: files.filter(f => {
        const m = /^floats\/equations\.tex$/i.test(f.path) || /^equations\/eq_\d+\.tex$/i.test(f.path);
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
        const imageFiles = files.filter(f => /\.(png|jpg|jpeg|gif|svg|webp|eps|tiff?|bmp|heic|heif|avif)$/i.test(f.path));
        imageFiles.forEach(f => categorizedPaths.add(f.path));
        
        const hasRfFigures = imageFiles.some(f => /^rf_fig_\d+/i.test(f.path) || /\/rf_fig_\d+/i.test(f.path));
        const seenBases = new Set<string>();
        const seenContents = new Set<string>();
        const displayed: any[] = [];

        // 1. First pass: Add canonical rf_fig_* images
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

        // 2. Second pass: Add non-rf images if not duplicating an rf_fig
        for (const f of imageFiles) {
          const isRf = /^rf_fig_\d+/i.test(f.path) || /\/rf_fig_\d+/i.test(f.path);
          if (!isRf) {
            const base = (f.path.split('/').pop() || f.path).toLowerCase();
            const isInternalDocxAlias = /^image\d+\.(png|jpg|jpeg)$/i.test(base);
            // If canonical rf_fig_* exist, suppress raw internal image1.png duplicates
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
  // Catch-all: show any file not matched by the above categories
  const uncategorized = files.filter(f => !categorizedPaths.has(f.path) && f.path !== 'main.tex');
  const mainFile = files.find(f => f.path === 'main.tex');

  return (
    <motion.aside 
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      style={{ width: sidebarWidth, display: 'flex', flexDirection: 'column', gap: '0.75rem', flexShrink: 0 }}
    >
      <div className="glass-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid var(--border)', borderRadius: '16px', background: 'var(--bg-primary)', backdropFilter: 'blur(10px)' }}>
        <div style={{ padding: '0.85rem 1rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Layout size={14} strokeWidth={2} style={{ color: 'var(--accent-primary)' }} />
            <span style={{ fontSize: '0.6rem', fontWeight: 900, color: 'var(--ide-icon-muted)', letterSpacing: '0.15em', fontFamily: 'var(--font-headline)' }}>WORKSPACE</span>
          </div>
          {!isReadOnly && (
            <label style={{ cursor: 'pointer', color: 'var(--ide-icon-muted)' }}>
              <input type="file" multiple onChange={handleFileUpload} style={{ display: 'none' }} />
              <Upload size={14} strokeWidth={2} />
            </label>
          )}
        </div>

        {/* MODERN PROGRESSIVE COMPILING LOADER CARD */}
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
                {/* Progressive loading bar */}
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
              <FileItem f={mainFile} activeFile={activeFile} onClick={switchTab} onDelete={deleteFile} onRename={renameFile} isReadOnly={isReadOnly} />
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
                <FileItem key={f.path} f={f} activeFile={activeFile} onClick={switchTab} onDelete={deleteFile} onRename={renameFile} isReadOnly={isReadOnly} />
              ))}
            </div>
          ))}
          {uncategorized.length > 0 && (
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.6rem', fontWeight: 900, color: 'var(--ide-icon-muted)', letterSpacing: '0.1em', padding: '0 0.75rem 0.25rem', textTransform: 'uppercase' }}>OTHER FILES</div>
              {uncategorized.sort((a,b) => a.path.localeCompare(b.path)).map(f => (
                <FileItem key={f.path} f={f} activeFile={activeFile} onClick={switchTab} onDelete={deleteFile} onRename={renameFile} isReadOnly={isReadOnly} />
              ))}
            </div>
          )}
        </div>
      </div>
      
      <div className="glass-card" style={{ padding: '0.75rem', borderRadius: '16px', border: '1px solid var(--border)', background: 'var(--bg-primary)' }}>
        <button onClick={exportProjectZip} style={{ width: '100%', padding: '0.7rem', background: 'var(--ide-btn-bg)', border: '1px solid var(--ide-btn-border)', borderRadius: '10px', color: 'var(--ide-btn-text)', fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem', fontFamily: 'var(--font-headline)', letterSpacing: '0.05em' }}>
          <Download size={14} strokeWidth={2} style={{ color: 'var(--accent-primary)' }} /> EXPORT ARTIFACTS
        </button>
      </div>
    </motion.aside>
  );
};
