"use client";
import '../editor-shared.css';
import { useSession } from "@/lib/pb-auth-react";
import React, { useEffect, useState, useCallback, useRef } from 'react';
import LatexifyLogo from '@/components/LatexifyLogo';
import dynamic from 'next/dynamic';
import { StudioFS, type StudioProject, type StudioFile } from '@/lib/studio-fs';
import Link from 'next/link';
import Image from 'next/image';
import { 
  Download, 
  Zap, 
  RefreshCw,
  Layout,
  X,
  Binary,
  FileText,
  Pencil,
  Sparkles,
  Trash2,
  Upload
} from 'lucide-react';
import { getLatexSuggestions } from '@/lib/latex-suggestions';
import { detectBestEngine, parseLog } from '@/lib/studio-core/compiler-utils';
import { formatLatexCode, type EditorMood, EDITOR_MOODS } from '@/lib/studio-core/formatting-utils';
import toast from 'react-hot-toast';
import { saveAs } from 'file-saver';
import { motion, AnimatePresence } from 'framer-motion';
import ThemeSwitcher from '../ThemeSwitcher';
import ConsolePanel from '../ConsolePanel';
import StudioErrorBoundary from '../StudioErrorBoundary';
import EditorLoadingOverlay from '../EditorLoadingOverlay';
import { type DiagnosticError } from '@/lib/studio-core/compiler-utils';

// UI Components
const MonacoEditor = dynamic(() => import('@monaco-editor/react').then(m => m.default), { ssr: false, loading: () => <div style={{ flex: 1, background: '#0a0a0a' }} /> });
const ScholarlyViewer = dynamic(() => import('../ScholarlyPDFViewer').then(m => m.default), { ssr: false, loading: () => <div style={{ height: '100%', background: '#050505' }} /> });

function FileItem({ f, activeFile, onClick, onDelete, onRename }: { f: any, activeFile: string, onClick: (path: string) => void, onDelete?: (path: string) => void, onRename?: (path: string) => void }) {
    const [hovered, setHovered] = useState(false);
    const isActive = activeFile === f.path;
    const isSkeleton = f.path === 'main.tex' || f.path === 'Migrated_Manuscript.tex';
    const showActions = !isSkeleton && (hovered || isActive);

    return (
        <motion.div 
            whileHover={{ x: 2 }}
            onHoverStart={() => setHovered(true)}
            onHoverEnd={() => setHovered(false)}
            onClick={() => onClick(f.path)} 
            style={{ 
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', padding: '0.45rem 0.75rem', borderRadius: '8px', cursor: 'pointer',
                background: isActive ? 'var(--accent-glow)' : hovered ? 'rgba(255,255,255,0.04)' : 'transparent',
                color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
                marginBottom: '1px', fontSize: '0.85rem', fontWeight: isActive ? 700 : 500, transition: 'all 0.15s', fontFamily: 'var(--font-headline)'
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0, overflow: 'hidden' }}>
                <div style={{ width: 4, height: 4, borderRadius: '50%', flexShrink: 0, background: isActive ? 'var(--accent-primary)' : 'var(--border)' }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.path}</span>
            </div>
            {showActions && (
                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexShrink: 0 }}>
                    {onRename && (
                        <button 
                            onClick={(e) => { e.stopPropagation(); onRename(f.path); }}
                            style={{ background: 'transparent', border: 'none', color: 'inherit', opacity: 0.6, transition: 'all 0.15s', cursor: 'pointer', padding: '2px 3px', display: 'flex', alignItems: 'center', borderRadius: '4px' }}
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
                            style={{ background: 'transparent', border: 'none', color: 'inherit', opacity: 0.6, transition: 'all 0.15s', cursor: 'pointer', padding: '2px 3px', display: 'flex', alignItems: 'center', borderRadius: '4px' }}
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
}

export default function MigratorIDE({ projectId }: { projectId: string }) {
  const { data: session, status } = useSession();
  
  const [fs, setFs] = useState<StudioFS | null>(null);
  const [project, setProject] = useState<StudioProject | null>(null);
  const [files, setFiles] = useState<StudioFile[]>([]);
  const [activeFile, setActiveFile] = useState<string>('main.tex');
  const [openTabs, setOpenTabs] = useState<string[]>(['main.tex']);
  const [code, setCode] = useState('');
  
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [compiling, setCompiling] = useState(false);
  const [engine, setEngine] = useState<'pdflatex' | 'lualatex' | 'xelatex'>('pdflatex');
  const [autoEngine, setAutoEngine] = useState(true);
  const [compileLog, setCompileLog] = useState('');
  const [errors, setErrors] = useState<DiagnosticError[]>([]);
  
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
  const [loadingCode, setLoadingCode] = useState(false);

  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const isSelfChange = useRef<boolean>(false);
  const compileRef = useRef<(() => Promise<void>) | null>(null);
  const codeRef = useRef('');
  const filesRef = useRef<StudioFile[]>([]);

  const safeSetItem = useCallback((key: string, value: string) => {
    try {
      localStorage.setItem(key, value);
    } catch {
      try {
        localStorage.removeItem(key);
        localStorage.setItem(key, value);
      } catch { /* quota exceeded — silently skip */ }
    }
  }, []);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentPdfBlob = useRef<Blob | null>(null);

  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  const sessionRef = useRef(session);
  sessionRef.current = session;
  const statusRef = useRef(status);
  statusRef.current = status;

  useEffect(() => {
    setMounted(true);
    document.body.classList.add('theme-emerald');
    if (statusRef.current === 'loading') return;
    const currentSession = sessionRef.current;
    const userEmail = currentSession?.user?.email || 'guest';
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
      } catch (err) {
        console.error("Failed to load PDF blob during initialization:", err);
      }
      setPdfUrl(null);
    };

    const init = async () => {
      const savedS = localStorage.getItem(`migrator_sidebar_${projectId}`);
      const savedP = localStorage.getItem(`migrator_pdf_${projectId}`);
      const savedMood = localStorage.getItem(`migrator_mood_${projectId}`) as EditorMood;

      if (savedS) setSidebarWidth(parseInt(savedS));
      if (savedP) setPdfWidth(parseInt(savedP));
      if (savedMood) setEditorMood(savedMood);

      const [proj, fileList] = await Promise.all([
        studioFs.getProject(projectId),
        studioFs.listFiles(projectId)
      ]);

      if (proj) {
        setProject(proj);
        setFiles(fileList);
        await loadPdfBlob(projectId);
        
        const savedEngine = localStorage.getItem(`migrator_engine_${projectId}`);
        const savedAuto = localStorage.getItem(`migrator_auto_${projectId}`);

        if (savedEngine) setEngine(savedEngine as any);
        else if (proj.engine) setEngine(proj.engine as any);

        if (savedAuto) setAutoEngine(savedAuto === 'true');
        else setAutoEngine(!proj.engine);

        const activeMeta = fileList.find(f => f.path === proj.mainFile) || 
                       fileList.find(f => f.path === 'main.tex') || 
                       fileList.find(f => f.path.endsWith('.tex')) ||
                       fileList[0];

        if (activeMeta) {
          setActiveFile(activeMeta.path);
          const fullActive = await studioFs.readFile(projectId, activeMeta.path);
          if (fullActive) setCode(fullActive.content);
          setOpenTabs(prev => prev.includes(activeMeta.path) ? prev : [...prev, activeMeta.path]);
        }
      }
    };
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

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
    if (isResizingSidebar) safeSetItem(`migrator_sidebar_${projectId}`, sidebarWidth.toString());
    if (isResizingPdf) safeSetItem(`migrator_pdf_${projectId}`, pdfWidth.toString());
    setIsResizingSidebar(false);
    setIsResizingPdf(false);
  }, [isResizingSidebar, isResizingPdf, sidebarWidth, pdfWidth, projectId]);

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

  useEffect(() => {
    if (!autoEngine || activeFile !== 'main.tex' || !code) return;
    const timer = setTimeout(() => {
      const best = detectBestEngine(code);
      setEngine(best);
    }, 500);
    return () => clearTimeout(timer);
  }, [code, autoEngine, activeFile]);

  useEffect(() => {
    if (mounted && project) {
      safeSetItem(`migrator_engine_${projectId}`, engine);
      safeSetItem(`migrator_auto_${projectId}`, autoEngine.toString());
      safeSetItem(`migrator_mood_${projectId}`, editorMood);
    }
  }, [engine, autoEngine, editorMood, mounted, project, projectId]);

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
          'scrollbarSlider.background': 'rgba(255,255,255,0.18)',
          'scrollbarSlider.hoverBackground': 'rgba(255,255,255,0.32)',
          'scrollbarSlider.activeBackground': 'rgba(255,255,255,0.40)',
          'scrollbarSlider.border': '1px solid rgba(255,255,255,0.05)',
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
  useEffect(() => { codeRef.current = code; }, [code]);

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

      // 2. Whole-line error decorations
      const oldDecorations = editor.errorDecorations || [];
      const activeErrors = errors.filter(e => {
        if (!e.line || e.line <= 0) return false;
        if (!e.file) return true;
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
  }, [errors, activeFile]);

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

  const compile = useCallback(async () => {
    if (!fs || compiling || !project) return;
    const rootFile = project.mainFile || 'main.tex';
    setCompiling(true);
    // NOTE: Do NOT clear pdfUrl here — keep the old PDF visible while recompiling.
    setSyncTexStr(null);
    setCompileLog(`> Compilation Started: ${rootFile}\n`);
    setErrors([]);

    try {
      await fs.writeFile(projectId, activeFile, codeRef.current);
      const payloadMeta = await fs.listFiles(projectId);
      
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
        f.content = ''; // GC hint
      }

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        throw new Error('No internet connection. Please check your network and try again.');
      }
      const response = await fetch('/api/latex-studio/compile', {
        method: 'POST',
        body: formData
      });

      let result;
      const text = await response.text();
      try {
        result = JSON.parse(text);
      } catch {
        result = { success: false, error: text || 'Compilation server error' };
      }

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
        // PDF produced despite non-fatal errors — show it with a warning
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
        const offline = typeof navigator !== 'undefined' && !navigator.onLine;
        toast.error(offline ? "Cannot compile: No internet connection." : "Compilation logic error: Check network or logs.");
        setCompileLog(prev => prev + `> CRITICAL EXCEPTION: ${err.message}\n`);
      }
    } finally {
      setCompiling(false);
    }
  }, [fs, compiling, projectId, activeFile, engine, project]);

  // Keep compileRef current so async callbacks always call the latest version
  useEffect(() => {
    compileRef.current = compile;
  }, [compile]);

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
    saveAs(blob, `${project?.title || 'migrated-manuscript'}.zip`);
  };

  const handleTitleSave = async () => {
    if (!tempTitle.trim() || !project || !fs) {
      setIsEditingTitle(false);
      return;
    }
    try {
      const newTitle = tempTitle.trim();
      await fs.renameProject(projectId, newTitle);
      setProject({ ...project, title: newTitle });
      
      // Cloud Proxy Update
      await fetch(`/api/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle })
      }).then(r => { if (!r.ok) console.error("Cloud rename failed:", r.status); });
      
      toast.success("Manuscript title updated");
    } catch (e) {
      console.error("Title save failed:", e);
      toast.error("Failed to update title");
    } finally {
      setIsEditingTitle(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = e.target.files;
    if (!uploadedFiles || !fs || !projectId) return;

    for (let i = 0; i < uploadedFiles.length; i++) {
        const file = uploadedFiles[i];
        const isBinary = /\.(png|jpg|jpeg|gif|pdf|eps|otf|ttf)$/i.test(file.name);
        const path = `MIGRATION FILES/${file.name}`;

        if (isBinary) {
            const buffer = await file.arrayBuffer();
            const base64 = `data:application/octet-stream;base64,${Buffer.from(buffer).toString('base64')}`;
            await fs.writeFile(projectId, path, base64);
        } else {
            const text = await file.text();
            await fs.writeFile(projectId, path, text);
        }
        toast.success(`Uploaded ${file.name}`);
    }
    const newList = await fs.listFiles(projectId);
    setFiles(newList);
  };

  const handleDeleteFile = async (path: string) => {
    const mainFile = project?.mainFile || 'Migrated_Manuscript.tex';
    if (path === mainFile) return toast.error("Cannot delete project skeleton");
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

  const handleRenameFile = async (oldPath: string) => {
    const mainFile = project?.mainFile || 'Migrated_Manuscript.tex';
    if (oldPath === mainFile) return toast.error("Cannot rename project skeleton");
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

  const handleDeleteFileRef = useRef(handleDeleteFile);
  handleDeleteFileRef.current = handleDeleteFile;

  const handleRenameFileRef = useRef(handleRenameFile);
  handleRenameFileRef.current = handleRenameFile;

  useEffect(() => {
    (window as any)._migrator_delete = handleDeleteFileRef.current;
    (window as any)._migrator_rename = handleRenameFileRef.current;
    return () => { 
      delete (window as any)._migrator_delete; 
      delete (window as any)._migrator_rename; 
    };
  }, []);

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
    setLoadingCode(true);
    setActiveFile(path);
    if (!openTabs.includes(path)) setOpenTabs(t => [...t, path]);
    const file = files.find(f => f.path === path);
    if (file) {
      setCode(file.content);
      setLoadingCode(false);
    } else {
      setLoadingCode(false);
    }
  };

  if (!mounted) return null;

  return (
    <StudioErrorBoundary>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg-primary)', color: 'var(--text-primary)', overflow: 'hidden', fontFamily: 'var(--font-body)' }}>
      
      {/* EMERALD GLASS HEADER */}
      <header style={{ 
        height: '64px', borderBottom: '1px solid var(--glass-header-border)', display: 'flex', alignItems: 'center', padding: '0 1.5rem', gap: '1.25rem', 
        background: 'var(--glass-header)', backdropFilter: 'blur(30px)', flexShrink: 0, position: 'relative', zIndex: 100,
        boxShadow: '0 4px 30px rgba(0, 0, 0, 0.4)'
      }}>
        {/* THEME ACCENT BAR */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'var(--accent-gradient)', opacity: 0.8, boxShadow: '0 0 10px var(--accent-glow)' }} />
        
        <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
           <LatexifyLogo size={48} />
        </Link>
        
        <div style={{ width: 1, height: 28, background: 'var(--ide-divider)', margin: '0 0.5rem' }} />
        
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '1.25rem', minWidth: 0 }}>
           <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
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
                      minWidth: '200px', outline: 'none', fontFamily: 'var(--font-headline)'
                    }}
                  />
                ) : (
                  <>
                    <span 
                      onClick={() => { setIsEditingTitle(true); setTempTitle(project?.title || ''); }}
                      style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--ide-title-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: 'var(--font-headline)', letterSpacing: '-0.01em', cursor: 'pointer' }}
                    >
                      {project?.title || 'Migration Workshop...'}
                    </span>
                    <Pencil 
                      size={16} 
                      onClick={() => { setIsEditingTitle(true); setTempTitle(project?.title || ''); }}
                      style={{ opacity: 0.6, cursor: 'pointer', transition: 'all 0.2s', color: 'var(--accent-primary)' }} 
                      onMouseOver={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'scale(1.1)'; }}
                      onMouseOut={e => { e.currentTarget.style.opacity = '0.6'; e.currentTarget.style.transform = 'scale(1)'; }}
                    />
                  </>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '2px' }}>
                 <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-primary)', boxShadow: '0 0 8px var(--accent-primary)' }} />
                 <span style={{ fontSize: '0.55rem', fontWeight: 800, textTransform: 'uppercase', opacity: 0.4, letterSpacing: '0.05em' }}>ENGINEERING MODE</span>
              </div>
           </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', padding: '0.35rem', background: 'var(--ide-group-bg)', borderRadius: '12px', border: '1px solid var(--ide-group-border)' }}>
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
           
           <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', background: 'var(--ide-group-bg)', padding: '0.35rem 0.75rem', borderRadius: '20px', border: '1px solid var(--accent-primary)', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
              <span style={{ fontSize: '0.65rem', fontWeight: 900, color: 'var(--accent-primary)', marginRight: '4px', letterSpacing: '0.08em' }}>MOOD</span>
              {(Object.keys(EDITOR_MOODS) as EditorMood[]).map(m => (
                <div 
                  key={m}
                  onClick={() => setEditorMood(m)}
                  title={`Switch to ${EDITOR_MOODS[m].name} Mood`}
                  style={{ 
                    width: 14, height: 14, borderRadius: '50%', background: EDITOR_MOODS[m].bg, 
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

        <ThemeSwitcher />

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.35rem', background: 'var(--ide-group-bg)', borderRadius: '12px', border: '1px solid var(--ide-group-border)' }}>
           <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', borderRight: '1px solid var(--ide-divider)', paddingRight: '0.75rem', paddingLeft: '0.4rem' }}>
              <Zap 
                size={14} 
                strokeWidth={2} 
                style={{ 
                  color: autoEngine ? 'var(--accent-primary)' : 'var(--ide-icon-muted)', 
                  opacity: autoEngine ? 1 : 0.5
                }} 
              />
              <select 
                value={engine} 
                onChange={e => {
                  setEngine(e.target.value as any);
                  setAutoEngine(false); // Manual override
                   safeSetItem(`migrator_auto_${projectId}`, 'false');
                  toast.success(`Engine set to ${e.target.value}. Auto-detection disabled.`, { icon: '⚙️', style: { borderRadius: '10px', background: '#333', color: '#fff', fontSize: '0.8rem' } });
                }}
                style={{ background: 'transparent', color: 'var(--ide-select-text)', border: 'none', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', outline: 'none', fontFamily: 'var(--font-headline)' }}
              >
                <option value="pdflatex">pdfLaTeX</option>
                <option value="lualatex">LuaLaTeX</option>
                <option value="xelatex">XeLaTeX</option>
              </select>
           </div>
           
           <div 
              onClick={() => {
                const nextAuto = !autoEngine;
                setAutoEngine(nextAuto);
                safeSetItem(`migrator_auto_${projectId}`, nextAuto.toString());
                if (nextAuto) toast.success("Auto-engine detection enabled");
              }}
              style={{ 
                fontSize: '0.6rem', fontWeight: 900, cursor: 'pointer', padding: '0.2rem 0.6rem', borderRadius: '6px', 
                background: autoEngine ? 'var(--accent-glow)' : 'var(--ide-btn-bg)',
                color: autoEngine ? 'var(--accent-primary)' : 'var(--ide-btn-text)',
                border: `1px solid ${autoEngine ? 'var(--accent-primary)' : 'var(--ide-btn-border)'}`,
                transition: 'all 0.2s', fontFamily: 'var(--font-headline)', letterSpacing: '0.05em'
              }}
            >
              AUTO
            </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
           <motion.button 
             whileHover={{ scale: 1.02 }}
             whileTap={{ scale: 0.98 }}
             onClick={compile} 
             disabled={compiling} 
             style={{ 
                background: compiling ? 'var(--bg-tertiary)' : 'var(--accent-primary)', 
                color: '#fff', border: 'none', padding: '0.5rem 1.5rem', borderRadius: '8px', 
               fontWeight: 800, fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.6rem',
               boxShadow: compiling ? 'none' : '0 4px 15px var(--accent-glow)', fontFamily: 'var(--font-headline)', letterSpacing: '0.05em'
             }}
           >
             {compiling ? <RefreshCw size={14} className="spinner" /> : <Binary size={14} strokeWidth={2} />} 
             <span>
               {compiling ? 'GRAFTING...' : <>COMPILE<span className="ide-btn-label"> & VERIFY</span></>}
             </span>
           </motion.button>
        </div>
      </header>

      <div style={{ 
         display: 'flex', flex: 1, overflow: 'hidden', padding: '0.75rem', gap: '0.25rem',
         background: 'var(--bg-secondary)', borderRadius: '24px', margin: '0.5rem', border: '1px solid var(--border)'
       }}>
        
        <motion.aside 
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          style={{ width: sidebarWidth, display: 'flex', flexDirection: 'column', gap: '0.75rem', flexShrink: 0 }}
        >
          <div className="glass-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid var(--glass-card-border)', borderRadius: '16px', background: 'var(--glass-card-bg)', backdropFilter: 'blur(10px)' }}>
              <div style={{ padding: '0.85rem 1rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                 <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Layout size={14} strokeWidth={2} style={{ color: 'var(--accent-primary)' }} />
                    <span style={{ fontSize: '0.6rem', fontWeight: 900, color: 'var(--text-secondary)', letterSpacing: '0.15em', fontFamily: 'var(--font-headline)' }}>MIGRATION FILES</span>
                 </div>
                 <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex' }}
                      onMouseOver={e => e.currentTarget.style.color = 'var(--text-primary)'}
                      onMouseOut={e => e.currentTarget.style.color = 'var(--text-secondary)'}
                      title="Upload Assets"
                    >
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
             
             {/* PROGRESSIVE COMPILING LOADER CARD */}
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

             <div className="sidebar-scroll-premium" style={{ flex: 1, overflowY: 'auto', padding: '0.5rem', paddingRight: '0.25rem' }}>
                 {(() => {
                   const rootFiles = files.filter(f => !f.path.includes('/'));
                   const migrationFiles = files.filter(f => f.path.startsWith('MIGRATION FILES/'));
                   
                   const mainFile = project?.mainFile || 'Migrated_Manuscript.tex';
                   const targetMain = files.find(f => f.path === mainFile);
                   const targetStyles = rootFiles.filter(f => f.path !== mainFile && (f.path.endsWith('.cls') || f.path.endsWith('.bst') || f.path.endsWith('.bib')));
                   const targetOther = rootFiles.filter(f => f.path !== mainFile && !targetStyles.includes(f));

                   return (
                     <>
                       {/* TARGET MANUSCRIPT SECTION */}
                       <div style={{ marginBottom: '1.25rem' }}>
                          <div style={{ fontSize: '0.65rem', fontWeight: 900, opacity: 0.3, letterSpacing: '0.1em', padding: '0 0.75rem 0.25rem' }}>TARGET MANUSCRIPT</div>
                          {targetMain && <FileItem f={targetMain} activeFile={activeFile} onClick={switchTab} onDelete={handleDeleteFile} onRename={handleRenameFile} />}
                          {targetStyles.map(f => <FileItem key={f.path} f={f} activeFile={activeFile} onClick={switchTab} onDelete={handleDeleteFile} onRename={handleRenameFile} />)}
                          {targetOther.map(f => <FileItem key={f.path} f={f} activeFile={activeFile} onClick={switchTab} onDelete={handleDeleteFile} onRename={handleRenameFile} />)}
                       </div>

                       {/* SOURCE REFERENCE SECTION */}
                       {migrationFiles.length > 0 && (
                         <div style={{ marginBottom: '1rem' }}>
                            <div style={{ fontSize: '0.65rem', fontWeight: 900, opacity: 0.3, letterSpacing: '0.1em', padding: '0 0.75rem 0.25rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.75rem', marginTop: '0.5rem' }}>SOURCE REFERENCE</div>
                            {migrationFiles.map(f => (
                              <FileItem key={f.path} f={f} activeFile={activeFile} onClick={switchTab} onDelete={handleDeleteFile} onRename={handleRenameFile} />
                            ))}
                         </div>
                       )}
                     </>
                   );
                 })()}
              </div>
          </div>

           <div style={{ padding: '0.75rem', borderRadius: '16px', border: '1px solid var(--border)', background: 'var(--bg-secondary)', backdropFilter: 'blur(10px)' }}>
              <button onClick={exportProjectZip} style={{ width: '100%', padding: '0.7rem', borderRadius: '10px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.6rem', fontFamily: 'var(--font-headline)', letterSpacing: '0.05em' }}>
                 <Download size={14} strokeWidth={2} style={{ color: 'var(--accent-primary)' }} /> EXPORT SOURCE ZIP
              </button>
           </div>
        </motion.aside>

        {/* RESIZER SIDEBAR */}
        <div 
           onMouseDown={() => setIsResizingSidebar(true)}
            style={{ 
              width: '8px', cursor: 'col-resize', borderRadius: '4px', transition: 'all 0.2s', margin: '0 -4px', zIndex: 10,
               background: isResizingSidebar ? 'var(--accent-primary)' : 'color-mix(in srgb, var(--text-primary) 8%, transparent)',
               boxShadow: isResizingSidebar ? '0 0 15px var(--accent-glow)' : 'none'
             }} 
             onMouseEnter={(e) => {
               e.currentTarget.style.background = 'var(--accent-primary)';
               e.currentTarget.style.boxShadow = '0 0 10px var(--accent-glow)';
             }}
             onMouseLeave={(e) => {
              e.currentTarget.style.background = isResizingSidebar ? 'var(--accent-primary)' : 'color-mix(in srgb, var(--text-primary) 8%, transparent)';
              e.currentTarget.style.boxShadow = isResizingSidebar ? '0 0 15px var(--accent-glow)' : 'none';
            }}
          />
 
         {/* NEW WORKSPACE WRAPPER */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, gap: '0.25rem' }}>
          
          <div style={{ display: 'flex', flex: 1, minHeight: 0, gap: '0.25rem' }}>
            <motion.main 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: EDITOR_MOODS[editorMood].bg, borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}
            >
               <div style={{ 
                  height: '42px', 
                  background: 'var(--bg-secondary)', 
                  backdropFilter: 'blur(10px)', 
                  display: 'flex', 
                  borderBottom: '1px solid var(--border)', 
                  position: 'relative',
                  overflowX: 'auto',
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none'
               }}>
                  {openTabs.map(t => (
                    <div key={t} onClick={() => switchTab(t)} className="group" style={{ 
                      padding: '0 1rem', height: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.75rem', fontWeight: activeFile === t ? 800 : 600,
                      background: activeFile === t ? 'var(--bg-primary)' : 'transparent', borderRight: '1px solid var(--border)', 
                      color: activeFile === t ? 'var(--text-primary)' : 'var(--text-secondary)', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', position: 'relative', fontFamily: 'var(--font-headline)', letterSpacing: '0.05em',
                      flexShrink: 1, minWidth: '80px', maxWidth: '160px', overflow: 'hidden'
                    }}>
                       {isImage(t) ? <Layout size={12} strokeWidth={2.5} style={{ opacity: activeFile === t ? 1 : 0.5, flexShrink: 0 }} /> : <FileText size={12} strokeWidth={2.5} style={{ opacity: activeFile === t ? 1 : 0.5, flexShrink: 0 }} />}
                       <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{t.toUpperCase()}</span>
                       {activeFile === t && (
                         <motion.div 
                           layoutId="tab-highlight-m" 
                           style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '2px', background: 'var(--accent-primary)', boxShadow: '0 0 10px var(--accent-glow)' }} 
                         />
                       )}
                       {t !== 'main.tex' && (
                         <X 
                           size={10} 
                           strokeWidth={2.5} 
                           onClick={(e) => { e.stopPropagation(); setOpenTabs(prev => prev.filter(x => x !== t)); }} 
                           style={{ flexShrink: 0, color: 'inherit', cursor: 'pointer' }} 
                           className="opacity-0 group-hover:opacity-100 hover:!text-red-500 transition-opacity transition-colors"
                         />
                       )}
                    </div>
                  ))}
               </div>

               <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column' }}>
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
                                  width={0}
                                  height={0}
                                  sizes="100vw"
                                  style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain', display: 'block', width: 'auto', height: 'auto' }}
                                  unoptimized
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
                      <div style={{ flex: 1, position: 'relative', height: '100%', width: '100%', minWidth: 0 }}>
                        <EditorLoadingOverlay
                          visible={loadingCode}
                          label="LOADING LATEX SOURCE"
                          sublabel="Populating editor with manuscript content..."
                        />
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
                            wordWrap: 'on',
                            readOnly: false,
                            autoClosingBrackets: 'languageDefined',
                            quickSuggestions: { other: true, comments: false, strings: false },
                         }}
                       />
                     </div>
                  )}
               </div>
            </motion.main>

             {/* RESIZER PDF */}
             <div 
                onMouseDown={() => setIsResizingPdf(true)}
                style={{ 
                  width: '8px', cursor: 'col-resize', borderRadius: '4px', transition: 'all 0.2s', margin: '0 -4px', zIndex: 10,
                  background: isResizingPdf ? 'var(--accent-primary)' : 'color-mix(in srgb, var(--text-primary) 8%, transparent)',
                  boxShadow: isResizingPdf ? '0 0 15px var(--accent-glow)' : 'none'
                }} 
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'color-mix(in srgb, var(--text-primary) 20%, transparent)';
                  e.currentTarget.style.boxShadow = '0 0 10px color-mix(in srgb, var(--accent-primary) 30%, transparent)';
                }}
                onMouseLeave={(e) => {
                 e.currentTarget.style.background = isResizingPdf ? 'var(--accent-primary)' : 'color-mix(in srgb, var(--text-primary) 8%, transparent)';
                 e.currentTarget.style.boxShadow = isResizingPdf ? '0 0 15px var(--accent-glow)' : 'none';
               }}
             />
 
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
                  onDownload={() => {
                    if (pdfUrl) {
                      const a = document.createElement('a');
                      a.href = pdfUrl;
                      a.download = 'migrated_manuscript.pdf';
                      a.click();
                    }
                  }}
                />
            </motion.section>
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
