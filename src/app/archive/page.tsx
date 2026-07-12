"use client";

import { useMemo } from "react";
import { useSession } from "@/lib/pb-auth-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Suspense, useState } from "react";
import Sidebar from "@/components/Sidebar";
import ProLoader from "@/components/ProLoader";
import { usePbRealtimeProjects } from "@/hooks/usePbRealtime";
import { 
  FileText, Archive as ArchiveIcon, Search, Trash2, 
  ArrowUpRight, X, RotateCcw, Clock, Cloud, HardDrive,
  ExternalLink
} from "lucide-react";

function ArchiveContent() {
  const { data: session } = useSession();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTab, setSelectedTab] = useState<'all' | 'archived' | 'completed'>('all');

  const { records: projects, loading, error } = usePbRealtimeProjects(
    session?.user?.id,
    undefined
  );

  // Projects that are completed or old (consider anything older than 30 days or status=completed as archive-worthy)
  const archiveProjects = useMemo(() => {
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return projects.filter(p => {
      const projectDate = new Date(p.date || p.updatedAt).getTime();
      const isOld = projectDate < thirtyDaysAgo;
      const isCompleted = p.status === 'completed' || p.status === 'verified';
      const isFailed = p.status === 'failed';
      return isOld || isCompleted || isFailed;
    });
  }, [projects]);

  const completedProjects = useMemo(() => {
    return projects.filter(p => p.status === 'completed' || p.status === 'verified');
  }, [projects]);

  const filteredProjects = useMemo(() => {
    let base = projects;
    if (selectedTab === 'archived') base = archiveProjects;
    else if (selectedTab === 'completed') base = completedProjects;

    if (!searchQuery) return base;
    const q = searchQuery.toLowerCase();
    return base.filter(p => 
      p.title.toLowerCase().includes(q) ||
      (p.projectType || '').toLowerCase().includes(q)
    );
  }, [projects, archiveProjects, completedProjects, selectedTab, searchQuery]);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this project permanently?")) return;
    try {
      const res = await fetch(`/api/projects/${id}/delete`, { method: 'DELETE' });
      if (!res.ok) throw new Error("Delete failed");
    } catch (err: any) {
      console.error("Delete failed:", err);
      alert("Failed to delete project.");
    }
  };

  const handleRestore = async (id: string) => {
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'draft' }),
      });
      if (!res.ok) throw new Error("Restore failed");
    } catch (err: any) {
      console.error("Restore failed:", err);
      alert("Failed to restore project.");
    }
  };

  if (!session) return null;

  return (
    <div className="flex h-screen bg-background-joy text-on-surface-joy font-body transition-colors duration-500 overflow-hidden">
      <Sidebar />
      
      <main className="flex-1 min-w-0 md:ml-64 p-8 lg:p-12 pt-24 lg:pt-32 h-full overflow-y-auto custom-scroll">
        {/* Header */}
        <header className="flex flex-col sm:flex-row justify-start items-start sm:items-center gap-6 mb-12 flex-wrap">
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="space-y-1">
            <h1 className="text-4xl font-bold tracking-tight text-on-surface flex items-center gap-4">
              <ArchiveIcon size={32} className="text-primary" />
              Archive
            </h1>
            <p className="text-secondary font-medium">Completed, old, and archived projects.</p>
          </motion.div>
        </header>

        {/* Toolbar */}
        <div className="flex flex-col lg:flex-row justify-between items-center gap-8 mb-12">
          <div className="flex bg-surface-container-low-joy/30 p-1.5 rounded-[2rem] gap-1 border border-outline-joy/5 w-full lg:w-auto overflow-x-auto scrollbar-hide">
            {[
              { id: 'all' as const, label: 'All Projects', icon: <FileText size={14} /> },
              { id: 'archived' as const, label: 'Archive', icon: <ArchiveIcon size={14} /> },
              { id: 'completed' as const, label: 'Completed', icon: <RotateCcw size={14} /> },
            ].map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedTab(cat.id)}
                className={`px-8 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center gap-3 whitespace-nowrap ${
                  selectedTab === cat.id
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
              placeholder="Search archived projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-14 pl-16 pr-8 bg-white border border-outline-joy/10 rounded-3xl font-medium focus:ring-4 focus:ring-primary-joy/5 focus:border-primary-joy/30 outline-none transition-all shadow-sm"
            />
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <ProLoader fullScreen={false} />
        ) : error ? (
          <div className="py-40 bg-surface-container-low/50 rounded-[3rem] text-center space-y-4 border border-error/30">
            <div className="w-20 h-20 bg-error/10 flex items-center justify-center mx-auto text-error rounded-full">
              <X size={32} />
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-bold text-error">Connection Error</h3>
              <p className="text-secondary font-medium">{error}</p>
            </div>
            <button onClick={() => window.location.reload()} className="text-sm font-bold text-primary hover:underline transition-all">
              Retry
            </button>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="py-40 bg-surface-container-low/50 rounded-[3rem] text-center space-y-4 border border-outline border-dashed">
            <div className="w-20 h-20 bg-surface-container flex items-center justify-center mx-auto text-secondary rounded-full">
              <ArchiveIcon size={32} />
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-bold">No archived projects</h3>
              <p className="text-secondary font-medium">Completed and old projects will appear here.</p>
            </div>
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
                  className="group relative glass-card border border-primary/30 rounded-[3rem] p-6 md:p-10 cursor-pointer overflow-hidden flex flex-col h-full hover:border-primary/60 transition-all duration-300"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-primary-joy/5 rounded-full -mr-16 -mt-16 blur-2xl group-hover:scale-150 transition-transform duration-700" />
                  
                  <div className="flex justify-between items-start mb-10">
                    <div className="w-16 h-16 rounded-[1.5rem] bg-surface-container-low flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-on-primary transition-all duration-500 shadow-sm">
                      {p.projectType === 'REVIEWER' ? <RotateCcw size={32} /> : <FileText size={32} />}
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedTab === 'archived' && (
                        <button 
                          onClick={(e) => {e.stopPropagation(); handleRestore(p.id);}}
                          className="w-10 h-10 rounded-xl text-slate-200 hover:text-primary-joy hover:bg-primary-joy/10 transition-all flex items-center justify-center"
                          title="Restore"
                        >
                          <RotateCcw size={18} />
                        </button>
                      )}
                      <button 
                        onClick={(e) => {e.stopPropagation(); handleDelete(p.id);}}
                        className="w-10 h-10 rounded-xl text-slate-200 hover:text-error-joy hover:bg-error-container-joy/10 transition-all flex items-center justify-center"
                        title="Delete"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 space-y-4">
                    <h4 className="text-2xl font-bold text-on-surface-joy leading-tight group-hover:text-primary-joy transition-colors line-clamp-2">{p.title}</h4>
                    <div className="flex flex-wrap gap-2">
                      <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-slate-100 text-slate-600 flex items-center gap-1">
                        <Clock size={10} />
                        {new Date(p.date || p.updatedAt).toLocaleDateString()}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-primary/10 text-primary flex items-center gap-1">
                        {p.projectType || 'DOC2LATEX'}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1 ${
                        p.status === 'completed' ? 'bg-green-100 text-green-700' :
                        p.status === 'failed' ? 'bg-red-100 text-red-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {p.status || 'unknown'}
                      </span>
                    </div>
                  </div>

                  <div className="mt-10 pt-10 border-t border-outline-joy/5 flex justify-between items-center">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] font-bold text-secondary uppercase tracking-wider">
                      <span>{p.wordCount || p.stats?.words || 0} words</span>
                      <span>{p.imageCount || p.stats?.images || 0} images</span>
                    </div>
                    <Link 
                      href={p.projectType === 'REVIEWER' ? '/reviewer' : p.projectType === 'CITATION' ? '/citations' : `/editor/${p.id}`}
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
    </div>
  );
}

export default function ArchivePage() {
  return (
    <Suspense fallback={null}>
      <ArchiveContent />
    </Suspense>
  );
}
