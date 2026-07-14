"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useSession } from "@/lib/pb-auth-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import { Suspense } from "react";
import Sidebar from "@/components/Sidebar";
import { StudioFS } from "@/lib/studio-fs";
import { ProjectStats } from "@/components/ProjectStats";
import ProLoader from "@/components/ProLoader";
import { usePbRealtimeProjects } from "@/hooks/usePbRealtime";

import { 
  FileText, Cloud, Quote, ShieldCheck, 
  Search, Trash2, ArrowUpRight, X,
  Table, Image as ImageIcon, Code, Sigma, BookOpen,
  Archive, ExternalLink, Clock, Layers, LayoutPanelLeft
} from "lucide-react";

const safeParse = (str: string) => {
  try { return JSON.parse(str || "{}"); } catch { return {}; }
};

export default function HistoryPage() {
  return (
    <Suspense fallback={null}>
      <HistoryContent />
    </Suspense>
  );
}

function HistoryContent() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') || 'ALL';
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState(initialTab);
  const [searchQuery, setSearchQuery] = useState("");
  const isFirstLoadRef = useRef(true);

  // PB Realtime — all user projects
  const { records: pbProjects, loading: pbLoading } = usePbRealtimeProjects(session?.user?.id, undefined);

  const categories = [
    { id: 'ALL', label: 'All Projects', icon: <ArchiveIcon/> },
    { id: 'LATEX_STUDIO', label: 'Latexify Studio', icon: <FileText size={14}/> },
    { id: 'DOC2LATEX', label: 'Doc2LateX Studio', icon: <Cloud size={14}/> },
    { id: 'CITATION', label: 'AI Citation Studio', icon: <Quote size={14}/> },
    { id: 'REVIEWER', label: 'AI Peer Reviewer', icon: <ShieldCheck size={14}/> },
    { id: 'TEMPLATE_MIGRATOR', label: 'Template Migrator', icon: <Layers size={14}/> },
    { id: 'DIAGRAM', label: 'AI Diagram Studio', icon: <LayoutPanelLeft size={14}/> },
  ];

  // Merge PB realtime projects with local StudioFS projects
  useEffect(() => {
    let active = true;
    const mergeProjects = async () => {
      if (isFirstLoadRef.current) {
        setLoading(true);
        isFirstLoadRef.current = false;
      }
      try {
        const serverProjects = (pbProjects || []).map((p: any) => ({
          ...p,
          date: p.date || p.updatedAt,
          type: p.projectType || 'DOC2LATEX',
          isLocal: false,
        }));

        let localProjects: any[] = [];
        if (session?.user?.email) {
          try {
            const fs = new StudioFS(session.user.email);
            const local = await fs.listProjects();
            localProjects = local.map(p => ({
              id: p.id,
              title: p.title,
              status: 'local',
              date: p.updatedAt,
              type: 'LATEX_STUDIO',
              stats: { words: 0, images: p.fileCount },
              isLocal: true,
            }));
          } catch (fsErr) {
            console.warn('History: StudioFS load failed:', fsErr);
          }
        }

        const mergedRaw = [...localProjects, ...serverProjects].sort((a, b) =>
          new Date(b.date).getTime() - new Date(a.date).getTime()
        );

        // De-duplication by id
        const merged = Array.from(new Map(mergedRaw.map(item => [item.id, item])).values());
        if (active) {
          setProjects(prev => {
            if (JSON.stringify(prev) === JSON.stringify(merged)) return prev;
            return merged;
          });
        }
      } catch (err) {
        console.error('History merge failed:', err);
        toast.error('Failed to load history');
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    if (session?.user?.email || pbProjects.length > 0 || !pbLoading) {
      mergeProjects();
    }

    return () => {
      active = false;
    };
  }, [session, pbProjects, pbLoading]);

  const filteredProjects = useMemo(() => {
    return projects
      .filter(p => activeTab === 'ALL' || p.type === activeTab)
      .filter(p => (p?.title || '').toLowerCase().includes((searchQuery || '').toLowerCase()));
  }, [projects, activeTab, searchQuery]);

  const handleDelete = async (id: string, isLocal?: boolean) => {
    if (!confirm("Are you sure you want to delete this project?")) return;
    const tId = toast.loading("Deleting project...");
    try {
      if (isLocal) {
        const finalFs = new StudioFS(session?.user?.email || 'guest');
        await finalFs.deleteProject(id);
      } else {
        const res = await fetch(`/api/projects/${id}/delete`, { method: 'DELETE' });
        if (!res.ok) throw new Error("Server delete failed");
      }
      setProjects(prev => prev.filter(p => p.id !== id));
      if (selectedProject?.id === id) setSelectedProject(null);
      toast.success("Project deleted", { id: tId });
    } catch { toast.error("Delete failed", { id: tId }); }
  };

  if (!session) return null;

  return (
    <div className="flex h-screen bg-background-joy text-on-surface-joy font-body transition-colors duration-500 overflow-hidden">
      <Sidebar />
      
      <main className="flex-1 min-w-0 md:ml-64 p-8 lg:p-12 pt-24 lg:pt-32 h-full overflow-y-auto custom-scroll">
        
        {/* Dynamic History Header */}
        <header className="flex flex-col sm:flex-row justify-start items-start sm:items-center gap-6 mb-12 flex-wrap">
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="space-y-1">
             <div className="flex items-center gap-3">
               <h1 className="text-4xl font-bold tracking-tight text-on-surface">
                  Full History
               </h1>
               <span className="flex items-center gap-1 text-[9px] font-bold text-green-600 bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/20">
                 <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                 Live
               </span>
             </div>
             <p className="text-secondary font-medium">Manage and review your scholarly manuscripts and archives.</p>
          </motion.div>
          <Link
            href="/archive"
            className="flex items-center gap-2 px-4 py-2 bg-surface-container-low rounded-xl text-sm font-bold text-secondary hover:text-primary hover:bg-surface-container transition-all border border-outline/10"
          >
            <Archive size={16} />
            Archive
            <ExternalLink size={12} />
          </Link>
        </header>

        {/* Global Toolbar */}
        <div className="flex flex-col lg:flex-row justify-between items-center gap-8 mb-12">
           <div className="flex bg-surface-container-low-joy/30 p-1.5 rounded-[2rem] gap-1 border border-outline-joy/5 w-full lg:w-auto overflow-x-auto scrollbar-hide">
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setActiveTab(cat.id)}
                  className={`px-8 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center gap-3 whitespace-nowrap ${
                    activeTab === cat.id 
                      ? "bg-white text-primary-joy shadow-joy-subtle border border-outline-joy/5" 
                      : "text-slate-400 hover:text-slate-600"
                  }`}
                >
                  {cat.icon}
                  {cat.label}
                </button>
              ))}
           </div>

           <div className="relative w-full lg:w-[400px] group">
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-primary-joy transition-colors" size={20} />
              <input 
                 type="text"
                 placeholder="Search projects..."
                 value={searchQuery}
                 onChange={(e) => setSearchQuery(e.target.value)}
                 className="w-full h-14 pl-16 pr-8 bg-white border border-outline-joy/10 rounded-3xl font-medium focus:ring-4 focus:ring-primary-joy/5 focus:border-primary-joy/30 outline-none transition-all shadow-sm"
              />
           </div>
        </div>

        {/* Archive Matrix */}
        {loading ? (
          <ProLoader fullScreen={false} />
        ) : filteredProjects.length === 0 ? (
          <div className="py-40 bg-surface-container-low/50 rounded-[3rem] text-center space-y-4 border border-outline border-dashed">
            <div className="w-20 h-20 bg-surface-container flex items-center justify-center mx-auto text-secondary rounded-full">
               <FileText size={32} />
            </div>
            <div className="space-y-1">
               <h3 className="text-xl font-bold">No projects found</h3>
               <p className="text-secondary font-medium">Try a different search term or category.</p>
            </div>
            <button onClick={() => {setActiveTab('ALL'); setSearchQuery('');}} className="text-sm font-bold text-primary hover:underline transition-all">Reset Filters</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
            <AnimatePresence>
              {filteredProjects.map((p, idx) => (
                <motion.div 
                  key={p.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ delay: idx * 0.05 }}
                  onClick={() => !p.isLocal && setSelectedProject(p)}
                  className={`group relative glass-card border border-primary/30 rounded-[3rem] p-6 md:p-10 cursor-pointer overflow-hidden flex flex-col h-full hover:border-primary/60 transition-all duration-300 ${
                    selectedProject?.id === p.id ? "ring-4 ring-primary/10 border-primary/60 bg-surface-container-low" : ""
                  }`}
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-primary-joy/5 rounded-full -mr-16 -mt-16 blur-2xl group-hover:scale-150 transition-transform duration-700" />
                  
                  <div className="flex justify-between items-start mb-10">
                     <div className="w-16 h-16 rounded-[1.5rem] bg-surface-container-low flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-on-primary transition-all duration-500 shadow-sm">
                         {p.type === 'REVIEWER' ? <ShieldCheck size={32} /> : p.type === 'CITATION' ? <Quote size={32} /> : p.type === 'DIAGRAM' ? <LayoutPanelLeft size={32} /> : p.type === 'TEMPLATE_MIGRATOR' ? <Layers size={32} /> : p.type === 'DOC2LATEX' ? <Cloud size={32} /> : <FileText size={32} />}
                     </div>
                     <div className="flex items-center gap-2">
                        <button 
                          onClick={(e) => {e.stopPropagation(); handleDelete(p.id, p.isLocal);}}
                          className="w-10 h-10 rounded-xl text-slate-200 hover:text-error-joy hover:bg-error-container-joy/10 transition-all flex items-center justify-center"
                        >
                           <Trash2 size={18} />
                        </button>
                     </div>
                  </div>

                  <div className="flex-1 space-y-4">
                     <h4 className="text-2xl font-bold text-on-surface-joy leading-tight group-hover:text-primary-joy transition-colors line-clamp-2">{p.title}</h4>
                     <p className="text-xs font-semibold text-secondary">
                        {new Date(p.date).toLocaleDateString()} • {p.isLocal ? 'Local' : 'Cloud'}
                     </p>
                  </div>

                  <div className="mt-10 pt-10 border-t border-outline-joy/5 flex justify-between items-center">
                     <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] font-bold text-secondary uppercase tracking-wider">
                        <div className="flex items-center gap-1.5" title="Words"><FileText size={14} className="text-primary/70"/> {p.stats?.words || 0}</div>
                        <div className="flex items-center gap-1.5" title="Images"><ImageIcon size={14} className="text-primary/70"/> {p.stats?.images || 0}</div>
                        <div className="flex items-center gap-1.5" title="Tables"><Table size={14} className="text-primary/70"/> {p.stats?.tables || 0}</div>
                        <div className="flex items-center gap-1.5" title="Equations"><Sigma size={14} className="text-primary/70"/> {p.stats?.equations || 0}</div>
                        <div className="flex items-center gap-1.5" title="Citations"><Quote size={14} className="text-primary/70"/> {p.stats?.citations || 0}</div>
                        <div className="flex items-center gap-1.5" title="Pseudocode"><Code size={14} className="text-primary/70"/> {p.stats?.pseudocode || 0}</div>
                        <div className="flex items-center gap-1.5" title="References"><BookOpen size={14} className="text-primary/70"/> {p.stats?.references || 0}</div>
                     </div>
                     <Link 
                        href={p.isLocal ? `/latex-studio/${p.id}` : (p.type === 'REVIEWER' ? `/reviewer/studio` : `/editor/${p.id}`)}
                        onClick={(e) => e.stopPropagation()}
                        className="h-10 px-6 bg-surface-container-low text-secondary rounded-lg font-bold text-sm flex items-center gap-2 hover:bg-on-background hover:text-white transition-all shadow-sm group/btn"
                     >
                        Open <ArrowUpRight size={14} className="group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5 transition-all" />
                     </Link>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </main>

      {/* Intelligence Slide-over - Reused for Global Consistency */}
      <AnimatePresence>
        {selectedProject && (
          <motion.div 
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 w-full md:w-[40%] bg-background-joy/90 backdrop-blur-3xl border-l border-outline-joy/10 z-[100] shadow-[-20px_0_100px_rgba(0,0,0,0.15)] flex flex-col"
          >
             <div className="p-8 border-b border-outline flex items-center justify-between">
                <h2 className="text-xl font-bold">Project Details</h2>
                <button onClick={() => setSelectedProject(null)} className="w-12 h-12 rounded-2xl hover:bg-slate-100 flex items-center justify-center">
                   <X size={24} />
                </button>
             </div>
             <div className="flex-1 overflow-y-auto p-10 custom-scroll space-y-12">
                <ProjectStats 
                  stats={{
                    wordCount: selectedProject.stats?.words || 0,
                    charCount: selectedProject.stats?.characters || 0,
                    imageCount: selectedProject.stats?.images || 0,
                    chartCount: selectedProject.stats?.charts || 0,
                    tableCount: selectedProject.stats?.tables || 0,
                    equationCount: selectedProject.stats?.equations || 0,
                    citationCount: selectedProject.stats?.citations || 0,
                    referenceCount: selectedProject.stats?.references || 0,
                    pseudocodeCount: selectedProject.stats?.pseudocode || 0
                  }}
                   metadata={{
                     title: selectedProject.title,
                     abstract: safeParse(selectedProject.structuredContent).abstract || "",
                     structuredContent: selectedProject.structuredContent
                   }}
                />
                <Link 
                  href={`/editor/${selectedProject.id}`}
                  className="w-full h-16 bg-primary text-on-primary rounded-xl font-bold text-lg flex items-center justify-center gap-2 shadow-md hover:scale-[1.01] active:scale-95 transition-all"
                >
                  Open Manuscript
                </Link>
             </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const ArchiveIcon = () => (
   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="21 8 21 21 3 21 3 8"></polyline><rect x="1" y="3" width="22" height="5"></rect><line x1="10" y1="12" x2="14" y2="12"></line></svg>
);
