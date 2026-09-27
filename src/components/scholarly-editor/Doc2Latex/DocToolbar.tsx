"use client";

import React from 'react';
import { 
  Pencil, Sparkles, Zap, Command, RefreshCw, LayoutDashboard, Share2, Bot, Lock
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
  isLocked?: boolean;
  lockReason?: 'project_limit' | 'ai_tokens_exhausted' | 'credits' | null;
  onLockedAction?: () => void;
  onShare?: () => void;
  showAiChat?: boolean;
  onToggleAiChat?: () => void;
}

export const DocToolbar: React.FC<DocToolbarProps> = ({
  project,
  tempTitle,
  isEditingTitle,
  setIsEditingTitle,
  setTempTitle,
  renameProject,
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
  isReadOnly = false,
  isLocked = false,
  lockReason = null,
  onLockedAction,
  onShare,
  showAiChat = false,
  onToggleAiChat,
}) => {
  const handleLockedClick = (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    if (onLockedAction) {
      onLockedAction();
    }
    if (lockReason === 'project_limit') {
      toast.error('Free plan limit of 7 projects reached. Please subscribe to a plan to continue.', { id: 'project-limit-toast' });
    } else if (lockReason === 'ai_tokens_exhausted') {
      toast.error('Daily LLM tokens exhausted. Actions paused until quota refreshes or upgrade to premium.', { id: 'ai-tokens-toast' });
    } else {
      toast.error('Credit limit reached. Please upgrade to Premium.', { id: 'credits-toast' });
    }
  };

  const effectivelyDisabled = isReadOnly || isLocked;

  const statusLabel = isLocked
    ? lockReason === 'project_limit'
      ? '7/7 Projects (Locked)'
      : lockReason === 'ai_tokens_exhausted'
      ? 'Quota Exhausted'
      : 'Locked'
    : isReadOnly
    ? 'Read-Only'
    : 'Active';

  const statusColor = isLocked
    ? lockReason === 'project_limit'
      ? '#ef4444'
      : '#a855f7'
    : isReadOnly
    ? '#f97316'
    : '#10b981';

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
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: isLocked ? statusColor : 'var(--accent-gradient, var(--accent-primary))', opacity: 0.8 }} />

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
            background: isLocked ? statusColor : 'var(--accent-primary)', borderRadius: '10px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 0 16px ${isLocked ? statusColor : 'var(--accent-glow)'}`,
          }}>
            {isLocked ? <Lock size={16} color="#fff" strokeWidth={2.5} /> : <Command size={18} color="#fff" strokeWidth={2.5} />}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            {isEditingTitle && !effectivelyDisabled ? (
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
                    if (isLocked) {
                      handleLockedClick();
                      return;
                    }
                    if (isReadOnly) {
                      toast.error("Read-Only Mode: Upgrade to Premium to rename the project.");
                      return;
                    }
                    setTempTitle(project?.title || '');
                    setIsEditingTitle(true);
                  }}
                  style={{
                    fontSize: '0.95rem', fontWeight: 900, color: 'var(--ide-title-text)',
                    margin: 0, cursor: effectivelyDisabled ? 'pointer' : 'pointer', fontFamily: 'var(--font-headline)',
                    letterSpacing: '-0.02em', whiteSpace: 'nowrap',
                    overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '220px',
                  }}
                >
                  {project?.title || 'Loading...'}
                </h1>
                {!effectivelyDisabled && <Pencil size={11} style={{ opacity: 0.35, color: 'var(--accent-primary)', flexShrink: 0 }} />}
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: statusColor, boxShadow: `0 0 6px ${statusColor}`, flexShrink: 0 }} />
              <span style={{
                fontSize: '0.58rem', fontWeight: 700, color: statusColor,
                letterSpacing: '0.05em', textTransform: 'uppercase', whiteSpace: 'nowrap',
              }}>
                {statusLabel}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── RIGHT: Tools ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>

        {/* AI Agent button */}
        {onToggleAiChat && (
          <button
            onClick={isLocked ? handleLockedClick : onToggleAiChat}
            title={isLocked ? "AI Agent is locked" : "Toggle AI Assistant"}
            style={{
              background: isLocked ? 'rgba(255,255,255,0.03)' : (showAiChat ? 'var(--accent-glow)' : 'var(--ide-btn-bg)'),
              border: `1px solid ${isLocked ? 'rgba(255,255,255,0.1)' : 'var(--ide-btn-border)'}`,
              color: isLocked ? '#94a3b8' : 'var(--accent-primary)',
              cursor: isLocked ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.65rem',
              borderRadius: '7px', fontSize: '0.65rem', fontWeight: 800,
              whiteSpace: 'nowrap', flexShrink: 0,
              opacity: isLocked ? 0.6 : 1,
              transition: 'all 0.2s',
            }}
          >
            {isLocked ? <Lock size={12} /> : <Bot size={13} />}
            <span>AI AGENT</span>
          </button>
        )}

        {/* Share button */}
        {onShare && (
          <button
            onClick={isLocked ? handleLockedClick : onShare}
            title={isLocked ? "Locked under limit" : "Generate and copy shared project link"}
            style={{
              background: 'var(--ide-btn-bg)',
              border: '1px solid var(--ide-btn-border)',
              color: isLocked ? '#94a3b8' : 'var(--text-primary)',
              cursor: isLocked ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.65rem',
              borderRadius: '7px', fontSize: '0.65rem', fontWeight: 800,
              whiteSpace: 'nowrap', flexShrink: 0,
              opacity: isLocked ? 0.6 : 1,
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              if (!isLocked) {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                e.currentTarget.style.borderColor = 'var(--accent-primary)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--ide-btn-bg)';
              e.currentTarget.style.borderColor = 'var(--ide-btn-border)';
            }}
          >
            <Share2 size={13} style={{ color: isLocked ? '#94a3b8' : 'var(--accent-primary)' }} />
            <span>SHARE</span>
          </button>
        )}

        {/* Beautify button */}
        <button
          onClick={isLocked ? handleLockedClick : beautify}
          disabled={!hasCode && !isLocked}
          title={isLocked ? "Locked under limit" : (hasCode ? "Beautify LaTeX code" : "No code to beautify")}
          style={{
            background: (!hasCode || isLocked) ? 'rgba(255,255,255,0.03)' : 'var(--ide-btn-bg)',
            border: '1px solid var(--ide-btn-border)',
            color: (!hasCode || isLocked) ? 'rgba(255,255,255,0.2)' : 'var(--accent-primary)',
            cursor: (!hasCode && !isLocked) ? 'not-allowed' : (isLocked ? 'not-allowed' : 'pointer'),
            display: 'flex',
            alignItems: 'center', gap: '0.3rem', padding: '0.3rem 0.55rem',
            borderRadius: '7px', fontSize: '0.62rem', fontWeight: 800,
            whiteSpace: 'nowrap', flexShrink: 0, opacity: (!hasCode || isLocked) ? 0.4 : 1,
          }}
        >
          <Sparkles size={13} />
          <span className="ide-btn-label">BEAUTIFY</span>
        </button>

        {/* Mood picker */}
        <div 
          onClick={isLocked ? handleLockedClick : undefined}
          style={{
            display: 'flex', alignItems: 'center', gap: '5px',
            background: 'var(--ide-group-bg)', padding: '0.3rem 0.6rem',
            borderRadius: '20px', border: '1px solid var(--ide-group-border)',
            flexShrink: 0,
            cursor: isLocked ? 'not-allowed' : 'default',
            opacity: isLocked ? 0.6 : 1,
          }}
        >
          <span style={{
            fontSize: '0.58rem', fontWeight: 900, color: 'var(--ide-btn-text)',
            letterSpacing: '0.08em', whiteSpace: 'nowrap',
          }}>
            MOOD
          </span>
          {(Object.keys(EDITOR_MOODS) as EditorMood[]).map(m => (
            <div
              key={m}
              onClick={(e) => {
                if (isLocked) {
                  handleLockedClick(e);
                  return;
                }
                setEditorMood(m);
              }}
              title={`Switch to ${EDITOR_MOODS[m].name} Mood`}
              style={{
                width: 18,
                height: 18,
                borderRadius: '50%',
                background: EDITOR_MOODS[m].bg || '#222',
                border: editorMood === m
                  ? '2.5px solid var(--accent-primary)'
                  : '1.5px solid var(--ide-btn-border)',
                cursor: isLocked ? 'not-allowed' : 'pointer',
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
          opacity: isLocked ? 0.65 : 1,
        }}>
          {/* Engine icon */}
          <Zap
            size={13}
            strokeWidth={2}
            style={{
              color: autoEngine ? 'var(--accent-primary)' : 'var(--ide-icon-muted)',
              cursor: isLocked ? 'not-allowed' : 'pointer', transition: 'all 0.2s',
              opacity: autoEngine ? 1 : 0.5, flexShrink: 0,
            }}
            onClick={isLocked ? handleLockedClick : () => setAutoEngine(!autoEngine)}
          />

          {/* Engine select */}
          <select
            value={engine}
            disabled={isLocked}
            onChange={e => {
              if (isLocked) {
                handleLockedClick();
                return;
              }
              setEngine(e.target.value);
            }}
            style={{
              background: 'transparent', color: 'var(--ide-select-text)',
              border: 'none', fontSize: '0.7rem', fontWeight: 700,
              cursor: isLocked ? 'not-allowed' : 'pointer', outline: 'none', fontFamily: 'var(--font-headline)',
            }}
          >
            <option value="tectonic">Tectonic</option>
            <option value="pdflatex">pdfLaTeX</option>
            <option value="lualatex">LuaLaTeX</option>
            <option value="xelatex">XeLaTeX</option>
          </select>

          {/* Auto toggle */}
          <div
            onClick={isLocked ? handleLockedClick : () => setAutoEngine(!autoEngine)}
            style={{
              fontSize: '0.55rem', fontWeight: 900, cursor: isLocked ? 'not-allowed' : 'pointer',
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
            whileHover={{ scale: effectivelyDisabled ? 1 : 1.02 }}
            whileTap={{ scale: effectivelyDisabled ? 1 : 0.98 }}
            onClick={isLocked ? handleLockedClick : (isReadOnly ? () => toast.error("Read-Only Mode: Daily credit limit reached. Please upgrade to Premium.") : compile)}
            disabled={compiling}
            style={{
              background: effectivelyDisabled ? 'rgba(255,255,255,0.04)' : 'var(--accent-primary)',
              color: effectivelyDisabled ? 'rgba(255,255,255,0.25)' : '#fff',
              border: effectivelyDisabled ? '1px solid rgba(255,255,255,0.08)' : 'none', padding: '0.38rem 0.85rem',
              borderRadius: '7px', fontWeight: 800, fontSize: '0.7rem',
              cursor: compiling ? 'wait' : (effectivelyDisabled ? 'not-allowed' : 'pointer'),
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              boxShadow: effectivelyDisabled ? 'none' : '0 3px 12px var(--accent-glow)',
              fontFamily: 'var(--font-headline)', letterSpacing: '0.02em',
              whiteSpace: 'nowrap', flexShrink: 0,
              opacity: compiling ? 0.85 : (effectivelyDisabled ? 0.6 : 1)
            }}
          >
            {compiling
              ? <RefreshCw size={13} className="spinner" />
              : isLocked
              ? <Lock size={13} strokeWidth={2} />
              : <Command size={13} strokeWidth={2} />
            }
            <span>{compiling ? 'BUILDING...' : isLocked ? 'LOCKED' : 'BUILD'}</span>
          </motion.button>
        </div>

        {/* Theme switcher */}
        <div style={{ flexShrink: 0, position: 'relative' }}>
          <ThemeSwitcher />
        </div>
      </div>
    </header>
  );
};
