"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Layout, Upload, Download } from 'lucide-react';
import { FileItem } from './FileItem';

interface DocSidebarProps {
  sidebarWidth: number;
  files: any[];
  activeFile: string;
  switchTab: (path: string) => void;
  deleteFile: (path: string) => void;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  exportProjectZip: () => void;
  isReadOnly?: boolean;
}

export const DocSidebar: React.FC<DocSidebarProps> = ({
  sidebarWidth,
  files,
  activeFile,
  switchTab,
  deleteFile,
  handleFileUpload,
  exportProjectZip,
  isReadOnly = false
}) => {
  // ── Standard Academic Manuscript File Categories ───────────────
  // Matches actual paths produced by ModularLatexAssembler:
  //   metadata/*  |  sections/*  |  tables/*  |  figures/*
  //   algorithms/*  |  references/*  |  assets (images)  |  template files
  const categories = [
    {
      name: 'TITLE & METADATA',
      files: files.filter(f =>
        /^metadata\/(?:title|authors|affiliations|abstract|keywords|acknowledgements|frontmatter|organizations)\.tex$/i.test(f.path)
      ),
    },
    {
      name: 'BODY SECTIONS',
      files: files.filter(f => /^sections\//.test(f.path) && f.path.endsWith('.tex')),
    },
    {
      name: 'TABLES',
      files: files.filter(f => /^floats\/tables\.tex$/i.test(f.path) || /^tables\/table_\d+\.tex$/i.test(f.path)),
    },
    {
      name: 'FIGURES',
      files: files.filter(f => /^floats\/figures\.tex$/i.test(f.path) || /^figures\/figure_\d+\.tex$/i.test(f.path)),
    },
    {
      name: 'ALGORITHMS',
      files: files.filter(f => /^floats\/algorithms\.tex$/i.test(f.path) || /^algorithms\/algo_\d+\.tex$/i.test(f.path)),
    },
    {
      name: 'EQUATIONS',
      files: files.filter(f => /^floats\/equations\.tex$/i.test(f.path)),
    },
    {
      name: 'REFERENCES',
      files: files.filter(f => /^references\//i.test(f.path)),
    },
    {
      name: 'IMAGE ASSETS',
      files: files.filter(f => /\.(png|jpg|jpeg|gif|svg|webp|eps|pdf|heic|heif|tiff|tif|bmp|avif)$/i.test(f.path) && !f.path.includes('/')),
    },
    {
      name: 'TEMPLATE FILES',
      files: files.filter(f =>
        /\.(cls|sty|bib|bst|cfg|clo|def|ldf)$/i.test(f.path) ||
        // Legacy components/ folder support (backwards compat)
        /^components\//i.test(f.path)
      ),
    },
  ];
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
        <div className="custom-scroll" style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
          {mainFile && (
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.6rem', fontWeight: 900, color: 'var(--ide-icon-muted)', letterSpacing: '0.1em', padding: '0 0.75rem 0.25rem', textTransform: 'uppercase' }}>DOC2LATEX SOURCE</div>
              <FileItem f={mainFile} activeFile={activeFile} onClick={switchTab} onDelete={deleteFile} isReadOnly={isReadOnly} />
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
                <FileItem key={f.path} f={f} activeFile={activeFile} onClick={switchTab} onDelete={deleteFile} isReadOnly={isReadOnly} />
              ))}
            </div>
          ))}
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
