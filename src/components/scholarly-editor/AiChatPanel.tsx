"use client";

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Zap, ChevronRight, ChevronDown, Bot, Copy, Check, Pencil, Trash2, 
  RotateCcw, Sparkles, Code, FileCode, CheckCircle2, CornerDownLeft, 
  Layers, MessageSquare, Terminal
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { ChatMessage, UseAiChatOptions } from '@/hooks/useAiChat';
import { useAiChat } from '@/hooks/useAiChat';

export interface AiChatPanelProps extends UseAiChatOptions {
  isOpen: boolean;
  onClose: () => void;
  onApplyEdits?: (edits: any[], content: string) => Promise<void>;
  onExtractCode?: (content: string) => string | null;
  afterApply?: () => void;
  activeFile?: string;
  fileCount?: number;
}

const QUICK_PROMPTS = [
  { label: 'Fix Syntax', icon: Zap, prompt: 'Scan my active file for LaTeX syntax errors, unescaped characters, or broken environments and fix them.' },
  { label: 'Format Citations', icon: FileCode, prompt: 'Check all \\cite{} keys in my active file against references.bib and suggest missing or formatted entries.' },
  { label: 'Academic Polish', icon: Sparkles, prompt: 'Polish the academic tone, grammar, and formal vocabulary of the active section while preserving all LaTeX macros.' },
  { label: 'Insert Equation', icon: Code, prompt: 'Generate an elegant, properly labeled equation environment with explanatory text.' },
  { label: 'Create Table', icon: Layers, prompt: 'Create a professional booktabs-style table with centered alignment, column headers, and a descriptive caption.' },
];

export function AiChatPanel({
  isOpen,
  onClose,
  onApplyEdits,
  onExtractCode,
  afterApply,
  activeFile = 'main.tex',
  fileCount,
  ...chatOptions
}: AiChatPanelProps) {
  const {
    messages, sending, input, setInput, send, abort,
    deleteMessage, startEdit, saveEdit, cancelEdit,
    editingIndex, editText, setEditText,
    collapsedMessages, toggleCollapse,
    messageStates, setMessageState,
    parseMessageJson, containerRef, clearMessages,
  } = useAiChat(chatOptions);

  const [copiedIndex, setCopiedIndex] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize input textarea up to 130px
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 130)}px`;
    }
  }, [input]);

  const handleCopy = useCallback(async (content: string, blockKey?: string) => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(content);
        if (blockKey) {
          setCopiedIndex(blockKey);
          setTimeout(() => setCopiedIndex(null), 2000);
        }
        toast.success("Copied to clipboard", { duration: 1500 });
        return;
      }
    } catch {}
    try {
      const textarea = document.createElement("textarea");
      textarea.value = content;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      const success = document.execCommand("copy");
      document.body.removeChild(textarea);
      if (success) { 
        if (blockKey) {
          setCopiedIndex(blockKey);
          setTimeout(() => setCopiedIndex(null), 2000);
        }
        toast.success("Copied to clipboard", { duration: 1500 }); 
        return; 
      }
    } catch {}
    toast.error("Failed to copy message.");
  }, []);

  const handleApply = useCallback(async (idx: number, content: string) => {
    if (onApplyEdits) {
      const parsedJson = parseMessageJson(content);
      if (parsedJson && parsedJson.edits) {
        await onApplyEdits(parsedJson.edits, content);
        setMessageState(idx, 'applied');
        afterApply?.();
        return;
      }
    }

    if (onExtractCode) {
      const code = onExtractCode(content);
      if (code) {
        setMessageState(idx, 'applied');
        afterApply?.();
        return;
      }
    }

    const fencedMatch = content.match(/```[\s]*([a-zA-Z0-9]*)\s*\r?\n([\s\S]*?)\r?\n[\s]*```/i);
    if (fencedMatch && fencedMatch[2] && fencedMatch[2].trim()) {
      if (onApplyEdits) {
        await onApplyEdits([{ type: 'write', path: activeFile, content: fencedMatch[2] }], content);
        setMessageState(idx, 'applied');
        afterApply?.();
        toast.success("Extracted code applied to editor!");
        return;
      }
    }

    const hasLatexMarkers = /\\(?:documentclass|begin|end|usepackage|section|cite|ref|include)/i.test(content);
    if (hasLatexMarkers && onApplyEdits) {
      await onApplyEdits([{ type: 'write', path: activeFile, content }], content);
      toast.success("LaTeX content applied to editor!");
      setMessageState(idx, 'applied');
      afterApply?.();
      return;
    }

    toast.error("No editable content detected in message.");
    setMessageState(idx, 'applied');
  }, [onApplyEdits, onExtractCode, parseMessageJson, setMessageState, afterApply, activeFile]);

  // Formatted markdown / code block renderer
  const renderFormattedContent = (content: string, msgIdx: number) => {
    const codeBlockRegex = /```([a-zA-Z0-9_+-]*)\r?\n([\s\S]*?)```/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let blockId = 0;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      const preText = content.substring(lastIndex, match.index);
      if (preText.trim()) {
        parts.push(
          <div key={`txt-${lastIndex}`} style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, fontSize: '0.8rem', color: 'var(--text-primary)' }}>
            {preText}
          </div>
        );
      }

      const lang = (match[1] || 'latex').toLowerCase();
      const code = match[2].trim();
      const currentBlockKey = `block-${msgIdx}-${blockId++}`;
      const isCopied = copiedIndex === currentBlockKey;

      parts.push(
        <div key={currentBlockKey} style={{
          margin: '0.6rem 0',
          borderRadius: '10px',
          border: '1px solid rgba(255,255,255,0.12)',
          background: 'rgba(10, 10, 15, 0.95)',
          overflow: 'hidden',
          boxShadow: '0 8px 24px rgba(0,0,0,0.35)'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.35rem 0.65rem',
            background: 'rgba(255,255,255,0.04)',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            fontSize: '0.65rem',
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-secondary)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Code size={11} style={{ color: 'var(--accent-primary)' }} />
              <span style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{lang || 'CODE'}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <button
                onClick={() => handleCopy(code, currentBlockKey)}
                style={{
                  background: isCopied ? 'rgba(34, 197, 94, 0.2)' : 'transparent',
                  border: isCopied ? '1px solid rgba(34, 197, 94, 0.4)' : 'none',
                  color: isCopied ? '#4ade80' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  fontSize: '0.65rem',
                  transition: 'all 0.2s'
                }}
                title="Copy code to clipboard"
              >
                {isCopied ? <Check size={11} /> : <Copy size={11} />}
                {isCopied ? 'Copied' : 'Copy'}
              </button>
              {onApplyEdits && (
                <button
                  onClick={async () => {
                    await onApplyEdits([{ type: 'write', path: activeFile, content: code }], content);
                    toast.success("Applied snippet to active file!");
                    afterApply?.();
                  }}
                  style={{
                    background: 'rgba(99, 102, 241, 0.2)',
                    border: '1px solid rgba(99, 102, 241, 0.4)',
                    color: '#a5b4fc',
                    cursor: 'pointer',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    fontSize: '0.65rem',
                    fontWeight: 600,
                    transition: 'all 0.2s'
                  }}
                  title="Insert directly into active file"
                >
                  <Sparkles size={11} /> Insert
                </button>
              )}
            </div>
          </div>
          <pre style={{
            margin: 0,
            padding: '0.65rem 0.85rem',
            overflowX: 'auto',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.75rem',
            lineHeight: 1.5,
            color: '#e2e8f0',
            whiteSpace: 'pre',
            maxHeight: '320px'
          }}>
            <code>{code}</code>
          </pre>
        </div>
      );

      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < content.length) {
      const remaining = content.substring(lastIndex);
      if (remaining.trim()) {
        parts.push(
          <div key={`txt-${lastIndex}`} style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, fontSize: '0.8rem', color: 'var(--text-primary)' }}>
            {remaining}
          </div>
        );
      }
    }

    return parts.length > 0 ? parts : (
      <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, fontSize: '0.8rem' }}>
        {content}
      </div>
    );
  };

  const renderMessage = (m: ChatMessage, i: number) => {
    const isAssistant = m.role === 'assistant';
    const parsedJson = isAssistant ? parseMessageJson(m.content) : null;
    const isCollapsed = isAssistant && collapsedMessages[i];

    return (
      <motion.div
        key={i}
        initial={{ opacity: 0, y: 8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.2 }}
        style={{
          padding: '0.85rem 1rem',
          borderRadius: isAssistant ? '14px 14px 14px 4px' : '14px 14px 4px 14px',
          background: isAssistant
            ? 'linear-gradient(145deg, rgba(26, 28, 44, 0.85) 0%, rgba(18, 20, 32, 0.95) 100%)'
            : 'linear-gradient(145deg, rgba(79, 70, 229, 0.25) 0%, rgba(99, 102, 241, 0.15) 100%)',
          color: 'var(--text-primary)',
          alignSelf: isAssistant ? 'flex-start' : 'flex-end',
          maxWidth: '92%',
          fontSize: '0.8rem',
          border: isAssistant
            ? '1px solid rgba(255, 255, 255, 0.08)'
            : '1px solid rgba(99, 102, 241, 0.35)',
          boxShadow: isAssistant
            ? '0 6px 24px rgba(0, 0, 0, 0.25)'
            : '0 4px 16px rgba(99, 102, 241, 0.1)',
          position: 'relative',
          backdropFilter: 'blur(20px)'
        }}
      >
        {/* Header line for message */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '0.45rem',
          fontSize: '0.65rem',
          color: isAssistant ? '#a5b4fc' : '#c7d2fe',
          fontWeight: 700,
          fontFamily: 'var(--font-headline)',
          letterSpacing: '0.04em'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            {isAssistant ? (
              <>
                <div style={{
                  width: '16px', height: '16px', borderRadius: '50%',
                  background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <Bot size={10} color="#fff" />
                </div>
                <span>LATEX ASSISTANT</span>
              </>
            ) : (
              <span>YOU</span>
            )}
          </div>
          {isAssistant && (
            <button
              onClick={() => toggleCollapse(i)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.2rem',
                fontSize: '0.65rem'
              }}
            >
              {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
              {isCollapsed ? 'Expand' : 'Collapse'}
            </button>
          )}
        </div>

        {editingIndex === i ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <textarea
              value={editText}
              onChange={e => setEditText(e.target.value)}
              style={{
                width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '8px', padding: '0.5rem', color: 'var(--text-primary)', fontSize: '0.8rem',
                outline: 'none', fontFamily: 'var(--font-mono)', minHeight: '60px'
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.4rem' }}>
              <button onClick={cancelEdit} style={{
                background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)', border: 'none',
                borderRadius: '5px', padding: '0.25rem 0.6rem', fontSize: '0.65rem', cursor: 'pointer'
              }}>Cancel</button>
              <button onClick={() => saveEdit(i)} style={{
                background: 'var(--accent-primary)', color: '#fff', border: 'none',
                borderRadius: '5px', padding: '0.25rem 0.6rem', fontSize: '0.65rem', cursor: 'pointer', fontWeight: 600
              }}>Save</button>
            </div>
          </div>
        ) : (
          <>
            {!isCollapsed && (
              <div>
                {parsedJson ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, fontSize: '0.8rem' }}>
                      {parsedJson.explanation || m.content}
                    </div>

                    {parsedJson.edits && parsedJson.edits.length > 0 && (
                      <div style={{
                        background: 'rgba(15, 17, 26, 0.85)',
                        padding: '0.65rem 0.8rem',
                        borderRadius: '10px',
                        border: '1px solid rgba(99, 102, 241, 0.3)',
                        fontSize: '0.72rem',
                        boxShadow: '0 4px 16px rgba(0,0,0,0.2)'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.35rem' }}>
                          <Terminal size={13} style={{ color: 'var(--accent-primary)' }} />
                          <span style={{ fontWeight: 800, color: '#e0e7ff', letterSpacing: '0.04em' }}>
                            PROPOSED WORKSPACE CHANGES ({parsedJson.edits.length}):
                          </span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                          {parsedJson.edits.map((e: any, idx: number) => (
                            <div key={idx} style={{
                              display: 'flex', alignItems: 'center', gap: '0.4rem',
                              padding: '0.25rem 0.45rem', borderRadius: '6px',
                              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)'
                            }}>
                              <span style={{
                                padding: '1px 5px', borderRadius: '4px',
                                fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase',
                                background: e.type === 'delete' ? 'rgba(239, 68, 68, 0.25)' : e.type === 'replace' ? 'rgba(234, 179, 8, 0.25)' : 'rgba(34, 197, 94, 0.25)',
                                color: e.type === 'delete' ? '#f87171' : e.type === 'replace' ? '#facc15' : '#4ade80'
                              }}>
                                {e.type}
                              </span>
                              <code style={{ color: '#a5b4fc', fontFamily: 'var(--font-mono)', fontSize: '0.7rem' }}>
                                {e.path}
                              </code>
                              {e.target && (
                                <span style={{ opacity: 0.6, fontSize: '0.65rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  target: &ldquo;{e.target.substring(0, 24)}...&rdquo;
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  renderFormattedContent(m.content, i)
                )}
              </div>
            )}

            {/* Action buttons for assistant responses */}
            {isAssistant && !isCollapsed && (
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.65rem' }}>
                <button
                  onClick={() => handleApply(i, m.content)}
                  style={{
                    background: messageStates[i] === 'applied'
                      ? 'rgba(34, 197, 94, 0.25)'
                      : 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                    color: messageStates[i] === 'applied' ? '#4ade80' : '#fff',
                    border: messageStates[i] === 'applied'
                      ? '1px solid rgba(34, 197, 94, 0.4)'
                      : '1px solid rgba(99, 102, 241, 0.4)',
                    padding: '0.4rem 0.75rem',
                    borderRadius: '8px',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.35rem',
                    boxShadow: messageStates[i] === 'applied' ? 'none' : '0 4px 12px rgba(79, 70, 229, 0.3)',
                    transition: 'all 0.2s'
                  }}
                >
                  {messageStates[i] === 'applied' ? (
                    <>
                      <CheckCircle2 size={13} />
                      Updates Applied
                    </>
                  ) : (
                    <>
                      <Sparkles size={13} />
                      Apply AI Updates to Workspace
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Message Controls */}
            <div style={{
              display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.45rem',
              opacity: 0.5, transition: 'opacity 0.2s'
            }} className="msg-controls">
              <button onClick={() => handleCopy(m.content)} title="Copy Message"
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', padding: '2px' }}>
                <Copy size={12} />
              </button>
              <button onClick={() => startEdit(i, m.content)} title="Edit Message"
                style={{ background: 'transparent', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', display: 'flex', padding: '2px' }}>
                <Pencil size={12} />
              </button>
              <button onClick={() => deleteMessage(i)} title="Delete Message"
                style={{ background: 'transparent', border: 'none', color: '#ff6b6b', cursor: 'pointer', display: 'flex', padding: '2px' }}>
                <Trash2 size={12} />
              </button>
            </div>
          </>
        )}
      </motion.div>
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 380, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          style={{
            borderLeft: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            flexDirection: 'column',
            background: 'linear-gradient(180deg, rgba(13, 15, 24, 0.96) 0%, rgba(10, 11, 18, 0.98) 100%)',
            backdropFilter: 'blur(30px)',
            fontFamily: 'var(--font-headline)',
            flexShrink: 0,
            overflow: 'hidden',
            position: 'relative',
            boxShadow: '-8px 0 32px rgba(0, 0, 0, 0.4)'
          }}
        >
          {/* Header */}
          <div style={{
            padding: '0.75rem 1rem',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'rgba(255,255,255,0.02)',
            flexShrink: 0
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <div style={{
                width: '24px', height: '24px', borderRadius: '7px',
                background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 0 14px rgba(99, 102, 241, 0.4)'
              }}>
                <Bot size={14} color="#fff" />
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#f8fafc', letterSpacing: '0.04em' }}>
                  LATEX AI ASSISTANT
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.62rem', color: '#94a3b8' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
                  <span>{activeFile}</span>
                  {fileCount !== undefined && <span>• {fileCount} files</span>}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              {messages.length > 0 && (
                <button
                  onClick={clearMessages}
                  title="Clear Chat History"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: 'var(--text-secondary)',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    display: 'flex',
                    padding: '4px',
                    transition: 'all 0.2s'
                  }}
                >
                  <RotateCcw size={13} />
                </button>
              )}
              <button
                onClick={onClose}
                title="Close Chat"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: 'var(--text-secondary)',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  display: 'flex',
                  padding: '4px',
                  transition: 'all 0.2s'
                }}
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Quick Action Prompt Chips */}
          <div style={{
            padding: '0.5rem 0.75rem',
            borderBottom: '1px solid rgba(255,255,255,0.05)',
            display: 'flex',
            gap: '0.35rem',
            overflowX: 'auto',
            scrollbarWidth: 'none',
            background: 'rgba(0,0,0,0.2)',
            flexShrink: 0
          }}>
            {QUICK_PROMPTS.map((qp, idx) => {
              const Icon = qp.icon;
              return (
                <button
                  key={idx}
                  onClick={() => send(qp.prompt)}
                  disabled={sending}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    padding: '0.25rem 0.55rem',
                    borderRadius: '20px',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: '#cbd5e1',
                    fontSize: '0.65rem',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    opacity: sending ? 0.5 : 1
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = 'rgba(99, 102, 241, 0.2)';
                    e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.4)';
                    e.currentTarget.style.color = '#fff';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                    e.currentTarget.style.color = '#cbd5e1';
                  }}
                >
                  <Icon size={11} style={{ color: 'var(--accent-primary)' }} />
                  {qp.label}
                </button>
              );
            })}
          </div>

          {/* Chat Messages Container */}
          <div
            ref={containerRef}
            className="custom-scroll"
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '0.85rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.85rem'
            }}
          >
            {messages.length === 0 ? (
              <div style={{
                textAlign: 'center',
                color: 'var(--text-secondary)',
                fontSize: '0.75rem',
                margin: 'auto 0',
                padding: '2rem 1.5rem',
                lineHeight: 1.6
              }}>
                <div style={{
                  width: '54px', height: '54px', borderRadius: '16px',
                  background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(168, 85, 247, 0.15) 100%)',
                  border: '1px solid rgba(99, 102, 241, 0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 1rem auto',
                  boxShadow: '0 0 30px rgba(99, 102, 241, 0.2)'
                }}>
                  <Sparkles size={24} style={{ color: 'var(--accent-primary)' }} />
                </div>
                <div style={{ fontWeight: 800, fontSize: '0.85rem', color: '#f8fafc', marginBottom: '0.35rem' }}>
                  Academic Pair Programmer
                </div>
                Ask questions, generate equations, audit bibliography citations, or request automatic file modifications across your manuscript!
              </div>
            ) : (
              messages.map(renderMessage)
            )}

            {sending && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  alignSelf: 'flex-start',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.65rem',
                  padding: '0.65rem 0.85rem',
                  background: 'rgba(26, 28, 44, 0.85)',
                  border: '1px solid rgba(99, 102, 241, 0.3)',
                  borderRadius: '12px',
                  color: '#c7d2fe',
                  fontSize: '0.75rem',
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)'
                }}
              >
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  <motion.div animate={{ scale: [1, 1.4, 1] }} transition={{ repeat: Infinity, duration: 0.8, delay: 0 }} style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#6366f1' }} />
                  <motion.div animate={{ scale: [1, 1.4, 1] }} transition={{ repeat: Infinity, duration: 0.8, delay: 0.2 }} style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#818cf8' }} />
                  <motion.div animate={{ scale: [1, 1.4, 1] }} transition={{ repeat: Infinity, duration: 0.8, delay: 0.4 }} style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#a5b4fc' }} />
                </div>
                <span style={{ fontWeight: 600 }}>Analyzing manuscript & synthesizing solution...</span>
              </motion.div>
            )}
          </div>

          {/* Interactive Multi-line Input Box */}
          <div style={{
            padding: '0.75rem',
            borderTop: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(15, 17, 26, 0.95)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.4rem',
            flexShrink: 0
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'flex-end',
              gap: '0.4rem',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '12px',
              padding: '0.4rem 0.6rem',
              transition: 'all 0.2s',
              boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.3)'
            }}>
              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder="Ask about equations, bibliography, formatting..."
                disabled={sending}
                rows={1}
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  color: '#f8fafc',
                  fontSize: '0.8rem',
                  outline: 'none',
                  fontFamily: 'var(--font-headline)',
                  lineHeight: 1.4,
                  resize: 'none',
                  minHeight: '28px',
                  maxHeight: '130px',
                  padding: '2px 0'
                }}
              />

              {sending ? (
                <button
                  onClick={abort}
                  title="Abort AI Generation"
                  style={{
                    background: 'rgba(239, 68, 68, 0.2)',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    color: '#f87171',
                    borderRadius: '8px',
                    padding: '0.35rem 0.65rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    flexShrink: 0,
                    transition: 'all 0.2s'
                  }}
                >
                  <X size={13} /> Abort
                </button>
              ) : (
                <button
                  onClick={() => send()}
                  disabled={!input.trim()}
                  title="Send message (Enter)"
                  style={{
                    background: input.trim()
                      ? 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)'
                      : 'rgba(255,255,255,0.05)',
                    color: input.trim() ? '#fff' : 'rgba(255,255,255,0.3)',
                    border: 'none',
                    borderRadius: '8px',
                    width: '32px',
                    height: '32px',
                    cursor: input.trim() ? 'pointer' : 'default',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    boxShadow: input.trim() ? '0 4px 12px rgba(99, 102, 241, 0.35)' : 'none',
                    transition: 'all 0.2s'
                  }}
                >
                  <CornerDownLeft size={14} />
                </button>
              )}
            </div>

            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '0 0.25rem',
              fontSize: '0.62rem',
              color: 'var(--text-secondary)',
              opacity: 0.7
            }}>
              <span>Return to send, Shift+Return for newline</span>
              <span>Full context aware</span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
