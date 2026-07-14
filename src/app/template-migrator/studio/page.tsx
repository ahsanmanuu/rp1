"use client";
import '../../app-shared.css';
import React, { useState, useRef, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import { 
  Cloud, 
  RefreshCw, 
  FileText, 
  Check, 
  ArrowRight, 
  ChevronRight, 
  Upload, 
  Zap, 
  Download, 
  Printer, 
  Maximize2, 
  Minimize2,
  FileBox,
  Trash2,
  AlertTriangle,
  Info,
  FileCheck2,
  Plus
} from 'lucide-react';
import { StudioFS } from '@/lib/studio-fs';
import { TEMPLATE_REGISTRY } from '@/lib/templates/registry';
import { migrateToTemplate } from '@/lib/migration-engine';
import { useSession } from "@/lib/pb-auth-react";
import toast from 'react-hot-toast';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import ProjectLimitModal from '@/components/ProjectLimitModal';
import { useProjectLimit } from '@/hooks/useProjectLimit';

// Dynamic import for Monaco to avoid SSR issues
const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

type MigrationStep = 'intake' | 'selection' | 'migrating' | 'editor';

export default function TemplateMigratorPage() {
  const { data: session } = useSession();
  const [step, setStep] = useState<MigrationStep>('intake');
  const [zipFile, setZipFile] = useState<File | null>(null);
  const { showLimitModal, setShowLimitModal } = useProjectLimit();
  // Migration State
  const [migratedContent] = useState<any>(null);
  const [activeFile, setActiveFile] = useState('main.tex');
  const [fileContents, setFileContents] = useState<Record<string, string | Uint8Array>>({});
  
  // Custom Templates State
  const [customTemplates, setCustomTemplates] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/templates', { cache: 'no-store' })
      .then(res => res.json())
      .then(data => setCustomTemplates(data.templates || []))
      .catch(console.error);
  }, []);

  const allTemplates = [
    ...TEMPLATE_REGISTRY,
    ...customTemplates.map(t => ({
      id: t.id,
      label: t.name,
      icon: '✨',
      category: 'Custom',
      desc: 'User uploaded custom template',
      publisher: 'Custom',
      isCustom: true
    }))
  ];
  
  // Editor & Preview State
  const [compiling, setCompiling] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfScale, setPdfScale] = useState(1.0);
  const [isTerminalOpen, setIsTerminalOpen] = useState(true);
  const [terminalLogs, setTerminalLogs] = useState<{ type: 'info' | 'error' | 'success' | 'warning', msg: string }[]>([]);
  const [isUploadingTemplate, setIsUploadingTemplate] = useState(false);
  const [engine, setEngine] = useState<'pdflatex' | 'xelatex' | 'lualatex'>('pdflatex');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const templateInputRef = useRef<HTMLInputElement>(null);
  const assetInputRef = useRef<HTMLInputElement>(null);
  const terminalRef = useRef<HTMLDivElement>(null);
  const previousPdfUrl = useRef<string | null>(null);

  // Robust Lifecycle Management for Blob URLs
  useEffect(() => {
    return () => {
      if (previousPdfUrl.current) URL.revokeObjectURL(previousPdfUrl.current);
    };
  }, []);

  const base64ToBlob = (base64: string) => {
    try {
      const parts = base64.split(',');
      const actualBase64 = (parts.length > 1 ? parts[1] : parts[0]).replace(/\s/g, '');
      const binStr = atob(actualBase64);
      const len = binStr.length;
      const arr = new Uint8Array(len);
      for (let i = 0; i < len; i++) arr[i] = binStr.charCodeAt(i);
      return new Blob([arr], { type: 'application/pdf' });
    } catch (e) {
      console.error("[MIGRATOR] Base64 conversion failed:", e);
      return null;
    }
  };

  // Intelligent Engine Detection
  const detectBestEngine = (files: Record<string, string | Uint8Array>) => {
    const paths = Object.keys(files);
    const hasFonts = paths.some(p => p.toLowerCase().endsWith('.otf') || p.toLowerCase().endsWith('.ttf'));
    
    let hasFontSpec = false;
    const hasLua = paths.some(p => p.toLowerCase().endsWith('.lua'));
    
    Object.entries(files).forEach(([path, content]) => {
      if (typeof content === 'string' && (path.endsWith('.tex') || path.endsWith('.cls'))) {
        if (content.includes('fontspec') || content.includes('polyglossia')) hasFontSpec = true;
      }
    });

    if (hasLua) return 'lualatex';
    if (hasFonts || hasFontSpec) return 'xelatex';
    return 'pdflatex';
  };
  



  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [terminalLogs]);

  const addLog = (type: 'info' | 'error' | 'success' | 'warning', msg: string) => {
    setTerminalLogs(prev => [...prev, { type, msg }]);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.name.endsWith('.zip')) {
      setZipFile(file);
      setStep('selection');
    } else {
      toast.error('Please upload a valid .zip archive');
    }
  };

  const router = useRouter();
  
  const startMigration = async (templateId: string) => {
    if (!zipFile) return;
    setStep('migrating');

    try {
      const buffer = await zipFile.arrayBuffer();
      // Get template boilerplate
      const templateRes = await fetch(`/api/templates/${templateId}`);
      if (!templateRes.ok) throw new Error(`Template Fetch Failed: ${templateRes.statusText}`);
      
      const templateData = await templateRes.json();
      if (!templateData || !templateData.content) throw new Error("Invalid Template Data: Missing content.");

      // Harmonize Assets: Convert assetsJson map to assets array if present
      if (templateData.assetsJson) {
        try {
          const amap = JSON.parse(templateData.assetsJson);
          if (!templateData.assets) templateData.assets = [];
          Object.entries(amap).forEach(([path, content]) => {
             // Only add if not already in assets (to prevent duplicates if the API returned both)
             if (!templateData.assets.some((a: any) => a.path === path)) {
               templateData.assets.push({ path, content });
             }
          });
        } catch (e) {
          console.error("[MIGRATOR] Failed to parse assetsJson:", e);
        }
      }
      
      // Nuclear 30.0: Full Asset Migration
      const result = await migrateToTemplate(buffer, templateData, templateId);
      
      // Auto-detect engine
      const detected = detectBestEngine(Object.fromEntries(result.files.map(f => [f.path, f.content])));

      // 1. Create a persistent project in the database
      const createRes = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `Migrated: ${zipFile.name.replace('.zip', '')}`,
          projectType: 'TEMPLATE_MIGRATOR',
          templateName: templateId,
          engine: detected
        })
      });
      const createData = await createRes.json();
      if (!createRes.ok) {
        if (createData.error === 'LIMIT_REACHED') {
          setShowLimitModal(true);
          setStep('selection');
          return;
        }
        throw new Error(createData.error || "Failed to create project");
      }
      const newProjectId = createData.project.id;

      // 2. Initialize the local StudioFS and sync the files
      const userEmail = session?.user?.email || 'guest';
      const fsLocal = new StudioFS(userEmail);
      
      const projectName = `Migrated: ${zipFile.name.replace('.zip', '')}`;
      
      // Intelligent Root File Discovery: Target the merged manuscript
      const detectedMain = result.mainFile || 'Migrated_Manuscript.tex';

      await fsLocal.injectProject(newProjectId, projectName, templateId, detectedMain);
      
      for (const file of result.files) {
        let content: string;
        if (file.content instanceof Uint8Array) {
           content = await new Promise(r => {
             const reader = new FileReader();
             reader.onloadend = () => r(reader.result as string);
             reader.readAsDataURL(new Blob([file.content as any]));
           });
        } else {
           content = file.content;
        }
        await fsLocal.writeFile(newProjectId, file.path, content);
      }

      toast.success('Migration successful! Launching Studio...');
      
      // 3. Redirect to the specialized Migrator Studio
      router.push(`/template-migrator/${newProjectId}`);
    } catch (err) {
      console.error(err);
      toast.error('Migration failed. Check ZIP structure.');
      setStep('intake');
    }
  };

  const handleCustomTemplateUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || isUploadingTemplate) return;

    const name = prompt("Enter a name for this Custom Template:", file.name.replace(/\.[^/.]+$/, ""));
    if (!name) return;

    setIsUploadingTemplate(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('name', name);

    try {
      const res = await fetch('/api/templates', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Custom Template Added Successfully");
        const freshRes = await fetch('/api/templates', { cache: 'no-store' });
        const freshData = await freshRes.json();
        setCustomTemplates(freshData.templates || []);
      } else {
        toast.error(data.error || "Failed to upload template");
      }
    } catch {
      toast.error("Network error during template upload");
    } finally {
      setIsUploadingTemplate(false);
      if (templateInputRef.current) templateInputRef.current.value = '';
    }
  };

  const handleCompile = async () => {
    if (!migratedContent) return;
    setCompiling(true);
    setPdfUrl(null); // FORCE RESET: Prevents iframe stale memory errors
    addLog('info', 'System: Starting scholarly migration & optimization pipeline...');
    setIsTerminalOpen(true);
    
    const toBase64 = (u8: Uint8Array) => {
      let b = '';
      for (let i = 0; i < u8.length; i++) b += String.fromCharCode(u8[i]);
      return window.btoa(b);
    };
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000);

    try {
      addLog('info', 'System: Stabilizing Pipeline - 120s Extended Window Active.');
      addLog('info', 'System: Pre-processing local assets and normalizing references...');
      addLog('info', 'Network: Dispatching resources to high-availability TeX cluster.');
      
      const res = await fetch('/api/latex-studio/compile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          engine: engine,
          mainFile: activeFile,
          files: Object.entries(fileContents).map(([path, content]) => {
            // Nuclear 19.0: Payload Integrity - Send ALL real data, no placeholders
            return {
              path,
              content: typeof content === 'string' ? content : `data:application/octet-stream;base64,${toBase64(content)}`
            };
          })
        }),
        signal: controller.signal
      });

      const data = await res.json();
      clearTimeout(timeoutId);

      const isRescue = data.log?.includes('RESCUE_PDF');

      if (data.log) {
        addLog('info', isRescue ? 'System: Recovered via Manuscript Rescue Mode.' : 'TeX: Compilation log received.');
        const lines = data.log.split('\n');
        lines.slice(-30).forEach((l: string) => {
          if (l.trim()) addLog('info', `> ${l}`);
        });
      }

      if (!data.success && !isRescue) {
        if (data.errors) {
          data.errors.forEach((err: any) => {
            addLog('error', `LaTeX Error (Line ${err.line}): ${err.message}`);
          });
        }
        // Instead of throwing a generic error, we present the failure in the console
        addLog('error', 'Critical: All compilation strategies exhausted. Review logs for syntax errors.');
        toast.error('Compilation Failed');
        setCompiling(false);
        return;
      }
      
      if (data.pdfBase64) {
        const blob = base64ToBlob(data.pdfBase64);
        if (blob) {
          const newUrl = URL.createObjectURL(blob);
          
          // Rolling Revocation: 3s delay for high-payload manuscripts
          if (previousPdfUrl.current) {
            const old = previousPdfUrl.current;
            setTimeout(() => URL.revokeObjectURL(old), 3000);
          }
          
          previousPdfUrl.current = newUrl;
          setPdfUrl(newUrl);
        }

        if (isRescue) {
          addLog('warning', 'Notice: Strategy 5 (Rescue) used. Custom templates/styles were bypassed for stability.');
          toast('PDF Recovered (Safe Mode)', { icon: '⚠️' });
        } else {
          addLog('success', 'System: PDF reconstructed successfully from cluster stream.');
          toast.success('PDF Compiled Successfully');
        }
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      console.error(err);
      if (err.name === 'AbortError') {
        addLog('error', 'Critical: Compilation timed out (120s limit). Project may be too complex or clusters are busy.');
        toast.error('Compilation Timeout');
      } else {
        addLog('error', 'Critical: TeX engine reported fatal errors.');
        toast.error('Compilation Error');
      }
    } finally {
      setCompiling(false);
    }
  };

  const downloadZip = async () => {
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    Object.entries(fileContents).forEach(([path, content]) => {
      zip.file(path, content);
    });
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `migrated_${zipFile?.name || 'project.zip'}`;
    a.click();
  };
  
  const handleAssetUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const path = `MIGRATION FILES/${file.name}`;
    
    // Support Binary (Images/PDF)
    if (file.type.startsWith('image/') || file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
      const buffer = await file.arrayBuffer();
      setFileContents(prev => ({ ...prev, [path]: new Uint8Array(buffer) }));
      toast.success(`Asset uploaded: ${file.name}`);
    } else {
      // Support Text (.tex, .bib, .sty, etc.)
      const text = await file.text();
      setFileContents(prev => ({ ...prev, [path]: text }));
      toast.success(`File uploaded: ${file.name}`);
    }
    setActiveFile(path);
  };

  const handleDeleteFile = (path: string) => {
    if (path === 'Migrated_Manuscript.tex') {
      toast.error('Cannot delete the main manuscript skeleton');
      return;
    }
    
    if (confirm(`Remove ${path} from this session?`)) {
      const newContents = { ...fileContents };
      delete newContents[path];
      setFileContents(newContents);
      
      if (activeFile === path) {
        setActiveFile(Object.keys(newContents)[0] || '');
      }
      toast.success(`Deleted: ${path}`);
    }
  };

  if (!session) return null;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-primary)', overflow: 'hidden' }}>
      <Sidebar />
      
      <main className="md:ml-64" style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', paddingTop: '64px' }}>
        
        {/* HEADER / STEPPER */}
        <div style={{ 
          height: '60px', borderBottom: '1px solid var(--border)', 
          background: 'var(--bg-secondary)', display: 'flex', 
          alignItems: 'center', padding: '0 2rem', justifyContent: 'space-between' 
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ 
              width: '32px', height: '32px', borderRadius: '8px', 
              background: 'var(--accent-gradient)', display: 'flex', 
              alignItems: 'center', justifyContent: 'center' 
            }}>
              <RefreshCw size={18} color="#fff" />
            </div>
            <h1 style={{ fontSize: '1.1rem', fontWeight: 800, fontFamily: 'var(--font-newsreader)', fontStyle: 'italic' }}>Template Migrator</h1>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
             <StepIndicator active={step === 'intake'} done={step !== 'intake'} label="Upload" />
             <ChevronRight size={14} opacity={0.3} />
             <StepIndicator active={step === 'selection'} done={step === 'migrating' || step === 'editor'} label="Template" />
             <ChevronRight size={14} opacity={0.3} />
             <StepIndicator active={step === 'editor'} done={false} label="Studio" />
          </div>
        </div>

        {/* MAIN PANEL */}
        <div style={{ flex: 1, position: 'relative', overflowY: step === 'editor' ? 'hidden' : 'auto' }}>
          
          {step === 'intake' && (
            <div style={{ maxWidth: '800px', margin: '4rem auto', padding: '0 2rem' }}>
               <div className="card glass" style={{ padding: '5rem 2rem', textAlign: 'center', border: '2px dashed var(--border)', borderRadius: '32px' }}>
                  <Cloud size={64} style={{ color: 'var(--accent-primary)', marginBottom: '1.5rem', opacity: 0.6 }} />
                  <h2 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '1rem' }}>Welcome to the Scholarly Migrator</h2>
                  <p style={{ color: 'var(--text-secondary)', marginBottom: '2.5rem', fontSize: '1.1rem' }}>Upload your existing LaTeX ZIP archive (including assets) to begin the premium migration process.</p>
                  
                  <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".zip" style={{ display: 'none' }} />
                  <button onClick={() => fileInputRef.current?.click()} className="btn btn-primary" style={{ height: '56px', padding: '0 2.5rem', fontSize: '1.1rem' }}>
                     <Upload size={20} /> Select Project ZIP
                  </button>

                  <div style={{ marginTop: '3rem', textAlign: 'left', background: 'rgba(255,193,7,0.05)', borderRadius: '20px', padding: '1.5rem', border: '1px solid rgba(255,193,7,0.2)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', color: '#ffc107' }}>
                      <AlertTriangle size={20} />
                      <h3 style={{ fontWeight: 700 }}>Migration Guidelines</h3>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                      <div>
                        <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <FileCheck2 size={14} /> Source ZIP (Must Have)
                        </h4>
                        <ul style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          <li>• Main <code style={{color: 'var(--accent-primary)'}}>.tex</code> file with <code style={{color: 'var(--accent-primary)'}}>{'\\begin{document}'}</code></li>
                          <li>• All Figures/Images referred in text</li>
                          <li>• Bibliography <code style={{color: 'var(--accent-primary)'}}>.bib</code> files</li>
                        </ul>
                      </div>
                      <div>
                        <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Info size={14} /> Performance Tips
                        </h4>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                           Ensure custom macros are in <code style={{color: 'var(--accent-primary)'}}>.sty</code> files. The engine will automatically promote these to the project root.
                        </p>
                      </div>
                    </div>
                  </div>
               </div>
            </div>
          )}

          {step === 'selection' && (
            <div style={{ maxWidth: '1200px', margin: '3rem auto', padding: '0 2rem pb-4' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
                 <div>
                   <h2 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Choose Target Structure</h2>
                   <p style={{ color: 'var(--text-secondary)' }}>Select the standard scholarly template you wish to migrate your content into.</p>
                 </div>
                 <button onClick={() => setStep('intake')} className="btn glass" style={{ fontSize: '0.8rem' }}>Change ZIP</button>
              </div>

              <div style={{ 
                background: 'rgba(255,193,7,0.05)', 
                border: '1px solid rgba(255,193,7,0.2)', 
                borderRadius: '16px', 
                padding: '1rem 1.5rem', 
                marginBottom: '2rem',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem'
              }}>
                <AlertTriangle size={24} style={{ color: '#ffc107', flexShrink: 0 }} />
                <div style={{ fontSize: '0.9rem' }}>
                  <span style={{ fontWeight: 700, color: '#ffc107' }}>Caution:</span> Target templates MUST contain a valid <code style={{color: 'var(--accent-primary)'}}>.cls</code> (Document Class) and a skeleton <code style={{color: 'var(--accent-primary)'}}>.tex</code> file. Ensure the <code style={{color: 'var(--accent-primary)'}}>{'\\documentclass'}</code> name matches your library assets exactly for 1000% accuracy.
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem', paddingBottom: '3rem' }}>
                {/* ADD CUSTOM TEMPLATE CARD */}
                <div 
                  className="card glass hover-scale"
                  onClick={() => templateInputRef.current?.click()}
                  style={{ 
                    padding: '1.5rem', cursor: 'pointer', borderRadius: '20px', 
                    border: '2px dashed var(--border)', display: 'flex', 
                    flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    minHeight: '200px', background: 'rgba(255,255,255,0.02)'
                  }}
                >
                   {isUploadingTemplate ? (
                     <RefreshCw size={32} className="spinner" style={{ color: 'var(--accent-primary)' }} />
                   ) : (
                     <Plus size={32} style={{ color: 'var(--accent-primary)', marginBottom: '1rem' }} />
                   )}
                   <h3 style={{ fontSize: '1rem', fontWeight: 700, textAlign: 'center' }}>
                     {isUploadingTemplate ? 'Uploading...' : 'Add Custom Template'}
                   </h3>
                   <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'center', marginTop: '0.5rem' }}>
                     Upload a .zip or .cls file to expand your library.
                   </p>
                   <input 
                     type="file" 
                     ref={templateInputRef} 
                     onChange={handleCustomTemplateUpload} 
                     accept=".zip,.cls" 
                     style={{ display: 'none' }} 
                   />
                </div>

                {allTemplates.map(t => (
                  <div 
                    key={t.id} 
                    className="card glass hover-scale" 
                    onClick={() => startMigration(t.id)}
                    style={{ padding: '1.5rem', cursor: 'pointer', borderRadius: '20px', transition: 'all 0.2s ease', position: 'relative' }}
                  >
                    {t.isCustom && (
                      <button 
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (!confirm('Delete custom template?')) return;
                          try {
                            await fetch(`/api/templates?id=${t.id}`, { method: 'DELETE' });
                            fetch('/api/templates', { cache: 'no-store' })
                              .then(res => res.json())
                              .then(data => setCustomTemplates(data.templates || []));
                          } catch {
                            alert('Failed to delete template');
                          }
                        }}
                        style={{ position: 'absolute', top: '16px', right: '16px', background: 'rgba(255,0,0,0.1)', border: 'none', color: 'var(--error)', cursor: 'pointer', padding: '4px 8px', borderRadius: '4px', fontSize: '0.85rem' }}
                        title="Delete custom template"
                      >
                        Delete
                      </button>
                    )}
                    <div style={{ fontSize: '2rem', marginBottom: '1rem', height: '48px', display: 'flex', alignItems: 'center' }}>
                      {t.icon && (typeof t.icon === 'string' && (t.icon.startsWith('http') || t.icon.startsWith('/') || t.icon.includes('.') || t.icon.includes('/'))) ? (
                        <Image src={t.icon} width={48} height={48} style={{ objectFit: 'contain' }} alt="" unoptimized />
                      ) : (
                        t.icon || '📄'
                      )}
                    </div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem', paddingRight: t.isCustom ? '60px' : '0' }}>{t.label}</h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{t.desc}</p>
                    <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
                       <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                         <ArrowRight size={16} />
                       </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 'migrating' && (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
               <RefreshCw size={48} className="spinner" style={{ color: 'var(--accent-primary)', marginBottom: '2rem' }} />
               <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Neural Anatomy Mapping...</h2>
               <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Grafting legacy content into standard scholarly structure.</p>
            </div>
          )}

          {step === 'editor' && migratedContent && (
            <div style={{ display: 'flex', height: '100%', background: 'var(--bg-primary)' }}>
              {/* File Explorer (Mini) */}
              <div style={{ width: '240px', background: 'var(--bg-secondary)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                     <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Assets & Files</span>
                     <button 
                        onClick={() => assetInputRef.current?.click()}
                        style={{ background: 'transparent', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.7rem', fontWeight: 700 }}
                     >
                        <Upload size={12} /> Upload
                     </button>
                     <input type="file" ref={assetInputRef} onChange={handleAssetUpload} style={{ display: 'none' }} />
                  </div>
                  <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem 0' }}>
                     {Object.keys(fileContents).map(path => (
                       <div 
                         key={path} 
                         style={{ 
                           padding: '0.5rem 1rem', fontSize: '0.8rem', cursor: 'pointer',
                           background: activeFile === path ? 'rgba(59,130,246,0.1)' : 'transparent',
                           color: activeFile === path ? 'var(--accent-primary)' : 'var(--text-primary)',
                           display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                         }}
                         className="file-item"
                       >
                          <div onClick={() => setActiveFile(path)} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flex: 1, overflow: 'hidden' }}>
                            <span style={{ flexShrink: 0 }}>{path.match(/\.(png|jpg|jpeg|gif|pdf)$/i) ? '🖼️' : '📄'}</span>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{path}</span>
                          </div>
                          {path !== 'Migrated_Manuscript.tex' && (
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleDeleteFile(path); }}
                              style={{ 
                                background: 'transparent', border: 'none', color: 'var(--error)', 
                                opacity: 0.4, cursor: 'pointer', padding: '2px', display: 'flex'
                              }}
                              className="delete-btn"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                       </div>
                     ))}
                  </div>
                 <div style={{ padding: '1rem', borderTop: '1px solid var(--border)' }}>
                    <button onClick={downloadZip} className="btn btn-primary" style={{ width: '100%', fontSize: '0.8rem' }}>
                      <FileBox size={14} /> Download ZIP
                    </button>
                 </div>
              </div>

              {/* Central Area: Editor + Preview */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                 {/* IDB Toolbar */}
                 <div style={{ height: '48px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', padding: '0 1rem', gap: '1rem', background: 'var(--bg-secondary)' }}>
                    <div style={{ flex: 1, fontSize: '0.8rem', fontWeight: 600 }}>{activeFile}</div>
                    
                    {/* Engine Selector */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-primary)', padding: '2px 8px', borderRadius: '6px', border: '1px solid var(--border)' }}>
                        <Zap size={14} style={{ color: 'var(--accent-primary)' }} />
                        <select 
                          value={engine} 
                          onChange={(e) => setEngine(e.target.value as any)}
                          style={{ 
                            background: 'transparent', border: 'none', color: 'var(--text-primary)', 
                            fontSize: '0.75rem', fontWeight: 700, outline: 'none', cursor: 'pointer' 
                          }}
                        >
                           <option value="pdflatex">pdfLaTeX</option>
                           <option value="xelatex">XeLaTeX</option>
                           <option value="lualatex">LuaLaTeX</option>
                        </select>
                    </div>
                    <button onClick={handleCompile} disabled={compiling} className="btn btn-primary" style={{ height: '32px', fontSize: '0.75rem', padding: '0 1rem' }}>
                       {compiling ? 'Compiling...' : '▶ Compile PDF'}
                    </button>
                 </div>
                 
                  <div style={{ flex: 1, display: 'flex' }}>
                    {/* Monaco */}
                    <div style={{ flex: 1, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                       <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
                        {!activeFile.match(/\.(png|jpg|jpeg|gif|pdf)$/i) ? (
                            <MonacoEditor
                              height="100%"
                              theme="vs-dark"
                              language="latex"
                              value={String(fileContents[activeFile] || '')}
                              onChange={(v) => setFileContents(prev => ({ ...prev, [activeFile]: v || '' }))}
                              options={{ fontSize: 13, minimap: { enabled: false } }}
                            />
                          ) : (
                            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000' }}>
                                <Image src={fileContents[activeFile] instanceof Uint8Array ? URL.createObjectURL(new Blob([fileContents[activeFile] as any])) : ''} fill style={{ objectFit: 'contain', maxWidth: '80%', maxHeight: '80%' }} alt="" unoptimized />
                            </div>
                          )}
                       </div>

                       {/* TERMINAL / CONSOLE */}
                       <div style={{ 
                         height: isTerminalOpen ? '220px' : '36px', 
                         flexShrink: 0,
                         background: 'var(--bg-primary)', borderTop: '2px solid var(--border)', 
                         display: 'flex', flexDirection: 'column', overflow: 'hidden',
                         transition: 'height 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                         zIndex: 10
                       }}>
                          <div 
                            onClick={() => setIsTerminalOpen(!isTerminalOpen)}
                            style={{ 
                              height: '36px', minHeight: '36px', padding: '0 1rem', display: 'flex', 
                              alignItems: 'center', justifyContent: 'space-between', 
                              cursor: 'pointer', background: 'var(--bg-secondary)' 
                            }}
                          >
                             <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                                <FileText size={14} style={{ color: 'var(--accent-primary)' }} /> 
                                <span style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>Scholarly Console</span>
                                {compiling && <div className="spinner" style={{ width: '8px', height: '8px', border: '2px solid var(--accent-primary)', borderTopColor: 'transparent', borderRadius: '50%' }} />}
                             </div>
                             <div style={{ color: 'var(--text-muted, var(--text-secondary))' }}>{isTerminalOpen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}</div>
                          </div>
                          
                          <div 
                            ref={terminalRef}
                            style={{ 
                              flex: 1, padding: '1rem', overflowY: 'auto', 
                              fontFamily: '"Fira Code", monospace', fontSize: '12px', lineHeight: 1.6 
                            }}
                          >
                             {terminalLogs.length === 0 ? (
                               <div style={{ color: 'var(--text-secondary)', fontStyle: 'italic', opacity: 0.6 }}>Scholarly environment ready. Waiting for compilation trigger...</div>
                             ) : (
                               terminalLogs.map((log, i) => (
                                 <div key={i} style={{ 
                                    color: log.type === 'error' ? 'var(--error, #ff5555)' : log.type === 'success' ? 'var(--success, #22c55e)' : 'var(--text-primary)',
                                    marginBottom: '4px', whiteSpace: 'pre-wrap',
                                    paddingLeft: '12px', borderLeft: `2px solid ${log.type === 'error' ? 'var(--error, #ff5555)' : log.type === 'success' ? 'var(--success, #22c55e)' : 'var(--border)'}`
                                 }}>
                                    {log.msg}
                                 </div>
                               ))
                             )}
                          </div>
                       </div>
                    </div>

                    {/* PDF Preview */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)' }}>
                       <div style={{ height: '40px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', padding: '0 0.5rem', gap: '0.5rem', justifyContent: 'center' }}>
                          <button onClick={() => setPdfScale(s => Math.max(0.5, s - 0.1))} className="toolbar-btn"><Minimize2 size={16} /></button>
                          <span style={{ fontSize: '0.75rem', minWidth: '40px', textAlign: 'center', color: 'var(--text-primary)' }}>{Math.round(pdfScale * 100)}%</span>
                          <button onClick={() => setPdfScale(s => Math.min(3.0, s + 0.1))} className="toolbar-btn"><Maximize2 size={16} /></button>
                          <div style={{ width: '1px', height: '20px', background: 'var(--border)', margin: '0 5px' }} />
                          <button onClick={() => pdfUrl && window.print()} className="toolbar-btn"><Printer size={16} /></button>
                          <a href={pdfUrl || ''} download="migrated.pdf" className="toolbar-btn"><Download size={16} /></a>
                       </div>
                       <div style={{ flex: 1, overflow: 'auto', display: 'flex', justifyContent: 'center', padding: '1rem', background: 'var(--bg-tertiary, var(--bg-secondary))' }}>
                          {pdfUrl ? (
                            <iframe 
                               key={pdfUrl} // FORCE RE-MOUNT
                               src={`${pdfUrl}#toolbar=0&navpanes=0&view=FitH`} 
                               style={{ 
                                width: `${800 * pdfScale}px`, 
                                height: '100%', 
                                border: 'none',
                                transition: 'width 0.2s ease'
                              }} 
                               title="PDF Preview"
                            />
                          ) : (
                            <div style={{ color: 'var(--text-secondary)', opacity: 0.5, marginTop: '10rem', fontSize: '0.9rem' }}>Compile to see preview</div>
                          )}
                       </div>
                    </div>
                 </div>
              </div>
            </div>
          )}

        </div>
      </main>


      <ProjectLimitModal isOpen={showLimitModal} onClose={() => setShowLimitModal(false)} />
    </div>
  );
}

const StepIndicator = ({ active, done, label }: { active: boolean, done: boolean, label: string }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
    <div style={{ 
      width: '20px', height: '20px', borderRadius: '50%', 
      border: '2px solid', 
      borderColor: done ? 'var(--accent-primary)' : active ? 'var(--accent-primary)' : 'var(--border)',
      background: done ? 'var(--accent-primary)' : 'transparent',
      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem'
    }}>
      {done ? <Check size={12} color="#fff" /> : active ? <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent-primary)' }} /> : null}
    </div>
    <span style={{ 
      fontSize: '0.75rem', fontWeight: 700, 
      color: active || done ? 'var(--text-primary)' : 'var(--text-secondary)',
      opacity: active || done ? 1 : 0.5
    }}>{label}</span>
  </div>
);
