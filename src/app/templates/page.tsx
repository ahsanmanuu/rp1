
"use client";

import { useSearchParams } from "next/navigation";
import { useState, Suspense, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { TEMPLATE_REGISTRY, TemplateMetadata } from "@/lib/templates/registry";
import Sidebar from "@/components/Sidebar";
import SiteFooter from "@/components/SiteFooter";
import { useSession } from "@/lib/pb-auth-react";
import { toast } from "react-hot-toast";
import ProjectLimitModal from "@/components/ProjectLimitModal";
import { useProjectLimit } from "@/hooks/useProjectLimit";
import { 
  Search, X, ArrowUpRight, 
  ChevronRight, Zap,
  Globe, GraduationCap, FileText, Layout,
  Layers, Briefcase, Sparkles,
  Command, FlaskConical,
  Monitor, Upload,
  FileArchive, Loader2, Trash2, Settings
} from "lucide-react";

// --- Robust Icon Component ---
const TemplateIcon = ({ src, label, category }: { src: string, label: string, category: string }) => {
  const [error, setError] = useState(false);
  const getFallbackIcon = () => {
    switch (category) {
      case 'Journal': return <FlaskConical size={16} className="text-primary-joy" />;
      case 'Thesis': return <GraduationCap size={16} className="text-purple-500" />;
      case 'CV': return <Briefcase size={16} className="text-orange-500" />;
      case 'Conference': return <Layers size={16} className="text-blue-500" />;
      case 'Presentation': return <Layout size={16} className="text-pink-500" />;
      default: return <FileText size={16} className="text-slate-400" />;
    }
  };

  if (!src) {
    return <div className="w-full h-full flex items-center justify-center bg-slate-50 rounded-lg">{getFallbackIcon()}</div>;
  }

  if (src.startsWith('http') || src.startsWith('/')) {
    if (error) {
      return <div className="w-full h-full flex items-center justify-center bg-slate-50 rounded-lg">{getFallbackIcon()}</div>;
    }
    return (
      <img
        src={src}
        alt={label}
        className="w-full h-full object-contain p-0.5"
        onError={() => setError(true)}
        referrerPolicy="no-referrer"
      />
    );
  }

  return <div className="w-full h-full flex items-center justify-center text-lg">{src}</div>;
};

function TemplatesContent() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get('projectId');
  const router = useRouter();
  const { data: session } = useSession();

  const [_loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("Journal");
  const [activeSubCategory, setActiveSubCategory] = useState<string>("All");
  const [customTemplates, setCustomTemplates] = useState<TemplateMetadata[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  
  // Modal State
  const [showModal, setShowModal] = useState(false);
  const { showLimitModal, setShowLimitModal } = useProjectLimit();
  const [showManageModal, setShowManageModal] = useState(false);
  const [pendingTemplateId, setPendingTemplateId] = useState<string | null>(null);
  
  // Manage Modal State
  const [selectedFileType, setSelectedFileType] = useState<string>(".tex");
  const [manageFile, setManageFile] = useState<File | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // Upload Modal State
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const manageFileInputRef = useRef<HTMLInputElement>(null);
  const [uploadForm, setUploadForm] = useState({
    name: "",
    category: "Journal",
    subCategory: "General"
  });

  const categories = [
    { name: "Journal", icon: <Globe size={14} /> },
    { name: "Thesis", icon: <GraduationCap size={14} /> },
    { name: "CV", icon: <Briefcase size={14} /> },
    { name: "Conference", icon: <Layers size={14} /> },
    { name: "Presentation", icon: <Layout size={14} /> },
    { name: "Basic", icon: <FileText size={14} /> },
  ];

  const fileTypes = [
    { label: ".tex (Main)", value: ".tex" },
    { label: ".bib (Citations)", value: ".bib" },
    { label: ".bst (Style)", value: ".bst" },
    { label: ".cls (Class)", value: ".cls" },
    { label: ".sty (Package)", value: ".sty" },
  ];

  const dynamicSubCategoryList = useMemo(() => {
    const subs = new Set<string>();
    TEMPLATE_REGISTRY.forEach(t => {
      if (t.category === uploadForm.category && t.subCategory && t.subCategory !== "multidisciplinary") {
        subs.add(t.subCategory);
      }
    });
    subs.add("General");
    return Array.from(subs);
  }, [uploadForm.category]);

  useEffect(() => {
    fetchCustomTemplates();
  }, []);

  const fetchCustomTemplates = async () => {
    try {
      const res = await fetch('/api/templates');
      const data = await res.json();
      if (data.templates) {
        const mapped: TemplateMetadata[] = data.templates.map((t: any) => {
          let extensions: string[] = ['.tex'];
          try {
            if (t.assetsJson) {
               const assets = JSON.parse(t.assetsJson);
               const exts = new Set<string>();
               Object.keys(assets).forEach(filename => {
                  const ext = filename.split('.').pop()?.toLowerCase();
                  if (ext && ['.tex', '.cls', '.sty', '.bst', '.bib'].includes('.' + ext)) {
                     exts.add('.' + ext);
                  }
               });
               if (exts.size > 0) extensions = Array.from(exts);
            }
           } catch {
            console.warn("Failed to parse assets for custom template", t.id);
          }
          
          return {
            id: t.id,
            label: t.name,
            category: t.category,
            subCategory: t.description || "General",
            desc: "Custom uploaded template",
            icon: "", // Will use fallback
            isCustom: true,
            fileExtensions: extensions
          };
        });
        setCustomTemplates(mapped);
      }
    } catch (err) {
      console.error("Failed to fetch custom templates:", err);
    }
  };

  const allTemplates = useMemo(() => {
    return [...TEMPLATE_REGISTRY, ...customTemplates];
  }, [customTemplates]);

  const subCategories = useMemo(() => {
    const subs = new Set<string>();
    allTemplates.forEach(t => {
      if (t.category === activeCategory && t.subCategory && t.subCategory !== "multidisciplinary") {
        subs.add(t.subCategory);
      }
    });
    return ["All", ...Array.from(subs)];
  }, [activeCategory, allTemplates]);

  const filteredTemplates = useMemo(() => {
    let filtered = allTemplates.filter(t => t.category === activeCategory);
    if (activeSubCategory !== "All") {
      filtered = filtered.filter(t => t.subCategory === activeSubCategory);
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(t => 
        t.label.toLowerCase().includes(query) || 
        t.publisher?.toLowerCase().includes(query) ||
        t.subCategory?.toLowerCase().includes(query)
      );
    }
    return filtered;
  }, [searchQuery, activeCategory, activeSubCategory, allTemplates]);

  const handleCardClick = (templateId: string) => {
    setSelected(templateId);
    setPendingTemplateId(templateId);
    if (projectId) {
      handleApplyClick({ stopPropagation: () => {} } as any, templateId);
    } else {
      setShowModal(true);
    }
  };

  const handleApplyClick = async (e: React.MouseEvent, templateId: string) => {
    e.stopPropagation(); // Don't trigger the manage modal
    setSelected(templateId);
    setPendingTemplateId(templateId);
    
    if (projectId) {
      setLoading(true);
      try {
        const projRes = await fetch(`/api/projects/${projectId}`);
        if (!projRes.ok) throw new Error("Failed to load project details");
        const projData = await projRes.json();
        const pType = projData.project?.projectType;
        const studioType = pType === 'LATEX_STUDIO' ? 'latexify' : 'doc2latex';

        const res = await fetch('/api/projects/apply-template', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId, templateId })
        });
        
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Failed to apply template");
        }
        
        sessionStorage.setItem(`force_sync_${projectId}`, 'true');
        const path = studioType === 'latexify' ? `/latex-studio/${projectId}` : `/doc2latex/${projectId}`;
        router.push(path);
        return;
      } catch (err: any) {
        console.error(err);
        toast.error(err.message || "Failed to apply template.");
        setLoading(false);
      }
    } else {
      setShowModal(true);
    }
  };

  const handleUpdateFile = async () => {
    if (!pendingTemplateId || !manageFile) {
      toast.error("Please select a file to update");
      return;
    }

    setIsUpdating(true);
    const formData = new FormData();
    formData.append('templateId', pendingTemplateId);
    formData.append('fileType', selectedFileType);
    formData.append('file', manageFile);

    try {
      const res = await fetch('/api/templates/update-file', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || "File updated successfully!");
        setShowManageModal(false);
        setManageFile(null);
        fetchCustomTemplates();
      } else {
        throw new Error(data.error || "Failed to update file");
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleApplyFinal = async (studioType: 'latexify' | 'doc2latex') => {
    if (!pendingTemplateId) return;
    
    setLoading(true);
    setShowModal(false);
    setShowManageModal(false);
    
    let targetProjectId = projectId;

    try {
      // 1. If no projectId provided, create a new project first
      if (!targetProjectId) {
        const tpl = allTemplates.find(t => t.id === pendingTemplateId);
        const createRes = await fetch('/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            name: `New ${tpl?.label || 'Manuscript'}`,
            projectType: studioType === 'latexify' ? 'LATEX_STUDIO' : 'DOC2LATEX'
          })
        });
        const createData = await createRes.json();
        if (!createRes.ok) {
          if (createData.error === 'LIMIT_REACHED') {
            setShowLimitModal(true);
            return;
          }
          throw new Error(createData.error || "Failed to create project");
        }
        targetProjectId = createData.project.id;
      }

      // 2. Apply template to the target project
      const res = await fetch('/api/projects/apply-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: targetProjectId, templateId: pendingTemplateId })
      });
      
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to apply template");
      }
      
      // 3. Set force sync flag for the editor to refresh its local cache
      sessionStorage.setItem(`force_sync_${targetProjectId}`, 'true');
      
      // 4. Redirect to the appropriate studio
      const path = studioType === 'latexify' ? `/latex-studio/${targetProjectId}` : `/doc2latex/${targetProjectId}`;
      router.push(path);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to start project with template.");
      setLoading(false);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      toast.error("Please select a ZIP file");
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('name', uploadForm.name);
    formData.append('category', uploadForm.category);
    formData.append('subCategory', uploadForm.subCategory);

    try {
      const res = await fetch('/api/templates', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      
      if (data.success) {
        toast.success("Template uploaded successfully!");
        setShowUploadModal(false);
        fetchCustomTemplates();
      } else {
        throw new Error(data.error || "Upload failed");
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteTemplate = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this custom template? This action cannot be undone.")) return;
    
    try {
      const res = await fetch(`/api/templates/delete?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        toast.success("Template deleted successfully");
        fetchCustomTemplates();
      } else {
        throw new Error(data.error || "Failed to delete template");
      }
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div className="flex h-screen bg-background-joy text-on-surface-joy font-body overflow-hidden">
      <Sidebar />
      
      <main className={`flex-1 p-6 lg:p-10 pt-28 lg:pt-32 min-w-0 h-full overflow-y-auto custom-scroll ${session ? 'md:ml-64' : ''}`}>
        
        {/* --- REFINED HERO SECTION --- */}
        <div className="max-w-6xl mx-auto mb-12 relative">
           <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
              <div className="space-y-4 text-center lg:text-left">
                 <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary-joy/5 text-primary-joy text-[10px] font-black uppercase tracking-[0.2em] rounded-full border border-primary-joy/10">
                    <Sparkles size={12} /> Scholarly Repository
                 </div>
                 <h1 className="text-4xl lg:text-5xl font-black tracking-tight text-slate-900 leading-tight">
                    Scholarly <span className="text-joy-gradient italic font-newsreader">Archive</span>
                 </h1>
                 <p className="text-slate-400 font-medium text-base max-w-2xl leading-relaxed">
                    Over 100+ professional LaTeX formats for high-impact publishing.
                 </p>
              </div>

              <div className="flex items-center gap-4 w-full lg:w-auto">
                 <div className="relative flex-1 lg:w-[300px]">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                    <input 
                       type="text"
                       placeholder="Search archives..."
                       value={searchQuery}
                       onChange={(e) => setSearchQuery(e.target.value)}
                       className="w-full h-12 pl-12 pr-6 bg-white border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-primary-joy transition-all shadow-sm"
                    />
                 </div>
                  <button 
                    disabled
                    className="h-12 px-6 bg-slate-200 text-slate-400 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-3 cursor-not-allowed opacity-50"
                    title="Template upload is disabled"
                  >
                     <Upload size={16} /> Upload ZIP (Disabled)
                  </button>
              </div>
           </div>
        </div>

        {/* --- CATEGORY TABS --- */}
        <div className="max-w-6xl mx-auto mb-8 space-y-4">
           <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2">
              {categories.map((cat) => (
                 <button
                   key={cat.name}
                   onClick={() => { setActiveCategory(cat.name); setActiveSubCategory("All"); }}
                   className={`h-11 px-6 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center gap-3 whitespace-nowrap border-2 ${
                     activeCategory === cat.name 
                       ? "bg-slate-900 text-white border-slate-900 shadow-md" 
                       : "bg-white text-slate-500 border-slate-200 hover:border-primary-joy/30"
                   }`}
                 >
                   {cat.icon}
                   {cat.name}
                 </button>
              ))}
           </div>

           {subCategories.length > 1 && (
              <div className="flex items-center gap-2 flex-wrap pt-4 border-t border-slate-100">
                 {subCategories.map((sub) => (
                    <button
                      key={sub}
                      onClick={() => setActiveSubCategory(sub)}
                      className={`px-4 py-2 rounded-lg text-[11px] font-bold transition-all border-2 ${
                        activeSubCategory === sub 
                          ? "bg-primary-joy text-white border-primary-joy" 
                          : "bg-white text-slate-500 border-slate-100 hover:border-slate-300"
                      }`}
                    >
                      {sub}
                    </button>
                 ))}
              </div>
           )}
        </div>

        {/* --- TEMPLATE GRID --- */}
        <div className="max-w-6xl mx-auto">
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-6">
              <AnimatePresence mode="popLayout">
                 {filteredTemplates.map((tpl, idx) => (
                     <motion.div
                       key={tpl.id}
                       layout
                       initial={{ opacity: 0, y: 10 }}
                       animate={{ opacity: 1, y: 0 }}
                       exit={{ opacity: 0, scale: 0.95 }}
                       transition={{ delay: idx * 0.01 }}
                       className={`group relative bg-[var(--card-bg)] rounded-2xl p-3.5 cursor-pointer overflow-hidden flex flex-col min-h-[240px] h-auto border-2 transition-all duration-300 shadow-[0_4px_12px_-2px_rgba(0,0,0,0.05)] hover:shadow-joy-premium ${
                         selected === tpl.id ? "border-primary-joy bg-white" : "border-slate-200 hover:border-primary-joy/40"
                       }`}
                       onClick={() => handleCardClick(tpl.id)}
                     >
                       <div className="relative z-10 flex flex-col h-full">
                          <div className="flex justify-between items-start mb-2.5">
                             <div className="w-8 h-8 rounded-lg bg-white shadow-sm overflow-hidden flex items-center justify-center p-1.5 border border-slate-100 group-hover:-translate-y-0.5 transition-all">
                                <TemplateIcon src={tpl.icon} label={tpl.label} category={tpl.category} />
                             </div>
                              {(tpl.assetFolder || tpl.isCustom) && (
                                 <div className="flex items-center gap-1.5">
                                    <button 
                                      onClick={(e) => {
                                         e.stopPropagation();
                                         setSelected(tpl.id);
                                         setPendingTemplateId(tpl.id);
                                         setShowManageModal(true);
                                      }}
                                      className="p-1 text-slate-300 hover:text-primary-joy transition-colors bg-white rounded-md border border-slate-100 hover:border-primary-joy/20 shadow-sm"
                                      title="Manage Template Files"
                                    >
                                       <Settings size={10} />
                                    </button>
                                    {tpl.isCustom && (
                                       <button 
                                         onClick={(e) => handleDeleteTemplate(e, tpl.id)}
                                         className="p-1 text-slate-300 hover:text-rose-500 transition-colors bg-white rounded-md border border-slate-100 hover:border-rose-100 shadow-sm"
                                         title="Delete Template"
                                       >
                                          <Trash2 size={10} />
                                       </button>
                                    )}
                                    <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[6px] font-black uppercase tracking-widest border ${
                                      tpl.isCustom ? "bg-blue-50 text-blue-600 border-blue-100" : "bg-emerald-50 text-emerald-600 border-emerald-100"
                                    }`}>
                                       {tpl.isCustom ? "Custom" : "Pro"}
                                    </div>
                                 </div>
                              )}
                          </div>

                          <div className="flex-1 space-y-1">
                             <span className="text-[7.5px] font-black uppercase tracking-[0.15em] text-primary-joy/60">{tpl.publisher || (tpl.isCustom ? "User Content" : "LaTeX Archive")}</span>
                             <h3 className="text-sm font-black tracking-tight text-slate-900 leading-tight group-hover:text-primary-joy transition-colors line-clamp-2">
                                {tpl.label}
                             </h3>
                             <p className="text-slate-500 text-[10px] font-medium line-clamp-2 leading-snug">
                                {tpl.desc}
                             </p>
                          </div>

                           <div className="mt-2 pt-2 border-t border-slate-100 flex flex-col gap-2.5">
                              <div className="flex flex-wrap gap-1.5">
                                 {tpl.fileExtensions?.map(ext => (
                                    <span key={ext} className="px-1 py-0.5 rounded-md bg-slate-100/60 text-slate-400 text-[10px] font-black uppercase tracking-widest border border-slate-200/40">
                                       {ext.startsWith('.') ? ext : `.${ext}`}
                                    </span>
                                 ))}
                                 {(!tpl.fileExtensions || tpl.fileExtensions.length === 0) && (
                                    <span className="px-1 py-0.5 rounded-md bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-widest italic">
                                       .source
                                    </span>
                                 )}
                              </div>
                              <div className="flex items-center justify-between">
                                 <div className="flex flex-col gap-0.5">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Quality</span>
                                    <div className="flex gap-0.5">
                                       {[1,2,3,4,5].map(i => (
                                          <div key={i} className={`w-1.5 h-0.5 rounded-full ${i <= (tpl.isCustom ? 5 : 4) ? "bg-primary-joy/30" : "bg-slate-100"}`} />
                                       ))}
                                    </div>
                                 </div>
                                 <button 
                                   onClick={(e) => handleApplyClick(e, tpl.id)}
                                   className={`h-6 px-2.5 rounded-md font-black text-[7px] uppercase tracking-widest flex items-center gap-1.5 transition-all shadow-sm ${
                                     selected === tpl.id 
                                       ? "bg-primary-joy text-white" 
                                       : "bg-white text-slate-600 border border-slate-100 hover:bg-slate-900 hover:text-white group-hover:border-transparent group-hover:shadow-md"
                                   }`}
                                 >
                                    Use this Template
                                    <ArrowUpRight size={8} />
                                 </button>
                              </div>
                           </div>
                       </div>
                    </motion.div>
                 ))}
               </AnimatePresence>
            </div>
         </div>

         <AnimatePresence>
            {showManageModal && (
               <div className="fixed inset-0 flex items-center justify-center p-6 bg-slate-900/95 backdrop-blur-md" style={{ zIndex: 9999 }}>
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9, y: 40 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 40 }}
                    className="w-full max-w-4xl rounded-[2.5rem] p-10 border border-slate-200 shadow-2xl relative overflow-hidden"
                    style={{ backgroundColor: 'var(--card-bg)', opacity: 1 }}
                  >
                     <div className="absolute top-0 right-0 w-64 h-64 bg-primary-joy/5 rounded-full -mr-32 -mt-32 blur-[80px]" />
                     <button 
                       onClick={() => { setShowManageModal(false); setManageFile(null); }}
                       className="absolute top-6 right-6 p-2 text-slate-300 hover:text-slate-900 transition-colors z-20 bg-slate-50 rounded-xl border border-slate-100"
                     ><X size={18} /></button>
                     <div className="space-y-8 relative z-10">
                        <div className="space-y-2">
                           <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-900 text-white text-[9px] font-black uppercase tracking-[0.2em] rounded-full"><Command size={10} /> Template Hardening</div>
                           <h2 className="text-2xl font-black text-slate-900 tracking-tight">Manage {allTemplates.find(t => t.id === pendingTemplateId)?.label}</h2>
                           <p className="text-slate-400 text-xs font-medium leading-relaxed">Replace specific template components with high-fidelity versions.</p>
                        </div>
                        <div className="space-y-6">
                           <div className="space-y-3">
                              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Select File Type</label>
                              <div className="flex flex-wrap gap-2">
                                 {fileTypes.map((type) => (
                                    <button key={type.value} onClick={() => setSelectedFileType(type.value)}
                                      className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all border-2 ${selectedFileType === type.value ? "bg-primary-joy text-white border-primary-joy shadow-md shadow-primary-joy/20" : "bg-white text-slate-500 border-slate-100 hover:border-slate-300"}`}>{type.label}</button>
                                 ))}
                              </div>
                           </div>
                           <div className="space-y-3">
                              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Upload Replacement (Disabled)</label>
                              <div className="w-full h-40 border-2 border-dashed border-slate-100 rounded-3xl flex flex-col items-center justify-center gap-4 bg-slate-100/50 cursor-not-allowed opacity-60 shadow-inner">
                                 <div className="w-12 h-12 bg-slate-200 rounded-2xl shadow-sm flex items-center justify-center text-slate-400 border border-slate-100"><Upload size={20} /></div>
                                 <div className="text-center"><span className="block text-[11px] font-black text-slate-400 uppercase tracking-widest">Upload Disabled</span><span className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">Source file modification is locked</span></div>
                              </div>
                           </div>
                        </div>
                        <div className="flex gap-4 pt-2">
                           <button disabled className="flex-1 h-16 bg-slate-300 text-slate-400 rounded-[1.25rem] font-black text-[11px] uppercase tracking-[0.2em] cursor-not-allowed opacity-50 flex items-center justify-center gap-3"><Zap size={20} /> Update File (Disabled)</button>
                           <button onClick={() => setShowModal(true)} className="h-16 px-8 bg-white border-2 border-slate-100 text-slate-600 rounded-[1.25rem] font-black text-[11px] uppercase tracking-widest hover:border-primary-joy hover:text-primary-joy transition-all flex items-center gap-3 shadow-sm">Use Template <ArrowUpRight size={18} /></button>
                        </div>
                     </div>
                  </motion.div>
               </div>
            )}
         </AnimatePresence>

         <AnimatePresence>
            {showModal && (
               <div className="fixed inset-0 flex items-center justify-center p-6 bg-slate-900/90 backdrop-blur-xl" style={{ zIndex: 9999 }}>
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95, y: 30 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 30 }}
                    className="w-full max-w-4xl rounded-[3rem] p-8 md:p-12 border-2 border-primary-joy/20 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.2)] relative overflow-hidden"
                    style={{ backgroundColor: 'var(--card-bg)', opacity: 1 }}
                  >
                     <div className="absolute top-0 right-0 w-64 h-64 bg-primary-joy/5 rounded-full -mr-32 -mt-32 blur-[80px]" />
                     <button onClick={() => setShowModal(false)} className="absolute top-6 right-6 p-2 text-slate-300 hover:text-slate-900 transition-colors z-20 bg-slate-50 rounded-xl border border-slate-100"><X size={18} /></button>
                     <div className="space-y-10 relative z-10">
                        <div className="space-y-4 text-center">
                           <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary-joy/5 text-primary-joy text-[10px] font-black uppercase tracking-widest rounded-full border border-primary-joy/10 mx-auto"><Zap size={14} /> Workflow Selection</div>
                           <h2 className="text-3xl font-black tracking-tight text-slate-900">Choose Your Studio</h2>
                           <p className="text-slate-400 font-medium text-base leading-relaxed max-w-full mx-auto">Select the optimized environment for this template. You can switch later if needed.</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                           <button onClick={() => handleApplyFinal('latexify')} className="group relative p-10 rounded-[2rem] border-2 border-outline-joy/10 hover:border-primary-joy bg-white hover:bg-primary-joy/[0.02] transition-all text-center space-y-5 shadow-sm hover:shadow-joy-premium flex flex-col items-center">
                              <div className="w-16 h-16 rounded-2xl bg-primary-joy/10 flex items-center justify-center text-primary-joy group-hover:scale-110 transition-transform duration-500 mx-auto"><Monitor size={32} /></div>
                              <div className="space-y-2"><h3 className="text-2xl font-black text-slate-800 tracking-tight">Latexify Studio</h3><p className="text-sm text-slate-400 font-medium leading-relaxed max-w-xs mx-auto">Full-featured LaTeX IDE with real-time sync, PDF preview, and version control.</p></div>
                              <div className="flex items-center gap-2 text-[10px] font-black text-primary-joy uppercase tracking-widest transition-all">Launch Now <ArrowUpRight size={14} /></div>
                           </button>
                           <button onClick={() => handleApplyFinal('doc2latex')} className="group relative p-10 rounded-[2rem] border-2 border-outline-joy/10 hover:border-primary-joy bg-white hover:bg-primary-joy/[0.02] transition-all text-center space-y-5 shadow-sm hover:shadow-joy-premium flex flex-col items-center">
                              <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 group-hover:scale-110 transition-transform duration-500 mx-auto"><Sparkles size={32} /></div>
                              <div className="space-y-2"><h3 className="text-2xl font-black text-slate-800 tracking-tight">Doc2Latex</h3><p className="text-sm text-slate-400 font-medium leading-relaxed max-w-xs mx-auto">AI-powered document parser and automatic manuscript format converter.</p></div>
                              <div className="flex items-center gap-2 text-[10px] font-black text-emerald-500 uppercase tracking-widest transition-all">Launch Now <ArrowUpRight size={14} /></div>
                           </button>
                        </div>
                     </div>
                  </motion.div>
               </div>
            )}
         </AnimatePresence>

         <AnimatePresence>
            {showUploadModal && (
               <div className="fixed inset-0 flex items-center justify-center p-6 bg-slate-900/90 backdrop-blur-xl" style={{ zIndex: 9999 }}>
                  <motion.div 
                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 20, scale: 0.95 }}
                    className="w-full max-w-4xl rounded-[3rem] p-8 md:p-12 border-2 border-slate-200 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.15)] relative overflow-hidden"
                    style={{ backgroundColor: 'var(--card-bg)', opacity: 1 }}
                  >
                     <div className="absolute top-0 left-0 w-48 h-48 bg-primary-joy/5 rounded-full -ml-24 -mt-24 blur-[60px]" />
                     <button onClick={() => setShowUploadModal(false)} className="absolute top-8 right-8 p-3 text-slate-300 hover:text-slate-900 bg-slate-50 rounded-2xl border border-slate-100 transition-all z-20"><X size={20} /></button>
                     <form onSubmit={handleUpload} className="space-y-8 relative z-10">
                        <div className="space-y-3">
                           <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary-joy/5 text-primary-joy text-[10px] font-black uppercase tracking-widest rounded-full border border-primary-joy/10"><FileArchive size={14} /> Repository Expansion</div>
                           <h2 className="text-3xl font-black text-slate-900 tracking-tight">Upload Custom Template</h2>
                           <p className="text-sm text-slate-400 font-medium leading-relaxed">Add your own professional formats to the Scholarly Archive. Ensure your ZIP includes all .tex, .cls, and .bst files.</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                           <div className="space-y-6">
                              <div className="space-y-1.5">
                                 <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Template Name</label>
                                 <input required type="text" placeholder="e.g., Nature Physics Revised" value={uploadForm.name} onChange={(e) => setUploadForm({...uploadForm, name: e.target.value})} className="w-full h-13 px-5 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:border-primary-joy focus:bg-white transition-all shadow-sm" />
                              </div>
                              <div className="space-y-1.5">
                                 <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Category</label>
                                 <div className="relative">
                                    <select value={uploadForm.category} onChange={(e) => { const newCat = e.target.value; const subs = new Set<string>(); TEMPLATE_REGISTRY.forEach(t => { if (t.category === newCat && t.subCategory && t.subCategory !== "multidisciplinary") subs.add(t.subCategory); }); subs.add("General"); setUploadForm({...uploadForm, category: newCat, subCategory: Array.from(subs)[0]}); }} className="w-full h-13 px-5 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:border-primary-joy focus:bg-white transition-all appearance-none cursor-pointer">{categories.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}</select>
                                    <ChevronRight className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 rotate-90" size={16} />
                                 </div>
                              </div>
                              <div className="space-y-1.5">
                                 <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Research Field</label>
                                 <div className="relative">
                                    <select value={uploadForm.subCategory} onChange={(e) => setUploadForm({...uploadForm, subCategory: e.target.value})} className="w-full h-13 px-5 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:border-primary-joy focus:bg-white transition-all appearance-none cursor-pointer">{dynamicSubCategoryList.map(s => <option key={s} value={s}>{s}</option>)}</select>
                                    <ChevronRight className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 rotate-90" size={16} />
                                 </div>
                              </div>
                           </div>
                           <div className="space-y-1.5">
                              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Source Archive</label>
                              <div onClick={() => fileInputRef.current?.click()} className="w-full h-full min-h-[220px] border-2 border-dashed border-slate-200 rounded-3xl flex flex-col items-center justify-center gap-4 bg-slate-50 hover:bg-white hover:border-primary-joy/50 transition-all cursor-pointer group shadow-inner">
                                 <div className="w-14 h-14 bg-white rounded-2xl shadow-sm flex items-center justify-center text-slate-400 group-hover:scale-110 group-hover:text-primary-joy transition-all border border-slate-100"><Upload size={24} /></div>
                                 <div className="text-center space-y-1 px-4"><span className="block text-[11px] font-black text-slate-900 uppercase tracking-widest">{fileInputRef.current?.files?.[0]?.name || "Select ZIP File"}</span><span className="block text-[9px] font-bold text-slate-400">Max size 25MB • .zip only</span></div>
                                 <input ref={fileInputRef} type="file" accept=".zip" className="hidden" onChange={() => setUploadForm({...uploadForm})} />
                              </div>
                           </div>
                        </div>
                        <button type="submit" disabled={uploading} className="w-full h-16 bg-slate-900 text-white rounded-[1.5rem] font-black text-[11px] uppercase tracking-[0.25em] shadow-xl hover:bg-primary-joy transition-all flex items-center justify-center gap-4 disabled:opacity-50 active:scale-[0.98]">{uploading ? <><Loader2 size={20} className="animate-spin" /> Analyzing Package...</> : <><Zap size={20} /> Integrate into Archive</>}</button>
                     </form>
                  </motion.div>
               </div>
            )}
         </AnimatePresence>

         <ProjectLimitModal isOpen={showLimitModal} onClose={() => setShowLimitModal(false)} />

         <div className="mt-16 -mx-6 lg:-mx-10">
           <SiteFooter />
         </div>
      </main>
    </div>
  );
}

export default function TemplatesPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background-joy flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary-joy/10 border-t-primary-joy rounded-full animate-spin" />
      </div>
    }>
      <TemplatesContent />
    </Suspense>
  );
}
