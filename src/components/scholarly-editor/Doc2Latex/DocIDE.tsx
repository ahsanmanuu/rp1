"use client";
import '../editor-shared.css';
import { useSession } from "@/lib/pb-auth-react";
import { useLayoutSync } from "@/hooks/useLayoutSync";
import { useEffect, useState, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { StudioFS, type StudioProject, type StudioFile } from '@/lib/studio-fs';
import { getLatexSuggestions } from '@/lib/latex-suggestions';
import JSZip from 'jszip';
import { 
  X,
  Layout,
  FileText,
  Command
} from 'lucide-react';
import toast from 'react-hot-toast';
import { saveAs } from 'file-saver';
import { motion } from 'framer-motion';
import { detectBestEngine, type DiagnosticError, parseLog } from '@/lib/studio-core/compiler-utils';
import { formatLatexCode, type EditorMood, EDITOR_MOODS } from '@/lib/studio-core/formatting-utils';
import ConsolePanel from '../ConsolePanel';
import StudioErrorBoundary from '../StudioErrorBoundary';

// Modular Components
import { DocSidebar } from './DocSidebar';
import { DocToolbar } from './DocToolbar';
import CreditLimitModal from './CreditLimitModal';

// UI Components
const MonacoEditor = dynamic(() => import('@monaco-editor/react').then(m => m.default), { ssr: false, loading: () => <div style={{ flex: 1, background: '#0a0a0a' }} /> });
const ScholarlyViewer = dynamic(() => import('../ScholarlyPDFViewer').then(m => m.default), { ssr: false, loading: () => <div style={{ height: '100%', background: '#050505' }} /> });


export default function DocIDE({ projectId }: { projectId: string }) {
  const { data: session, status } = useSession();
  const { settings, updatePanels, updatePages } = useLayoutSync(false);

  // -- Credit Limit & Modal State --
  const isOutOfCredits = status !== 'loading' && session?.user && (session.user.points ?? 0) <= 0 && session.user.membership === 'free';
  const [showCreditLimitModal, setShowCreditLimitModal] = useState(false);
  const [dismissedCreditModal, setDismissedCreditModal] = useState(false);

  useEffect(() => {
    if (status !== 'loading' && session?.user) {
      const outOfCredits = (session.user.points ?? 0) <= 0 && session.user.membership === 'free';
      if (outOfCredits && !dismissedCreditModal) {
        setShowCreditLimitModal(true);
      } else {
        setShowCreditLimitModal(false);
      }
    }
  }, [session, status, dismissedCreditModal]);

  // -- Filesystem & Project State --
  const [fs, setFs] = useState<StudioFS | null>(null);
  const [project, setProject] = useState<StudioProject | null>(null);
  const [files, setFiles] = useState<StudioFile[]>([]);
  const [activeFile, setActiveFile] = useState<string>('main.tex');
  const [openTabs, setOpenTabs] = useState<string[]>(['main.tex']);
  const [code, setCode] = useState('');
  const [saveTimer, setSaveTimer] = useState<NodeJS.Timeout | null>(null);

  // -- API & Compilation State --
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [compileVersion] = useState(0); // bumped after each compile to force viewer re-fetch
  const [compiling, setCompiling] = useState(false);
  const [compileLog, setCompileLog] = useState('');
  const [errors, setErrors] = useState<DiagnosticError[]>([]);
  const [engine, setEngine] = useState<'tectonic' | 'pdflatex' | 'lualatex' | 'xelatex'>('tectonic');
  const [autoEngine, setAutoEngine] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  // -- Layout State --
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [pdfWidth, setPdfWidth] = useState(550);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [isResizingPdf, setIsResizingPdf] = useState(false);
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState('');
  const [editorMood, setEditorMood] = useState<EditorMood>('obsidian');

  // -- Sync State --
  const [jumpTo, setJumpTo] = useState<{ percentage: number; timestamp: number } | null>(null);
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const isSelfChange = useRef<boolean>(false);
  const filesRef = useRef<StudioFile[]>([]);
  const currentPdfBlob = useRef<Blob | null>(null);
  const compileRef = useRef<(() => Promise<void>) | null>(null);
  const shareProject = async () => {
    const tid = toast.loading("Generating share link...");
    try {
      const res = await fetch(`/api/projects/${projectId}/share`, { method: 'POST' });
      if (!res.ok) throw new Error("Failed to generate share link");
      const data = await res.json();
      if (data.shareUrl) {
        await navigator.clipboard.writeText(data.shareUrl);
        toast.success("Share link copied to clipboard!", { id: tid });
      } else {
        throw new Error(data.error || "Failed to share");
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to share project", { id: tid });
    }
  };

  // Initialize & Synchronize
  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  useEffect(() => {
    setMounted(true);
    document.body.classList.add('theme-purple');

    if (status === 'loading') return;
    const userEmail = session?.user?.email || 'guest';

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
          
          // Inject project metadata into StudioFS
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
            for (const file of data.project.files) {
              const ext = file.filename.split('.').pop()?.toLowerCase();
              const isText = ['tex', 'bib', 'cls', 'sty', 'bst', 'txt'].includes(ext || '');
              const isBinary = ['image', 'png', 'jpg', 'jpeg', 'pdf'].includes(file.fileType) || ['png', 'jpg', 'jpeg', 'pdf'].includes(ext || '');

              if (isText) {
                // Always use text content for LaTeX source/meta files
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
            }
          }
          
          const freshFiles = await studioFs.listFiles(projectId);
          setFiles(freshFiles);
          
          const active = freshFiles.find(f => f.path === 'main.tex') || freshFiles[0];
          if (active) {
            setActiveFile(active.path);
            setCode(isImage(active.path) ? active.content : formatLatexCode(active.content));
            setOpenTabs([active.path]);
          }
          
          // Pre-load the compiled PDF document safely as a blob URL to prevent automatic downloads
          await loadPdfBlob(projectId);
          
          toast.success("Workspace synced from cloud");
          

        }
      } catch (err) {
        console.error("Cloud sync failed:", err);
        toast.error("Failed to sync workspace");
      } finally {
        setIsSyncing(false);
      }
    };

    const init = async () => {
      const savedS = settings.panels?.[`doc_sidebar_${projectId}`] || localStorage.getItem(`doc_sidebar_${projectId}`);
      const savedP = settings.panels?.[`doc_pdf_${projectId}`] || localStorage.getItem(`doc_pdf_${projectId}`);
      const savedMood = settings.panels?.[`doc_mood_${projectId}`] || (localStorage.getItem(`doc_mood_${projectId}`) as EditorMood);

      if (savedS) setSidebarWidth(parseInt(savedS));
      if (savedP) setPdfWidth(parseInt(savedP));
      if (savedMood) setEditorMood(savedMood);

      const studioFs = new StudioFS(userEmail);
      setFs(studioFs);

      const [localProj, freshFiles] = await Promise.all([
        studioFs.getProject(projectId),
        studioFs.listFiles(projectId)
      ]);

      // FORCE SYNC if flagged in sessionStorage
      const forceSync = sessionStorage.getItem(`force_sync_${projectId}`) === 'true';

      if (localProj && !forceSync) {
        setProject(localProj);
        setFiles(freshFiles);
        await loadPdfBlob(projectId);
        
        const savedEngine = settings.pages?.[`doc_engine_${projectId}`] || localStorage.getItem(`doc_engine_${projectId}`);
        const savedAuto = settings.pages?.[`doc_auto_${projectId}`] || localStorage.getItem(`doc_auto_${projectId}`);

        if (savedEngine) setEngine(savedEngine as any);
        else if (localProj.engine) setEngine(localProj.engine as any);

        if (savedAuto) setAutoEngine(savedAuto === 'true');
        else setAutoEngine(!localProj.engine);
        
        if (freshFiles.length === 0) {
          await syncFromCloud(studioFs);
        } else {
          const activeMeta = freshFiles.find(f => f.path === 'main.tex') || freshFiles[0];
          if (activeMeta) {
            setActiveFile(activeMeta.path);
            const fullActive = await studioFs.readFile(projectId, activeMeta.path);
            const isMainTexEmpty = activeMeta.path === 'main.tex' && (!fullActive || !fullActive.content || fullActive.content.trim().length < 50);
            
            if (isMainTexEmpty) {
              console.log("[StudioFS] Local main.tex is empty/corrupt. Triggering syncFromCloud for self-healing!");
              await syncFromCloud(studioFs);
            } else {
              if (fullActive) setCode(isImage(activeMeta.path) ? fullActive.content : formatLatexCode(fullActive.content));
              if (!openTabs.includes(activeMeta.path)) setOpenTabs([activeMeta.path]);
            }
          }
        }
      } else {
        await syncFromCloud(studioFs);
      }
    };
    init();
  }, [session, status, projectId, openTabs]);

  useEffect(() => {
    if (autoEngine && code) {
      const best = detectBestEngine(code); // Corrected to match the lib signature if it changed
      setEngine(best);
    }
  }, [code, autoEngine, activeFile, engine]);

  useEffect(() => {
    if (mounted && project) {
      localStorage.setItem(`doc_engine_${projectId}`, engine);
      localStorage.setItem(`doc_auto_${projectId}`, autoEngine.toString());
      localStorage.setItem(`doc_mood_${projectId}`, editorMood);

      updatePages({
        [`doc_engine_${projectId}`]: engine,
        [`doc_auto_${projectId}`]: autoEngine,
      });
      updatePanels({
        [`doc_mood_${projectId}`]: editorMood,
      });
    }
  }, [engine, autoEngine, editorMood, mounted, project, projectId, updatePages, updatePanels]);



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

      // 1. Map compile errors to Monaco markers (squiggles)
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

      // 2. Whole-line background error decorations
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
  }, [errors, activeFile, code]);

  const projectStatus = (project as any)?.status;

  useEffect(() => {
    if (projectStatus !== 'processing') return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}`);
        const data = await res.json();
        if (data.project && data.project.status !== 'processing') {
          setProject(data.project);
          clearInterval(interval);
          toast.success("Manuscript ready for editing");
        }
      } catch (e) { console.error("Polling error:", e); }
    }, 3000);
    return () => clearInterval(interval);
  }, [projectStatus, projectId]);

  const handleTitleSave = async () => {
    if (isOutOfCredits) {
      toast.error("Read-Only Mode: Daily credit limit reached. Please upgrade to Premium to rename the project.");
      setIsEditingTitle(false);
      return;
    }
    if (!tempTitle.trim() || !project || !fs) {
      setIsEditingTitle(false);
      return;
    }
    try {
      const newName = tempTitle.trim();
      await fs.renameProject(projectId, newName);
      setProject({ ...project, title: newName } as any);
      
      await fetch(`/api/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName })
      });
      
      toast.success("Manuscript title updated");
    } catch (e) {
      console.error("Title save failed:", e);
      toast.error("Failed to update title");
    } finally {
      setIsEditingTitle(false);
    }
  };

  const handleFormat = () => {
    if (isOutOfCredits) {
      toast.error("Read-Only Mode: Daily credit limit reached. Please upgrade to Premium to format.");
      return;
    }
    const formatted = formatLatexCode(code);
    setCode(formatted);
    toast.success("Code Beautified", { icon: '✨' });
  };

  const saveFile = useCallback(async (path: string, content: string) => {
    if (isOutOfCredits) return;
    if (!fs || !projectId) return;
    await fs.writeFile(projectId, path, content);
    setFiles(await fs.listFiles(projectId));
  }, [fs, projectId, isOutOfCredits]);

  const createNewFile = async () => {
    if (isOutOfCredits) {
      toast.error("Read-Only Mode: Daily credit limit reached. Please upgrade to Premium to create files.");
      return;
    }
    const name = prompt("Enter file name (e.g., section1.tex):");
    if (!name || !fs || !projectId) return;

    const fileName = name.endsWith('.tex') || name.includes('.') ? name : `${name}.tex`;
    await fs.writeFile(projectId, fileName, "% New LaTeX Source File\n");
    const newList = await fs.listFiles(projectId);
    setFiles(newList);
    switchTab(fileName);
    toast.success(`Created ${fileName}`);
  };

  const handleCodeChange = (value: string | undefined) => {
    if (isOutOfCredits) {
      toast.error("Read-Only Mode: Daily credit limit reached. Please upgrade to Premium to edit.");
      return;
    }
    if (!project) return;
    const val = value || '';
    setCode(val);
    if (saveTimer) clearTimeout(saveTimer);
    setSaveTimer(setTimeout(() => saveFile(activeFile, val), 1000));
  };

  const isImage = (path: string) => {
    const ext = path.split('.').pop()?.toLowerCase() || '';
    return ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'heic', 'heif', 'tiff', 'tif', 'bmp', 'avif', 'eps', 'pdf'].includes(ext);
  };

  const switchTab = async (path: string) => {
    if (!project) return;
    if (path === activeFile) return;
    if (fs && !isImage(activeFile) && !isOutOfCredits) await fs.writeFile(projectId, activeFile, code);
    setActiveFile(path);
    if (!openTabs.includes(path)) setOpenTabs(t => [...t, path]);
    const file = files.find(f => f.path === path);
    if (file) {
      setCode(isImage(path) ? file.content : formatLatexCode(file.content));
    }
  };

  const handleCloseTab = (e: React.MouseEvent, path: string) => {
    e.stopPropagation();
    setOpenTabs(prev => {
      const nextTabs = prev.filter(x => x !== path);
      if (activeFile === path) {
        const closedIndex = prev.indexOf(path);
        const fallbackTab = nextTabs[closedIndex] || nextTabs[closedIndex - 1] || 'main.tex';
        switchTab(fallbackTab);
      }
      return nextTabs;
    });
  };

  const deleteFile = async (path: string) => {
    if (isOutOfCredits) {
      toast.error("Read-Only Mode: Daily credit limit reached. Please upgrade to Premium to delete files.");
      return;
    }
    if (!fs || !projectId || !confirm(`Delete ${path}?`)) return;
    await fs.deleteFile(projectId, path);
    setFiles(prev => prev.filter(f => f.path !== path));
    if (openTabs.includes(path)) setOpenTabs(t => t.filter(x => x !== path));
    if (activeFile === path) switchTab(openTabs[0] || 'main.tex');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isOutOfCredits) {
      toast.error("Read-Only Mode: Daily credit limit reached. Please upgrade to Premium to upload files.");
      return;
    }
    if (!e.target.files || !fs) return;
    const tid = toast.loading("Processing upload...");
    try {
      for (const file of Array.from(e.target.files)) {
        if (file.name.endsWith('.zip')) {
          const zip = await JSZip.loadAsync(file);
          for (const [path, zipFile] of Object.entries(zip.files)) {
            if (zipFile.dir) continue;
            const isText = path.endsWith('.tex') || path.endsWith('.bib') || path.endsWith('.cls') || path.endsWith('.sty');
            if (isText) {
              await fs.writeFile(projectId, path, await zipFile.async('string'));
            } else {
              const dataUrl = `data:${path.endsWith('.png') ? 'image/png' : 'image/jpeg'};base64,${await zipFile.async('base64')}`;
              await fs.writeFile(projectId, path, dataUrl);
            }
          }
        } else {
          const isTex = file.name.endsWith('.tex') || file.name.endsWith('.bib') || file.name.endsWith('.cls') || file.name.endsWith('.sty');
          const content = await new Promise<string>((resolve) => {
            const r = new FileReader();
            r.onload = () => resolve(r.result as string);
            if (isTex) r.readAsText(file); else r.readAsDataURL(file);
          });
          await fs.writeFile(projectId, file.name, content);
        }
      }
      setFiles(await fs.listFiles(projectId));
      toast.success("Assets synchronized", { id: tid });
    } catch {
      toast.error("Upload failed", { id: tid });
    }
  };

  const exportProjectZip = async () => {
    if (!fs) return;
    const blob = await fs.exportZip(projectId);
    saveAs(blob, `${project?.title || 'manuscript'}.zip`);
  };

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
      localStorage.setItem(`doc_sidebar_${projectId}`, sidebarWidth.toString());
      updatePanels({ [`doc_sidebar_${projectId}`]: sidebarWidth });
    }
    if (isResizingPdf) {
      localStorage.setItem(`doc_pdf_${projectId}`, pdfWidth.toString());
      updatePanels({ [`doc_pdf_${projectId}`]: pdfWidth });
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

  const jumpToLine = (line: number) => {
    if (!editorRef.current) return;
    editorRef.current.revealLineInCenter(line);
    editorRef.current.setPosition({ lineNumber: line, column: 1 });
    editorRef.current.focus();
  };

  const syncToPdf = () => {
    if (editorRef.current) {
      const pos = editorRef.current.getPosition();
      if (pos) setJumpTo({ percentage: (pos.lineNumber / editorRef.current.getModel().getLineCount()) * 100, timestamp: Date.now() });
    }
  };

  const compile = useCallback(async () => {
    if (isOutOfCredits) {
      toast.error("Read-Only Mode: Daily credit limit reached. Please upgrade to Premium to compile.");
      return;
    }
    if (!fs || compiling || !project || isSyncing) return;
    const rootFile = project?.mainFile || 'main.tex';
    setCompiling(true);
    setCompileLog(`> Compilation Started: ${rootFile}\n`);
    setErrors([]);

    try {
      await fs.writeFile(projectId, activeFile, code);
      const payloadMeta = await fs.listFiles(projectId);
      
      // AUTO-SYNC TO PERSISTENT STORE BEFORE COMPILING
      setIsSyncing(true);
      try {
        const textFiles = [];
        for (const meta of payloadMeta) {
          const ext = meta.path.split('.').pop()?.toLowerCase() || '';
          const isText = ['tex', 'bib', 'cls', 'sty', 'bst', 'txt'].includes(ext);
          if (isText) {
            const f = await fs.readFile(projectId, meta.path);
            if (f) {
              textFiles.push({
                filename: f.path,
                content: f.content
              });
            }
          }
        }
        const mainContent = textFiles.find(f => f.filename === 'main.tex')?.content || code;
        await fetch(`/api/projects/${projectId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            latexContent: mainContent,
            files: textFiles
          })
        });
      } catch (syncErr) {
        console.error("Auto-sync to cloud failed before compilation:", syncErr);
      } finally {
        setIsSyncing(false);
      }
      
      const formData = new FormData();
      formData.append('engine', engine);
      formData.append('mainFile', rootFile);
      if (projectId) formData.append('projectId', projectId);
      
      for (let i = 0; i < payloadMeta.length; i++) {
        const fMeta = payloadMeta[i];
        const f = await fs.readFile(projectId, fMeta.path);
        if (!f) continue;
        
        formData.append(`files[${i}][path]`, f.path);
        formData.append(`files[${i}][content]`, f.content);
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
        await renderPdf();
        setCompileLog(prev => prev + '> SUCCESS: PDF Generated.\n' + (result.log || ''));
        toast.success("Manuscript Compiled Successfully", { icon: '✨' });
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
        const offline = typeof navigator !== 'undefined' && !navigator.onLine;
        toast.error(offline ? "Cannot compile: No internet connection." : "Compilation logic error: Check network or logs.");
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

  if (!mounted) return null;

  return (
    <StudioErrorBoundary>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg-primary)', color: 'var(--text-primary)', overflow: 'hidden', fontFamily: 'var(--font-body)' }}>
        
        <DocToolbar 
          project={project}
          tempTitle={tempTitle}
          isEditingTitle={isEditingTitle}
          setIsEditingTitle={setIsEditingTitle}
          setTempTitle={setTempTitle}
          renameProject={handleTitleSave}
          createNewFile={createNewFile}
          beautify={handleFormat}
          hasCode={!!code?.trim() && !isImage(activeFile)}
          editorMood={editorMood}
          setEditorMood={setEditorMood}
          engine={engine}
          setEngine={(val: any) => {
            setEngine(val);
            setAutoEngine(false);
            localStorage.setItem(`doc_auto_${projectId}`, 'false');
          }}
          autoEngine={autoEngine}
          setAutoEngine={(val: boolean) => {
            setAutoEngine(val);
            localStorage.setItem(`doc_auto_${projectId}`, val.toString());
          }}
          compile={compile}
          compiling={compiling}
          projectId={projectId}
          isReadOnly={isOutOfCredits}
          onShare={shareProject}
        />

         <div style={{ 
           display: 'flex', flex: 1, overflow: 'hidden', padding: '0.75rem', gap: '0.25rem',
           background: 'var(--bg-secondary)', borderRadius: '24px', margin: '0.5rem', border: '1px solid var(--border)'
         }}>
           
            <DocSidebar 
              sidebarWidth={sidebarWidth}
              files={files}
              activeFile={activeFile}
              switchTab={switchTab}
              deleteFile={deleteFile}
              handleFileUpload={handleFileUpload}
              exportProjectZip={exportProjectZip}
              isReadOnly={isOutOfCredits}
              compiling={compiling}
            />

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
                 style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: EDITOR_MOODS[editorMood].bg, borderRadius: '16px', border: '1px solid var(--border)', overflow: 'hidden', boxShadow: '0 8px 30px rgba(0,0,0,0.15)' }}
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
                        <div key={t} onClick={() => switchTab(t)} style={{ 
                          padding: '0 1rem', height: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.65rem', fontWeight: activeFile === t ? 800 : 600,
                          background: activeFile === t ? 'var(--bg-primary)' : 'transparent', borderRight: '1px solid var(--border)', 
                          color: activeFile === t ? 'var(--text-primary)' : 'var(--text-secondary)', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', position: 'relative', fontFamily: 'var(--font-headline)', letterSpacing: '0.05em',
                          flexShrink: 1, minWidth: '80px', maxWidth: '160px', overflow: 'hidden'
                        }}>
                           {isImage(t) ? <Layout size={12} strokeWidth={2.5} style={{ opacity: activeFile === t ? 1 : 0.5, flexShrink: 0 }} /> : <FileText size={12} strokeWidth={2.5} style={{ opacity: activeFile === t ? 1 : 0.5, flexShrink: 0 }} />}
                           <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{t.toUpperCase()}</span>
                           {activeFile === t && (
                             <motion.div 
                               layoutId="tab-highlight-d" 
                               style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '2px', background: 'var(--accent-primary)', boxShadow: '0 0 10px var(--accent-glow)' }} 
                             />
                           )}
                           {t !== 'main.tex' && (
                             <X 
                               size={10} 
                               strokeWidth={2.5} 
                               onClick={(e) => handleCloseTab(e, t)} 
                               style={{ flexShrink: 0, opacity: activeFile === t ? 0.7 : 0.4, color: 'currentColor' }} 
                               className="hover:text-red-500 transition-colors cursor-pointer"
                             />
                           )}
                        </div>
                      ))}
                  </div>

                  <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column' }}>
                    {isSyncing && (
                      <div style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'rgba(10, 10, 10, 0.85)',
                        backdropFilter: 'blur(8px)',
                        zIndex: 50,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '1.5rem',
                      }}>
                        {/* Dynamic revolving icon */}
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                          style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '12px',
                            background: 'linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary, #a855f7) 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 0 20px var(--accent-glow)',
                          }}
                        >
                          <Command size={22} color="#fff" />
                        </motion.div>
                        
                        <div style={{ textAlign: 'center' }}>
                          <h4 style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.5rem 0', fontFamily: 'var(--font-headline)', letterSpacing: '0.05em' }}>
                            LOADING LATEX MANUSCRIPT TEMPLATE
                          </h4>
                          <p style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', margin: 0, fontFamily: 'var(--font-body)' }}>
                            Synchronizing source files and asset directories...
                          </p>
                        </div>

                        {/* Progress Bar */}
                        <div style={{
                          width: '180px',
                          height: '4px',
                          background: 'rgba(255, 255, 255, 0.08)',
                          borderRadius: '2px',
                          overflow: 'hidden',
                          position: 'relative'
                        }}>
                          <motion.div
                            initial={{ left: '-100%' }}
                            animate={{ left: '100%' }}
                            transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                            style={{
                              position: 'absolute',
                              top: 0,
                              bottom: 0,
                              width: '60px',
                              background: 'var(--accent-primary)',
                              boxShadow: '0 0 8px var(--accent-primary)',
                              borderRadius: '2px'
                            }}
                          />
                        </div>
                      </div>
                    )}

                    {isImage(activeFile) ? (
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-secondary)', padding: '2rem' }}>
                          <div style={{ position: 'relative', maxWidth: '100%', maxHeight: '100%', boxShadow: '0 0 50px rgba(0,0,0,0.5)', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
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
                           handleCodeChange(v || '');
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
                           readOnly: isOutOfCredits
                         }}
                       />
                    )}
                 </div>
               </motion.main>

               {/* RESIZER PDF */}
                <div 
                  onMouseDown={() => setIsResizingPdf(true)}
                  style={{ 
                    width: '6px', cursor: 'col-resize', borderRadius: '3px', transition: 'all 0.2s', margin: '0 -2px', zIndex: 10,
                    background: isResizingPdf ? 'var(--accent-primary)' : 'color-mix(in srgb, var(--text-primary) 8%, transparent)' 
                  }} 
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--accent-primary)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = isResizingPdf ? 'var(--accent-primary)' : 'color-mix(in srgb, var(--text-primary) 8%, transparent)'}
                />

               <motion.section 
                 initial={{ x: 20, opacity: 0 }}
                 animate={{ x: 0, opacity: 1 }}
                 style={{ width: pdfWidth, background: 'var(--bg-secondary)', borderRadius: '16px', border: '1px solid var(--border)', overflow: 'hidden', position: 'relative', flexShrink: 0, boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}
               >
                   <ScholarlyViewer 
                     pdfUrl={pdfUrl && !pdfUrl.startsWith('blob:') && !pdfUrl.startsWith('data:') ? `${pdfUrl}?v=${compileVersion}` : pdfUrl} 
                     compiling={compiling}
                     jumpTo={jumpTo} 
                     onJumpToLatexCode={jumpToLine} 
                     onSync={syncToPdf}
                     onDownload={() => currentPdfBlob.current && saveAs(currentPdfBlob.current, 'manuscript.pdf')}
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


         <CreditLimitModal 
           isOpen={showCreditLimitModal} 
           onClose={() => {
             setDismissedCreditModal(true);
             setShowCreditLimitModal(false);
           }}
         />
      </div>
    </StudioErrorBoundary>
  );
}
