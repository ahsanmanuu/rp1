'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface UseAiChatOptions {
  projectId: string;
  storageKey: string;
  apiEndpoint: string;
  buildContext?: () => Record<string, any> | Promise<Record<string, any>>;
}

export function useAiChat({ projectId, storageKey, apiEndpoint, buildContext }: UseAiChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [messageStates, setMessageStates] = useState<Record<number, 'applied' | 'rejected' | 'none'>>({});
  const [collapsedMessages, setCollapsedMessages] = useState<Record<number, boolean>>({});

  const abortRef = useRef<AbortController | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const safeSetItem = useCallback((key: string, value: string) => {
    try {
      localStorage.setItem(key, value);
    } catch {
      try {
        localStorage.removeItem(key);
        localStorage.setItem(key, value);
      } catch {}
    }
  }, []);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTo({ top: containerRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, sending]);

  useEffect(() => {
    if (typeof window !== 'undefined' && projectId) {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) setMessages(JSON.parse(saved));
      } catch {}
    }
  }, [projectId, storageKey]);

  const saveMessages = useCallback((msgs: ChatMessage[]) => {
    setMessages(msgs);
    if (typeof window !== 'undefined' && projectId) {
      safeSetItem(storageKey, JSON.stringify(msgs));
    }
  }, [projectId, storageKey, safeSetItem]);

  const clearMessages = useCallback(() => {
    saveMessages([]);
    setMessageStates({});
    setCollapsedMessages({});
  }, [saveMessages]);

  const send = useCallback(async () => {
    if (!input.trim() || sending) return;
    const userMsg = input.trim();
    setInput('');
    const updated: ChatMessage[] = [...messages, { role: 'user', content: userMsg }];
    saveMessages(updated);
    setSending(true);

    const controller = new AbortController();
    abortRef.current = controller;
    const timeoutId = setTimeout(() => controller.abort(), 300000);

    try {
      const ctx = buildContext ? await buildContext() : {};
      const res = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: updated, ...ctx }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      let data: any;
      const text = await res.text();
      try {
        data = JSON.parse(text);
      } catch {
        data = { error: text || 'AI Agent encountered a runtime anomaly.' };
      }

      if (!res.ok) {
        if (data.error === 'AI_CAP_REACHED' || data.error === 'AI_CAP_RULE_BLOCKED') {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('ai-cap-triggered'));
          }
          throw new Error(data.error === 'AI_CAP_RULE_BLOCKED'
            ? `AI usage rule enforced: ${data.reason || 'Blocked'}`
            : `Daily AI cap reached. Resets at ${data.reactivatesAt ? new Date(data.reactivatesAt).toLocaleString() : 'next cycle'}.`
          );
        }
        throw new Error(data.error || 'AI Agent encountered a runtime anomaly.');
      }

      const responseMsg = data.message || (data.data?.message) || 'No response from AI.';
      saveMessages([...updated, { role: 'assistant', content: responseMsg }]);
      setCollapsedMessages(prev => ({ ...prev, [updated.length]: true }));
    } catch (err: any) {
      clearTimeout(timeoutId);
      let errorMsg = err.message || 'AI Agent connection disrupted.';
      if (err.name === 'AbortError') {
        errorMsg = 'AI Agent request timed out (exceeded 120 seconds). Please try a shorter prompt.';
      }
      saveMessages([...updated, { role: 'assistant', content: `ERROR: ${errorMsg}` }]);
      setCollapsedMessages(prev => ({ ...prev, [updated.length]: true }));
    } finally {
      setSending(false);
      abortRef.current = null;
    }
  }, [input, sending, messages, apiEndpoint, buildContext, saveMessages]);

  const abort = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
      setSending(false);
    }
  }, []);

  const deleteMessage = useCallback((idx: number) => {
    saveMessages(messages.filter((_, i) => i !== idx));
    setMessageStates(prev => {
      const next = { ...prev };
      delete next[idx];
      return next;
    });
  }, [messages, saveMessages]);

  const startEdit = useCallback((idx: number, text: string) => {
    setEditingIndex(idx);
    setEditText(text);
  }, []);

  const saveEdit = useCallback((idx: number) => {
    saveMessages(messages.map((m, i) => i === idx ? { ...m, content: editText } : m));
    setEditingIndex(null);
    setEditText('');
  }, [messages, editText, saveMessages]);

  const cancelEdit = useCallback(() => {
    setEditingIndex(null);
    setEditText('');
  }, []);

  const toggleCollapse = useCallback((idx: number) => {
    setCollapsedMessages(prev => ({ ...prev, [idx]: !prev[idx] }));
  }, []);

  const setMessageState = useCallback((idx: number, state: 'applied' | 'rejected' | 'none') => {
    setMessageStates(prev => ({ ...prev, [idx]: state }));
  }, []);

  const parseMessageJson = useCallback((content: string): any => {
    try {
      let cleaned = content.trim();
      cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
      try {
        const parsed = JSON.parse(cleaned);
        if (parsed && (parsed.edits || parsed.explanation)) return parsed;
      } catch {}
      const start = cleaned.indexOf('{');
      const end = cleaned.lastIndexOf('}');
      if (start !== -1 && end > start) {
        const block = cleaned.substring(start, end + 1);
        try {
          const parsed = JSON.parse(block);
          if (parsed && (parsed.edits || parsed.explanation)) return parsed;
        } catch {
          try {
            const cleanBlock = block.replace(/,(\s*[}\]])/g, '$1');
            const parsed = JSON.parse(cleanBlock);
            if (parsed && (parsed.edits || parsed.explanation)) return parsed;
          } catch {}
        }
      }
    } catch {}
    return null;
  }, []);

  return {
    messages,
    sending,
    input,
    setInput,
    send,
    abort,
    deleteMessage,
    startEdit,
    saveEdit,
    cancelEdit,
    editingIndex,
    editText,
    setEditText,
    collapsedMessages,
    toggleCollapse,
    messageStates,
    setMessageState,
    parseMessageJson,
    containerRef,
    clearMessages,
  };
}
