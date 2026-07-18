"use client";
import './editor-shared.css';
import { useSession, signIn } from "@/lib/pb-auth-react";
import { useLayoutSync } from "@/hooks/useLayoutSync";
import { useEffect, useState, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { StudioFS, type StudioProject, type StudioFile } from '@/lib/studio-fs';
import { parseLaTeXStructure, type OutlineNode } from '@/lib/structure-parser';
import { indexProject, type ProjectIndex } from '@/lib/project-indexer';
import Link from 'next/link';
import Image from 'next/image';
import { Share2, Printer, Cloud, UserPlus, Trash2, Pencil, Sparkles, RefreshCw } from 'lucide-react';
import { getLatexSuggestions } from '@/lib/latex-suggestions';
import toast from 'react-hot-toast';
import LatexifyLogo from '@/components/LatexifyLogo';
import { motion, AnimatePresence } from 'framer-motion';

// --- Scholarly Seal Component ---
const ScholarlySeal = ({ size = 24 }: { size?: number }) => (
  <svg viewBox="0 0 100 100" style={{ width: size, height: size, color: 'var(--accent-primary)' }} fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="25" y="25" width="50" height="50" stroke="currentColor" strokeWidth="4"/>
    <rect x="35" y="35" width="30" height="30" stroke="currentColor" strokeWidth="2" opacity="0.5"/>
    <path d="M50 10V25M50 75V90M10 50H25M75 50H90" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/>
    <circle cx="50" cy="50" r="2" fill="currentColor"/>
  </svg>
);

const EditorSkeleton = () => (
  <div style={{ flex: 1, background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <div style={{ color: '#333', fontSize: '0.9rem' }}>Initializing Editor...</div>
  </div>
);

// Dynamically import heavy components
const MonacoEditor = dynamic(() => import('@monaco-editor/react').then(m => m.default), { ssr: false, loading: () => <EditorSkeleton /> });
const ScholarlyViewer = dynamic(() => import('./ScholarlyPDFViewer').then(m => m.default), { ssr: false, loading: () => <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}>Loading viewer...</div> });

import 'katex/dist/katex.min.css';
import { saveAs } from 'file-saver';
import { type DiagnosticError, parseLog } from '@/lib/studio-core/compiler-utils';
import { formatLatexCode, type EditorMood, EDITOR_MOODS } from '@/lib/studio-core/formatting-utils';
import ConsolePanel from './ConsolePanel';
import EditorLoadingOverlay from './EditorLoadingOverlay';

interface IDEContainerProps {
  projectId?: string;
  isGuest?: boolean;
}

export default function IDEContainer({ projectId: initialProjectId, isGuest: _isGuest = false }: IDEContainerProps) {
  const { data: session, status } = useSession();
  
  const [projectId, setProjectId] = useState<string | undefined>(initialProjectId);
  const [fs, setFs] = useState<StudioFS | null>(null);
  const [project, setProject] = useState<StudioProject | null>(null);
  const [files, setFiles] = useState<StudioFile[]>([]);
  const [activeFile, setActiveFile] = useState<string>('main.tex');
  const [openTabs, setOpenTabs] = useState<string[]>(['main.tex']);
  const [code, setCode] = useState('');
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [compiling, setCompiling] = useState(false);
  const [compileLog, setCompileLog] = useState('');
  const [errors, setErrors] = useState<DiagnosticError[]>([]);
  const [engine, setEngine] = useState<'pdflatex' | 'lualatex' | 'xelatex'>('pdflatex');
  const [activePanel, setActivePanel] = useState<'files' | 'outline' | 'settings' | 'converter'>('files');
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [editorMood, setEditorMood] = useState<EditorMood>('obsidian');
  const [fontSize] = useState(15);
  const [aiPanel, setAiPanel] = useState(false);
  const [_creating, setCreating] = useState(false);
  const [jumpTo, setJumpTo] = useState<{ percentage: number; timestamp: number } | null>(null);
  const [_outline, setOutline] = useState<OutlineNode[]>([]);
  const [pdfWidth, setPdfWidth] = useState(500);
  const [sidebarWidth, setSidebarWidth] = useState(220);
  const [_projectIndex, setProjectIndex] = useState<ProjectIndex>({ labels: [], citations: [] });
  const [showPdf, setShowPdf] = useState(true);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [projectType, setProjectType] = useState<string | null>(null);
  const [loadingCode, setLoadingCode] = useState(false);
  
  // Collaboration States
  const [showShareModal, setShowShareModal] = useState(false);
  const [collaborators, setCollaborators] = useState<any[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'viewer' | 'editor'>('viewer');
  const [isSharing, setIsSharing] = useState(false);

  // Converter States
  const [converting, setConverting] = useState(false);
  const [mounted, setMounted] = useState(false);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const structureTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const isSelfChange = useRef<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const compileRef = useRef<(() => Promise<void>) | null>(null);
  const isSystemSyncing = useRef(false);
  const currentPdfBlob = useRef<Blob | null>(null);
  const previousPdfUrl = useRef<string | null>(null);

  const filesRef = useRef<StudioFile[]>([]);
  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  // Load persisted layout
  const { settings, updatePanels } = useLayoutSync(false);

  useEffect(() => {
    setMounted(true);
    const sw = localStorage.getItem('sidebarWidth');
    const pw = localStorage.getItem('pdfWidth');
    if (sw) setSidebarWidth(parseInt(sw));
    if (pw) setPdfWidth(parseInt(pw));
  }, []);

  useEffect(() => {
    if (settings.panels?.sidebarWidth) {
      setSidebarWidth(settings.panels.sidebarWidth);
    }
    if (settings.panels?.pdfWidth) {
      setPdfWidth(settings.panels.pdfWidth);
    }
    if (settings.panels?.editorMood) {
      setEditorMood(settings.panels.editorMood);
    }
  }, [settings.panels?.sidebarWidth, settings.panels?.pdfWidth, settings.panels?.editorMood]);

  useEffect(() => {
    localStorage.setItem('sidebarWidth', sidebarWidth.toString());
    localStorage.setItem('pdfWidth', pdfWidth.toString());
    localStorage.setItem('guest_mood', editorMood);

    updatePanels({
      sidebarWidth,
      pdfWidth,
      editorMood
    });
  }, [sidebarWidth, pdfWidth, editorMood, updatePanels]);

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

  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [isResizingPdf, setIsResizingPdf] = useState(false);

  useEffect(() => {
    if (status === 'loading') return;
    
    // Support Guest mode if no session or explicitly asked
    const userEmail = session?.user?.email || 'guest-session';
    const studioFs = new StudioFS(userEmail);
    setFs(studioFs);

    const init = async () => {
      setLoadingCode(true);
      let targetId = initialProjectId;
      
      // 1. Resolve Target Project ID
      if (!targetId) {
        const projects = await studioFs.listProjects();
        const demo = projects.find(p => p.title === 'Demo Project');
        if (!demo) {
          targetId = await studioFs.createProject('Demo Project', 'blank');
        } else {
          targetId = demo.id;
        }
        setProjectId(targetId);
      }

      // 2. IMMEDIATE LOCAL LOAD (Zero Latency)
      const [proj, fileList] = await Promise.all([
        studioFs.getProject(targetId),
        studioFs.listFiles(targetId)
      ]);

      if (proj) {
        setProject(proj);
        setFiles(fileList);
        setEngine(proj.engine);
        const activeMeta = fileList.find(f => f.path === 'main.tex') || fileList[0];
        if (activeMeta) {
          setActiveFile(activeMeta.path);
          setOpenTabs([activeMeta.path]);
          const fullActive = await studioFs.readFile(targetId, activeMeta.path);
          if (fullActive) setCode(fullActive.content);
        }
        
        // Project Indexing logic is currently unavailable for fileListMeta because it requires content. 
        // We defer full indexing until the full files are needed or stream it later.
      }

      // 3. BACKGROUND SOURCE OF TRUTH SYNC (Cloud Consistency)
      try {
        const dbRes = await fetch(`/api/projects/${targetId}`);
        const dbData = await dbRes.json();
        const databaseProject = dbData.project;

        if (databaseProject) {
          setProjectType(databaseProject.projectType || null);
          console.log('Synchronizing workspace with cloud source...');
          let needsRefresh = false;

          // 3.1 Sync Core LaTeX Content (main.tex)
          const mainPath = databaseProject.mainFile || 'main.tex';
          const localMain = fileList.find(f => f.path === mainPath);
          if (databaseProject.latexContent && (!localMain || localMain.content.length === 0)) {
            await studioFs.writeFile(targetId, mainPath, databaseProject.latexContent);
            needsRefresh = true;
          }

          // 3.2 Universal Asset & Secondary File Sync
          if (databaseProject.files && databaseProject.files.length > 0) {
            for (const file of databaseProject.files) {
              const existsLocally = fileList.some(f => f.path === file.filename);
              if (!existsLocally) {
                try {
                  const res = await fetch(file.filePath);
                  if (res.ok) {
                    if (file.fileType === 'image') {
                      const blob = await res.blob();
                      const dataUrl = await new Promise<string>((resolve) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result as string);
                        reader.readAsDataURL(blob);
                      });
                      await studioFs.writeFile(targetId, file.filename, dataUrl);
                    } else {
                      const content = await res.text();
                      await studioFs.writeFile(targetId, file.filename, content);
                    }
                    needsRefresh = true;
                  }
                } catch (_e) { console.error(`Sync error for ${file.filename}:`, _e); }
              }
            }
          }

          // 3.3 Final State Sync (Only if cloud had updates)
          if (needsRefresh) {
            const finalFiles = await studioFs.listFiles(targetId);
            const finalProj = await studioFs.getProject(targetId);
            setFiles(finalFiles);
            setProject(finalProj || null);
            
            const active = finalFiles.find(f => f.path === mainPath) || finalFiles[0];
            if (active) {
                setActiveFile(active.path);
                setCode(active.content);
            }
            setProjectIndex(indexProject(finalFiles));
          }
        }
      } catch {
        console.warn('Sync ignored: Working in offline/local mode.');
      }
      setLoadingCode(false);
    };

    init();
  }, [session, status, initialProjectId]);

  const saveFile = useCallback(async (path: string, content: string) => {
    if (!fs || !projectId) return;
    await fs.writeFile(projectId, path, content);
    setFiles(prev => prev.map(f => f.path === path ? { ...f, content, updatedAt: Date.now() } : f));
    setProjectIndex(indexProject(await fs.listFiles(projectId)));
  }, [fs, projectId]);

  const handleCodeChange = (value: string | undefined) => {
    const val = value || '';
    setCode(val);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveFile(activeFile, val), 1500);
    if (structureTimer.current) clearTimeout(structureTimer.current);
    structureTimer.current = setTimeout(() => setOutline(parseLaTeXStructure(val)), 1000);
  };

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

  const switchTab = async (path: string) => {
    if (fs && projectId) await fs.writeFile(projectId, activeFile, code);
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

  const printPdf = useCallback(() => {
    if (!pdfUrl) return;
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = pdfUrl;
    document.body.appendChild(iframe);
    iframe.onload = () => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    };
  }, [pdfUrl]);

  const loadCollaborators = useCallback(async () => {
    if (!projectId) return;
    try {
      const res = await fetch(`/api/projects/${projectId}/collaborators`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.collaborators) setCollaborators(data.collaborators);
    } catch (e) {
      console.error("Collaborator load failed", e);
    }
  }, [projectId]);

  const inviteMember = async () => {
    if (!inviteEmail || !projectId) return;
    setIsSharing(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/collaborators`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole })
      });
      if (res.ok) {
        toast.success("Member access granted");
        setInviteEmail('');
        loadCollaborators();
      } else {
        toast.error("Failed to share project");
      }
    } finally {
      setIsSharing(false);
    }
  };

  const removeMember = async (email: string) => {
    if (!projectId) return;
    try {
      const res = await fetch(`/api/projects/${projectId}/collaborators`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      if (res.ok) {
        toast.success("Member access revoked");
        loadCollaborators();
      }
    } catch {
      toast.error("Revoke failed");
    }
  };

  const handleThinConverterUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !projectId || !fs) return;

    setConverting(true);
    const toastId = toast.loading("Converting Document to LaTeX...");
    
    try {
      const formData = new FormData();
      formData.append("file", file);
      
      const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
      
      let uploadData: any = {};
      const resText = await uploadRes.text();
      try {
        if (resText.trim().startsWith('{')) {
          uploadData = JSON.parse(resText);
        } else {
          throw new Error(`Server Error (${uploadRes.status}): Invalid response format.`);
        }
      } catch (e: any) {
        throw new Error(e.message || `Server Error (${uploadRes.status}): Invalid response format.`);
      }
      
      if (!uploadRes.ok) throw new Error(uploadData.error || "Conversion failed");

      // 1. Get the newly converted LaTeX content
      const projRes = await fetch(`/api/projects/${uploadData.projectId}`);
      if (!projRes.ok) throw new Error("Failed to fetch converted project");
      const projData = await projRes.json();

      if (projData.project?.latexContent) {
        // 2. Overwrite main.tex in CURRENT project
        await fs.writeFile(projectId, 'main.tex', projData.project.latexContent);
        
        // 3. Sync extracted assets (images) if any
        if (projData.project.files) {
          for (const asset of projData.project.files) {
            if (asset.fileType === 'image') {
              const imgRes = await fetch(asset.filePath);
              const blob = await imgRes.blob();
              const dataUrl = await new Promise<string>(r => {
                const rd = new FileReader();
                rd.onloadend = () => r(rd.result as string);
                rd.readAsDataURL(blob);
              });
              await fs.writeFile(projectId, asset.filename, dataUrl);
            }
          }
        }

        // 4. Update Editor UI
        const updatedFiles = await fs.listFiles(projectId);
        setFiles(updatedFiles);
        if (activeFile === 'main.tex') {
          setCode(projData.project.latexContent);
        }
        toast.success("Success! Document converted and integrated.", { id: toastId });
      }
    } catch (err: any) {
      const offline = typeof navigator !== 'undefined' && !navigator.onLine;
      toast.error(offline ? "Cannot compile: No internet connection." : (err.message || "Failed to convert document"), { id: toastId });
    } finally {
      setConverting(false);
    }
  };

  const handleDeleteFile = async (path: string) => {
    if (!window.confirm(`Are you sure you want to delete ${path}?`)) return;
    try {
      if (fs && projectId) {
        await fs.deleteFile(projectId, path);
        const newList = await fs.listFiles(projectId);
        setFiles(newList);
        if (activeFile === path) {
          setActiveFile('main.tex');
          const main = newList.find(f => f.path === 'main.tex');
          if (main) setCode(main.content);
        }
        toast.success("File deleted");
      }
    } catch (e: any) {
      toast.error("Delete failed: " + e.message);
    }
  };

  const handleRenameFile = async (oldPath: string) => {
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
      }
    } catch (e: any) {
      toast.error("Rename failed: " + e.message);
    }
  };

  const compile = useCallback(async () => {
    if (!fs || !projectId || compiling) return;
    setCompiling(true);
    setCompileLog('Compiling...\n');
    setErrors([]);



    try {
      await saveFile(activeFile, code);
      const allFiles = await fs.listFiles(projectId);
      const filePayload = allFiles.filter(f => !f.isDirectory);
      
      const formData = new FormData();
      formData.append('engine', engine);
      formData.append('mainFile', project?.mainFile || 'main.tex');
      if (projectId) formData.append('projectId', projectId);
      
      for (let i = 0; i < filePayload.length; i++) {
        const f = filePayload[i];
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
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setCompileLog(data.log || '');
      const parsedErrors = data.errors || parseLog(data.log || '');
      setErrors(parsedErrors);
      
      if (parsedErrors.length > 0) {
        setConsoleOpen(true);
      }
      
      if (!data.pdfUrl && !data.pdfBase64) {
        setPdfUrl('');
      }

      if (data.pdfUrl) {
        const cacheBustedUrl = data.pdfUrl + (data.pdfUrl.includes('?') ? '&' : '?') + 't=' + Date.now();
        setPdfUrl(cacheBustedUrl);
        // Fetch the blob asynchronously for the download button
        fetch(cacheBustedUrl).then(res => res.blob()).then(blob => {
          currentPdfBlob.current = blob;
        }).catch(e => console.error("Could not fetch blob for download:", e));
      } else if (data.pdfBase64) {
        const prefix = data.pdfBase64.startsWith('data:') ? '' : 'data:application/pdf;base64,';
        const fetchRes = await fetch(prefix + data.pdfBase64);
        const blob = await fetchRes.blob();
        
        // Store blob for direct downloads
        currentPdfBlob.current = blob;
        
        const newUrl = URL.createObjectURL(blob);
        if (previousPdfUrl.current) {
          const old = previousPdfUrl.current;
          setTimeout(() => URL.revokeObjectURL(old), 1000);
        }
        previousPdfUrl.current = newUrl;
        setPdfUrl(newUrl);
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
        setCompileLog(prev => prev + '\n> CONNECTION ERROR: Failed to contact the compilation server. Please ensure you are online.\n');
      } else {
        const offline = typeof navigator !== 'undefined' && !navigator.onLine;
        toast.error(offline ? "Cannot compile: No internet." : "Check network or logs.");
        setCompileLog(prev => prev + `\nCompilation failed: ${err.message}`);
      }
    } finally {
      setCompiling(false);
    }
  }, [fs, projectId, activeFile, code, engine, project, saveFile, compiling]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); compile(); } };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [compile]);

  // Keep compileRef current so async callbacks always call the latest version
  useEffect(() => {
    compileRef.current = compile;
  }, [compile]);

  const handleFormat = () => {
    try {
      const formatted = formatLatexCode(code);
      if (formatted !== code) {
        setCode(formatted);
        toast.success("LaTeX Beautified", { icon: '✨' });
      }
    } catch {
      toast.error("Formatting failed");
    }
  };


  
  // Bi-directional Sync with Deep Heuristics
  const lastSyncTime = useRef(0);
  const lastPercentage = useRef(0);

  const syncToPdf = useCallback(() => {
    if (!editorRef.current || isSystemSyncing.current) return;
    
    // Prevent excessive updates if recently synced via system
    if (Date.now() - lastSyncTime.current < 800) return;

    const model = editorRef.current.getModel();
    if (!model) return;
    const selection = editorRef.current.getSelection();
    const line = selection?.startLineNumber || 1;
    const totalLines = model.getLineCount();
    
    // Improved Heuristic: Preamble filtering
    const content = model.getValue();
    const docStartMatch = content.match(/\\begin\{document\}/);
    const docStartLine = docStartMatch ? model.getPositionAt(docStartMatch.index!).lineNumber : 1;
    
    let percentage = 0;
    if (line < docStartLine) {
      percentage = 0; // In preamble
    } else {
      const bodyLines = totalLines - docStartLine + 1;
      percentage = (line - docStartLine) / (bodyLines || 1);
    }

    // Only update if it's a significant change (> 0.5%)
    if (Math.abs(percentage - lastPercentage.current) > 0.005) {
      lastPercentage.current = percentage;
      setJumpTo({ percentage, timestamp: Date.now() });
    }
  }, []);

  const jumpToEditor = (percentage: number) => {
    if (!editorRef.current) return;
    const model = editorRef.current.getModel();
    if (!model) return;
    const totalLines = model.getLineCount();
    
    // Find preamble offset
    const content = model.getValue();
    const docStartMatch = content.match(/\\begin\{document\}/);
    const docStartLine = docStartMatch ? model.getPositionAt(docStartMatch.index!).lineNumber : 1;
    const bodyLines = totalLines - docStartLine + 1;
    
    const targetLine = docStartLine + Math.floor(percentage * bodyLines);
    
    isSystemSyncing.current = true; // Lock
    lastSyncTime.current = Date.now(); // Mark system sync time
    lastPercentage.current = percentage;

    editorRef.current.setSelection({ 
      startLineNumber: targetLine, 
      startColumn: 1, 
      endLineNumber: targetLine, 
      endColumn: 1 
    });
    editorRef.current.revealLineInCenter(targetLine);
    editorRef.current.focus();
    
    setTimeout(() => { isSystemSyncing.current = false; }, 1200); // Broadened lock for maximum stability
  };

  const syncOnCursorChange = useCallback(() => {
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(syncToPdf, 300);
  }, [syncToPdf]);

  const downloadPdf = () => {
    if (currentPdfBlob.current) {
      // Blob in memory — trigger explicit user-initiated download
      saveAs(currentPdfBlob.current, `${project?.title || 'manuscript'}.pdf`);
    } else if (pdfUrl) {
      // No blob yet — open in a new tab using anchor (NOT window.open which causes
      // auto-download when pdfUrl is a blob: URL)
      const a = document.createElement('a');
      a.href = pdfUrl;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      // Do NOT set a.download — that forces a download instead of opening in tab
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };


  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !fs || !projectId) return;
    const uploadedFiles = Array.from(e.target.files);
    for (const file of uploadedFiles) {
      let path = (file.webkitRelativePath || file.name).replace(/\s+/g, '_');
      const ext = path.split('.').pop()?.toLowerCase();
      const isText = ['tex', 'bib', 'cls', 'sty', 'txt', 'md', 'csv'].includes(ext || '');
      let content: string;
      const isBypassedImage = ['heic', 'heif', 'tiff', 'tif', 'bmp', 'avif', 'eps', 'pdf', 'png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext || '');
      if (!isText && file.type.startsWith('image/') && !isBypassedImage && !['image/jpeg', 'image/png'].includes(file.type)) {
        content = await new Promise<string>((resolve) => {
          const img = new (window as any).Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width; canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (ctx) { ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(img, 0, 0); }
            resolve(canvas.toDataURL('image/png'));
          };
          const reader = new FileReader();
          reader.onload = () => { img.src = reader.result as string; };
          reader.readAsDataURL(file);
        });
        path = path.replace(/\.[^/.]+$/, "") + ".png";
      } else {
        content = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          if (isText) reader.readAsText(file); else reader.readAsDataURL(file);
        });
      }
      await fs.writeFile(projectId, path, content);
    }
    const updated = await fs.listFiles(projectId);
    setFiles(updated);
    setProjectIndex(indexProject(updated));
  };


  const downloadZip = async () => {
    if (!fs || !projectId) return;
    const blob = await fs.exportZip(projectId);
    let name = project?.title || 'project';
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(name.trim());
    if (!name || isUuid) name = 'document';
    const fileName = `${name.replace(/\s+/g, '_')}.zip`;
    
    saveAs(blob, fileName);
  };

  const jumpToLine = async (line: number, path?: string, col: number = 1) => {
    if (!editorRef.current) return;
    
    // 1. Tab Switching Logic
    if (path && path !== activeFile) {
      const fileExists = files.some(f => f.path === path);
      if (fileExists) {
        await switchTab(path);
        // Wait for tab switch and code update
        setTimeout(() => jumpToLine(line, undefined, col), 50);
        return;
      }
    }

    const editor = editorRef.current;
    
    // 2. Clear previous jump decorations if any
    const oldDecorations = editor.jumpDecorations || [];
    
    // 3. Add Flare Decoration
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

    // 4. Position and Focus
    editor.setSelection({ startLineNumber: line, startColumn: col, endLineNumber: line, endColumn: col + 5 });
    editor.revealLineInCenter(line);
    editor.focus();

    // 5. Cleanup flare after 3 seconds
    setTimeout(() => {
      if (editorRef.current) {
        editorRef.current.jumpDecorations = editorRef.current.deltaDecorations(newDecorations, []);
      }
    }, 3000);
  };

  const getFileIcon = (name: string) => {
    const ext = name.split('.').pop()?.toLowerCase();
    const icons: Record<string, string> = { tex: '📄', bib: '📚', cls: '⚙️', sty: '🎨', png: '🖼️', jpg: '🖼️', pdf: '📰' };
    return icons[ext || ''] || '📄';
  };

  // Styles for resizer
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingSidebar) setSidebarWidth(Math.max(160, Math.min(500, e.clientX)));
      else if (isResizingPdf) setPdfWidth(Math.max(300, Math.min(window.innerWidth * 0.8, window.innerWidth - e.clientX)));
    };
    const handleMouseUp = () => { setIsResizingSidebar(false); setIsResizingPdf(false); document.body.style.cursor = 'default'; };
    if (isResizingSidebar || isResizingPdf) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
    }
    return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); };
  }, [isResizingSidebar, isResizingPdf]);

  const registerLatexCompletionItems = (monaco: any) => {
    return monaco.languages.registerCompletionItemProvider('latex', {
      provideCompletionItems: (model: any, position: any) => {
        return { suggestions: getLatexSuggestions(monaco, model, position, filesRef.current) };
      }
    });
  };

  if (!mounted) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg-primary)', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
         <div className="shimmer" style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--accent-primary)', opacity: 0.2 }} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg-primary)', overflow: 'hidden' }}>

      
      {/* TOP TOOLBAR */}
      <div style={{
        height: '48px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0 1rem', flexShrink: 0, zIndex: 10
      }}>
        <Link href="/dashboard" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
           <ScholarlySeal size={28} />
           <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '1rem', marginLeft: '0.75rem', cursor: 'pointer', fontFamily: 'var(--font-newsreader)', fontStyle: 'italic' }}>
             {projectType === 'DOC2LATEX' ? (
               <>Doc2Latex<span style={{ fontStyle: 'normal', fontWeight: 800, color: 'var(--accent-primary)' }}>ify</span></>
             ) : (
               <><LatexifyLogo size={24} style={{ marginRight: '0.25rem' }} /> <span style={{ fontStyle: 'normal', fontWeight: 800, color: 'var(--accent-primary)' }}>Dashboard</span></>
             )}
           </div>
        </Link>
        <div style={{ width: '1px', height: '20px', background: 'var(--border)', margin: '0 0.5rem' }} />
        
        {!projectId && <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Initializing...</div>}
        {projectId && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: '0.5rem' }}>
            {isEditingTitle ? (
              <input
                autoFocus
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                onBlur={async () => {
                  setIsEditingTitle(false);
                  const newName = editedTitle.trim();
                  if (newName && newName !== (project?.title || 'Untitled Project')) {
                     const pid = projectId;
                     if (!pid) return;

                     // 1. Update Remote (Cloud Sync)
                     fetch(`/api/projects/${pid}`, {
                       method: 'PUT',
                       headers: { 'Content-Type': 'application/json' },
                       body: JSON.stringify({ title: newName })
                     }).catch(err => console.error("Remote rename failed:", err));

                     // 2. Update Local (Metadata Persistence)
                     if (fs) {
                       await fs.renameProject(pid, newName);
                     }

                     // 3. Update UI State
                     setProject(p => p ? { ...p, title: newName } : null);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur();
                  if (e.key === 'Escape') {
                    setEditedTitle(project?.title || 'Untitled Project');
                    setIsEditingTitle(false);
                  }
                }}
                style={{
                  background: 'var(--bg-tertiary)', border: '1px solid var(--accent-primary)',
                  color: 'var(--text-primary)', fontSize: '0.9rem', fontWeight: 700,
                  outline: 'none', padding: '2px 6px', borderRadius: '4px', width: '200px'
                }}
              />
            ) : (
              <>
                <span 
                  onClick={() => {
                    setEditedTitle(project?.title || 'Untitled Project');
                    setIsEditingTitle(true);
                  }}
                  style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', cursor: 'pointer' }}
                >
                  {project?.title || 'Untitled Project'}
                </span>
                <Pencil 
                  size={16} 
                  style={{ color: 'var(--accent-primary)', cursor: 'pointer', opacity: 0.7, transition: 'all 0.2s' }} 
                  onMouseOver={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'scale(1.1)'; }}
                  onMouseOut={e => { e.currentTarget.style.opacity = '0.7'; e.currentTarget.style.transform = 'scale(1)'; }}
                  onClick={() => {
                    setEditedTitle(project?.title || 'Untitled Project');
                    setIsEditingTitle(true);
                  }}
                />
              </>
            )}
          </div>
        )}

        <div style={{ flex: 1 }} />

        {/* Global CTA if not logged in */}
        {!session && (
          <div style={{ display: 'flex', gap: '0.5rem', marginRight: '1rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', alignSelf: 'center', marginRight: '0.5rem' }}>Guest Mode</span>
            <button type="button" onClick={() => signIn()} className="btn btn-primary" style={{ padding: '0.2rem 0.8rem', fontSize: '0.75rem' }}>Login / Register</button>
          </div>
        )}

        <button type="button" onClick={() => setShowPdf(s => !s)} className="btn btn-secondary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem', height: '28px' }}>
          {showPdf ? 'Hide PDF' : 'Show PDF'}
        </button>

        <select value={engine} onChange={async e => {
          const v = e.target.value as any; setEngine(v);
          if (fs && projectId) await fs.updateProjectEngine(projectId, v);
        }} className="input-field" style={{ width: 'auto', padding: '0.2rem 0.5rem', fontSize: '0.75rem', height: '32px' }}>
          <option value="pdflatex">pdfLaTeX</option>
          <option value="lualatex">LuaLaTeX</option>
          <option value="xelatex">XeLaTeX</option>
        </select>

        <button type="button" onClick={compile} disabled={compiling} className="btn btn-primary" style={{ padding: '0.3rem 1rem', fontSize: '0.82rem', height: '32px' }}>
          {compiling ? '...' : '▶ Compile'}
        </button>

         <button 
           type="button" 
           onClick={handleFormat}
           disabled={!code || !code.trim() || !!activeFile?.match(/\.(png|jpg|jpeg|gif|webp|svg|heic|heif|tiff|tif|bmp|avif|eps|pdf)$/i)}
           title={!code || !code.trim() ? "No code to beautify" : !!activeFile?.match(/\.(png|jpg|jpeg|gif|webp|svg|heic|heif|tiff|tif|bmp|avif|eps|pdf)$/i) ? "Cannot beautify image files" : "Beautify & Tidy Code (Auto-Format)"} 
           style={{ 
             background: !code || !code.trim() || !!activeFile?.match(/\.(png|jpg|jpeg|gif|webp|svg|heic|heif|tiff|tif|bmp|avif|eps|pdf)$/i) ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.05)',
             border: '1px solid rgba(255,255,255,0.1)', 
             color: !code || !code.trim() || !!activeFile?.match(/\.(png|jpg|jpeg|gif|webp|svg|heic|heif|tiff|tif|bmp|avif|eps|pdf)$/i) ? 'rgba(255,255,255,0.2)' : 'var(--accent-primary)',
             cursor: !code || !code.trim() || !!activeFile?.match(/\.(png|jpg|jpeg|gif|webp|svg|heic|heif|tiff|tif|bmp|avif|eps|pdf)$/i) ? 'not-allowed' : 'pointer',
             display: 'flex', alignItems: 'center', 
             gap: '0.4rem', padding: '0.35rem 0.6rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 800,
             height: '32px', opacity: !code || !code.trim() || !!activeFile?.match(/\.(png|jpg|jpeg|gif|webp|svg|heic|heif|tiff|tif|bmp|avif|eps|pdf)$/i) ? 0.4 : 1
           }}
         >
            <Sparkles size={14} />
            <span>BEAUTIFY</span>
         </button>

        <button type="button" onClick={syncToPdf} title="Sync PDF to current line" className="btn btn-secondary" style={{ padding: '0.3rem 0.5rem', fontSize: '1rem', height: '32px' }}>
          🎯
        </button>

        {pdfUrl && <button type="button" onClick={downloadPdf} title="Download PDF" className="btn btn-secondary" style={{ padding: '0.3rem 0.75rem', fontSize: '0.78rem', height: '32px' }}>⬇ PDF</button>}

        <button type="button" onClick={printPdf} title="Print PDF" className="btn btn-secondary" style={{ padding: '0.3rem 0.5rem', fontSize: '1rem', height: '32px' }}>
          <Printer size={16} />
        </button>

        <button type="button" onClick={downloadZip} title="Download ZIP" className="btn btn-secondary" style={{ padding: '0.3rem 0.75rem', fontSize: '0.78rem', height: '32px' }}>📦 ZIP</button>

        <button 
          type="button"
          onClick={() => {
            loadCollaborators();
            setShowShareModal(true);
          }} 
          title="Share Project / Team Access" 
          className="btn btn-secondary" 
          style={{ padding: '0.3rem 0.75rem', fontSize: '0.78rem', height: '32px', display: 'flex', alignItems: 'center', gap: '4px' }}
        >
          <Share2 size={14} /> Team
        </button>

        <button type="button" onClick={() => setAiPanel(p => !p)} className={aiPanel ? 'btn btn-primary' : 'btn btn-secondary'} style={{ padding: '0.3rem 0.75rem', fontSize: '0.78rem', height: '32px' }}>🤖 AI</button>

        <div style={{ width: '1px', height: '20px', background: 'var(--border)', margin: '0 0.5rem' }} />
        
        {/* Editor Mood Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', background: 'rgba(0,0,0,0.4)', padding: '0.35rem 0.75rem', borderRadius: '20px', border: '1px solid var(--accent-primary)', boxShadow: '0 2px 10px rgba(0,0,0,0.2)' }}>
           <span style={{ fontSize: '0.65rem', fontWeight: 900, color: 'var(--accent-primary)', marginRight: '4px', letterSpacing: '0.08em' }}>MOOD</span>
           {(Object.keys(EDITOR_MOODS) as EditorMood[]).map(m => (
             <div 
               key={m}
               onClick={() => setEditorMood(m)}
               title={`Switch to ${EDITOR_MOODS[m].name} Mood`}
               style={{ 
                 width: 14, height: 14, borderRadius: '50%', background: EDITOR_MOODS[m].bg, 
                 border: editorMood === m ? '2.5px solid #fff' : '1px solid rgba(255,255,255,0.8)', 
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

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Sidebar */}
        <div style={{ width: `${sidebarWidth}px`, flexShrink: 0, borderRight: '1px solid var(--border)', background: 'var(--bg-secondary)', display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
          <div onMouseDown={() => setIsResizingSidebar(true)} style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '4px', cursor: 'col-resize', zIndex: 10, background: 'color-mix(in srgb, var(--text-primary) 8%, transparent)' }} />
          
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
            {(['files', 'outline', 'converter', 'settings'] as const).map(p => (
              <button type="button" key={p} onClick={() => setActivePanel(p)} title={p === 'converter' ? 'DOC2LATEX' : p.toUpperCase()} style={{
                flex: 1, padding: '0.5rem 0', fontSize: '0.7rem',
                background: activePanel === p ? 'var(--bg-tertiary)' : 'transparent',
                border: 'none', color: activePanel === p ? 'var(--accent-primary)' : 'var(--text-secondary)',
              }}>{p === 'files' ? '📁' : p === 'outline' ? '📑' : p === 'converter' ? '☁️' : '⚙️'}</button>
            ))}
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

          <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem 0' }}>
            {activePanel === 'files' && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ padding: '0.5rem', borderBottom: '1px solid var(--border)', display: 'flex', gap: '0.25rem' }}>
                  <button type="button" onClick={() => setCreating(true)} style={{ flex: 1, padding: '0.2rem', fontSize: '0.7rem' }} className="btn btn-primary">+ File</button>
                  <button type="button" onClick={() => fileInputRef.current?.click()} style={{ flex: 1, padding: '0.2rem', fontSize: '0.7rem' }} className="btn btn-secondary">Upload</button>
                  <button type="button" onClick={() => folderInputRef.current?.click()} style={{ flex: 1, padding: '0.2rem', fontSize: '0.7rem' }} className="btn btn-secondary">Folder</button>
                </div>
                <input type="file" ref={fileInputRef} onChange={handleFileUpload} multiple style={{ display: 'none' }} />
                <input type="file" ref={folderInputRef} onChange={handleFileUpload} {...({ webkitdirectory: "true", directory: "true" } as any)} style={{ display: 'none' }} />
                
                {(() => {
                  const categories = [
                    { name: 'HEADER & INFO', icon: '📝', files: files.filter(f => /^(title|authors|abstract|keywords|contribution|organization|bibliography)\.tex$/i.test(f.path)) },
                    { name: 'STRUCTURE', icon: '📑', files: files.filter(f => /^(section|paragraph)_\d+\.tex$/i.test(f.path)) },
                    { name: 'ACADEMIC BLOCKS', icon: '🏗️', files: files.filter(f => /^(table|figure|algo|equation)_\d+\.tex$/i.test(f.path)) },
                    { name: 'OTHER ASSETS', icon: '📁', files: files.filter(f => 
                        !/^(main|title|authors|abstract|keywords|contribution|organization|bibliography)\.tex$/i.test(f.path) &&
                        !/^(section|paragraph|table|figure|algo|equation)_\d+\.tex$/i.test(f.path) &&
                        f.path !== 'main.tex'
                      ) 
                    }
                  ];
                  const mainFileObj = files.find(f => f.path === 'main.tex');
                  
                  return (
                    <div className="custom-scroll" style={{ flex: 1, overflowY: 'auto' }}>
                      {mainFileObj && (
                        <div key="main" style={{ marginBottom: '1rem' }}>
                          <div style={{ fontSize: '0.75rem', fontWeight: 800, opacity: 0.4, padding: '0.5rem 0.75rem', letterSpacing: '0.1em' }}>MAIN ENTRY</div>
                          <div onClick={() => switchTab(mainFileObj.path)} style={{
                            padding: '0.4rem 0.75rem', cursor: 'pointer', fontSize: '0.85rem',
                            background: activeFile === mainFileObj.path ? 'var(--bg-tertiary)' : 'transparent',
                            color: activeFile === mainFileObj.path ? 'var(--accent-primary)' : 'var(--text-primary)',
                            display: 'flex', gap: '0.5rem', alignItems: 'center'
                          }}>
                            🚀 {mainFileObj.name}
                          </div>
                        </div>
                      )}
                      
                      {categories.map(cat => cat.files.length > 0 && (
                        <div key={cat.name} style={{ marginBottom: '1rem' }}>
                          <div style={{ fontSize: '0.75rem', fontWeight: 800, opacity: 0.4, padding: '0.5rem 0.75rem', letterSpacing: '0.1em' }}>{cat.name}</div>
                          {cat.files.sort((a,b) => {
                            const aNum = parseInt(a.path.match(/\d+/)?.[0] || '0');
                            const bNum = parseInt(b.path.match(/\d+/)?.[0] || '0');
                            return aNum - bNum || a.path.localeCompare(b.path);
                          }).map(f => (
                            <div key={f.path} onClick={() => switchTab(f.path)} style={{
                              padding: '0.4rem 0.75rem', cursor: 'pointer', fontSize: '0.85rem',
                              background: activeFile === f.path ? 'var(--bg-tertiary)' : 'transparent',
                              color: activeFile === f.path ? 'var(--accent-primary)' : 'var(--text-primary)',
                              display: 'flex', gap: '0.5rem', alignItems: 'center', justifyContent: 'space-between'
                            }}>
                              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', overflow: 'hidden' }}>
                                {getFileIcon(f.name)} <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={f.path}>{f.name}</span>
                              </div>
                              {f.path !== 'main.tex' && (
                                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                                  <button onClick={() => handleRenameFile(f.path)} style={{ background: 'transparent', border: 'none', color: 'inherit', opacity: 0.5, cursor: 'pointer', padding: '2px' }} title="Rename File">
                                    <Pencil size={12} />
                                  </button>
                                  <button onClick={() => handleDeleteFile(f.path)} style={{ background: 'transparent', border: 'none', color: 'inherit', opacity: 0.5, cursor: 'pointer', padding: '2px' }} title="Delete File">
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            )}
            {activePanel === 'converter' && (
              <div style={{ padding: '1rem' }}>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Doc2Latex</h4>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Convert Word (.docx) or Text documents and merge them into this project.</p>
                
                <div 
                  onClick={() => document.getElementById('thin-converter-input')?.click()}
                  style={{
                    border: '1px dashed var(--border)', borderRadius: '8px', padding: '1.5rem 0.5rem',
                    textAlign: 'center', cursor: 'pointer', background: 'rgba(255,255,255,0.02)',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <input id="thin-converter-input" type="file" onChange={handleThinConverterUpload} accept=".docx,.txt" style={{ display: 'none' }} />
                  <Cloud size={24} style={{ color: 'var(--accent-primary)', marginBottom: '0.5rem', opacity: 0.8 }} />
                  <div style={{ fontSize: '0.7rem', fontWeight: 600 }}>{converting ? 'Converting...' : 'Click to Import Word'}</div>
                </div>

                {converting && (
                  <div style={{ marginTop: '1rem', padding: '0.5rem', background: 'var(--bg-tertiary)', borderRadius: '4px' }}>
                    <div style={{ fontSize: '0.6rem', color: 'var(--accent-primary)', marginBottom: '4px' }}>ANALYZING STRUCTURE...</div>
                    <div style={{ height: '2px', background: 'var(--border)', borderRadius: '1px', overflow: 'hidden' }}>
                      <div className="shimmer" style={{ width: '100%', height: '100%' }} />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Editor */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          <div style={{ flex: 1, position: 'relative' }}>
             {activeFile.match(/\.(png|jpg|jpeg|gif|webp|svg|heic|heif|tiff|tif|bmp|avif|eps|pdf)$/i) ? (
                <div style={{ height: '100%', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                   {(() => {
                     const ext = activeFile.split('.').pop()?.toLowerCase() || '';
                     const isRenderable = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'avif', 'bmp'].includes(ext);
                     if (isRenderable) {
                       return (
                          <Image src={code} alt="Preview" width={800} height={600} style={{ maxWidth: '90%', maxHeight: '90%', objectFit: 'contain' }} />
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
                           boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)'
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
                </div>
             ) : (
                <div style={{ flex: 1, position: 'relative', height: '100%', width: '100%', minWidth: 0 }}>
                  <EditorLoadingOverlay
                    visible={loadingCode}
                    label="LOADING LATEX SOURCE"
                    sublabel="Populating editor with manuscript content..."
                  />
                  <MonacoEditor
                    path={activeFile}
                    height="100%"
                    theme="scholarly-vibrant"
                    defaultValue={code}
                    onChange={v => {
                      isSelfChange.current = true;
                      handleCodeChange(v || '');
                    }}
                    onMount={(ed, monaco) => { 
                      editorRef.current = ed; 
                      monacoRef.current = monaco; 
                      
                      if (code) {
                        ed.setValue(code);
                      }

                      // Register LaTeX Language & Monarch Tokenizer for Multicolor Syntax Highlighting
                      try {
                        monaco.languages.register({ id: 'latex' });
                      } catch(e) {}
                      
                      try {
                        monaco.languages.setMonarchTokensProvider('latex', {
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

                      ed.onDidChangeCursorPosition(syncOnCursorChange);
                      const disposable = registerLatexCompletionItems(monaco);
                      (ed as any)._latexSnippets = disposable;

                      // Register Ctrl+Enter command to compile
                      try {
                        ed.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
                          compileRef.current?.();
                        });
                      } catch (e) {
                        console.warn("Failed to bind Ctrl+Enter command:", e);
                      }
                    }}
                    options={{ 
                      fontSize, 
                      minimap: { enabled: false }, 
                      automaticLayout: true, 
                      scrollBeyondLastLine: false, 
                      lineNumbersMinChars: 3, 
                      glyphMargin: false, 
                      lineDecorationsWidth: 0, 
                      fontLigatures: true, 
                      cursorBlinking: 'smooth', 
                      smoothScrolling: true,
                      wordWrap: 'on'
                    }}
                  />
                </div>
             )}
          </div>

          {/* Console */}
          <ConsolePanel 
             errors={errors as any}
             log={compileLog}
             isOpen={consoleOpen}
             onToggle={() => setConsoleOpen(!consoleOpen)}
             onJumpToLine={jumpToLine}
             projectId={projectId || 'guest'}
             compiling={compiling}
             title="SCHOLARLY DIAGNOSTIC CORE"
          />
        </div>

        {/* PDF */}
        {showPdf && (
          <>
            <div onMouseDown={() => setIsResizingPdf(true)} style={{ width: '4px', cursor: 'col-resize', background: 'color-mix(in srgb, var(--text-primary) 8%, transparent)' }} />
            <div style={{ width: `${pdfWidth}px`, flexShrink: 0, borderLeft: '1px solid var(--border)' }}>
               <ScholarlyViewer 
                 pdfUrl={pdfUrl} 
                 compiling={compiling} 
                 onJumpToLatexCode={jumpToEditor} 
                 jumpTo={jumpTo} 
               />
            </div>
          </>
        )}
        
        {aiPanel && (
          <div style={{ width: '300px', flexShrink: 0, borderLeft: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
             <AIAssistPanel 
               code={code} 
               errors={errors} 
                onInsert={(newCode) => {
                  const isFullDoc = newCode.includes('\\documentclass');
                  const updatedCode = isFullDoc ? newCode : `${code}\n${newCode}`;
                  setCode(updatedCode);
                  if (fs && projectId) {
                    fs.writeFile(projectId, activeFile, updatedCode);
                  }
                  setTimeout(() => compileRef.current?.(), 100);
                }} 
               onClose={() => setAiPanel(false)} 
             />
          </div>
        )}
      </div>

      {/* Team Sharing Modal */}
      {showShareModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: 'var(--bg-secondary)', width: '450px', borderRadius: '16px', border: '1px solid var(--border)', padding: '2rem', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>Team Access</h3>
              <button type="button" onClick={() => setShowShareModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>×</button>
            </div>

            <div style={{ marginBottom: '2rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Invite Member</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input 
                  placeholder="email@example.com" 
                  value={inviteEmail} 
                  onChange={e => setInviteEmail(e.target.value)}
                  style={{ flex: 1, padding: '0.6rem', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none' }} 
                />
                <select 
                  value={inviteRole} 
                  onChange={e => setInviteRole(e.target.value as any)}
                  style={{ padding: '0.6rem', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)' }}
                >
                  <option value="viewer">Viewer</option>
                  <option value="editor">Editor</option>
                </select>
                <button onClick={inviteMember} disabled={isSharing} className="btn btn-primary" style={{ padding: '0.6rem 1.2rem' }}>
                  <UserPlus size={16} />
                </button>
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '1rem', textTransform: 'uppercase' }}>Current Members</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '200px', overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--accent-primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 800 }}>M</div>
                    <div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>{session?.user?.email}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--accent-primary)', fontWeight: 600 }}>Owner</div>
                    </div>
                  </div>
                </div>
                
                {collaborators.map(c => (
                  <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem' }}>U</div>
                      <div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>{c.userEmail}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{c.role.charAt(0).toUpperCase() + c.role.slice(1)}</div>
                      </div>
                    </div>
                    <button type="button" onClick={() => removeMember(c.userEmail)} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', opacity: 0.6 }} title="Revoke access"><Trash2 size={16} /></button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── AI ASSIST PANEL ─────────────────────────────────────────────────────────
function AIAssistPanel({ code, errors, onInsert, onClose }: { code: string; errors: DiagnosticError[]; onInsert: (code: string) => void; onClose: () => void; }) {
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'fix' | 'generate' | 'explain'>('fix');

  const run = async () => {
    if (!prompt.trim() && mode !== 'fix') return;
    setLoading(true);
    setResponse('');
    try {
      const body = mode === 'fix' ? { mode: 'fix', code, errors } : mode === 'generate' ? { mode: 'generate', prompt, context: code.substring(0, 2000) } : { mode: 'explain', error: prompt || errors[0]?.message || '' };
      const res = await fetch('/api/latex-studio/ai-fix', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      setResponse(data.result || data.error || 'No response');
    } catch (err: any) {
      setResponse(err.message || 'Request failed. Check your connection.');
    } finally { setLoading(false); }
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '0.75rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>🤖 AI Assistant</span>
        <button type="button" onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', fontSize:'1rem', color:'var(--text-secondary)' }}>×</button>
      </div>
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
        {(['fix', 'generate', 'explain'] as const).map(m => (
          <button type="button" key={m} onClick={() => setMode(m)} style={{ flex: 1, padding: '0.4rem', fontSize: '0.65rem', fontWeight: 600, background: mode === m ? 'var(--bg-tertiary)' : 'transparent', border: 'none', cursor: 'pointer', color: mode === m ? 'var(--accent-primary)' : 'var(--text-secondary)', textTransform: 'uppercase' }}>{m}</button>
        ))}
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {mode === 'fix' && errors.length > 0 && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '0.6rem' }}>
            <p style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--error)', marginBottom: '0.3rem' }}>{errors.length} errors found</p>
          </div>
        )}
        {mode !== 'fix' && (
          <textarea value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="Describe what you need..." rows={4} style={{ width: '100%', padding: '0.5rem', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '0.75rem' }} />
        )}
        <button type="button" onClick={run} disabled={loading} className="btn btn-primary" style={{ fontSize: '0.8rem' }}>{loading ? 'Thinking...' : '⚡ Run AI'}</button>
        {response && (
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>RESPONSE</span>
              <button type="button" onClick={() => onInsert(response)} style={{ fontSize: '0.7rem', color: 'var(--accent-primary)', background: 'none', border: 'none', cursor: 'pointer' }}>Insert ↳</button>
            </div>
            <pre style={{ fontSize: '0.7rem', whiteSpace: 'pre-wrap', background: '#000', padding: '0.5rem', borderRadius: '4px', overflowY: 'auto', maxHeight: '300px' }}>{response}</pre>
          </div>
        )}
      </div>
    </div>
  );
}

// PDFViewer component removed as it is now integrated into PDFSyncViewer
