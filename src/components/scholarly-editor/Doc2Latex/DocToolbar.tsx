"use client";

import { 
  Plus, Edit2, Pencil, Sparkles, Zap, Command, RefreshCw, LayoutDashboard, Share2
} from 'lucide-react';
import Link from 'next/link';
import ThemeSwitcher from '../ThemeSwitcher';
import { EDITOR_MOODS, type EditorMood } from '@/lib/studio-core/formatting-utils';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';

interface DocToolbarProps {
  project: any;
  tempTitle: string;
  isEditingTitle: boolean;
  setIsEditingTitle: (val: boolean) => void;
  setTempTitle: (val: string) => void;
  renameProject: () => void;
  createNewFile: () => void;
  beautify: () => void;
  hasCode?: boolean;
  editorMood: EditorMood;
  setEditorMood: (mood: EditorMood) => void;
  engine: string;
  setEngine: (engine: any) => void;
  autoEngine: boolean;
  setAutoEngine: (val: boolean) => void;
  compile: () => void;
  compiling: boolean;
  projectId: string;
  saveToCloud?: () => void;
  isSyncing?: boolean;
  isReadOnly?: boolean;
  onShare?: () => void;
}

export const DocToolbar: React.FC<DocToolbarProps> = ({
  project,
  tempTitle,
  isEditingTitle,
  setIsEditingTitle,
  setTempTitle,
  renameProject,
  createNewFile,
  beautify,
  hasCode = true,
  editorMood,
  setEditorMood,
  engine,
  setEngine,
  autoEngine,
  setAutoEngine,
  compile,
  compiling,
  projectId,
  isReadOnly = false,
  onShare,
}) => {
  return (
    <header style={{ 
      height: '64px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 1rem',
      background: 'var(--glass-header)',
      backdropFilter: 'blur(20px)',
      borderBottom: '1px solid var(--ide-header-border)',
      position: 'relative',
      zIndex: 100,
      gap: '0.5rem',
      overflow: 'hidden',
    }}>
      {/* Accent top bar */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'var(--accent-gradient, var(--accent-primary))', opacity: 0.8 }} />

      {/* ── LEFT: Nav + Project Identity ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0, minWidth: 0 }}>

        {/* Nav icons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}>
          <Link
            href="/dashboard"
            title="Return to Dashboard"
            style={{
              width: '30px', height: '30px', borderRadius: '7px',
              background: 'var(--ide-btn-bg)', border: '1px solid var(--ide-btn-border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--ide-btn-text)', transition: 'all 0.2s', flexShrink: 0,
            }}
          >
            <LayoutDashboard size={14} />
          </Link>
        </div>

        <div style={{ width: '1px', height: '20px', background: 'var(--ide-divider)', flexShrink: 0 }} />

        {/* Logo badge + title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0 }}>
          <div style={{
            width: '34px', height: '34px', flexShrink: 0,
            background: 'var(--accent-primary)', borderRadius: '10px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 16px var(--accent-glow)',
          }}>
            <Command size={18} color="#fff" strokeWidth={2.5} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            {isEditingTitle && !isReadOnly ? (
              <input
                autoFocus
                value={tempTitle}
                onChange={e => setTempTitle(e.target.value)}
                onBlur={renameProject}
                onKeyDown={e => e.key === 'Enter' && renameProject()}
                style={{
                  background: 'var(--ide-input-bg)', border: '1px solid var(--accent-primary)',
                  color: 'var(--ide-title-text)', fontSize: '0.9rem', fontWeight: 900,
                  borderRadius: '6px', padding: '0.1rem 0.5rem', outline: 'none',
                  width: '180px', fontFamily: 'var(--font-headline)',
                }}
              />
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0 }}>
                <h1
                  onClick={() => {
                    if (isReadOnly) {
                      toast.error("Read-Only Mode: Upgrade to Premium to rename the project.");
                      return;
                    }
                    setTempTitle(project?.title || '');
                    setIsEditingTitle(true);
                  }}
                  style={{
                    fontSize: '0.95rem', fontWeight: 900, color: 'var(--ide-title-text)',
                    margin: 0, cursor: isReadOnly ? 'default' : 'pointer', fontFamily: 'var(--font-headline)',
                    letterSpacing: '-0.02em', whiteSpace: 'nowrap',
                    overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '220px',
                  }}
                >
                  {project?.title || 'Loading...'}
                </h1>
                {!isReadOnly && <Pencil size={11} style={{ opacity: 0.35, color: 'var(--accent-primary)', flexShrink: 0 }} />}
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: isReadOnly ? '#f97316' : '#10b981', boxShadow: `0 0 6px ${isReadOnly ? '#f97316' : '#10b981'}`, flexShrink: 0 }} />
              <span style={{
                fontSize: '0.58rem', fontWeight: 700, color: isReadOnly ? '#f97316' : 'var(--ide-subtitle-text)',
                letterSpacing: '0.05em', textTransform: 'uppercase', whiteSpace: 'nowrap',
              }}>
                {isReadOnly ? 'Read-Only' : 'Active'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── RIGHT: Tools ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>

        {/* Share button */}
        {onShare && (
          <button
            onClick={onShare}
            title="Generate and copy shared project link"
            style={{
              background: 'var(--ide-btn-bg)',
              border: '1px solid var(--ide-btn-border)',
              color: 'var(--text-primary)',
              cursor: 'pointer', display: 'flex',
              alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.65rem',
              borderRadius: '7px', fontSize: '0.65rem', fontWeight: 800,
              whiteSpace: 'nowrap', flexShrink: 0,
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
              e.currentTarget.style.borderColor = 'var(--accent-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--ide-btn-bg)';
              e.currentTarget.style.borderColor = 'var(--ide-btn-border)';
            }}
          >
            <Share2 size={13} style={{ color: 'var(--accent-primary)' }} />
            <span>SHARE</span>
          </button>
        )}

        {/* Beautify button */}
        <button
          onClick={beautify}
          disabled={!hasCode}
          title={hasCode ? "Beautify LaTeX code" : "No code to beautify"}
          style={{
            background: !hasCode ? 'rgba(255,255,255,0.03)' : 'var(--ide-btn-bg)',
            border: '1px solid var(--ide-btn-border)',
            color: !hasCode ? 'rgba(255,255,255,0.2)' : 'var(--accent-primary)',
            cursor: !hasCode ? 'not-allowed' : 'pointer', display: 'flex',
            alignItems: 'center', gap: '0.3rem', padding: '0.3rem 0.55rem',
            borderRadius: '7px', fontSize: '0.62rem', fontWeight: 800,
            whiteSpace: 'nowrap', flexShrink: 0, opacity: !hasCode ? 0.4 : 1,
          }}
        >
          <Sparkles size={13} />
          <span className="ide-btn-label">BEAUTIFY</span>
        </button>

        {/* Mood picker */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '5px',
          background: 'var(--ide-group-bg)', padding: '0.3rem 0.6rem',
          borderRadius: '20px', border: '1px solid var(--ide-group-border)',
          flexShrink: 0,
        }}>
          <span style={{
            fontSize: '0.58rem', fontWeight: 900, color: 'var(--ide-btn-text)',
            letterSpacing: '0.08em', whiteSpace: 'nowrap',
          }}>
            MOOD
          </span>
          {(Object.keys(EDITOR_MOODS) as EditorMood[]).map(m => (
            <div
              key={m}
              onClick={() => setEditorMood(m)}
              title={`Switch to ${EDITOR_MOODS[m].name} Mood`}
              style={{
                width: 18,
                height: 18,
                borderRadius: '50%',
                background: EDITOR_MOODS[m].bg || '#222',
                border: editorMood === m
                  ? '2.5px solid var(--accent-primary)'
                  : '1.5px solid var(--ide-btn-border)',
                cursor: 'pointer',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                transform: editorMood === m ? 'scale(1.25)' : 'scale(1)',
                boxShadow: editorMood === m
                  ? `0 0 8px ${EDITOR_MOODS[m].bg || 'var(--accent-glow)'}, 0 0 0 1px var(--accent-primary)`
                  : '0 1px 3px rgba(0,0,0,0.25)',
                flexShrink: 0,
              }}
            />
          ))}
        </div>

        <div style={{ width: '1px', height: '22px', background: 'var(--ide-divider)', flexShrink: 0 }} />

        {/* Engine + Compile group */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.4rem',
          padding: '0.3rem 0.5rem', background: 'var(--ide-group-bg)',
          borderRadius: '10px', border: '1px solid var(--ide-group-border)',
          flexShrink: 0,
        }}>
          {/* Engine icon */}
          <Zap
            size={13}
            strokeWidth={2}
            style={{
              color: autoEngine ? 'var(--accent-primary)' : 'var(--ide-icon-muted)',
              cursor: 'pointer', transition: 'all 0.2s',
              opacity: autoEngine ? 1 : 0.5, flexShrink: 0,
            }}
            onClick={() => setAutoEngine(!autoEngine)}
          />

          {/* Engine select */}
          <select
            value={engine}
            onChange={e => setEngine(e.target.value)}
            style={{
              background: 'transparent', color: 'var(--ide-select-text)',
              border: 'none', fontSize: '0.7rem', fontWeight: 700,
              cursor: 'pointer', outline: 'none', fontFamily: 'var(--font-headline)',
            }}
          >
            <option value="tectonic">Tectonic</option>
            <option value="pdflatex">pdfLaTeX</option>
            <option value="lualatex">LuaLaTeX</option>
            <option value="xelatex">XeLaTeX</option>
          </select>

          {/* Auto toggle */}
          <div
            onClick={() => setAutoEngine(!autoEngine)}
            style={{
              fontSize: '0.55rem', fontWeight: 900, cursor: 'pointer',
              padding: '0.15rem 0.45rem', borderRadius: '5px',
              background: autoEngine ? 'var(--accent-glow)' : 'var(--ide-btn-bg)',
              color: autoEngine ? 'var(--accent-primary)' : 'var(--ide-btn-text)',
              border: `1px solid ${autoEngine ? 'var(--accent-primary)' : 'var(--ide-btn-border)'}`,
              transition: 'all 0.2s', fontFamily: 'var(--font-headline)',
              letterSpacing: '0.05em', flexShrink: 0,
            }}
          >
            AUTO
          </div>

          {/* Compile button */}
          <motion.button
            whileHover={{ scale: isReadOnly ? 1 : 1.02 }}
            whileTap={{ scale: isReadOnly ? 1 : 0.98 }}
            onClick={isReadOnly ? () => toast.error("Read-Only Mode: Daily credit limit reached. Please upgrade to Premium.") : compile}
            disabled={compiling}
            style={{
              background: isReadOnly ? 'rgba(255,255,255,0.03)' : (compiling ? 'var(--ide-btn-bg)' : 'var(--accent-primary)'),
              color: isReadOnly ? 'rgba(255,255,255,0.2)' : '#fff',
              border: 'none', padding: '0.38rem 0.85rem',
              borderRadius: '7px', fontWeight: 800, fontSize: '0.7rem',
              cursor: compiling ? 'not-allowed' : (isReadOnly ? 'not-allowed' : 'pointer'),
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              boxShadow: compiling || isReadOnly ? 'none' : '0 3px 12px var(--accent-glow)',
              fontFamily: 'var(--font-headline)', letterSpacing: '0.02em',
              whiteSpace: 'nowrap', flexShrink: 0,
              opacity: isReadOnly ? 0.6 : 1
            }}
          >
            {compiling
              ? <RefreshCw size={13} className="spinner" />
              : <Command size={13} strokeWidth={2} />
            }
            <span>{compiling ? 'Building...' : 'BUILD'}</span>
          </motion.button>
        </div>

        {/* Theme switcher – last, shrink-protected */}
        <div style={{ flexShrink: 0, position: 'relative' }}>
          <ThemeSwitcher />
        </div>
      </div>
    </header>
  );
};
