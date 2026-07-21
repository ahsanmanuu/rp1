"use client";

import { useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Zap, ChevronRight, Bot, Copy, Pencil, Trash2, RotateCcw
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
}

export function AiChatPanel({
  isOpen,
  onClose,
  onApplyEdits,
  onExtractCode,
  afterApply,
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

  const handleCopy = useCallback(async (content: string) => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(content);
        toast.success("Copied to clipboard");
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
      if (success) { toast.success("Copied to clipboard"); return; }
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
      toast.success("Code block extracted to editor!");
      setMessageState(idx, 'applied');
      afterApply?.();
      return;
    }

    const hasLatexMarkers = /\\(?:documentclass|begin|end|usepackage|section|cite|ref|include)/i.test(content);
    if (hasLatexMarkers) {
      toast.success("LaTeX content applied to editor!");
      setMessageState(idx, 'applied');
      afterApply?.();
      return;
    }

    toast.error("No editable content detected in message.");
    setMessageState(idx, 'applied');
  }, [onApplyEdits, onExtractCode, parseMessageJson, setMessageState, afterApply]);

  const renderMessage = (m: ChatMessage, i: number) => (
    <motion.div
      key={i}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        padding: '0.75rem 1rem', borderRadius: '12px',
        background: m.role === 'user' ? 'var(--bg-tertiary)' : 'var(--bg-accent-faint)',
        color: 'var(--text-primary)', alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
        maxWidth: '90%', fontSize: '0.8rem',
        border: m.role === 'user' ? '1px solid var(--border)' : '1px solid var(--border-accent)',
        boxShadow: m.role === 'assistant' ? '0 4px 20px rgba(15, 98, 254, 0.1)' : 'none',
        position: 'relative'
      }}
    >
      {editingIndex === i ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <textarea
            value={editText}
            onChange={e => setEditText(e.target.value)}
            style={{
              width: '100%', background: 'var(--bg-secondary)', border: '1px solid var(--border)',
              borderRadius: '8px', padding: '0.5rem', color: 'var(--text-primary)', fontSize: '0.8rem',
              outline: 'none', fontFamily: 'var(--font-mono)', minHeight: '60px'
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.4rem' }}>
            <button onClick={cancelEdit} style={{
              background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: 'none',
              borderRadius: '4px', padding: '0.2rem 0.5rem', fontSize: '0.65rem', cursor: 'pointer'
            }}>Cancel</button>
            <button onClick={() => saveEdit(i)} style={{
              background: 'var(--accent-primary)', color: '#fff', border: 'none',
              borderRadius: '4px', padding: '0.2rem 0.5rem', fontSize: '0.65rem', cursor: 'pointer'
            }}>Save</button>
          </div>
        </div>
      ) : (
        <>
          {m.role === 'assistant' && (
            <div
              onClick={() => toggleCollapse(i)}
              style={{
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem',
                marginBottom: '0.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.3rem'
              }}
            >
              <ChevronRight size={14} style={{
                color: 'var(--accent-primary)',
                transform: collapsedMessages[i] ? 'rotate(0deg)' : 'rotate(90deg)',
                transition: 'transform 0.2s'
              }} />
              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                {collapsedMessages[i] ? 'Expand Response' : 'Collapse Response'}
              </span>
            </div>
          )}

          {!(m.role === 'assistant' && collapsedMessages[i]) && (
            <div style={{ lineHeight: 1.4 }}>
              {(() => {
                const parsedJson = parseMessageJson(m.content);
                if (parsedJson) {
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      <p style={{ margin: '0 0 0.6rem 0', whiteSpace: 'pre-wrap' }}>
                        {parsedJson.explanation || m.content}
                      </p>
                      {parsedJson.edits && parsedJson.edits.length > 0 && (
                        <div style={{
                          background: 'var(--bg-secondary)', padding: '0.5rem', borderRadius: '6px',
                          border: '1px solid var(--border)', fontSize: '0.7rem'
                        }}>
                          <span style={{ fontWeight: 700, color: 'var(--accent-primary)', display: 'block', marginBottom: '0.2rem' }}>
                            AI Workspace Action ({parsedJson.edits.length} edits):
                          </span>
                          <ul style={{ margin: 0, paddingLeft: '1rem', listStyleType: 'disc' }}>
                            {parsedJson.edits.map((e: any, idx: number) => (
                              <li key={idx} style={{ marginBottom: '2px' }}>
                                <span style={{ fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                                  {e.type}
                                </span>
                                : <code style={{ color: 'var(--accent-primary)' }}>{e.path}</code>
                                {e.target && <span style={{ opacity: 0.7 }}> (Target: &ldquo;{e.target.substring(0, 20)}...&rdquo;)</span>}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  );
                }
                return m.content.split('\n').map((line, idx) => {
                  if (line.startsWith('```')) return null;
                  return <p key={idx} style={{ margin: '0 0 0.3rem 0', whiteSpace: 'pre-wrap' }}>{line}</p>;
                });
              })()}
            </div>
          )}

          {m.role === 'assistant' && !collapsedMessages[i] && (
            <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.5rem' }}>
              <button
                onClick={() => handleApply(i, m.content)}
                style={{
                  background: messageStates[i] === 'applied' ? 'var(--bg-tertiary)' : 'var(--accent-primary)',
                  color: '#fff', border: 'none', padding: '0.35rem 0.6rem', borderRadius: '6px',
                  fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer', flex: 1,
                  opacity: messageStates[i] === 'applied' ? 0.7 : 1
                }}
              >
                {messageStates[i] === 'applied' ? 'Updates Applied' : 'Apply AI Updates'}
              </button>
              <button
                onClick={() => {
                  setMessageState(i, messageStates[i] === 'rejected' ? 'none' : 'rejected');
                  if (messageStates[i] !== 'rejected') toast.success("Response marked as rejected");
                }}
                style={{
                  background: messageStates[i] === 'rejected' ? 'var(--bg-tertiary)' : 'rgba(255, 77, 77, 0.2)',
                  color: messageStates[i] === 'rejected' ? 'var(--text-secondary)' : '#ff4d4d',
                  border: '1px solid rgba(255, 77, 77, 0.3)', padding: '0.35rem 0.6rem',
                  borderRadius: '6px', fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer', flex: 1
                }}
              >
                {messageStates[i] === 'rejected' ? 'Rejected' : 'Reject'}
              </button>
            </div>
          )}

          <div style={{
            display: 'flex', gap: '0.6rem', justifyContent: 'flex-end', marginTop: '0.4rem',
            opacity: 0.6, transition: 'opacity 0.2s'
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

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 360, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.25, ease: 'easeInOut' }}
          style={{
            borderLeft: '1px solid var(--border)',
            display: 'flex', flexDirection: 'column',
            background: 'var(--bg-primary)',
            backdropFilter: 'blur(30px)',
            fontFamily: 'var(--font-headline)',
            flexShrink: 0, overflow: 'hidden',
            position: 'relative'
          }}
        >
          <div style={{
            padding: '0.6rem 0.9rem', borderBottom: '1px solid var(--border)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            flexShrink: 0
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Bot size={16} style={{ color: 'var(--accent-primary)' }} />
              <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--accent-primary)', letterSpacing: '0.1em' }}>
                AI ASSISTANT
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              {messages.length > 0 && (
                <button onClick={clearMessages} title="Clear Chat History"
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', padding: '2px', opacity: 0.6 }}>
                  <RotateCcw size={12} />
                </button>
              )}
              <button onClick={onClose} title="Close Chat"
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', padding: '2px' }}>
                <X size={14} />
              </button>
            </div>
          </div>

          <div ref={containerRef} className="custom-scroll" style={{
            flex: 1, overflowY: 'auto', padding: '0.75rem',
            display: 'flex', flexDirection: 'column', gap: '0.75rem'
          }}>
            {messages.length === 0 ? (
              <div style={{
                textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.75rem',
                marginTop: '3rem', padding: '0 1rem', lineHeight: 1.6
              }}>
                <Bot size={36} style={{ color: 'var(--accent-primary)', margin: '0 auto 0.75rem', display: 'block', opacity: 0.5 }} />
                Ask anything regarding your manuscript, formulas, bibliography, structure, or formatting!
              </div>
            ) : (
              messages.map(renderMessage)
            )}

            {sending && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                style={{
                  alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '0.6rem',
                  padding: '0.5rem 0.75rem', background: 'var(--bg-accent-faint)',
                  border: '1px solid var(--border-accent)', borderRadius: '10px',
                  color: 'var(--text-secondary)', fontSize: '0.75rem',
                  boxShadow: '0 4px 15px rgba(15, 98, 254, 0.1)'
                }}
              >
                <span style={{
                  width: '10px', height: '10px', border: '2px solid var(--border)',
                  borderTop: '2px solid var(--accent-primary)', borderRadius: '50%',
                  animation: 'spin 1s linear infinite', display: 'inline-block'
                }} />
                AI Agent is computing response...
              </motion.div>
            )}
          </div>

          <div style={{
            padding: '0.6rem 0.75rem', borderTop: '1px solid var(--border)',
            display: 'flex', gap: '0.5rem', background: 'var(--bg-secondary)',
            flexShrink: 0
          }}>
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="Ask AI assistant..."
              disabled={sending}
              style={{
                flex: 1, background: 'var(--bg-tertiary)', border: '1px solid var(--border)',
                borderRadius: '8px', padding: '0.5rem 0.75rem', color: 'var(--text-primary)',
                fontSize: '0.8rem', outline: 'none', fontFamily: 'var(--font-headline)',
                transition: 'all 0.2s'
              }}
            />
            {sending ? (
              <button
                onClick={abort}
                title="Abort AI Generation"
                style={{
                  background: '#ff4d4d', color: '#fff', border: 'none',
                  borderRadius: '8px', padding: '0 0.75rem', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem',
                  fontSize: '0.7rem', fontWeight: 700
                }}
              >
                <X size={14} /> Abort
              </button>
            ) : (
              <button
                onClick={send}
                disabled={!input.trim()}
                style={{
                  background: 'var(--accent-primary)', color: '#fff', border: 'none',
                  borderRadius: '8px', padding: '0 0.75rem', cursor: 'pointer',
                  opacity: !input.trim() ? 0.5 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}
              >
                <Zap size={16} />
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
