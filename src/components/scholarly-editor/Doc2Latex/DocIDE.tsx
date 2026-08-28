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
import { AiChatPanel } from '../AiChatPanel';

// Modular Components
import { DocSidebar } from './DocSidebar';
import { DocToolbar } from './DocToolbar';
import CreditLimitModal from './CreditLimitModal';
import EditorLoadingOverlay from '../EditorLoadingOverlay';

// UI Components
const MonacoEditor = dynamic(() => import('@monaco-editor/react').then(m => m.default), { ssr: false, loading: () => <div style={{ flex: 1, background: '#0a0a0a' }} /> });
const ScholarlyViewer = dynamic(() => import('../ScholarlyPDFViewer').then(m => m.default), { ssr: false, loading: () => <div style={{ height: '100%', background: '#050505' }} /> });

const RETRYABLE_HTTP_STATUS = new Set([408, 429, 502, 503, 504]);
const SYNC_FETCH_ATTEMPTS = 3;
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// Fetches the project payload from the cloud with a per-attempt timeout and
// retries, so transient failures (dev-server restarts, proxy 5xx, aborts)
// don't leave the editor uninitialized.
async function fetchProjectWithRetry(projectId: string): Promise<Response> {
  let lastError: any;
  for (let attempt = 1; attempt <= SYNC_FETCH_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);
    try {
      const res = await fetch(`/api/projects/${projectId}`, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) return res;
      lastError = new Error(`Cloud sync failed with status ${res.status}`);
      if (attempt < SYNC_FETCH_ATTEMPTS && RETRYABLE_HTTP_STATUS.has(res.status)) {
        console.warn(`[DocIDE] Sync attempt ${attempt}/${SYNC_FETCH_ATTEMPTS} failed with HTTP ${res.status} — retrying…`);
        await sleep(1000 * attempt);
        continue;
      }
      return res;
    } catch (err: any) {
      clearTimeout(timeoutId);
      const retryable = err?.name === 'AbortError' || err?.name === 'TypeError' || err?.name === 'TimeoutError';
      if (retryable && attempt < SYNC_FETCH_ATTEMPTS) {
        lastError = err;
        console.warn(`[DocIDE] Sync attempt ${attempt}/${SYNC_FETCH_ATTEMPTS} failed (${err?.name || 'network'}) — retrying…`);
        await sleep(1000 * attempt);
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}


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
  const [loadingCode, setLoadingCode] = useState(false);
  const [showAiChat, setShowAiChat] = useState(false);

  // -- Sync State --
  const [jumpTo, setJumpTo] = useState<{ percentage: number; timestamp: number } | null>(null);
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const isSelfChange = useRef<boolean>(false);
  const filesRef = useRef<StudioFile[]>([]);
  const currentPdfBlob = useRef<Blob | null>(null);
  const compileRef = useRef<(() => Promise<void>) | null>(null);
  const codeRef = useRef('');
  // Unsaved-edit tracking: set whenever the user types, cleared when the
  // buffer is persisted. Guards the staleness probe / syncFromCloud so a
  // background re-sync can NEVER overwrite the user's in-editor edits.
  const dirtyRef = useRef(false);
  const compilingRef = useRef(false);
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

  const initStartedRef = useRef<{ projectId: string; email: string } | null>(null);

  useEffect(() => {
    setMounted(true);
    document.body.classList.add('theme-purple');

    // Wait for an authenticated session. The effect re-runs when `status` /
    // email settle, so a slow session fetch (e.g. during a dev-server restart)
    // no longer leaves the editor permanently uninitialized.
    if (status !== 'authenticated') return;
    const currentSession = session;
    const userEmail = currentSession?.user?.email || 'guest';
    if (initStartedRef.current?.projectId === projectId && initStartedRef.current?.email === userEmail) return;
    initStartedRef.current = { projectId, email: userEmail };

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

    const hydrateAndHealFigures = async (studioFs: StudioFS, projId: string, initialFiles: StudioFile[]): Promise<StudioFile[]> => {
      try {
        const { getLocalDocument } = await import('@/lib/local-project-store');
        const localDoc = await getLocalDocument(projId);
        const localFigures = (localDoc?.envelope?.figures || []).filter((f: any) => f && f.name && (f.dataUrl || f.content));

        // 1. Write all local figures from client IndexedDB into StudioFS
        for (const fig of localFigures) {
          const rawName = String(fig.name).replace(/^\.\//, '');
          const dataUrl = fig.dataUrl || (typeof (fig as any).content === 'string' && (fig as any).content.startsWith('data:') ? (fig as any).content : '');
          if (dataUrl && dataUrl.length > 200) {
            const baseName = rawName.split('/').pop() || rawName;
            await studioFs.writeFile(projId, baseName, dataUrl);
            await studioFs.writeFile(projId, `assets/${baseName}`, dataUrl);
            await studioFs.writeFile(projId, `figures/${baseName}`, dataUrl);
            if (rawName !== baseName && !rawName.startsWith('assets/') && !rawName.startsWith('figures/')) {
              await studioFs.writeFile(projId, rawName, dataUrl);
            }
          }
        }

        let currentFiles = await studioFs.listFiles(projId);
        const existingPaths = new Set(currentFiles.map(f => f.path.toLowerCase()));

        // 2. Scan all .tex files for \includegraphics references and ensure each referenced image exists in StudioFS
        const incRe = /\\includegraphics(?:\[[^\]]*\])?\{([^}]+)\}/g;
        const texFiles = currentFiles.filter(f => f.path.endsWith('.tex') && typeof f.content === 'string');
        const referencedImages = new Set<string>();
        for (const f of texFiles) {
          let m: RegExpExecArray | null;
          while ((m = incRe.exec(f.content))) {
            const ref = (m[1] || '').trim().replace(/^.*\//, '');
            if (ref && !ref.includes('\\')) referencedImages.add(ref);
          }
        }

        let seqIdx = 0;
        for (const refName of referencedImages) {
          const lower = refName.toLowerCase();
          const hasAsset = existingPaths.has(lower) || existingPaths.has(`assets/${lower}`) || existingPaths.has(`figures/${lower}`);
          if (!hasAsset) {
            const matchedFig = localFigures.find((f: any) => 
              String(f.name).toLowerCase() === lower || 
              String(f.name).toLowerCase().endsWith(lower)
            ) || localFigures[seqIdx++] || localFigures[0];

            let dataUrl = matchedFig?.dataUrl || (matchedFig as any)?.content;
            if (!dataUrl || dataUrl.length < 200) {
              try {
                const res = await fetch(`/uploads/projects/${projId}/${refName}`);
                if (res.ok) {
                  const blob = await res.blob();
                  const reader = new FileReader();
                  const p = new Promise<string>((resP) => {
                    reader.onloadend = () => resP(reader.result as string);
                  });
                  reader.readAsDataURL(blob);
                  const fetchedUrl = await p;
                  if (fetchedUrl && fetchedUrl.startsWith('data:')) {
                    dataUrl = fetchedUrl;
                  }
                }
              } catch {}
            }
            if (!dataUrl || dataUrl.length < 200) {
              const ext = refName.split('.').pop() || 'png';
              dataUrl = `data:image/${ext === 'jpg' ? 'jpeg' : ext};base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=`;
            }
            await studioFs.writeFile(projId, refName, dataUrl);
            await studioFs.writeFile(projId, `assets/${refName}`, dataUrl);
            await studioFs.writeFile(projId, `figures/${refName}`, dataUrl);
            existingPaths.add(lower);
            existingPaths.add(`assets/${lower}`);
            existingPaths.add(`figures/${lower}`);
          }
        }

        // Clean up legacy aggregator float files from StudioFS so they don't clutter the IDE
        for (const legacyPath of ['assets/figure.tex', 'assets/table.tex', 'assets/algorithm.tex', 'assets/equation.tex']) {
          if (existingPaths.has(legacyPath.toLowerCase())) {
            await studioFs.deleteFile(projId, legacyPath);
          }
        }

        currentFiles = await studioFs.listFiles(projId);

        // 3. Self-heal: If image assets exist in StudioFS but no figures/figure_*.tex files exist,
        // create component float files so they are referenced and editable in the studio.
        const imageAssets = currentFiles.filter(f => /\.(png|jpg|jpeg|gif|webp|svg|eps)$/i.test(f.path) && f.path.startsWith('assets/'));
        const hasFigureTex = currentFiles.some(f => /^figures\/figure_\d+\.tex$/i.test(f.path));
        if (imageAssets.length > 0 && !hasFigureTex) {
          let figIdx = 1;
          for (const imgF of imageAssets) {
            const baseName = imgF.path.split('/').pop() || imgF.path;
            const figTexPath = `figures/figure_${figIdx}.tex`;
            const figCode = `\\begin{figure}[!htbp]\n\\centering\n\\includegraphics[width=0.9\\linewidth,max height=0.7\\textheight,keepaspectratio]{${baseName}}\n\\caption{Figure ${figIdx}}\n\\label{fig:${figIdx}}\n\\end{figure}\n`;
            await studioFs.writeFile(projId, figTexPath, figCode);
            figIdx++;
          }
          currentFiles = await studioFs.listFiles(projId);
        }

        return currentFiles;
      } catch (err) {
        console.warn('[DocIDE] hydrateAndHealFigures error:', err);
        return initialFiles;
      }
    };

    const syncFromCloud = async (studioFs: StudioFS) => {
      setIsSyncing(true);
      try {
        // Compile-wipe safety: NEVER clobber unsaved editor edits. If the user
        // has typed since the last save, the cloud snapshot is older than the
        // editor buffer — syncing would destroy their work.
        if (dirtyRef.current) {
          console.warn("[DocIDE] Cloud sync aborted: editor has unsaved changes.");
          return;
        }
        const res = await fetchProjectWithRetry(projectId);
        if (!res.ok) throw new Error(`Failed to sync from cloud (HTTP ${res.status})`);
        const data = await res.json();
        
        if (data.project) {
          setProject(data.project);

          // Local-first recovery (Phase 2): if the server response lacks the
          // AI snapshot (aiLatex/aiVerdict) — PocketBase content was trimmed
          // or lost — re-inject it from the localStorage copy stashed by the
          // upload page, so the in-memory project still carries the validated
          // component fragments for template re-application.
          try {
            const sc = (data.project as any)?.structuredContent;
            const parsedSc = sc ? (typeof sc === 'string' ? JSON.parse(sc) : sc) : null;
            const lacksAi = !parsedSc || !parsedSc.aiLatex;
            if (lacksAi) {
              const cachedRaw = localStorage.getItem(`ai_verdict_${projectId}`);
              if (cachedRaw) {
                const cached = JSON.parse(cachedRaw);
                if (cached?.aiLatex || cached?.aiVerdict) {
                  if (parsedSc && typeof parsedSc === 'object') {
                    if (cached.aiLatex) parsedSc.aiLatex = cached.aiLatex;
                    if (cached.aiVerdict) parsedSc.aiVerdict = cached.aiVerdict;
                    (data.project as any).structuredContent = JSON.stringify(parsedSc);
                  }
                  console.log(`[DocIDE] Restored AI snapshot from localStorage for project ${projectId}.`);
                }
              }
            }
          } catch (verdictErr) {
            console.warn('AI snapshot localStorage restore failed (non-critical):', verdictErr);
          }
          
          // Preserve valid local image assets before clearing old text files
          const preservedLocalImages = new Map<string, string>();
          try {
            const oldFiles = await studioFs.listFiles(projectId);
            for (const oldFile of oldFiles) {
              const ext = oldFile.path.split('.').pop()?.toLowerCase() || '';
              const isImg = ['png', 'jpg', 'jpeg', 'pdf', 'webp', 'gif', 'svg', 'eps', 'tiff', 'tif', 'bmp', 'heic', 'heif', 'avif'].includes(ext);
              if (isImg && oldFile.content && oldFile.content.length > 200 && !oldFile.content.includes('AAAAASUVORK5CYII=')) {
                preservedLocalImages.set(oldFile.path, oldFile.content);
                preservedLocalImages.set(oldFile.path.split('/').pop() || oldFile.path, oldFile.content);
              }
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
            // Parallel file hydration: text writes and binary asset fetches are
            // independent of each other, so serializing them wastes wall-clock
            // time on every sync (each binary asset costs a fetch + dataURL read).
            await Promise.all(data.project.files.map(async (file: any) => {
              const ext = file.filename.split('.').pop()?.toLowerCase();
              const isText = ['tex', 'bib', 'cls', 'sty', 'bst', 'txt', 'cfg', 'clo', 'def', 'ldf', 'tikz', 'lua'].includes(ext || '');
              const isBinary = ['image', 'png', 'jpg', 'jpeg', 'pdf', 'webp', 'gif', 'svg', 'eps', 'tiff', 'tif', 'bmp', 'heic', 'heif', 'avif'].includes(file.fileType) ||
                ['png', 'jpg', 'jpeg', 'pdf', 'webp', 'gif', 'svg', 'eps', 'tiff', 'tif', 'bmp', 'heic', 'heif', 'avif'].includes(ext || '');

              if (isText) {
                // Always use text content for LaTeX source/meta files
                if (file.filename !== 'main.tex') {
                  await studioFs.writeFile(projectId, file.filename, file.content || "");
                }
              } else if (isBinary) {
                let dataUrl = '';
                if (typeof file.content === 'string' && file.content.length > 100) {
                  if (file.content.startsWith('data:')) {
                    dataUrl = file.content;
                  } else if (!file.content.includes('\n')) {
                    const mime = ext === 'jpg' ? 'image/jpeg' : `image/${ext || 'png'}`;
                    dataUrl = `data:${mime};base64,${file.content}`;
                  }
                }

                // Check preserved local images
                if (!dataUrl || dataUrl.length < 200 || dataUrl.includes('AAAAASUVORK5CYII=')) {
                  const baseName = file.filename.split('/').pop() || file.filename;
                  if (preservedLocalImages.has(file.filename)) {
                    dataUrl = preservedLocalImages.get(file.filename)!;
                  } else if (preservedLocalImages.has(baseName)) {
                    dataUrl = preservedLocalImages.get(baseName)!;
                  }
                }

                // Fallback: fetch from server endpoint /uploads/projects/...
                if ((!dataUrl || dataUrl.length < 200) && file.filePath) {
                  try {
                    const assetRes = await fetch(file.filePath);
                    if (assetRes.ok) {
                      const blob = await assetRes.blob();
                      if (blob.size > 50) {
                        dataUrl = await new Promise<string>((resolve) => {
                          const reader = new FileReader();
                          reader.onloadend = () => resolve(reader.result as string);
                          reader.readAsDataURL(blob);
                        });
                      }
                    }
                  } catch (assetErr) {
                    console.warn(`Failed to fetch binary asset ${file.filename}:`, assetErr);
                  }
                }

                // Fallback: Recover pristine figure bytes from client-side IndexedDB store
                if (!dataUrl || dataUrl.length < 200) {
                  try {
                    const { getLocalDocument } = await import('@/lib/local-project-store');
                    const localDoc = await getLocalDocument(projectId);
                    const figPool = [
                      ...(Array.isArray(localDoc?.envelope?.figures) ? localDoc.envelope.figures : []),
                      ...(Array.isArray((localDoc as any)?.figures) ? (localDoc as any).figures : [])
                    ];
                    if (figPool.length > 0) {
                      const baseName = file.filename.split('/').pop() || file.filename;
                      const matchedFig = figPool.find((fig: any) => 
                        fig.name === file.filename || 
                        fig.name === baseName ||
                        (fig.name && file.filename.endsWith(fig.name))
                      );
                      if (matchedFig?.dataUrl && matchedFig.dataUrl.length > 200) {
                        dataUrl = matchedFig.dataUrl;
                      }
                    }
                  } catch {}
                }

                // Proactively heal server DB & disk with recovered binary image
                if (dataUrl && dataUrl.length > 200 && (!file.content || file.content.length < 200)) {
                  fetch(`/api/projects/${projectId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      file: {
                        filename: file.filename,
                        content: dataUrl,
                        fileType: 'image'
                      }
                    })
                  }).catch(() => {});
                }

                if (!dataUrl) {
                  dataUrl = `data:image/${ext === 'jpg' ? 'jpeg' : (ext || 'png')};base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=`;
                }
                await studioFs.writeFile(projectId, file.filename, dataUrl);
              }
            }));
          }
          
          let freshFiles = await studioFs.listFiles(projectId);
          freshFiles = await hydrateAndHealFigures(studioFs, projectId, freshFiles);

          setFiles(freshFiles);
          
          const active = freshFiles.find(f => f.path === 'main.tex') || freshFiles[0];
          if (active) {
            setActiveFile(active.path);
            setCode(isImage(active.path) ? active.content : formatLatexCode(active.content));
            setOpenTabs([active.path]);
          }
          
          // Pre-load the compiled PDF document safely as a blob URL to prevent
          // automatic downloads. NOT awaited: the workspace must become usable
          // immediately — the PDF viewer shows a loading state until the blob
          // arrives in the background.
          void loadPdfBlob(projectId);
          
          toast.success("Workspace synced from cloud");
          

        }
      } catch (err: any) {
        if (err?.name === 'AbortError') {
          console.warn("Cloud sync aborted: timed out after 60s — the request may still be completing server-side");
          toast.error("Sync timed out — please retry");
        } else {
          console.error("Cloud sync failed:", err);
          toast.error("Failed to sync workspace");
        }
        // Fall back to whatever is cached locally so the workspace is never
        // left blank after a transient network failure.
        try {
          const cachedFiles = await studioFs.listFiles(projectId);
          if (cachedFiles.length > 0) {
            setFiles(cachedFiles);
            const active = cachedFiles.find(f => f.path === 'main.tex') || cachedFiles[0];
            if (active) {
              setActiveFile(active.path);
              const fullActive = await studioFs.readFile(projectId, active.path);
              if (fullActive?.content) {
                setCode(isImage(active.path) ? fullActive.content : formatLatexCode(fullActive.content));
                setOpenTabs((prev) => (prev.includes(active.path) ? prev : [...prev, active.path]));
              }
            }
          }
        } catch (fallbackErr) {
          console.warn("Failed to fall back to cached local files:", fallbackErr);
        }
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
        
        // Self-heal: ensure all local client figures exist in StudioFS
        let currentFreshFiles = await hydrateAndHealFigures(studioFs, projectId, freshFiles);

        setFiles(currentFreshFiles);
        // Non-blocking: the editor must not wait on the PDF fetch.
        void loadPdfBlob(projectId);
        
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

              // Stale-cache guard: the local IndexedDB snapshot is displayed,
              // but the cloud copy may be NEWER (e.g. the manuscript was
              // re-uploaded from another device, or a server-side heal
              // regenerated it). Without this probe the stale local copy is
              // treated as truth and the auto-sync below clobbers the newer
              // server content — which is exactly how "missing sections"
              // became permanent. Probe `updatedAt` in the background and
              // re-sync only when the cloud copy is genuinely newer.
              //
              // SAFETY (compile-wipe fix): the probe NEVER re-syncs while the
              // user has unsaved edits or a compile is in flight — the
              // compile's own autosave PUT bumps the server updatedAt, and a
              // late probe response would otherwise wipe the user's edits via
              // syncFromCloud's setCode. The local baseline is also re-read at
              // response time, not the mount-time snapshot.
              void (async () => {
                try {
                  const probeRes = await fetchProjectWithRetry(projectId);
                  if (!probeRes.ok) return;
                  const probeData = await probeRes.json();
                  const cloudProject = probeData?.project;
                  if (!cloudProject) return;
                  if (dirtyRef.current || compilingRef.current) {
                    console.log("[DocIDE] Staleness probe skipped: user edits or compile in progress.");
                    return;
                  }
                  const freshLocal = await studioFs.getProject(projectId);
                  const cloudTime = new Date(cloudProject.updatedAt).getTime();
                  const localTime = (freshLocal?.updatedAt ?? localProj.updatedAt) || 0;
                  if (!Number.isNaN(cloudTime) && cloudTime > localTime + 5000 && !dirtyRef.current && !compilingRef.current) {
                    console.log(`[DocIDE] Cloud copy is newer than local cache (cloud=${cloudTime} local=${localTime}). Re-syncing from cloud.`);
                    await syncFromCloud(studioFs);
                  }
                } catch (probeErr) {
                  console.warn("[DocIDE] Staleness probe failed (non-critical):", probeErr);
                }
              })();
            }
          }
        }
      } else {
        await syncFromCloud(studioFs);
      }
    };
    init().catch(err => {
      console.error("Init failed:", err);
      setIsSyncing(false);
      setLoadingCode(false);
    });
   
  }, [projectId, status, session]);

  useEffect(() => {
    if (!autoEngine || !code || activeFile !== 'main.tex') return;
    const timer = setTimeout(() => {
      const best = detectBestEngine(code);
      setEngine(best);
    }, 500);
    return () => clearTimeout(timer);
  }, [code, autoEngine, activeFile]);

  useEffect(() => {
    if (mounted && project) {
      try {
        localStorage.setItem(`doc_engine_${projectId}`, engine);
        localStorage.setItem(`doc_auto_${projectId}`, autoEngine.toString());
        localStorage.setItem(`doc_mood_${projectId}`, editorMood);
      } catch {
        try {
          localStorage.removeItem(`doc_engine_${projectId}`);
          localStorage.removeItem(`doc_auto_${projectId}`);
          localStorage.removeItem(`doc_mood_${projectId}`);
          localStorage.setItem(`doc_engine_${projectId}`, engine);
          localStorage.setItem(`doc_auto_${projectId}`, autoEngine.toString());
          localStorage.setItem(`doc_mood_${projectId}`, editorMood);
        } catch { /* storage full, skip */ }
      }

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
          'scrollbarSlider.background': 'rgba(255,255,255,0.18)',
          'scrollbarSlider.hoverBackground': 'rgba(255,255,255,0.32)',
          'scrollbarSlider.activeBackground': 'rgba(255,255,255,0.40)',
          'scrollbarSlider.border': '1px solid rgba(255,255,255,0.05)',
        }
      });
      mon.editor.setTheme('scholarly-vibrant');
    }
  }, [editorMood]);

  // Restore editor content after browser tab switch — browsers may GC the Monaco model
  // when the tab is backgrounded. Detect blank editor and repopulate from codeRef.
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && editorRef.current) {
        const savedCode = codeRef.current;
        if (!savedCode) return;
        try {
          const model = editorRef.current.getModel();
          const currentValue = model ? model.getValue() : '';
          if (!currentValue && savedCode) {
            editorRef.current.setValue(savedCode);
          }
        } catch {}
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

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
  // Sync codeRef for compile callbacks
  useEffect(() => { codeRef.current = code; }, [code]);
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
  }, [errors, activeFile]);

  const projectStatus = (project as any)?.status;

  useEffect(() => {
    if (projectStatus !== 'processing') return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
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
      }).then(r => { if (!r.ok) console.error("Cloud rename failed:", r.status); });
      
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
    dirtyRef.current = false;
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
    dirtyRef.current = true;
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
    // CRITICAL (delete fix): never write the outgoing file back to the FS if it
    // no longer exists there. deleteFile() deletes the file and THEN calls
    // switchTab() — the unconditional writeFile below re-created the deleted
    // file in IndexedDB with its old content, so the very next compile sent it
    // to the server and the "deleted" file kept rendering in the PDF.
    if (fs && !isImage(activeFile) && !isOutOfCredits) {
      const stillExists = await fs.readFile(projectId, activeFile);
      if (stillExists) await fs.writeFile(projectId, activeFile, code);
    }
    setLoadingCode(true);
    setActiveFile(path);
    if (!openTabs.includes(path)) setOpenTabs(t => [...t, path]);
    const file = files.find(f => f.path === path);
    if (file) {
      let newContent = isImage(path) ? file.content : formatLatexCode(file.content);
      
      // If it's an image and content is empty or short placeholder, resolve from upload URL
      if (isImage(path) && (!newContent || newContent.length < 200)) {
        try {
          const cleanName = path.replace(/^assets\//, '');
          const candidateUrl = `/uploads/projects/${projectId}/${cleanName}`;
          const res = await fetch(candidateUrl);
          if (res.ok) {
            const blob = await res.blob();
            const reader = new FileReader();
            const dataUrlPromise = new Promise<string>((resolve) => {
              reader.onloadend = () => resolve(reader.result as string);
            });
            reader.readAsDataURL(blob);
            const resolvedDataUrl = await dataUrlPromise;
            if (resolvedDataUrl && resolvedDataUrl.startsWith('data:')) {
              newContent = resolvedDataUrl;
              file.content = resolvedDataUrl;
              if (fs) await fs.writeFile(projectId, path, resolvedDataUrl);
            }
          }
        } catch (fetchErr) {
          console.warn("[DocIDE] Could not resolve image fallback URL:", fetchErr);
        }
      }

      setCode(newContent);
      if (editorRef.current && !isImage(path)) {
        try {
          editorRef.current.setValue(newContent);
        } catch (e) {}
      }
      setLoadingCode(false);
    } else {
      setLoadingCode(false);
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

    // Strip \input{}/\include{} references from main.tex BEFORE deleting the file,
    // so the compiler doesn't try to recover the deleted file during the next build.
    try {
      const mainFileObj = await fs.readFile(projectId, 'main.tex');
      if (mainFileObj?.content) {
        const basename = path.replace(/\.tex$/i, '').replace(/^.*\//, '');
        const patterns = [
          new RegExp(`\\\\input\\s*\\{\\s*(?:\\.?\\/)?${basename}(?:\\.tex)?\\s*\\}\\s*\\n?`, 'gi'),
          new RegExp(`\\\\include\\s*\\{\\s*(?:\\.?\\/)?${basename}(?:\\.tex)?\\s*\\}\\s*\\n?`, 'gi'),
        ];
        let cleaned: string = mainFileObj.content;
        for (const pat of patterns) cleaned = cleaned.replace(pat, '');
        if (cleaned !== mainFileObj.content) {
          await fs.writeFile(projectId, 'main.tex', cleaned);
          setFiles(prev => prev.map(f => f.path === 'main.tex' ? { ...f, content: cleaned } : f));
        }
      }
    } catch (cleanupErr) {
      console.warn('[DELETE] Failed to clean \\input{} references from main.tex:', cleanupErr);
    }

    await fs.deleteFile(projectId, path);
    setFiles(prev => prev.filter(f => f.path !== path));
    const remainingTabs = openTabs.filter(x => x !== path);
    setOpenTabs(remainingTabs);
    if (activeFile === path) {
      const remainingFiles = files.filter(f => f.path !== path);
      const fallbackTab = remainingTabs[0] || remainingFiles[0]?.path || '';
      if (fallbackTab) switchTab(fallbackTab);
      else setCode('');
    }
    // PROPAGATE THE DELETE TO THE CLOUD: without this, the stale ProjectFile
    // row + disk copy are resurrected by hardenedDiscovery on the next compile
    // and the deleted file keeps appearing in the PDF.
    try {
      const delRes = await fetch(`/api/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deleteFiles: [path] })
      });
      if (!delRes.ok) console.error("Delete propagation failed:", delRes.status);
    } catch (delErr) {
      console.error("Delete propagation error:", delErr);
    }
  };

  const renameFile = async (oldPath: string) => {
    if (isOutOfCredits) {
      toast.error("Read-Only Mode: Daily credit limit reached. Please upgrade to Premium to rename files.");
      return;
    }
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
      try { localStorage.setItem(`doc_sidebar_${projectId}`, sidebarWidth.toString()); } catch {}
      updatePanels({ [`doc_sidebar_${projectId}`]: sidebarWidth });
    }
    if (isResizingPdf) {
      try { localStorage.setItem(`doc_pdf_${projectId}`, pdfWidth.toString()); } catch {}
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
    compilingRef.current = true;
    setCompiling(true);
    setCompileLog(`> Compilation Started: ${rootFile}\n`);
    setErrors([]);
    let autoSyncFailed = false;

    try {
      // RACE FIX: read directly from Monaco editor — codeRef.current is synced
      // via async useEffect and can be stale if user types then clicks BUILD
      // in the same microtask. Monaco always holds the authoritative buffer.
      const liveContent = editorRef.current?.getValue() ?? codeRef.current ?? '';
      await fs.writeFile(projectId, activeFile, liveContent);
      // The editor buffer is now persisted — safe for background syncs.
      dirtyRef.current = false;
      const payloadMeta = await fs.listFiles(projectId);
      
      // AUTO-SYNC TO PERSISTENT STORE BEFORE COMPILING
      // NOTE: intentionally does NOT use the isSyncing state anymore — that
      // flag drives the full-screen "LOADING LATEX MANUSCRIPT" overlay, which
      // made every BUILD click look like the editor was reloading/rehydrating
      // (and masked the probe's setCode wipe). The compile progress is shown
      // by the `compiling` state (BUILDING… button, sidebar spinner).
      try {
        const textMetas = payloadMeta.filter((meta) => {
          const ext = meta.path.split('.').pop()?.toLowerCase() || '';
          return ['tex', 'bib', 'cls', 'sty', 'bst', 'txt'].includes(ext);
        });
        const textFiles = (await Promise.all(
          textMetas.map(async (meta) => {
            const f = await fs.readFile(projectId, meta.path);
            return f ? { filename: f.path, content: f.content } : null;
          })
        )).filter((f): f is { filename: string; content: string } => f !== null);
        // CRITICAL: send the ACTUAL root file content as latexContent — never
        // the active editor buffer. When main.tex was deleted, sending `code`
        // here would overwrite Project.latexContent with an arbitrary fragment
        // (no \documentclass) and corrupt every future compile.
        const mainContent = textFiles.find(f => f.filename === rootFile)?.content ?? '';
        try {
          // Await the autosave so compile always runs on the just-saved source,
          // and surface the failure (Phase 5) instead of logging silently.
          const syncRes = await fetch(`/api/projects/${projectId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              latexContent: mainContent,
              files: textFiles
            })
          });
          if (!syncRes.ok) {
            autoSyncFailed = true;
            console.error("Auto-sync PUT failed:", syncRes.status);
          }
        } catch (syncPutErr) {
          autoSyncFailed = true;
          console.error("Auto-sync to cloud failed before compilation:", syncPutErr);
        }
      } catch (syncErr) {
        console.error("Auto-sync to cloud failed before compilation:", syncErr);
      }
      
      const formData = new FormData();
      formData.append('engine', engine);
      formData.append('mainFile', rootFile);
      if (projectId) formData.append('projectId', projectId);

      const payloadFiles = (await Promise.all(
        payloadMeta.map(async (fMeta) => {
          const f = await fs.readFile(projectId, fMeta.path);
          return f || null;
        })
      )).filter((f): f is StudioFile => f !== null);

      // ROBUST FIGURE RECOVERY (doc2latex):
      // The structured-content parser (DeepDocumentParser) stamps figure ids as
      // `pdf_fig_<lineNumber>.png` (the SOURCE LINE index, not a sequential
      // figure index) and charts as `chart_pending_<N>.png`, while the real
      // binaries uploaded from the client are named `rf_fig_<seq>.png` /
      // `rf_chart_<seq>.png`. The two naming schemes never align, so LaTeX
      // renders empty placeholder boxes. Here we re-attach the pristine figure
      // bytes (from the client's IndexedDB envelope.figures, the only place they
      // are guaranteed to exist) by injecting each one under the EXACT reference
      // name used by \includegraphics — matched by sequential document order
      // within its family (figure vs chart). The reference name is irrelevant;
      // what matters is that a real image file exists at that path at compile
      // time.
      try {
        const { getLocalDocument } = await import('@/lib/local-project-store');
        const localDoc = await getLocalDocument(projectId);
        const figs = localDoc?.envelope?.figures;
        if (Array.isArray(figs) && figs.length > 0) {
          const byLower = new Map<string, any>();
          payloadFiles.forEach((f: any) => byLower.set((f.path || '').toLowerCase(), f));
          // Envelope figures split into families by the SAME convention the
          // server uses for the uploaded binaries (rf_fig_* / rf_chart_*).
          const envFigs = (figs as any[]).filter(f => /^rf_fig_/i.test(f.name || ''));
          const envCharts = (figs as any[]).filter(f => /^(rf_chart_|chart_pending_)/i.test(f.name || ''));
          // Also index by exact name so a correctly-named reference (rf_fig_9)
          // resolves to ITS OWN bytes rather than the sequential slot.
          const byName = new Map<string, any>();
          for (const f of figs) byName.set((f.name || '').toLowerCase(), f);
          const numIn = (s: string) => parseInt((s.match(/(\d+)/) || ['', '0'])[1]) || 0;
          const isChartRef = (r: string) => /chart_pending|rf_chart/i.test(r) || /chart/i.test(r);
          const hasRealBytes = (c: any) => typeof c === 'string' && c.length > 200;
          // Float files in numeric order follow document order of figures.
          const floatKeys = payloadFiles
            .filter(f => /^(figures\/figure_\d+\.tex|figures\/figure_group_\d+\.tex)$/i.test(f.path || ''))
            .map(f => f.path)
            .sort((a: string, b: string) => numIn(a) - numIn(b));
          const refFiles = [
            ...floatKeys,
            ...payloadFiles.filter(f => !floatKeys.includes(f.path) && /\.tex$/i.test(f.path || '')).map(f => f.path)
          ];
          let fi = 0, ci = 0;
          const incRe = /\\includegraphics(?:\[[^\]]*\])?\{([^}]+)\}/g;
          for (const p of refFiles) {
            const f = payloadFiles.find((x: any) => x.path === p);
            if (!f) continue;
            const content = typeof f.content === 'string' ? f.content : '';
            let m: RegExpExecArray | null;
            while ((m = incRe.exec(content))) {
              const ref = (m[1] || '').trim().replace(/^.*\//, '');
              if (!ref) continue;
              const lower = ref.toLowerCase();
              const existing = byLower.get(lower);
              if (existing && hasRealBytes(existing.content)) continue; // already has real bytes
              // 1) Direct name match (e.g. reference already says rf_fig_9.png).
              let fig = byName.get(lower);
              let useSeq = false;
              // 2) Otherwise map sequentially within the family (pdf_fig_42 ->
              //    the Nth rf_fig binary in document order).
              if (!fig) {
                const isChart = isChartRef(ref);
                const useChartPool = isChart && envCharts.length > 0;
                const pool = useChartPool ? envCharts : envFigs;
                const idx = useChartPool ? ci : fi;
                fig = pool[idx];
                useSeq = true;
                if (fig) { if (useChartPool) ci++; else fi++; }
              }
              if (!fig || !fig.dataUrl || fig.dataUrl.length <= 200) {
                if (!existing) {
                  const ext = ref.split('.').pop() || 'png';
                  const fallbackB64 = `data:image/${ext === 'jpg' ? 'jpeg' : ext};base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=`;
                  const injected: any = { path: ref, content: fallbackB64 };
                  payloadFiles.push(injected);
                  byLower.set(lower, injected);
                }
                continue;
              }
              if (existing) {
                existing.content = fig.dataUrl;
                console.log(`[DocIDE] Upgraded placeholder ${ref} with real figure bytes.`);
              } else {
                const injected: any = { path: ref, content: fig.dataUrl };
                payloadFiles.push(injected);
                byLower.set(lower, injected);
                console.log(`[DocIDE] Injected missing figure binary ${ref} (${useSeq ? 'seq ' : 'named '}${isChartRef(ref) ? 'chart' : 'figure'}) from IndexedDB envelope.`);
              }
            }
          }
        }
      } catch (figErr) {
        console.warn('[DocIDE] Figure recovery skipped:', figErr);
      }

      for (let i = 0; i < payloadFiles.length; i++) {
        const f = payloadFiles[i];
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

      let result;
      const text = await response.text();
      try {
        result = JSON.parse(text);
      } catch {
        result = { success: false, error: text || 'Compilation server error' };
      }
      
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

      // Phase 5: surface degraded compiles — auto-generated package/class
      // stubs, ghost-inking failures, strategy warnings, cloud autosave
      // failures — instead of letting a degraded PDF look like a clean build.
      const surfacedWarnings: string[] = [];
      if (Array.isArray(result.warnings)) surfacedWarnings.push(...result.warnings);
      if (result.warning) surfacedWarnings.push(result.warning);
      if (autoSyncFailed) surfacedWarnings.push('Cloud autosave failed — recent changes may not be persisted.');
      if (surfacedWarnings.length > 0) {
        const unique = [...new Set(surfacedWarnings)];
        setCompileLog(prev => prev + '> WARNINGS: ' + unique.join(' | ') + '\n');
        toast.error(unique[0], { icon: '⚠️' });
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
      compilingRef.current = false;
      setCompiling(false);
    }
  }, [fs, compiling, projectId, activeFile, code, engine, project, isSyncing]);

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
  }, [fs, project, compiling, isSyncing, projectId, compile]);

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
            try { localStorage.setItem(`doc_auto_${projectId}`, 'false'); } catch {}
          }}
          autoEngine={autoEngine}
          setAutoEngine={(val: boolean) => {
            setAutoEngine(val);
            try { localStorage.setItem(`doc_auto_${projectId}`, val.toString()); } catch {}
          }}
          compile={compile}
          compiling={compiling}
          projectId={projectId}
          isReadOnly={isOutOfCredits}
          onShare={shareProject}
          showAiChat={showAiChat}
          onToggleAiChat={() => setShowAiChat(prev => !prev)}
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
              renameFile={renameFile}
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
                 style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: 'var(--bg-secondary)', borderRadius: '16px', border: '1px solid var(--border)', overflow: 'hidden', boxShadow: '0 8px 30px rgba(0,0,0,0.15)' }}
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
                     msOverflowStyle: 'none',
                     borderTopLeftRadius: '15px',
                     borderTopRightRadius: '15px',
                     isolation: 'isolate'
                   }}>
                      {openTabs.map(t => (
                        <div key={t} onClick={() => switchTab(t)} className="group" style={{ 
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
                           {openTabs.length > 1 && (
                             <X 
                               size={10} 
                               strokeWidth={2.5} 
                               onClick={(e) => handleCloseTab(e, t)} 
                               style={{ flexShrink: 0, color: 'inherit', cursor: 'pointer' }} 
                               className="opacity-0 group-hover:opacity-100 hover:!text-red-500 transition-opacity transition-colors"
                             />
                           )}
                        </div>
                      ))}
                  </div>

                  <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: showAiChat ? 'row' : 'column', minWidth: 0, background: EDITOR_MOODS[editorMood].bg }}>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    <EditorLoadingOverlay
                      visible={isSyncing}
                      label="LOADING LATEX MANUSCRIPT"
                      sublabel="Synchronizing source files and asset directories..."
                    />

                    {isImage(activeFile) ? (
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-secondary)', padding: '2rem' }}>
                          <div style={{ position: 'relative', maxWidth: '100%', maxHeight: '100%', boxShadow: '0 0 50px rgba(0,0,0,0.5)', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            {(() => {
                              const ext = activeFile.split('.').pop()?.toLowerCase() || '';
                              const isRenderable = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'avif', 'bmp'].includes(ext);
                              if (isRenderable) {
                                const cleanBase = activeFile.replace(/^(assets|figures)\//, '');
                                const fallbackUrl = `/uploads/projects/${projectId}/${cleanBase}`;
                                const hasDataUrl = code && typeof code === 'string' && code.startsWith('data:image/') && code.length > 200 && !code.includes('AAAAASUVORK5CYII=');
                                const imageSrc = hasDataUrl ? code : fallbackUrl;
                                return (
                                  <img 
                                    src={imageSrc} 
                                    alt={activeFile} 
                                    onError={(e) => {
                                      const target = e.currentTarget;
                                      if (target.src !== fallbackUrl) {
                                        target.src = fallbackUrl;
                                      } else if (!target.src.includes(`assets/${cleanBase}`)) {
                                        target.src = `/uploads/projects/${projectId}/assets/${cleanBase}`;
                                      }
                                    }}
                                    style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain', display: 'block', borderRadius: '4px' }} 
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
                        <MonacoEditor 
                           key={activeFile}
                           path={activeFile}
                           height="100%" 
                           theme="vs-dark" 
                           language={activeFile.endsWith('.bib') ? 'bibtex' : 'latex'} 
                           value={code} 
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
                              readOnly: isOutOfCredits,
                              autoClosingBrackets: 'languageDefined',
                              quickSuggestions: { other: true, comments: false, strings: false },
                           }}
                         />
                      </div>
                    )}
                  </div>
                  <AiChatPanel
                    isOpen={showAiChat}
                    onClose={() => setShowAiChat(false)}
                    projectId={projectId}
                    storageKey={`doc2latex_chat_${projectId}`}
                    apiEndpoint="/api/doc2latex/chat"
                    buildContext={() => ({
                      activeFile,
                      fileContent: code,
                      allFiles: files.map(f => ({ path: f.path, content: f.path === activeFile ? codeRef.current : f.content })),
                    })}
                    onApplyEdits={async (edits) => {
                      let currentCode = code;
                      let codeChanged = false;
                      for (const edit of edits) {
                        const filePath = edit.path;
                        if (filePath === activeFile) {
                          let newContent = currentCode;
                          if (edit.type === 'write') newContent = edit.content || '';
                          else if (edit.type === 'replace') {
                            newContent = edit.target ? currentCode.replace(edit.target, edit.content || '') : (edit.content || '');
                          } else if (edit.type === 'delete') {
                            newContent = edit.target ? currentCode.replace(edit.target, '') : currentCode;
                          } else if (edit.type === 'insert') {
                            if (edit.target) {
                              const idx = currentCode.indexOf(edit.target);
                              newContent = idx !== -1 ? currentCode.substring(0, idx) + (edit.content || '') + currentCode.substring(idx) : currentCode + '\n' + (edit.content || '');
                            } else {
                              newContent = currentCode + '\n' + (edit.content || '');
                            }
                          }
                          if (newContent !== currentCode) { currentCode = newContent; codeChanged = true; }
                        } else if (fs) {
                          const fileObj = files.find(f => f.path === filePath);
                          const otherContent = fileObj?.content || '';
                          let newContent = otherContent;
                          if (edit.type === 'write') newContent = edit.content || '';
                          else if (edit.type === 'replace') newContent = edit.target ? otherContent.replace(edit.target, edit.content || '') : (edit.content || '');
                          else if (edit.type === 'delete') newContent = edit.target ? otherContent.replace(edit.target, '') : otherContent;
                          else if (edit.type === 'insert') {
                            if (edit.target) {
                              const idx = otherContent.indexOf(edit.target);
                              newContent = idx !== -1 ? otherContent.substring(0, idx) + (edit.content || '') + otherContent.substring(idx) : otherContent + '\n' + (edit.content || '');
                            } else {
                              newContent = otherContent + '\n' + (edit.content || '');
                            }
                          }
                          if (newContent !== otherContent) await fs.writeFile(projectId, filePath, newContent);
                        }
                      }
                      if (codeChanged) {
                        setCode(currentCode);
                        if (fs && projectId) await fs.writeFile(projectId, activeFile, currentCode);
                      }
                      if (fs && projectId) setFiles(await fs.listFiles(projectId));
                      toast.success("AI Agent edits applied to workspace!", { icon: '🤖' });
                      setTimeout(() => compileRef.current?.(), 100);
                    }}
                    afterApply={() => {
                      if (compileRef.current) setTimeout(() => compileRef.current?.(), 100);
                    }}
                  />
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
