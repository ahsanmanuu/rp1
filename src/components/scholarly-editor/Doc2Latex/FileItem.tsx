"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Trash2 } from 'lucide-react';

interface FileItemProps {
  f: any;
  activeFile: string;
  onClick: (path: string) => void;
  onDelete: (path: string) => void;
  isReadOnly?: boolean;
}

export const FileItem: React.FC<FileItemProps> = ({ f, activeFile, onClick, onDelete, isReadOnly = false }) => {
  return (
    <motion.div 
      whileHover={{ x: 2, background: 'rgba(255,255,255,0.02)' }}
      onClick={() => onClick(f.path)} 
      style={{ 
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.45rem 0.75rem', borderRadius: '8px', cursor: 'pointer',
        background: activeFile === f.path ? 'var(--accent-glow)' : 'transparent',
        color: activeFile === f.path ? 'var(--accent-primary)' : 'var(--text-secondary)',
        marginBottom: '1px', fontSize: '11pt', fontWeight: activeFile === f.path ? 700 : 500, transition: 'all 0.15s', fontFamily: 'var(--font-headline)'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', overflow: 'hidden' }}>
        <div style={{ width: 4, height: 4, borderRadius: '50%', background: activeFile === f.path ? 'var(--accent-primary)' : 'var(--border)' }} />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.path}</span>
      </div>
      {activeFile === f.path && f.path !== 'main.tex' && !isReadOnly && (
        <Trash2 size={10} onClick={(e) => { e.stopPropagation(); onDelete(f.path); }} style={{ opacity: 0.4 }} />
      )}
    </motion.div>
  );
};
