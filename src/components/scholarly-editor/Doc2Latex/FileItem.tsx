import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Trash2, Pencil } from 'lucide-react';

interface FileItemProps {
  f: any;
  activeFile: string;
  onClick: (path: string) => void;
  onDelete?: (path: string) => void;
  onRename?: (path: string) => void;
  isReadOnly?: boolean;
}

export const FileItem: React.FC<FileItemProps> = ({ f, activeFile, onClick, onDelete, onRename, isReadOnly = false }) => {
  const [hovered, setHovered] = useState(false);
  const isActive = activeFile === f.path;
  const isMain = f.path === 'main.tex';
  const showActions = !isMain && !isReadOnly && (hovered || isActive);

  return (
    <motion.div 
      whileHover={{ x: 2 }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      onClick={() => onClick(f.path)} 
      style={{ 
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.45rem 0.75rem', borderRadius: '8px', cursor: 'pointer',
        background: isActive ? 'var(--accent-glow)' : hovered ? 'rgba(255,255,255,0.04)' : 'transparent',
        color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
        marginBottom: '1px', fontSize: '11pt', fontWeight: isActive ? 700 : 500, transition: 'all 0.15s', fontFamily: 'var(--font-headline)'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', overflow: 'hidden', minWidth: 0 }}>
        <div style={{ width: 4, height: 4, borderRadius: '50%', flexShrink: 0, background: isActive ? 'var(--accent-primary)' : 'var(--border)' }} />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.path}</span>
      </div>
      {showActions && (
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexShrink: 0, marginLeft: '0.5rem' }}>
          {onRename && (
            <button 
              onClick={(e) => { e.stopPropagation(); onRename(f.path); }} 
              style={{ background: 'transparent', border: 'none', color: 'inherit', opacity: 0.6, cursor: 'pointer', padding: '2px 3px', display: 'flex', alignItems: 'center', borderRadius: '4px', transition: 'opacity 0.15s' }}
              onMouseOver={e => { e.currentTarget.style.opacity = '1'; }}
              onMouseOut={e => { e.currentTarget.style.opacity = '0.6'; }}
              title="Rename File"
            >
              <Pencil size={11} />
            </button>
          )}
          {onDelete && (
            <button 
              onClick={(e) => { e.stopPropagation(); onDelete(f.path); }} 
              style={{ background: 'transparent', border: 'none', color: 'inherit', opacity: 0.6, cursor: 'pointer', padding: '2px 3px', display: 'flex', alignItems: 'center', borderRadius: '4px', transition: 'all 0.15s' }}
              onMouseOver={e => { e.currentTarget.style.opacity = '1'; (e.currentTarget as HTMLElement).style.color = '#ef4444'; }}
              onMouseOut={e => { e.currentTarget.style.opacity = '0.6'; (e.currentTarget as HTMLElement).style.color = 'inherit'; }}
              title="Delete File"
            >
              <Trash2 size={11} />
            </button>
          )}
        </div>
      )}
    </motion.div>
  );
};
