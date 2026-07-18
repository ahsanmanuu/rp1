"use client";
import '../editor-shared.css';
import { useSession } from "@/lib/pb-auth-react";
import { useLayoutSync } from "@/hooks/useLayoutSync";
import React, { useState, useEffect, useRef, useCallback } from 'react';
import LatexifyLogo from '@/components/LatexifyLogo';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { StudioFS, type StudioProject, type StudioFile } from '@/lib/studio-fs';
import Link from 'next/link';
import { 
  Download, 
  Trash2, 
  Zap, 
  ChevronRight, 
  RefreshCw,
  Plus,
  Layout,
  Command,
  X,
  FileText,
  Upload,
  Settings, Pencil, Sparkles, Copy, Eye, EyeOff, LayoutDashboard, Bot
} from 'lucide-react';
import { getLatexSuggestions } from '@/lib/latex-suggestions';
import { detectBestEngine } from '@/lib/studio-core/compiler-utils';
import { formatLatexCode, type EditorMood, EDITOR_MOODS } from '@/lib/studio-core/formatting-utils';
import toast from 'react-hot-toast';
import { saveAs } from 'file-saver';
import { motion, AnimatePresence } from 'framer-motion';
import ThemeSwitcher from '../ThemeSwitcher';
import ConsolePanel from '../ConsolePanel';
import StudioErrorBoundary from '../StudioErrorBoundary';
import { type DiagnosticError, parseLog } from '@/lib/studio-core/compiler-utils';

// UI Components
const MonacoEditor = dynamic(() => import('@monaco-editor/react').then(m => m.default), { ssr: false, loading: () => <div style={{ flex: 1, background: '#0a0a0a' }} /> });
const ScholarlyViewer = dynamic(() => import('../ScholarlyPDFViewer').then(m => m.default), { ssr: false, loading: () => <div style={{ height: '100%', background: '#050505' }} /> });

export default function LatexifyIDE({ projectId }: { projectId: string }) {
  const { data: session, status } = useSession();
  const { settings, updatePanels, updatePages } = useLayoutSync(false);
  
  const [fs, setFs] = useState<StudioFS | null>(null);
  const [project, setProject] = useState<StudioProject | null>(null);
  const [files, setFiles] = useState<StudioFile[]>([]);
  const [activeFile, setActiveFile] = useState<string>('main.tex');
  const [openTabs, setOpenTabs] = useState<string[]>(['main.tex']);
  const [code, setCode] = useState('');
  
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [compiling, setCompiling] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [compileLog, setCompileLog] = useState('');
  const [errors, setErrors] = useState<DiagnosticError[]>([]);
  const [engine, setEngine] = useState<'pdflatex' | 'lualatex' | 'xelatex'>('pdflatex');
  const [isAutoMode, setIsAutoMode] = useState(true);
  
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [pdfWidth, setPdfWidth] = useState(550);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [isResizingPdf, setIsResizingPdf] = useState(false);
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState('');
  const [editorMood, setEditorMood] = useState<EditorMood>('obsidian');
  const [jumpTo, setJumpTo] = useState<{ percentage: number; timestamp: number } | null>(null);
  const [syncJumpLine, setSyncJumpLine] = useState<{ line: number; timestamp: number } | null>(null);
  const [syncTexStr, setSyncTexStr] = useState<string | null>(null);
  const [showAiChat, setShowAiChat] = useState(false);
  const [hidePdf, setHidePdf] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant', content: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [sendingChat, setSendingChat] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [messageStates, setMessageStates] = useState<Record<number, 'applied' | 'rejected' | 'none'>>({});
  const [collapsedMessages, setCollapsedMessages] = useState<Record<number, boolean>>({});
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);


  // Auto Scroll to current position
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({ top: chatContainerRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [chatMessages, sendingChat]);

  // Load Chat History from Client Storage
  useEffect(() => {
    if (typeof window !== 'undefined' && projectId) {
      try {
        const saved = localStorage.getItem(`latexify_chat_${projectId}`);
        if (saved) setChatMessages(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load chat history", e);
      }
    }
  }, [projectId]);

  // Click outside handler for Settings Dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setSettingsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Save Chat History
  const saveChatHistory = (msgs: { role: 'user' | 'assistant', content: string }[]) => {
    setChatMessages(msgs);
    if (typeof window !== 'undefined' && projectId) {
      localStorage.setItem(`latexify_chat_${projectId}`, JSON.stringify(msgs));
    }
  };

  const handleSendChat = async () => {
    if (!chatInput.trim() || sendingChat) return;
    const userMsg = chatInput.trim();
    setChatInput('');
    const updatedMsgs = [...chatMessages, { role: 'user' as const, content: userMsg }];
    saveChatHistory(updatedMsgs);
    setSendingChat(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;
    const timeoutId = setTimeout(() => controller.abort(), 120000); // 120 seconds timeout

    try {
      const res = await fetch('/api/latex-studio/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updatedMsgs,
          activeFile,
          fileContent: code,
          allFiles: files.map(f => ({ path: f.path, content: f.path === activeFile ? code : f.content }))
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'AI Agent encountered a runtime anomaly.');

      saveChatHistory([...updatedMsgs, { role: 'assistant' as const, content: data.message }]);
      setCollapsedMessages(prev => ({ ...prev, [updatedMsgs.length]: true }));
    } catch (err: any) {
      clearTimeout(timeoutId);
      let errorMsg = 'AI Agent connection disrupted.';
      if (err.name === 'AbortError') {
        errorMsg = 'AI Agent request timed out (exceeded 120 seconds). Please try a shorter prompt.';
      } else if (err.message) {
        errorMsg = err.message;
      }
      toast.error(errorMsg, { icon: '🤖' });
      saveChatHistory([...updatedMsgs, { role: 'assistant' as const, content: `🛑 **ERROR:** ${errorMsg}` }]);
      setCollapsedMessages(prev => ({ ...prev, [updatedMsgs.length]: true }));
    } finally {
      setSendingChat(false);
    }
  };

  const handleAbortChat = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setSendingChat(false);
      toast.error("AI prompt generation aborted.", { icon: '🛑' });
    }
  };

  const handleDeleteMessage = (idx: number) => {
    const updated = chatMessages.filter((_, i) => i !== idx);
    saveChatHistory(updated);
    toast.success("Message deleted");
  };

  const handleStartEdit = (idx: number, text: string) => {
    setEditingIndex(idx);
    setEditText(text);
  };

  const handleSaveEdit = (idx: number) => {
    const updated = chatMessages.map((m, i) => i === idx ? { ...m, content: editText } : m);
    saveChatHistory(updated);
    setEditingIndex(null);
    toast.success("Message updated");
  };
  
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const isSelfChange = useRef<boolean>(false);
  const filesRef = useRef<StudioFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentPdfBlob = useRef<Blob | null>(null);
  // Stable ref to latest compile fn – safe to call from async callbacks without stale closure
  const compileRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  useEffect(() => {
    setMounted(true);
    document.body.classList.add('theme-indigo');

    if (status === 'loading') return;
    const userEmail = session?.user?.email || 'guest';
    const studioFs = new StudioFS(userEmail);
    setFs(studioFs);

    const loadPdfBlob = async (projId: string) => {
      try {
        const res = await fetch(`/api/projects/${projId}/pdf?base64=true`);
        if (res.ok) {
          const data = await res.json();
          if (data.pdfBase64) {
            const raw = data.pdfBase64.startsWith('data:') ? data.pdfBase64 : `data:application/pdf;base64,${data.pdfBase64}`;
            const blobRes = await fetch(raw);
            const blob = await blobRes.blob();
            if (blob.size > 0) {
              currentPdfBlob.current = blob;
              const blobUrl = URL.createObjectURL(blob);
              setPdfUrl(blobUrl);
              return;
            }
          }
        }
      } catch (_) {}
      // NOTE: Do NOT call setPdfUrl(null) here — if a PDF was already compiled
      // and set in pdfUrl (e.g., by a successful compile), clearing it to null
      // would make it disappear. Only the compile function should control pdfUrl.
    };

    const syncFromCloud = async (studioFs: StudioFS) => {
      setIsSyncing(true);
      try {
        const res = await fetch(`/api/projects/${projectId}`);
        const data = await res.json();
        
        if (data.project) {
          setProject(data.project);
          
          // Clear old local files in StudioFS to avoid stale/conflicting files in local IndexedDB
          try {
            const oldFiles = await studioFs.listFiles(projectId);
            for (const oldFile of oldFiles) {
              await studioFs.deleteFile(projectId, oldFile.path);
            }
          } catch (clearErr) {
            console.warn("Failed to clear old local files:", clearErr);
          }
          
          // Inject project metadata into StudioFS if it's a first-time sync or force-sync
          await studioFs.injectProject(
            projectId, 
            data.project.title || 'Untitled', 
            data.project.templateId || 'blank',
            data.project.mainFile || 'main.tex'
          );
          
          if (data.project.latexContent) {
            await studioFs.writeFile(projectId, 'main.tex', data.project.latexContent);
          }
          
          if (data.project.files && data.project.files.length > 0) {
            // Parallelize asset fetching with a concurrency limit (e.g. 5 at a time)
            const CONCURRENCY = 8;
            const chunks = [];
            for (let i = 0; i < data.project.files.length; i += CONCURRENCY) {
              chunks.push(data.project.files.slice(i, i + CONCURRENCY));
            }

            for (const chunk of chunks) {
              await Promise.all(chunk.map(async (file: any) => {
                const ext = file.filename.split('.').pop()?.toLowerCase();
                const isText = ['tex', 'bib', 'cls', 'sty', 'bst', 'txt'].includes(ext || '');
                const isBinary = ['image', 'png', 'jpg', 'jpeg', 'pdf'].includes(file.fileType) || ['png', 'jpg', 'jpeg', 'pdf'].includes(ext || '');

                if (isText) {
                  if (file.filename !== 'main.tex') {
                    await studioFs.writeFile(projectId, file.filename, file.content || "");
                  }
                } else if (isBinary) {
                  if (file.filePath) {
                    try {
                      const assetRes = await fetch(file.filePath);
                      const blob = await assetRes.blob();
                      const dataUrl = await new Promise<string>((resolve) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result as string);
                        reader.readAsDataURL(blob);
                      });
                      await studioFs.writeFile(projectId, file.filename, dataUrl);
                    } catch (assetErr) {
                      console.error(`Failed to sync binary asset ${file.filename}:`, assetErr);
                    }
                  }
                }
              }));
            }
          }
          
          const freshFiles = await studioFs.listFiles(projectId);
          setFiles(freshFiles);
          
          const activeMeta = freshFiles.find(f => f.path === 'main.tex') || freshFiles[0];
          if (activeMeta) {
            setActiveFile(activeMeta.path);
            const fullFile = await studioFs.readFile(projectId, activeMeta.path);
            if (fullFile) setCode(fullFile.content);
            setOpenTabs([activeMeta.path]);
          }
          
          // Pre-load the compiled PDF document safely as a blob URL to prevent automatic downloads
          await loadPdfBlob(projectId);
          
          toast.success("Workspace synchronized", { icon: '🔄' });
        }
      } catch (err) {
        console.error("Cloud sync failed:", err);
        toast.error("Failed to sync workspace");
      } finally {
        setIsSyncing(false);
      }
    };

    const init = async () => {
      const savedS = settings.panels?.[`latexify_sidebar_${projectId}`] || localStorage.getItem(`latexify_sidebar_${projectId}`);
      const savedP = settings.panels?.[`latexify_pdf_${projectId}`] || localStorage.getItem(`latexify_pdf_${projectId}`);
      const savedMood = settings.panels?.[`latexify_mood_${projectId}`] || (localStorage.getItem(`latexify_mood_${projectId}`) as EditorMood);
      
      if (savedS) setSidebarWidth(parseInt(savedS));
      if (savedP) setPdfWidth(parseInt(savedP));
      if (savedMood) setEditorMood(savedMood);

      const [localProj, fileList] = await Promise.all([
        studioFs.getProject(projectId),
        studioFs.listFiles(projectId)
      ]);

      // FORCE SYNC if flagged in sessionStorage
      const forceSync = sessionStorage.getItem(`force_sync_${projectId}`) === 'true';

      if (localProj && !forceSync) {
        setProject(localProj);
        setFiles(fileList);
        await loadPdfBlob(projectId);
        
        const savedEngine = settings.pages?.[`latexify_engine_${projectId}`] || localStorage.getItem(`latexify_engine_${projectId}`);
        const savedAuto = settings.pages?.[`latexify_auto_${projectId}`] || localStorage.getItem(`latexify_auto_${projectId}`);

        if (savedEngine) setEngine(savedEngine as any);
        else if (localProj.engine) setEngine(localProj.engine as any);

        if (savedAuto) setIsAutoMode(savedAuto === 'true');
        else setIsAutoMode(!localProj.engine);

        const activeMeta = fileList.find(f => f.path === localProj.mainFile) || fileList.find(f => f.path === 'main.tex') || fileList.find(f => f.path.endsWith('.tex')) || fileList[0];
        if (activeMeta) {
          setActiveFile(activeMeta.path);
          const fullActive = await studioFs.readFile(projectId, activeMeta.path);
          const isMainTexEmpty = activeMeta.path === 'main.tex' && (!fullActive || !fullActive.content || fullActive.content.trim().length < 50);
          
          if (isMainTexEmpty) {
            console.log("[StudioFS] Local main.tex is empty/corrupt. Triggering syncFromCloud for self-healing!");
            await syncFromCloud(studioFs);
          } else {
            if (fullActive) {
              setCode(fullActive.content);
            }
            if (!openTabs.includes(activeMeta.path)) setOpenTabs([activeMeta.path]);
          }
        }
      } else {
        await syncFromCloud(studioFs);
      }
    };
    init().catch((err) => console.debug("Init error (non-blocking):", err));
  }, [session, status, projectId, openTabs]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isResizingSidebar) {
      const newWidth = Math.max(180, Math.min(500, e.clientX - 12));
      setSidebarWidth(newWidth);
    } else if (isResizingPdf) {
      const newWidth = Math.max(300, Math.min(window.innerWidth * 0.6, window.innerWidth - e.clientX - 12));
      setPdfWidth(newWidth);
    }
  }, [isResizingSidebar, isResizingPdf]);

  const handleMouseUp = useCallback(() => {
    if (isResizingSidebar) {
      localStorage.setItem(`latexify_sidebar_${projectId}`, sidebarWidth.toString());
      updatePanels({ [`latexify_sidebar_${projectId}`]: sidebarWidth });
    }
    if (isResizingPdf) {
      localStorage.setItem(`latexify_pdf_${projectId}`, pdfWidth.toString());
      updatePanels({ [`latexify_pdf_${projectId}`]: pdfWidth });
    }
    setIsResizingSidebar(false);
    setIsResizingPdf(false);
  }, [isResizingSidebar, isResizingPdf, sidebarWidth, pdfWidth, projectId, updatePanels]);

  useEffect(() => {
    if (isResizingSidebar || isResizingPdf) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    };
  }, [isResizingSidebar, isResizingPdf, handleMouseMove, handleMouseUp]);

  const jumpToLine = async (line: number, path?: string) => {
    if (!editorRef.current) return;

    // 1. Tab Switching Logic
    if (path && path !== activeFile) {
      const fileExists = files.some(f => f.path === path);
      if (fileExists) {
        await switchTab(path);
        // Wait for tab switch and code update
        setTimeout(() => jumpToLine(line, undefined), 50);
        return;
      }
    }

    const editor = editorRef.current;
    
    // 2. Flare Decoration
    const oldDecorations = editor.jumpDecorations || [];
    const newDecorations = editor.deltaDecorations(oldDecorations, [
      {
        range: { startLineNumber: line, startColumn: 1, endLineNumber: line, endColumn: 1 },
        options: {
          isWholeLine: true,
          className: 'monaco-line-flare',
          marginClassName: 'monaco-margin-flare'
        }
      }
    ]);
    editor.jumpDecorations = newDecorations;

    // 3. Reveal and Focus
    editor.revealLineInCenter(line);
    editor.setPosition({ lineNumber: line, column: 1 });
    editor.focus();

    // 4. Cleanup
    setTimeout(() => {
      if (editorRef.current) {
        editorRef.current.jumpDecorations = editorRef.current.deltaDecorations(newDecorations, []);
      }
    }, 3000);
  };

  useEffect(() => {
    if (isAutoMode && code && activeFile === 'main.tex') {
      const best = detectBestEngine(code);
      if (best !== engine) {
        setEngine(best);
      }
    }
  }, [code, isAutoMode, activeFile, engine]);

  useEffect(() => {
    if (mounted && project) {
      localStorage.setItem(`latexify_engine_${projectId}`, engine);
      localStorage.setItem(`latexify_auto_${projectId}`, isAutoMode.toString());
      localStorage.setItem(`latexify_mood_${projectId}`, editorMood);

      updatePages({
        [`latexify_engine_${projectId}`]: engine,
        [`latexify_auto_${projectId}`]: isAutoMode,
      });
      updatePanels({
        [`latexify_mood_${projectId}`]: editorMood,
      });
    }
  }, [engine, isAutoMode, editorMood, mounted, project, projectId, updatePages, updatePanels]);



  // Dynamic Monaco Theme Update
  useEffect(() => {
    if (monacoRef.current && editorMood) {
      const mon = monacoRef.current;
      mon.editor.defineTheme('scholarly-vibrant', {
        base: 'vs-dark',
        inherit: true,
        rules: [
          { token: 'keyword.latex', foreground: '569cd6', fontStyle: 'bold' },
          { token: 'command.latex', foreground: 'c586c0' },
          { token: 'parameter.latex', foreground: '9cdcfe' },
          { token: 'string.latex', foreground: 'ce9178' },
          { token: 'comment.latex', foreground: '6a9955', fontStyle: 'italic' },
          { token: 'math.latex', foreground: 'dcdcaa' },
          { token: 'keyword.control.latex', foreground: '4ec9b0' }
        ],
        colors: {
          'editor.background': EDITOR_MOODS[editorMood].bg,
          'editor.foreground': '#f0f0f0',
          'editorCursor.foreground': '#ffffff',
          'editor.lineHighlightBackground': 'rgba(255,255,255,0.03)',
          'editorLineNumber.foreground': 'rgba(255,255,255,0.2)',
        }
      });
      mon.editor.setTheme('scholarly-vibrant');
    }
  }, [editorMood]);

  // Safely update editor value without resetting cursor position
  useEffect(() => {
    if (editorRef.current) {
      if (isSelfChange.current) {
        isSelfChange.current = false;
        return;
      }
      const currentValue = editorRef.current.getValue();
      const normalizeNewlines = (str: string) => str.replace(/\r\n/g, '\n');
      if (normalizeNewlines(code) !== normalizeNewlines(currentValue)) {
        editorRef.current.setValue(code);
      }
    }
  }, [code]);

  // Handle Diagnostic Markers (Error Squiggles) & Whole Line Highlights
  useEffect(() => {
    if (monacoRef.current && editorRef.current) {
      const model = editorRef.current.getModel();
      if (!model) return;
      
      const monaco = monacoRef.current;
      const editor = editorRef.current;

      // 1. Map compile errors to Monaco markers
      const markers = errors
        .filter(e => {
          const ln = Number(e.line);
          return !isNaN(ln) && ln >= 1 && ln <= model.getLineCount();
        })
        .map(e => {
          const ln = Number(e.line) || 1;
          return {
            severity: e.type === 'error' ? monaco.MarkerSeverity.Error : monaco.MarkerSeverity.Warning,
            message: e.message,
            startLineNumber: ln,
            startColumn: 1,
            endLineNumber: ln,
            endColumn: model.getLineMaxColumn(ln),
          };
        });

      // --- CUSTOM LINTER: Text after \end{document} ---
      if (activeFile.endsWith('.tex')) {
        const lineCount = model.getLineCount();
        let endDocumentLine = -1;
        
        for (let i = 1; i <= lineCount; i++) {
          const lineContent = model.getLineContent(i);
          if (lineContent.includes('\\end{document}')) {
            endDocumentLine = i;
            break;
          }
        }
        
        if (endDocumentLine !== -1) {
          for (let i = endDocumentLine + 1; i <= lineCount; i++) {
            const lineContent = model.getLineContent(i);
            if (lineContent.trim().length > 0) {
              markers.push({
                severity: monaco.MarkerSeverity.Warning,
                message: "Text occurring after \\end{document} is ignored by the LaTeX compiler",
                startLineNumber: i,
                startColumn: 1,
                endLineNumber: i,
                endColumn: model.getLineMaxColumn(i) || 1,
              });
            }
          }
        }
      }
      
      monaco.editor.setModelMarkers(model, 'latex', markers);

      // 2. Map compile errors to Monaco decorations for LINE HIGHLIGHTING
      const oldDecorations = editor.errorDecorations || [];
      
      const activeErrors = errors.filter(e => {
        if (!e.line || e.line <= 0) return false;
        if (!e.file) return true; // Assume active/main file if unspecified
        const errFile = e.file.toLowerCase().split('/').pop();
        const currentFile = activeFile.toLowerCase().split('/').pop();
        return errFile === currentFile;
      });

      const newDecorations = activeErrors
        .filter(e => {
          const ln = Number(e.line);
          return !isNaN(ln) && ln >= 1 && ln <= model.getLineCount();
        })
        .map(e => ({
          range: { startLineNumber: Number(e.line), startColumn: 1, endLineNumber: Number(e.line), endColumn: 1 },
          options: {
            isWholeLine: true,
            className: 'monaco-error-line',
            marginClassName: 'monaco-error-margin',
            hoverMessage: { value: e.message }
          }
        }));

      editor.errorDecorations = editor.deltaDecorations(oldDecorations, newDecorations);
    }
  }, [errors, activeFile, code]);
  const compile = useCallback(async () => {
    if (!fs || compiling || !project || isSyncing) return;
    const rootFile = project?.mainFile || 'main.tex';
    setCompiling(true);
    // NOTE: Do NOT clear pdfUrl here — keep the old PDF visible while recompiling.
    // It will be replaced atomically when the new PDF blob is ready.
    setSyncTexStr(null);
    setCompileLog('');
    setErrors([]);

    try {
      await fs.writeFile(projectId, activeFile, code);
      const payloadMeta = await fs.listFilesMeta(projectId);
      
      const formData = new FormData();
      formData.append('engine', engine);
      formData.append('mainFile', rootFile);
      if (projectId) formData.append('projectId', projectId);
      
      for (let i = 0; i < payloadMeta.length; i++) {
        const fMeta = payloadMeta[i];
        const f = await fs.readFile(projectId, fMeta.path);
        if (!f) continue;
        
        formData.append(`files[${i}][path]`, f.path);
        if (f.content.startsWith('data:')) {
           const res = await fetch(f.content);
           const blob = await res.blob();
           formData.append(`files[${i}][content]`, blob, f.path);
        } else {
           formData.append(`files[${i}][content]`, f.content);
        }
      }

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        throw new Error('No internet connection. Please check your network and try again.');
      }
      const response = await fetch('/api/latex-studio/compile', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      // Helper: render a PDF from the response
      // Priority: pdfBase64 (already in memory, no HTTP race) > pdfUrl (HTTP)
      const renderPdf = async () => {
        if (result.pdfBase64) {
          const raw = result.pdfBase64.startsWith('data:') ? result.pdfBase64 : `data:application/pdf;base64,${result.pdfBase64}`;
          const res = await fetch(raw);
          const blob = await res.blob();
          if (blob.size === 0) throw new Error('Received empty PDF data from compiler.');
          currentPdfBlob.current = blob;
          setPdfUrl(URL.createObjectURL(blob));
        } else if (result.pdfUrl) {
          try {
            const res = await fetch(`${result.pdfUrl}${result.pdfUrl.includes('?') ? '&' : '?'}base64=true`);
            if (res.ok) {
              const data = await res.json();
              if (data.pdfBase64) {
                const raw = data.pdfBase64.startsWith('data:') ? data.pdfBase64 : `data:application/pdf;base64,${data.pdfBase64}`;
                const blobRes = await fetch(raw);
                const blob = await blobRes.blob();
                if (blob.size > 0) {
                  currentPdfBlob.current = blob;
                  setPdfUrl(URL.createObjectURL(blob));
                  return;
                }
              }
            }
          } catch (err) {
            console.error("Failed to load compiled PDF via safe fallback:", err);
          }
          // Raw fetch fallback
          try {
            const res = await fetch(result.pdfUrl, { cache: 'no-store' });
            const blob = await res.blob();
            currentPdfBlob.current = blob;
            setPdfUrl(URL.createObjectURL(blob));
          } catch (err) {
            console.error("Failed to fetch raw PDF:", err);
          }
        }
      };

      if (result.success) {
        if (result.syncTex) setSyncTexStr(result.syncTex);
        await renderPdf();
        setCompileLog(prev => prev + '> SUCCESS: PDF Generated.\n' + (result.log || ''));
        toast.success('Manuscript Compiled Successfully', { icon: '✨' });
      } else if (result.pdfUrl || result.pdfBase64) {
        // PDF was produced despite non-fatal errors (e.g. missing images, undefined cmds)
        await renderPdf();
        const parsedErrors = result.errors || parseLog(result.log || '');
        const realErrors   = parsedErrors.filter((e: any) => e.type === 'error');
        const warnings     = parsedErrors.filter((e: any) => e.type === 'warning');
        setErrors(parsedErrors);
        setCompileLog(prev => prev + `> COMPILED WITH ISSUES: ${realErrors.length} error(s), ${warnings.length} warning(s).\n` + (result.log || ''));
        if (realErrors.length > 0) {
          setConsoleOpen(true);
          toast(`PDF generated with ${realErrors.length} error(s) — check console`, { icon: '⚠️' });
        } else {
          toast(`Compiled with ${warnings.length} warning(s)`, { icon: '🟡' });
        }
      } else {
        const parsedErrors = result.errors || parseLog(result.log || '');
        const realErrors   = parsedErrors.filter((e: any) => e.type === 'error');
        setErrors(parsedErrors);
        setCompileLog(prev => prev + '> ERROR: Compilation Failed.\n' + (result.log || ''));
        setPdfUrl(''); // Clear the stale PDF URL so the user knows compilation failed
        if (realErrors.length > 0) {
          setConsoleOpen(true);
          toast.error(`Build failed: ${realErrors.length} error(s) found.`, { icon: '🚫' });
        } else {
          toast.error(result.message || result.error || 'Compilation Error');
        }
      }
    } catch (err: any) {
      console.error("Compilation failed:", err);
      const errMsg = err?.message || '';
      const isNetwork = errMsg.includes('Failed to fetch') || 
                        errMsg.toLowerCase().includes('fetch') || 
                        errMsg.toLowerCase().includes('network') || 
                        errMsg.toLowerCase().includes('connection') ||
                        err?.name === 'TypeError';
                        
      if (isNetwork) {
        toast.error("Network Error: Unable to reach the compilation server. Please check your connection.");
        setCompileLog(prev => prev + '> CONNECTION ERROR: Failed to contact the compilation server. Please ensure you are online.\n');
      } else {
        const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
        toast.error(isOffline ? "Cannot compile: No internet connection." : "Compilation logic error: Check network or logs.");
        setCompileLog(prev => prev + `> CRITICAL EXCEPTION: ${err.message}\n`);
      }
    } finally {
      setCompiling(false);
    }
  }, [fs, compiling, projectId, activeFile, engine, code, project, isSyncing]);

  // Keep compileRef current so async callbacks always call the latest version
  useEffect(() => {
    compileRef.current = compile;
  }, [compile]);

  // Universal auto-compile trigger: executes after syncFromCloud finishes (isSyncing is false)
  useEffect(() => {
    // code != null handles empty-string LaTeX ('' is valid, just falsy)
    if (fs && project && code != null && !compiling && !isSyncing) {
      const forceSync = sessionStorage.getItem(`force_sync_${projectId}`) === 'true';
      if (forceSync) {
        sessionStorage.removeItem(`force_sync_${projectId}`);
        compile();
      }
    }
  }, [fs, project, code, compiling, isSyncing, projectId, compile]);

  // Global Ctrl+Enter / Cmd+Enter key listener for compilation
  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        compile();
      }
    };
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, [compile]);

  const exportProjectZip = async () => {
    if (!fs) return;
    const blob = await fs.exportZip(projectId);
    saveAs(blob, `${project?.title || 'manuscript'}.zip`);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !fs || !projectId) return;

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const ext = file.name.split('.').pop()?.toLowerCase() || '';
        const isText = ['tex', 'bib', 'cls', 'sty', 'txt'].includes(ext);

        const reader = new FileReader();
        reader.onload = async (event) => {
            const content = event.target?.result as string;
            await fs.writeFile(projectId, file.name, content);
            const newList = await fs.listFiles(projectId);
            setFiles(newList);
            toast.success(`Uploaded ${file.name}`);
        };

        if (isText) {
            reader.readAsText(file);
        } else {
            reader.readAsDataURL(file);
        }
    }
  };

  const handleDeleteFile = async (path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (path === 'main.tex') return toast.error("Cannot delete main.tex");
    if (!confirm(`Delete ${path}?`)) return;
    
    if (fs && projectId) {
        await fs.deleteFile(projectId, path);
        const newList = await fs.listFiles(projectId);
        setFiles(newList);
        if (activeFile === path) {
            const next = newList.find(f => !f.isDirectory) || newList[0];
            if (next) switchTab(next.path);
        }
        setOpenTabs(tabs => tabs.filter(t => t !== path));
        toast.success(`Deleted ${path}`);
    }
  };

  const handleRenameFile = async (oldPath: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (oldPath === 'main.tex') return toast.error("Cannot rename main.tex");
    const newName = window.prompt("Rename file path:", oldPath);
    if (!newName || newName.trim() === "" || newName === oldPath) return;
    try {
      if (fs && projectId) {
        await fs.renameFile(projectId, oldPath, newName.trim());
        toast.success("File renamed");
        const newList = await fs.listFiles(projectId);
        setFiles(newList);
        if (activeFile === oldPath) {
          setActiveFile(newName.trim());
        }
        setOpenTabs(tabs => tabs.map(t => t === oldPath ? newName.trim() : t));
      }
    } catch (err: any) {
      toast.error("Rename failed: " + err.message);
    }
  };

  const createNewFile = async () => {
    const name = prompt("Enter file name (e.g., section1.tex):");
    if (!name || !fs || !projectId) return;

    const fileName = name.endsWith('.tex') || name.includes('.') ? name : `${name}.tex`;
    await fs.writeFile(projectId, fileName, "% New LaTeX Source File\n");
    const newList = await fs.listFiles(projectId);
    setFiles(newList);
    switchTab(fileName);
    toast.success(`Created ${fileName}`);
  };

  const handleTitleSave = async () => {
    if (!tempTitle.trim() || !project || !fs) {
      setIsEditingTitle(false);
      return;
    }
    try {
      const studioFs = new StudioFS(session?.user?.email || 'guest');
      await studioFs.updateProject(projectId, { title: tempTitle });
      
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: tempTitle })
      });

      if (response.ok) {
        setProject(prev => prev ? { ...prev, title: tempTitle } : null);
        toast.success("Project Renamed", { icon: '📝' });
      } else {
        toast.error("Failed to sync rename to cloud");
      }
    } catch {
      toast.error("Rename failed: Local storage error");
    } finally {
      setIsEditingTitle(false);
    }
  };

  const handleFormat = () => {
    const formatted = formatLatexCode(code);
    setCode(formatted);
    toast.success("Code Beautified", { icon: '✨' });
  };

  const isImage = (path: string) => {
    const ext = path.split('.').pop()?.toLowerCase() || '';
    return ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'heic', 'heif', 'tiff', 'tif', 'bmp', 'avif', 'eps', 'pdf'].includes(ext);
  };

  const switchTab = async (path: string) => {
    if (path === activeFile) return;
    if (fs && !isImage(activeFile)) await fs.writeFile(projectId, activeFile, code);
    setActiveFile(path);
    if (!openTabs.includes(path)) setOpenTabs(t => [...t, path]);
    const file = files.find(f => f.path === path);
    if (file) setCode(file.content);
  };

  if (!mounted) return null;

  return (
    <StudioErrorBoundary>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg-primary)', color: 'var(--text-primary)', overflow: 'hidden', fontFamily: 'var(--font-body)' }}>
        
        {/* SAPPHIRE GLASS HEADER */}
        <header style={{ 
          height: '64px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', padding: '0 1.5rem',
          background: 'var(--glass-header)', backdropFilter: 'blur(30px)', flexShrink: 0, position: 'relative', zIndex: 100,
          boxShadow: '0 4px 30px rgba(0, 0, 0, 0.1)', justifyContent: 'space-between', gap: '1rem'
        }}>
          {/* THEME ACCENT BAR */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'var(--accent-gradient)', opacity: 0.8, boxShadow: '0 0 10px var(--accent-glow)' }} />
          
          {/* LEFT GROUP: Dashboard, Logo & Project Title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 0 }}>
            <Link href="/dashboard" title="Return to Dashboard" style={{ 
              width: '32px', height: '32px', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', transition: 'all 0.2s', flexShrink: 0
            }}>
              <LayoutDashboard size={16} />
            </Link>

            <div style={{ width: 1, height: 24, background: 'var(--border)', flexShrink: 0 }} />

            <div 
              onClick={() => window.location.href = '/latex-studio/projects'} 
              style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', cursor: 'pointer', flexShrink: 0 }}
            >
               <LatexifyLogo size={40} />
            </div>

            <div style={{ width: 1, height: 24, background: 'var(--border)', flexShrink: 0 }} />

            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                {isEditingTitle ? (
                  <input 
                    autoFocus
                    value={tempTitle}
                    onChange={e => setTempTitle(e.target.value)}
                    onBlur={handleTitleSave}
                    onKeyDown={e => e.key === 'Enter' && handleTitleSave()}
                    style={{ 
                      background: 'var(--ide-input-bg)', color: 'var(--ide-title-text)', border: '1px solid var(--accent-primary)', 
                      borderRadius: '4px', fontSize: '0.85rem', fontWeight: 600, padding: '2px 8px', width: 'auto',
                      minWidth: '150px', outline: 'none', fontFamily: 'var(--font-headline)'
                    }}
                  />
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0 }}>
                    <span 
                      onClick={() => { setIsEditingTitle(true); setTempTitle(project?.title || ''); }}
                      style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--ide-title-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: 'var(--font-headline)', letterSpacing: '-0.01em', cursor: 'pointer' }}
                    >
                      {project?.title || 'Academic Project...'}
                    </span>
                    <Pencil 
                      size={12} 
                      onClick={() => { setIsEditingTitle(true); setTempTitle(project?.title || ''); }}
                      style={{ opacity: 0.5, cursor: 'pointer', transition: 'all 0.2s', color: 'var(--accent-primary)', flexShrink: 0 }} 
                      onMouseOver={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'scale(1.1)'; }}
                      onMouseOut={e => { e.currentTarget.style.opacity = '0.5'; e.currentTarget.style.transform = 'scale(1)'; }}
                    />
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '2px' }}>
                 <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent-primary)', boxShadow: '0 0 6px var(--accent-primary)' }} />
                 <span style={{ fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase', opacity: 0.4, letterSpacing: '0.05em' }}>ACTIVE WORKSPACE</span>
              </div>
            </div>
          </div>

          {/* RIGHT GROUP: Actions, Settings popover & Compiler */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
             <button 
               onClick={() => setShowAiChat(!showAiChat)}
               title="Toggle AI Assistant"
               style={{ 
                 background: showAiChat ? 'var(--accent-glow)' : 'var(--ide-btn-bg)', 
                 border: '1px solid var(--ide-btn-border)', 
                 color: 'var(--accent-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', 
                 gap: '0.4rem', padding: '0.35rem 0.6rem', borderRadius: '8px', fontSize: '0.65rem', fontWeight: 800 
               }}
             >
                <Bot size={14} />
                <span className="ide-btn-label">AI AGENT</span>
             </button>

             <button 
                onClick={() => setHidePdf(!hidePdf)}
                title={hidePdf ? "Show PDF Viewer" : "Hide PDF Viewer"}
                style={{ 
                  background: 'var(--ide-btn-bg)', border: '1px solid var(--ide-btn-border)', 
                  color: 'var(--accent-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', 
                  gap: '0.4rem', padding: '0.35rem 0.6rem', borderRadius: '8px', fontSize: '0.65rem', fontWeight: 800 
                }}
              >
                 {hidePdf ? <Eye size={14} /> : <EyeOff size={14} />}
                 <span className="ide-btn-label">{hidePdf ? "SHOW PDF" : "HIDE PDF"}</span>
              </button>

             <button 
                onClick={handleFormat}
                disabled={!code || !code.trim() || isImage(activeFile)}
                title={!code || !code.trim() ? "No code to beautify" : isImage(activeFile) ? "Cannot beautify image files" : "Beautify & Tidy Code (Auto-Format)"}
                style={{ 
                  background: !code || !code.trim() || isImage(activeFile) ? 'transparent' : 'var(--ide-btn-bg)', 
                   border: '1px solid var(--ide-btn-border)', 
                   color: !code || !code.trim() || isImage(activeFile) ? 'var(--text-secondary)' : 'var(--accent-primary)', 
                  cursor: !code || !code.trim() || isImage(activeFile) ? 'not-allowed' : 'pointer', 
                  display: 'flex', alignItems: 'center', 
                  gap: '0.4rem', padding: '0.35rem 0.6rem', borderRadius: '8px', fontSize: '0.65rem', fontWeight: 800,
                  opacity: !code || !code.trim() || isImage(activeFile) ? 0.4 : 1
                }}
              >
                 <Sparkles size={14} />
                 <span className="ide-btn-label">BEAUTIFY</span>
              </button>

             <ThemeSwitcher />

             {/* SETTINGS GEAR POPOVER */}
             <div style={{ position: 'relative' }} ref={settingsRef}>
                <button 
                  onClick={() => setSettingsOpen(!settingsOpen)}
                  title="Editor & Engine Settings"
                  style={{ 
                    background: settingsOpen ? 'var(--accent-glow)' : 'var(--ide-btn-bg)', 
                    border: '1px solid var(--ide-btn-border)', 
                    color: 'var(--accent-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', 
                    gap: '0.4rem', padding: '0.35rem 0.6rem', borderRadius: '8px', fontSize: '0.65rem', fontWeight: 800,
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={e => !settingsOpen && (e.currentTarget.style.background = 'var(--ide-btn-border)')}
                  onMouseOut={e => !settingsOpen && (e.currentTarget.style.background = 'var(--ide-btn-bg)')}
                >
                   <Settings size={14} />
                   <span className="ide-btn-label">SETTINGS</span>
                </button>
                
                <AnimatePresence>
                  {settingsOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      style={{
                        position: 'absolute', right: 0, marginTop: '0.5rem', width: '280px',
                        background: 'var(--ide-popover-bg)', backdropFilter: 'blur(30px)',
                        border: '1px solid var(--ide-popover-border)', borderRadius: '16px',
                        boxShadow: '0 10px 40px rgba(0,0,0,0.2)', zIndex: 200, padding: '1.25rem',
                        display: 'flex', flexDirection: 'column', gap: '1.25rem',
                        color: 'var(--ide-popover-text)'
                      }}
                    >
                      {/* COMPILER ENGINE */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                         <span style={{ fontSize: '0.65rem', fontWeight: 900, color: 'var(--accent-primary)', letterSpacing: '0.1em' }}>COMPILER ENGINE</span>
                         <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <select 
                              value={engine} 
                              onChange={e => {
                                setEngine(e.target.value as any);
                                setIsAutoMode(false); // Manual override
                                toast.success(`Engine set to ${e.target.value}. Auto-detection disabled.`, { icon: '⚙️' });
                              }}
                              style={{ 
                                flex: 1, background: 'var(--ide-input-bg)', color: 'var(--ide-popover-text)', border: '1px solid var(--ide-btn-border)', 
                                borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700, padding: '0.4rem 0.6rem', cursor: 'pointer', outline: 'none' 
                              }}
                            >
                              <option value="pdflatex">pdfLaTeX {isAutoMode && engine === 'pdflatex' ? '(Auto)' : ''}</option>
                              <option value="lualatex">LuaLaTeX {isAutoMode && engine === 'lualatex' ? '(Auto)' : ''}</option>
                              <option value="xelatex">XeLaTeX {isAutoMode && engine === 'xelatex' ? '(Auto)' : ''}</option>
                            </select>
                            <button
                              onClick={() => {
                                const nextAuto = !isAutoMode;
                                setIsAutoMode(nextAuto);
                                localStorage.setItem(`latexify_auto_${projectId}`, nextAuto.toString());
                                if (nextAuto) toast.success("Auto-engine detection enabled");
                              }}
                              style={{
                                fontSize: '0.65rem', fontWeight: 900, cursor: 'pointer', padding: '0.4rem 0.6rem', borderRadius: '8px', 
                                background: isAutoMode ? 'var(--accent-glow)' : 'var(--ide-btn-bg)',
                                color: isAutoMode ? 'var(--accent-primary)' : 'var(--ide-btn-text)',
                                border: `1px solid ${isAutoMode ? 'var(--accent-primary)' : 'var(--ide-btn-border)'}`,
                                transition: 'all 0.2s'
                              }}
                            >
                              AUTO
                            </button>
                         </div>
                      </div>

                      {/* EDITOR MOOD */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                         <span style={{ fontSize: '0.65rem', fontWeight: 900, color: 'var(--accent-primary)', letterSpacing: '0.1em' }}>EDITOR MOOD</span>
                         <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', background: 'var(--ide-group-bg)', padding: '0.5rem 0.75rem', borderRadius: '10px', border: '1px solid var(--ide-group-border)' }}>
                            {(Object.keys(EDITOR_MOODS) as EditorMood[]).map(m => (
                              <div 
                                key={m}
                                onClick={() => setEditorMood(m)}
                                title={`Switch to ${EDITOR_MOODS[m].name} Mood`}
                                style={{ 
                                  width: 16, height: 16, borderRadius: '50%', background: EDITOR_MOODS[m].bg, 
                                   border: editorMood === m ? '2.5px solid var(--ide-text-inverse)' : '1px solid var(--ide-text-subtle)', 
                                  cursor: 'pointer',
                                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                  transform: editorMood === m ? 'scale(1.2)' : 'scale(1)',
                                  boxShadow: editorMood === m ? `0 0 10px ${EDITOR_MOODS[m].bg}` : 'none'
                                }} 
                                onMouseOver={e => e.currentTarget.style.transform = 'scale(1.3)'}
                                onMouseOut={e => e.currentTarget.style.transform = (editorMood === m ? 'scale(1.2)' : 'scale(1)')}
                              />
                            ))}
                         </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
             </div>
             
             {/* COMPILE BUTTON */}
             <motion.button 
               whileHover={{ scale: 1.02 }}
               whileTap={{ scale: 0.98 }}
               onClick={compile} 
               disabled={compiling} 
               style={{ 
                  background: compiling ? 'var(--bg-tertiary)' : 'var(--accent-primary)', 
                 color: '#fff', 
                 border: compiling ? '1px solid var(--border)' : '1px solid var(--accent-primary)', 
                 padding: '0.35rem 0.8rem', borderRadius: '8px', 
                 fontWeight: 800, fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem',
                 boxShadow: compiling ? 'none' : '0 4px 15px var(--accent-glow)', fontFamily: 'var(--font-headline)', letterSpacing: '0.02em'
               }}
             >
               {compiling ? <RefreshCw size={14} className="spinner" /> : <Command size={14} strokeWidth={2} />} 
               <span>
                 {compiling ? 'Building...' : <>COMPILE<span className="ide-btn-label"> PROJECT</span></>}
               </span>
             </motion.button>
          </div>

        </header>

          <div style={{ 
            display: 'flex', flex: 1, overflow: 'hidden', padding: '0.5rem', gap: '0.375rem',
            background: 'var(--bg-secondary)', borderRadius: '16px', margin: '0.5rem', border: '1px solid var(--border)'
          }}>
            
            <motion.aside 
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              style={{ width: sidebarWidth, display: 'flex', flexDirection: 'column', gap: '0.75rem', flexShrink: 0 }}
            >
              <div className="glass-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid var(--glass-card-border)', borderRadius: '12px', background: 'var(--glass-card-bg)', backdropFilter: 'blur(10px)' }}>
                <div style={{ padding: '0.85rem 1rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Layout size={14} strokeWidth={2} style={{ color: 'var(--accent-primary)' }} />
                      <span style={{ fontSize: '0.65rem', fontWeight: 900, color: 'var(--accent-primary)', letterSpacing: '0.15em', fontFamily: 'var(--font-headline)' }}>SOURCE ASSETS</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                     <button onClick={createNewFile} style={{ background: 'transparent', border: 'none', color: 'var(--accent-primary)', opacity: 0.8, cursor: 'pointer', display: 'flex' }} title="New File">
                        <Plus size={14} strokeWidth={2} />
                     </button>
                     <button onClick={() => fileInputRef.current?.click()} style={{ background: 'transparent', border: 'none', color: 'var(--accent-primary)', opacity: 0.8, cursor: 'pointer', display: 'flex' }} title="Upload File">
                        <Upload size={14} strokeWidth={2} />
                     </button>
                     <input 
                       type="file" 
                       ref={fileInputRef} 
                       onChange={handleFileUpload} 
                       style={{ display: 'none' }} 
                       multiple 
                     />
                  </div>
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
                  {files.map(f => (
                    <motion.div 
                      whileHover={{ x: 2, background: 'rgba(255,255,255,0.02)' }}
                      key={f.path} 
                      onClick={() => switchTab(f.path)} 
                      className={`file-sidebar-item ${activeFile === f.path ? 'active' : ''}`}
                      style={{ 
                        display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.55rem 0.75rem', borderRadius: '8px', cursor: 'pointer',
                        background: activeFile === f.path ? 'var(--bg-tertiary)' : 'transparent',
                        marginBottom: '2px', fontSize: '0.85rem', fontWeight: activeFile === f.path ? 700 : 500, transition: 'all 0.2s', fontFamily: 'var(--font-headline)',
                        justifyContent: 'space-between'
                      }}
                     >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                           <div 
                             className={`file-sidebar-dot ${activeFile === f.path ? 'active' : ''}`}
                             style={{ 
                               width: 6, 
                               height: 6, 
                               borderRadius: '50%', 
                               opacity: activeFile === f.path ? 1 : 0.6
                             }} 
                           />
                           <span style={{ color: 'inherit' }}>{f.path}</span>
                        </div>
                        {f.path !== 'main.tex' && (
                          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                            <button 
                              onClick={(e) => handleRenameFile(f.path, e)}
                              style={{ background: 'transparent', border: 'none', color: 'inherit', opacity: 0.5, transition: 'opacity 0.2s', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}
                              title="Rename File"
                            >
                               <Pencil size={12} />
                            </button>
                            <button 
                              onClick={(e) => handleDeleteFile(f.path, e)}
                              style={{ background: 'transparent', border: 'none', color: 'inherit', opacity: 0.5, transition: 'opacity 0.2s', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}
                              title="Delete File"
                            >
                               <Trash2 size={12} />
                            </button>
                          </div>
                        )}
                     </motion.div>
                  ))}
               </div>
            </div>

            <div className="glass-card" style={{ padding: '0.75rem', borderRadius: '16px', border: '1px solid var(--glass-card-border)', background: 'var(--glass-card-bg)' }}>
               <button onClick={exportProjectZip} style={{ width: '100%', padding: '0.7rem', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: '10px', color: 'var(--accent-primary)', fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem', fontFamily: 'var(--font-headline)', letterSpacing: '0.05em' }}>
                  <Download size={14} strokeWidth={2} style={{ color: 'var(--accent-primary)' }} /> EXPORT SOURCE ZIP
               </button>
            </div>
           </motion.aside>

           {/* RESIZER SIDEBAR */}
            <div 
              onMouseDown={() => setIsResizingSidebar(true)}
              style={{ 
                width: '6px', cursor: 'col-resize', borderRadius: '3px', transition: 'all 0.2s', margin: '0 -2px', zIndex: 10,
                background: isResizingSidebar ? 'var(--accent-primary)' : 'color-mix(in srgb, var(--text-primary) 8%, transparent)' 
              }} 
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--accent-primary)'}
              onMouseLeave={(e) => e.currentTarget.style.background = isResizingSidebar ? 'var(--accent-primary)' : 'color-mix(in srgb, var(--text-primary) 8%, transparent)'}
           />
 
           {/* NEW WORKSPACE WRAPPER */}
           <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, gap: '0.25rem' }}>
             
             <div style={{ display: 'flex', flex: 1, minHeight: 0, gap: '0.25rem' }}>
               <motion.main 
                 initial={{ y: 20, opacity: 0 }}
                 animate={{ y: 0, opacity: 1 }}
                  style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: EDITOR_MOODS[editorMood].bg, borderRadius: '16px', border: '1px solid var(--border)', overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}
               >
                 <div className="custom-scroll" style={{ 
                     height: '42px', 
                     background: 'var(--bg-secondary)', 
                     backdropFilter: 'blur(10px)', 
                     display: 'flex', 
                     borderBottom: '1px solid var(--border)', 
                     position: 'relative', 
                     overflowX: 'auto', 
                     overflowY: 'hidden', 
                     whiteSpace: 'nowrap',
                     scrollbarWidth: 'none',
                     msOverflowStyle: 'none'
                   }}>
                      {openTabs.map(t => (
                        <div key={t} onClick={() => switchTab(t)} style={{ 
                          padding: '0 1rem', height: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: activeFile === t ? 800 : 600,
                          background: activeFile === t ? 'var(--bg-primary)' : 'transparent', borderRight: '1px solid var(--border)', 
                          color: activeFile === t ? 'var(--text-primary)' : 'var(--text-secondary)', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', position: 'relative', fontFamily: 'var(--font-headline)', letterSpacing: '0.05em',
                          flexShrink: 1, minWidth: '80px', maxWidth: '160px', overflow: 'hidden'
                        }}>
                           {isImage(t) ? <Layout size={14} strokeWidth={2.5} style={{ opacity: activeFile === t ? 1 : 0.5, flexShrink: 0 }} /> : <FileText size={14} strokeWidth={2.5} style={{ opacity: activeFile === t ? 1 : 0.5, flexShrink: 0 }} />}
                           <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{t.toUpperCase()}</span>
                           {openTabs.length > 1 && (
                             <button 
                               onClick={(e) => {
                                 e.stopPropagation();
                                 const newTabs = openTabs.filter(tab => tab !== t);
                                 setOpenTabs(newTabs);
                                 if (activeFile === t) {
                                   const nextActive = newTabs[0] || '';
                                   setActiveFile(nextActive);
                                   const foundFile = files.find(f => f.path === nextActive);
                                   if (foundFile) setCode(foundFile.content);
                                 }
                               }}
                               style={{ background: 'transparent', border: 'none', color: 'currentColor', opacity: activeFile === t ? 0.7 : 0.4, cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '2px', flexShrink: 0 }}
                               className="hover:text-red-500 transition-colors cursor-pointer"
                             >
                               <X size={12} />
                             </button>
                           )}
                          {activeFile === t && (
                            <motion.div 
                              layoutId="tab-highlight-l" 
                              style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '2px', background: 'var(--accent-primary)', boxShadow: '0 0 10px var(--accent-glow)' }} 
                            />
                          )}
                       </div>
                     ))}
                  </div>
                           <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'row', minHeight: 0 }}>
                     <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                        {isImage(activeFile) ? (
                           <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-secondary)', padding: '2rem' }}>
                              <div style={{ position: 'relative', maxWidth: '100%', maxHeight: '100%', boxShadow: '0 0 50px rgba(0,0,0,0.5)', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                 {(() => {
                                   const ext = activeFile.split('.').pop()?.toLowerCase() || '';
                                   const isRenderable = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'avif', 'bmp'].includes(ext);
                                   if (isRenderable) {
                                     return (
                                       <Image 
                                         src={code} 
                                         alt={activeFile} 
                                         width={800}
                                         height={600}
                                         unoptimized
                                         style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain', display: 'block' }} 
                                       />
                                     );
                                   } else if (ext === 'pdf') {
                                     let pdfSrc = code;
                                     if (pdfSrc.startsWith('data:application/octet-stream;')) {
                                       pdfSrc = pdfSrc.replace('data:application/octet-stream;', 'data:application/pdf;');
                                     } else if (!pdfSrc.startsWith('data:') && !pdfSrc.startsWith('http') && !pdfSrc.startsWith('/')) {
                                       pdfSrc = `data:application/pdf;base64,${pdfSrc}`;
                                     }
                                     return (
                                       <iframe 
                                         src={pdfSrc} 
                                         style={{ width: '100%', height: '80vh', minWidth: '600px', border: 'none', background: '#fff', borderRadius: '8px' }} 
                                         title="PDF Preview"
                                       />
                                     );
                                   } else {
                                     return (
                                       <div style={{
                                         width: '450px',
                                         padding: '2.5rem',
                                         background: 'rgba(255, 255, 255, 0.02)',
                                         backdropFilter: 'blur(16px)',
                                         border: '1px solid rgba(255, 255, 255, 0.06)',
                                         borderRadius: '12px',
                                         display: 'flex',
                                         flexDirection: 'column',
                                         alignItems: 'center',
                                         textAlign: 'center',
                                         gap: '1.25rem',
                                         boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
                                         margin: '2rem'
                                       }}>
                                         <div style={{
                                           width: '64px',
                                           height: '64px',
                                           borderRadius: '50%',
                                           background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(168, 85, 247, 0.2) 100%)',
                                           border: '1px solid rgba(99, 102, 241, 0.3)',
                                           display: 'flex',
                                           alignItems: 'center',
                                           justifyContent: 'center',
                                           boxShadow: '0 0 20px rgba(99, 102, 241, 0.15)',
                                           color: '#a855f7'
                                         }}>
                                           <span style={{ fontSize: '1.75rem', fontWeight: 'bold' }}>✨</span>
                                         </div>
                                         <h3 style={{
                                           fontSize: '1rem',
                                           fontWeight: 700,
                                           color: '#f3f4f6',
                                           margin: 0,
                                           fontFamily: 'var(--font-headline)',
                                           letterSpacing: '0.05em'
                                         }}>
                                           AUTO-OPTIMIZED FIGURE ASSET
                                         </h3>
                                         <p style={{
                                           fontSize: '0.75rem',
                                           lineHeight: '1.5',
                                           color: '#9ca3af',
                                           margin: 0,
                                           fontFamily: 'var(--font-headline)'
                                         }}>
                                           This figure format (<code style={{ color: 'var(--accent-primary)', padding: '0.1rem 0.3rem', background: 'rgba(255,255,255,0.06)', borderRadius: '4px' }}>{ext.toUpperCase()}</code>) will be automatically processed, transcoded, and compiled on the backend during PDF generation. Live web previews are skipped to maintain peak editing speed.
                                         </p>
                                       </div>
                                     );
                                   }
                                 })()}
                                 <div style={{ width: '100%', padding: '0.75rem', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#888', fontFamily: 'var(--font-headline)' }}>{activeFile.toUpperCase()}</span>
                                    <span style={{ fontSize: '0.6rem', background: 'var(--accent-primary)', color: '#fff', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: 900 }}>IMAGE ASSET</span>
                                 </div>
                              </div>
                           </div>
                        ) : (
                          <MonacoEditor 
                            height="100%" 
                            theme="vs-dark" 
                            language="latex" 
                            defaultValue={code}
                            onChange={v => {
                              isSelfChange.current = true;
                              setCode(v || '');
                            }}
                            onMount={(ed, mon) => { 
                              editorRef.current = ed; 
                              monacoRef.current = mon; 
                              if (code) {
                                ed.setValue(code);
                              } 
                              
                              // Register LaTeX Language & Monarch Tokenizer for Multicolor Syntax Highlighting
                              try {
                                mon.languages.register({ id: 'latex' });
                              } catch(e) {}
                              
                              try {
                                mon.languages.setMonarchTokensProvider('latex', {
                                  defaultToken: '',
                                  tokenPostfix: '.latex',
                                  tokenizer: {
                                    root: [
                                      // Comments
                                      [/%.*$/, 'comment.latex'],
                                      // Math Mode
                                      [/\$\$/, { token: 'math.latex', next: '@mathModeBlock' }],
                                      [/\$/, { token: 'math.latex', next: '@mathModeInline' }],
                                      // Keywords / Commands
                                      [/\\(?:begin|end|documentclass|usepackage|title|author|date|maketitle|section|subsection|subsubsection|paragraph|label|ref|cite|bibliography|bibliographystyle|include|input|newcommand|renewcommand|centering|includegraphics|caption|item|textbf|textit|texttt)\b/, 'keyword.latex'],
                                      [/\\(?:[a-zA-Z]+)/, 'command.latex'],
                                      // Delimiters / Braces
                                      [/[{}()\[\]]/, 'delimiter'],
                                      [/\d+/, 'number'],
                                    ],
                                    mathModeBlock: [
                                      [/\$\$/, { token: 'math.latex', next: '@pop' }],
                                      [/./, 'math.latex'],
                                    ],
                                    mathModeInline: [
                                      [/\$/, { token: 'math.latex', next: '@pop' }],
                                      [/./, 'math.latex'],
                                    ]
                                  }
                                });
                              } catch(e) {}

                              // Register LaTeX Suggestion Provider
                              mon.languages.registerCompletionItemProvider('latex', {
                                provideCompletionItems: (model: any, position: any) => {
                                  return { suggestions: getLatexSuggestions(mon, model, position, filesRef.current) };
                                }
                              });

                              // Register Ctrl+Enter command to compile
                              try {
                                ed.addCommand(mon.KeyMod.CtrlCmd | mon.KeyCode.Enter, () => {
                                  compileRef.current?.();
                                });
                              } catch (e) {
                                console.warn("Failed to bind Ctrl+Enter command:", e);
                              }
                            }}
                            options={{
                              fontSize: 14,
                              padding: { top: 20, bottom: 20 },
                              minimap: { enabled: false },
                              lineNumbers: 'on',
                              lineNumbersMinChars: 3,
                              glyphMargin: false,
                              lineDecorationsWidth: 0,
                              cursorBlinking: 'smooth',
                              smoothScrolling: true,
                              fontFamily: 'var(--font-mono)',
                              fontLigatures: true,
                              renderLineHighlight: 'all',
                              scrollbar: { vertical: 'visible', horizontal: 'visible', verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
                              automaticLayout: true,
                              wordWrap: 'on'
                            }}
                          />
                        )}
                     </div>

                      {showAiChat && (
                        <div style={{ 
                          width: '340px', borderLeft: '1px solid var(--border)', 
                          display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)', 
                          backdropFilter: 'blur(30px)', fontFamily: 'var(--font-headline)', flexShrink: 0
                        }}>
                          <div style={{ padding: '0.6rem 0.9rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                             <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--accent-primary)', letterSpacing: '0.1em' }}>AI ASSISTANT</span>
                             <button onClick={() => setShowAiChat(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex' }}>
                               <X size={14} />
                             </button>
                          </div>
                          
                          <div ref={chatContainerRef} className="custom-scroll" style={{ flex: 1, overflowY: 'auto', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {chatMessages.length === 0 ? (
                              <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: '3rem', padding: '0 1rem', lineHeight: 1.5 }}>
                                <Bot size={32} className="text-primary mb-2 block mx-auto" />
                                Ask anything regarding formulas, bibliography files, structure overrides, or package settings!
                              </div>
                            ) : (
                              chatMessages.map((m, i) => (
                                <div key={i} style={{ 
                                  padding: '0.75rem 1rem', borderRadius: '12px', 
                                  background: m.role === 'user' ? 'var(--bg-tertiary)' : 'var(--bg-accent-faint)',
                                  color: 'var(--text-primary)', alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                                  maxWidth: '90%', fontSize: '0.8rem', border: m.role === 'user' ? '1px solid var(--border)' : '1px solid var(--border-accent)',
                                  boxShadow: m.role === 'assistant' ? '0 4px 20px rgba(15, 98, 254, 0.1)' : 'none',
                                  position: 'relative'
                                }}>
                                  {editingIndex === i ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                      <textarea 
                                        value={editText}
                                        onChange={e => setEditText(e.target.value)}
                                        style={{ 
                                          width: '100%', background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                                          borderRadius: '8px', padding: '0.5rem', color: 'var(--text-primary)', fontSize: '0.8rem', outline: 'none',
                                          fontFamily: 'var(--font-mono)', minHeight: '60px'
                                        }}
                                      />
                                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.4rem' }}>
                                        <button onClick={() => setEditingIndex(null)} style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: 'none', borderRadius: '4px', padding: '0.2rem 0.5rem', fontSize: '0.65rem', cursor: 'pointer' }}>Cancel</button>
                                        <button onClick={() => handleSaveEdit(i)} style={{ background: 'var(--accent-primary)', color: '#fff', border: 'none', borderRadius: '4px', padding: '0.2rem 0.5rem', fontSize: '0.65rem', cursor: 'pointer' }}>Save</button>
                                      </div>
                                    </div>
                                  ) : (
                                    <>
                                      {m.role === 'assistant' && (
                                        <div 
                                          onClick={() => setCollapsedMessages(prev => ({ ...prev, [i]: !prev[i] }))} 
                                          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.3rem' }}
                                        >
                                           <ChevronRight size={14} className="text-primary transition-transform" style={{ transform: collapsedMessages[i] ? 'rotate(0deg)' : 'rotate(90deg)' }} />
                                           <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                                            {collapsedMessages[i] ? 'Expand Response' : 'Collapse Response'}
                                          </span>
                                        </div>
                                      )}

                                      {!(m.role === 'assistant' && collapsedMessages[i]) && (
                                        <>
                                          {m.content.split('\n').map((line, idx) => {
                                             if (line.startsWith('```') && line.length > 3) return null;
                                             if (line === '```') return null;
                                             return <p key={idx} style={{ margin: '0 0 0.6rem 0', lineHeight: 1.4, wordBreak: 'break-word' }}>{line}</p>
                                          })}
                                        </>
                                      )}
                                      
                                      {m.role === 'assistant' && (
                                        <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.5rem' }}>
                                            <button 
                                              onClick={() => {
                                                const match = m.content.match(/```(?:latex|tex|bib|bst|cls|sty)?\n([\s\S]*?)```/);
                                                if (match && match[1]) {
                                                  const extracted = match[1];
                                                  const isFullDoc = extracted.includes('\\documentclass');
                                                  const newCode = isFullDoc ? extracted : `${code}\n${extracted}`;
                                                  setCode(newCode);
                                                  toast.success(isFullDoc ? "Full document applied to editor!" : "Snippet inserted into editor!");
                                                  setTimeout(() => compileRef.current?.(), 100);
                                                } else {
                                                  toast.error("No code block detected in message.");
                                                }
                                                setMessageStates(prev => ({ ...prev, [i]: 'applied' }));
                                              }}
                                             style={{ 
                                               background: messageStates[i] === 'applied' ? 'var(--bg-tertiary)' : 'var(--accent-primary)', 
                                               color: '#fff', border: 'none', padding: '0.35rem 0.6rem', borderRadius: '6px', fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer', flex: 1 
                                             }}
                                           >
                                             {messageStates[i] === 'applied' ? 'Code Inserted' : 'Apply'}
                                           </button>
                                           
                                           <button 
                                             onClick={() => {
                                               setMessageStates(prev => ({ ...prev, [i]: 'rejected' }));
                                               toast.success("Response marked as rejected");
                                             }}
                                             style={{ 
                                                background: messageStates[i] === 'rejected' ? 'var(--bg-tertiary)' : 'rgba(255, 77, 77, 0.2)', 
                                                color: messageStates[i] === 'rejected' ? 'var(--text-secondary)' : '#ff4d4d', border: '1px solid rgba(255, 77, 77, 0.3)', padding: '0.35rem 0.6rem', borderRadius: '6px', fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer', flex: 1 
                                             }}
                                           >
                                             {messageStates[i] === 'rejected' ? 'Rejected' : 'Reject'}
                                           </button>
                                        </div>
                                      )}

                                      <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end', marginTop: '0.4rem', opacity: 0.8, transition: 'opacity 0.2s' }} className="msg-controls">
                                         <button 
                                            onClick={async () => {
                                              try {
                                                if (navigator?.clipboard?.writeText) {
                                                  await navigator.clipboard.writeText(m.content);
                                                  toast.success("Copied to clipboard");
                                                  return;
                                                }
                                              } catch (err) {
                                                console.warn("Failed to copy with navigator.clipboard:", err);
                                              }

                                              try {
                                                const textarea = document.createElement("textarea");
                                                textarea.value = m.content;
                                                textarea.style.position = "fixed";
                                                textarea.style.opacity = "0";
                                                document.body.appendChild(textarea);
                                                textarea.select();
                                                const success = document.execCommand("copy");
                                                document.body.removeChild(textarea);
                                                if (success) {
                                                  toast.success("Copied to clipboard");
                                                  return;
                                                }
                                              } catch (fallbackErr) {
                                                console.error("Fallback copy failed:", fallbackErr);
                                              }

                                              toast.error("Failed to copy message. Please select and copy manually.");
                                            }}
                                            title="Copy Message"
                                            style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', padding: '2px' }}
                                          >
                                           <Copy size={12} />
                                         </button>
                                         <button 
                                           onClick={() => handleStartEdit(i, m.content)}
                                           title="Edit Message"
                                           style={{ background: 'transparent', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', display: 'flex', padding: '2px' }}
                                         >
                                           <Pencil size={12} />
                                         </button>
                                         <button 
                                           onClick={() => handleDeleteMessage(i)}
                                           title="Delete Message"
                                           style={{ background: 'transparent', border: 'none', color: '#ff6b6b', cursor: 'pointer', display: 'flex', padding: '2px' }}
                                         >
                                           <Trash2 size={12} />
                                         </button>
                                      </div>
                                    </>
                                  )}
                                </div>
                              ))
                            )}
                              {sendingChat && (
                                <div style={{ 
                                  alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '0.6rem', 
                                  padding: '0.5rem 0.75rem', background: 'var(--bg-accent-faint)', 
                                  border: '1px solid var(--border-accent)', borderRadius: '10px', 
                                  color: 'var(--text-secondary)', fontSize: '0.75rem',
                                  boxShadow: '0 4px 15px rgba(15, 98, 254, 0.1)',
                                  marginBottom: '0.5rem'
                                }}>
                                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                    <span style={{ 
                                      width: '10px', height: '10px', border: '2px solid var(--border)', 
                                      borderTop: '2px solid var(--accent-primary)', borderRadius: '50%', animation: 'spin 1s linear infinite',
                                      display: 'inline-block' 
                                    }} />
                                 </div>
                                 AI Agent is computing response...
                               </div>
                             )}
                         </div>

                          <div style={{ padding: '0.6rem 0.75rem', borderTop: '1px solid var(--border)', display: 'flex', gap: '0.5rem', background: 'var(--bg-secondary)' }}>
                            <input 
                              type="text" 
                              value={chatInput}
                              onChange={e => setChatInput(e.target.value)}
                              onKeyDown={e => e.key === 'Enter' && handleSendChat()}
                              placeholder="Ask AI assistant..."
                              disabled={sendingChat}
                              style={{ 
                                flex: 1, background: 'var(--bg-tertiary)', border: '1px solid var(--border)',
                                borderRadius: '8px', padding: '0.5rem 0.75rem', color: 'var(--text-primary)', fontSize: '0.8rem', outline: 'none',
                                fontFamily: 'var(--font-headline)', transition: 'all 0.2s'
                              }}
                            />
                            {sendingChat ? (
                              <button 
                                onClick={handleAbortChat}
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
                                onClick={handleSendChat}
                                disabled={!chatInput.trim()}
                                style={{ 
                                  background: 'var(--accent-primary)', color: '#fff', border: 'none', 
                                  borderRadius: '8px', padding: '0 0.75rem', cursor: 'pointer', opacity: !chatInput.trim() ? 0.5 : 1,
                                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}
                              >
                                <Zap size={16} />
                              </button>
                            )}
                         </div>
                       </div>
                     )}
                  </div>
               </motion.main>

                {/* RESIZER PDF */}
                {!hidePdf && (
                   <div 
                     onMouseDown={() => setIsResizingPdf(true)}
                     style={{ 
                       width: '6px', cursor: 'col-resize', borderRadius: '3px', transition: 'all 0.2s', margin: '0 -2px', zIndex: 10,
                       background: isResizingPdf ? 'var(--accent-primary)' : 'color-mix(in srgb, var(--text-primary) 8%, transparent)' 
                     }} 
                     onMouseEnter={(e) => e.currentTarget.style.background = 'var(--accent-primary)'}
                     onMouseLeave={(e) => e.currentTarget.style.background = isResizingPdf ? 'var(--accent-primary)' : 'color-mix(in srgb, var(--text-primary) 8%, transparent)'}
                  />
                )}

               {!hidePdf && (
                 <motion.section 
                   initial={{ x: 20, opacity: 0 }}
                   animate={{ x: 0, opacity: 1 }}
                   style={{ width: pdfWidth, background: 'var(--bg-secondary)', borderRadius: '16px', border: '1px solid var(--border)', overflow: 'hidden', position: 'relative', flexShrink: 0, boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}
                 >
                    <ScholarlyViewer 
                      pdfUrl={pdfUrl} 
                      syncTexStr={syncTexStr}
                      compiling={compiling}
                      jumpTo={jumpTo} 
                      jumpToLine={syncJumpLine}
                      onExactSync={(line) => {
                         jumpToLine(line);
                      }}
                      onJumpToLatexCode={(percentage) => {
                        if (!editorRef.current) return;
                        const model = editorRef.current.getModel();
                        if (!model) return;
                        const totalLines = model.getLineCount();
                        const content = model.getValue();
                        const docStartMatch = content.match(/\\begin\{document\}/);
                        const docStartLine = docStartMatch ? model.getPositionAt(docStartMatch.index!).lineNumber : 1;
                        
                        const targetLine = Math.floor(docStartLine + Math.max(0, Math.min(1, percentage)) * (totalLines - docStartLine));
                        jumpToLine(targetLine);
                      }}
                      onSync={() => {
                        if (!editorRef.current) return;
                        const model = editorRef.current.getModel();
                        const line = editorRef.current.getPosition()?.lineNumber || 1;
                        
                        setSyncJumpLine({ line, timestamp: Date.now() });

                        const totalLines = model.getLineCount();
                        const content = model.getValue();
                        const docStartMatch = content.match(/\\begin\{document\}/);
                        const docStartLine = docStartMatch ? model.getPositionAt(docStartMatch.index!).lineNumber : 1;
                        let percentage = 0;
                        if (line >= docStartLine) {
                          percentage = (line - docStartLine) / (totalLines - docStartLine + 1);
                        }
                        setJumpTo({ percentage, timestamp: Date.now() });
                      }}
                      onDownload={async () => {
                        if (!fs || !projectId) return;

                        // Fast path: use already-compiled PDF blob if available
                        if (currentPdfBlob.current && currentPdfBlob.current.size > 0) {
                          const url = window.URL.createObjectURL(currentPdfBlob.current);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `${project?.title || 'manuscript'}.pdf`;
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                          setTimeout(() => URL.revokeObjectURL(url), 5000);
                          toast.success("PDF downloaded!");
                          return;
                        }

                        const toastId = toast.loading("Compiling latest manuscript for download...");
                        try {
                          if (typeof navigator !== 'undefined' && !navigator.onLine) {
                            throw new Error('No internet connection. Cannot compile for download.');
                          }
                          if (!isImage(activeFile)) {
                             await fs.writeFile(projectId, activeFile, code);
                          }
                          const fileData = await fs.listFiles(projectId);
                          const payload = fileData.map(f => ({ path: f.path, content: f.content }));
                          
                          const rootFile = project?.mainFile || 'main.tex';
                          
                          const res = await fetch('/api/latex-studio/compile', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              files: payload,
                              mainFile: rootFile,
                              engine: engine,
                              projectId: projectId
                            })
                          });
                          const data = await res.json();
                          
                          if (data.pdfBase64 || data.pdfUrl) {
                            const b64Uri = data.pdfBase64 
                              ? (data.pdfBase64.startsWith('data:') ? data.pdfBase64 : `data:application/pdf;base64,${data.pdfBase64}`)
                              : data.pdfUrl;

                            const blobRes = await fetch(b64Uri);
                            const blob = await blobRes.blob();
                            
                            const url = window.URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `${project?.title || 'manuscript'}.pdf`;
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            setTimeout(() => URL.revokeObjectURL(url), 5000);
                            
                            if (data.success) {
                              toast.success("Latest manuscript downloaded!", { id: toastId });
                            } else {
                              toast.success("Downloaded (with non-fatal errors)", { id: toastId, icon: '⚠️' });
                            }
                          } else {
                            throw new Error(data.message || data.error || "Compilation failed");
                          }
                        } catch (err: any) {
                          const errMsg = err?.message || '';
                          const isNetwork = errMsg.includes('Failed to fetch') || 
                                            errMsg.toLowerCase().includes('fetch') || 
                                            errMsg.toLowerCase().includes('network') || 
                                            errMsg.toLowerCase().includes('connection') ||
                                            err?.name === 'TypeError';
                          toast.error(isNetwork 
                            ? "Network Error: Unable to reach the compilation server. Please check your connection."
                            : `Download failed: ${err.message}`, 
                            { id: toastId }
                          );
                        }
                      }}
                    />
                 </motion.section>
               )}
             </div>

             <ConsolePanel 
                errors={errors}
                log={compileLog}
                isOpen={consoleOpen}
                onToggle={() => setConsoleOpen(!consoleOpen)}
                onJumpToLine={jumpToLine}
                projectId={projectId}
                compiling={compiling}
                title="SCHOLARLY DIAGNOSTIC CORE"
             />
           </div>
         </div>


      </div>
    </StudioErrorBoundary>
  );
}
