"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSession } from "@/lib/pb-auth-react";
import {
  Search, BookOpen, Copy, ChevronRight, Sparkles, Plus, FileText, Edit2,
  Globe, Download, Book, X, List, Loader2, LayoutPanelLeft, Trash, Settings,
  ChevronDown, Keyboard, PanelLeftClose, PanelLeftOpen, ShieldCheck, AlertCircle,
  Video, Newspaper, Gavel, GraduationCap, MoreVertical, Database, Cpu, Folder, CloudUpload
} from "lucide-react";
import { toast } from "react-hot-toast";
import { saveAs } from "file-saver";
import { Document, Packer, Paragraph, TextRun, AlignmentType } from "docx";

// --- TYPES ---
interface Contributor {
  role: string;
  first: string;
  middle?: string;
  last: string;
  suffix?: string;
}

interface Citation {
  id: string;
  sourceType: string;
  title: string;
  authors: string;
  authorList?: Contributor[];
  year: string;
  month?: string;
  day?: string;
  sourceName: string;
  doi?: string;
  isbn?: string;
  url?: string;
  publisher?: string;
  publisherCity?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  edition?: string;
  publicationStatus?: string;
  database?: string;
  annotation?: string;
  accessDate?: string;
  formatted?: string;
  inText?: string;
  dateAdded: Date;
  suggestions?: number;
  inTextOptions?: {
    locationType: string;
    locationValue: string;
    suppressAuthor: boolean;
    suppressYear: boolean;
  };
}

interface CitationList {
  id: string;
  name: string;
  _count?: { citations: number };
}

interface Folder {
  id: string;
  name: string;
  lists: CitationList[];
}

const POPULAR_STYLES = [
  "APA 7th edition", "MLA 9th edition", "Chicago 17th (Author-Date)", 
  "Harvard", "Vancouver", "IEEE", "AMA 11th edition"
];

const SOURCE_TYPES = [
  { id: 'journal', label: 'Journal Article', icon: <FileText size={18} /> },
  { id: 'book', label: 'Book', icon: <Book size={18} /> },
  { id: 'website', label: 'Website', icon: <Globe size={18} /> },
  { id: 'video', label: 'Online Video', icon: <Video size={18} /> },
  { id: 'news', label: 'News Article', icon: <Newspaper size={18} /> },
  { id: 'legal', label: 'Legal Case', icon: <Gavel size={18} /> },
  { id: 'thesis', label: 'Thesis/Dissertation', icon: <GraduationCap size={18} /> },
  { id: 'patent', label: 'Patent', icon: <ShieldCheck size={18} /> },
  { id: 'software', label: 'Software', icon: <Cpu size={18} /> },
  { id: 'dataset', label: 'Dataset', icon: <Database size={18} /> },
];

export default function CitationGeneratorPage() {
  const { data: session } = useSession();
  const [query, setQuery] = useState("");
  const [folders, setFolders] = useState<Folder[]>([
    { id: '1', name: 'My Projects', lists: [{ id: 'l1', name: 'References', _count: { citations: 0 } }] }
  ]);
  const [activeListId, setActiveListId] = useState("l1");
  const [citations, setCitations] = useState<Citation[]>([]);
  const [selectedCitation, setSelectedCitation] = useState<Citation | null>(null);
  const [checkedIds, setCheckedIds] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<"bibliography" | "in-text">("bibliography");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [showStyleSelector, setShowStyleSelector] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState("APA 7th edition");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Citation[] | null>(null);

  const [activeRowMenu, setActiveRowMenu] = useState<string | null>(null);

  // Manual Entry / Edit State
  const [manualData, setManualData] = useState<Partial<Citation>>({
    sourceType: "journal",
    title: "",
    authorList: [{ role: "Author", first: "", last: "" }],
    year: "",
    sourceName: "",
    doi: "",
    url: "",
    publicationStatus: "Published",
    accessDate: new Date().toISOString().split('T')[0]
  });

  const accentGreen = "#00a86b";

  useEffect(() => {
    const savedFolders = localStorage.getItem("ss_folders");
    if (savedFolders) setFolders(JSON.parse(savedFolders));
    
    const savedCitations = localStorage.getItem(`ss_citations_${activeListId}`);
    if (savedCitations) setCitations(JSON.parse(savedCitations));
  }, [activeListId]);

  useEffect(() => {
    if (folders.length > 0) localStorage.setItem("ss_folders", JSON.stringify(folders));
  }, [folders]);

  useEffect(() => {
    localStorage.setItem(`ss_citations_${activeListId}`, JSON.stringify(citations));
  }, [citations, activeListId]);

  const handleAutocite = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;
    setIsSearching(true);
    setSearchResults(null);
    try {
      const res = await fetch('/api/citations/autocite', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ identifier: query }) 
      });
      const data = await res.json();
      if (res.ok) {
        if (data.results) setSearchResults(data.results);
        else addCitation(data);
      } else toast.error(data.error || "Search failed");
    } catch { toast.error("Search failed"); } finally { setIsSearching(false); }
  };

  const addCitation = async (cit: any) => {
    const authorStr = cit.authors || "Unknown Author";
    const primaryAuthor = authorStr.split(';')[0].split(',')[0].trim();
    
    const newCitation: Citation = {
      ...cit,
      id: Math.random().toString(36).substr(2, 9),
      dateAdded: new Date(),
      formatted: formatCitation(cit, selectedStyle),
      inText: `(${primaryAuthor}, ${cit.year || "n.d."})`,
      inTextOptions: { locationType: "Page", locationValue: "", suppressAuthor: false, suppressYear: false }
    };
    
    setCitations([newCitation, ...citations]);
    setSearchResults(null);
    setQuery("");
    toast.success("Added to list");
  };

  const formatCitation = (cit: any, style: string) => {
    const authors = cit.authors || "Unknown Author";
    const year = cit.year || "n.d.";
    const title = cit.title || "Untitled";
    const source = cit.sourceName || "";
    
    if (style.includes("APA")) {
      return `${authors}. (${year}). ${title}. ${source}.`;
    } else if (style.includes("MLA")) {
      return `${authors}. "${title}." ${source}, ${year}.`;
    }
    return `${authors} (${year}). ${title}. ${source}.`;
  };

  const toggleCheck = (id: string) => {
    setCheckedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleExportWord = async () => {
    const targetCitations = checkedIds.length > 0 ? citations.filter(c => checkedIds.includes(c.id)) : citations;
    if (targetCitations.length === 0) return toast.error("Nothing to export");

    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          new Paragraph({
            children: [new TextRun({ text: "References", bold: true, size: 28 })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 }
          }),
          ...targetCitations.map(cit => new Paragraph({
            children: [new TextRun({ text: cit.formatted || "" })],
            spacing: { after: 200 }
          }))
        ]
      }]
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, "Bibliography.docx");
    toast.success("Bibliography exported");
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const authorStr = manualData.authorList?.map(a => `${a.last}, ${a.first}`).join('; ') || "Unknown Author";
    const primaryAuthor = manualData.authorList?.[0]?.last || "Unknown";
    
    const newCitation: Citation = {
      ...(manualData as Citation),
      authors: authorStr,
      id: selectedCitation?.id || Math.random().toString(36).substr(2, 9),
      dateAdded: new Date(),
      formatted: formatCitation({ ...manualData, authors: authorStr }, selectedStyle),
      inText: `(${primaryAuthor}, ${manualData.year || "n.d."})`,
      inTextOptions: { locationType: "Page", locationValue: "", suppressAuthor: false, suppressYear: false }
    };

    if (selectedCitation) {
      setCitations(citations.map(c => c.id === selectedCitation.id ? newCitation : c));
      setSelectedCitation(newCitation);
    } else {
      setCitations([newCitation, ...citations]);
    }
    
    setShowManualModal(false);
    toast.success(selectedCitation ? "Updated" : "Created");
  };

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontFamily: 'Inter, sans-serif', overflow: 'hidden' }}>
      
      {/* 1. APP BAR */}
      <div style={{ width: '68px', background: '#1a1c2e', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '1.25rem 0', gap: '1.5rem', zIndex: 100 }}>
        <div style={{ width: '32px', height: '32px', background: accentGreen, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Sparkles size={20} color="#fff" /></div>
        <div style={{ height: '1px', width: '30px', background: 'rgba(255,255,255,0.1)' }} />
        <AppBarIcon icon={<List size={22} />} active />
        <AppBarIcon icon={<Edit2 size={22} />} />
        <AppBarIcon icon={<Search size={22} />} />
        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '1.5rem', alignItems: 'center' }}>
          <AppBarIcon icon={<Settings size={22} />} />
          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#4a4a4a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.8rem', fontWeight: 700 }}>
            {session?.user?.name?.[0] || 'U'}
          </div>
        </div>
      </div>

      <main style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        
        {/* 2. SIDEBAR */}
        <AnimatePresence>
          {!isSidebarCollapsed && (
            <motion.div initial={{ width: 0 }} animate={{ width: '280px' }} exit={{ width: 0 }} style={{ background: 'var(--bg-primary)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', padding: '1.5rem 1rem', overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}>
                <button style={{ padding: '0.65rem 1.25rem', borderRadius: '24px', border: 'none', background: '#e9f5ef', fontWeight: 700, color: accentGreen, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Plus size={18} /> New list</button>
                <PanelLeftClose size={20} color="#8c8c8c" cursor="pointer" onClick={() => setIsSidebarCollapsed(true)} />
              </div>
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {folders.map(folder => (
                  <div key={folder.id} style={{ marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0.75rem', color: '#1a1c2e', fontWeight: 700, fontSize: '0.9rem' }}><ChevronDown size={14} /><Folder size={16} color="#8c8c8c" /> {folder.name}</div>
                    {folder.lists.map(list => (
                      <div key={list.id} onClick={() => setActiveListId(list.id)} style={{ padding: '0.6rem 1rem 0.6rem 2.5rem', borderRadius: '10px', background: activeListId === list.id ? 'var(--bg-tertiary)' : 'transparent', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', color: activeListId === list.id ? 'var(--accent-primary)' : 'var(--text-secondary)' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: activeListId === list.id ? 700 : 500 }}>{list.name}</span>
                        <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>{list._count?.citations || 0}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {isSidebarCollapsed && (
          <div onClick={() => setIsSidebarCollapsed(false)} style={{ width: '40px', background: 'var(--bg-primary)', borderRight: '1px solid var(--border)', display: 'flex', justifyContent: 'center', paddingTop: '1.5rem', cursor: 'pointer' }}><PanelLeftOpen size={20} color="#8c8c8c" /></div>
        )}

        {/* 3. WORKSPACE */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
            
            {/* Header */}
            <div style={{ padding: '1.5rem 2.5rem', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>References</h1>
                  <div onClick={() => setShowStyleSelector(true)} style={{ fontSize: '0.85rem', color: accentGreen, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>{selectedStyle} <ChevronDown size={14} /></div>
                </div>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <div style={{ display: 'flex', background: 'var(--bg-tertiary)', borderRadius: '20px', padding: '2px' }}>
                    <button onClick={() => setViewMode("bibliography")} style={{ padding: '0.4rem 1.25rem', borderRadius: '18px', fontSize: '0.8rem', fontWeight: 700, background: viewMode === "bibliography" ? 'var(--bg-primary)' : 'transparent', color: viewMode === "bibliography" ? 'var(--accent-primary)' : 'var(--text-secondary)', border: 'none', cursor: 'pointer' }}>Bibliography</button>
                    <button onClick={() => setViewMode("in-text")} style={{ padding: '0.4rem 1.25rem', borderRadius: '18px', fontSize: '0.8rem', fontWeight: 700, background: viewMode === "in-text" ? 'var(--bg-primary)' : 'transparent', color: viewMode === "in-text" ? 'var(--accent-primary)' : 'var(--text-secondary)', border: 'none', cursor: 'pointer' }}>In-text</button>
                  </div>
                  <button onClick={handleExportWord} className="btn btn-secondary"><Download size={18} /> Export</button>
                </div>
              </div>

              {/* Search Bar */}
              <div style={{ marginTop: '2.5rem', maxWidth: '850px', margin: '2.5rem auto 0' }}>
                <div style={{ display: 'flex', border: '2px solid var(--border)', borderRadius: '50px', padding: '0.7rem 0.7rem 0.7rem 2.5rem', position: 'relative', background: 'var(--bg-primary)', boxShadow: '0 4px 20px rgba(0,0,0,0.04)' }}>
                  <Search size={22} color="#8c8c8c" />
                  <form onSubmit={handleAutocite} style={{ flex: 1, display: 'flex' }}>
                    <input placeholder="Search keywords, DOI, ISBN, or URL..." value={query} onChange={e => setQuery(e.target.value)} style={{ flex: 1, border: 'none', outline: 'none', fontSize: '1.1rem', paddingLeft: '1rem', background: 'transparent', color: 'var(--text-primary)' }} />
                    <button type="submit" style={{ background: accentGreen, color: '#fff', border: 'none', padding: '0.75rem 2.5rem', borderRadius: '35px', fontWeight: 800, cursor: 'pointer' }}>
                      {isSearching ? <Loader2 size={20} className="animate-spin" /> : "Cite"}
                    </button>
                  </form>
                  <SearchResultsOverlay />
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '4rem', marginTop: '1.75rem' }}>
                  <button onClick={() => setShowUploadModal(true)} style={{ background: 'transparent', border: 'none', color: accentGreen, fontWeight: 800, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer' }}><CloudUpload size={20} /> Upload PDF</button>
                  <button onClick={() => { setManualData({ sourceType: "journal", authorList: [{ role: "Author", first: "", last: "" }] }); setShowManualModal(true); }} style={{ background: 'transparent', border: 'none', color: accentGreen, fontWeight: 800, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer' }}><Keyboard size={20} /> Cite manually</button>
                </div>
              </div>
            </div>

            {/* Citations List */}
            <div style={{ flex: 1, overflowY: 'auto', paddingBottom: '6rem' }}>
              {citations.length === 0 ? (
                <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.5 }}>
                  <BookOpen size={64} color="#e5e9e7" />
                  <p style={{ marginTop: '1rem', fontWeight: 600 }}>Your bibliography is empty. Start by searching above!</p>
                </div>
              ) : citations.map(cit => (
                <div 
                  key={cit.id} 
                  onClick={() => setSelectedCitation(cit)} 
                  style={{ 
                    padding: '1.5rem 2.5rem', display: 'flex', gap: '1.5rem', borderBottom: '1px solid var(--border)', 
                    background: selectedCitation?.id === cit.id ? 'var(--bg-secondary)' : 'transparent',
                    position: 'relative'
                  }} 
                  className="group"
                >
                  <input type="checkbox" checked={checkedIds.includes(cit.id)} onChange={(e) => { e.stopPropagation(); toggleCheck(cit.id); }} style={{ width: '20px', height: '20px', accentColor: accentGreen, marginTop: '4px' }} />
                  <div style={{ flex: 1 }}>
                    {cit.suggestions ? <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#ff4d4f', fontSize: '0.75rem', fontWeight: 800, marginBottom: '0.4rem' }}><AlertCircle size={14} /> Missing critical info</div> : null}
                    <p style={{ fontSize: '1rem', lineHeight: '1.7', color: 'var(--text-primary)' }}>{viewMode === "bibliography" ? cit.formatted : cit.inText}</p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', opacity: 0 }} className="group-hover:opacity-100">
                    <button onClick={(e) => { e.stopPropagation(); toast.success("Copied!"); }} style={{ padding: '8px', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-primary)' }}><Copy size={16} color="#8c8c8c" /></button>
                    <button onClick={(e) => { e.stopPropagation(); setActiveRowMenu(cit.id); }} style={{ padding: '8px', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-primary)' }}><MoreVertical size={16} color="#8c8c8c" /></button>
                  </div>
                </div>
              ))}
            </div>

            {/* Bulk Action Bar */}
            <AnimatePresence>
              {checkedIds.length > 0 && (
                <motion.div initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }} style={{ position: 'absolute', bottom: '2rem', left: '50%', transform: 'translateX(-50%)', background: '#1a1c2e', borderRadius: '50px', padding: '0.8rem 2.5rem', display: 'flex', alignItems: 'center', gap: '2.5rem', zIndex: 200, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
                  <span style={{ color: 'var(--bg-primary)', fontWeight: 800 }}>{checkedIds.length} Selected</span>
                  <BulkBtn icon={<Copy size={18} />} label="Copy all" onClick={() => toast.success("Copied selected!")} />
                  <BulkBtn icon={<Download size={18} />} label="Export" onClick={handleExportWord} />
                  <BulkBtn icon={<Trash size={18} />} label="Delete" color="#ff4d4f" onClick={() => { setCitations(citations.filter(c => !checkedIds.includes(c.id))); setCheckedIds([]); }} />
                  <button onClick={() => setCheckedIds([])} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', padding: '0.5rem', borderRadius: '50%', color: 'var(--bg-primary)', cursor: 'pointer' }}><X size={16} /></button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* 5. INSPECTOR PANEL (FULL IMPLEMENTATION) */}
          <div style={{ width: '450px', background: 'var(--bg-secondary)', padding: '1.25rem', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ flex: 1, background: 'var(--bg-primary)', borderRadius: '24px', border: '1px solid var(--border)', padding: '2.5rem', overflowY: 'auto' }}>
              {selectedCitation ? (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
                    <h3 style={{ fontSize: '1.35rem', fontWeight: 900 }}>Edit Source</h3>
                    <X size={24} color="#8c8c8c" cursor="pointer" onClick={() => setSelectedCitation(null)} />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    <InspectorField label="Title" value={selectedCitation.title} />
                    <InspectorField label="Authors" value={selectedCitation.authors} />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <InspectorField label="Year" value={selectedCitation.year} />
                      <InspectorField label="Pages" value={selectedCitation.pages} />
                    </div>
                    <InspectorField label="Source Name" value={selectedCitation.sourceName} />
                    <InspectorField label="DOI / URL" value={selectedCitation.doi || selectedCitation.url} />
                    
                    <div style={{ marginTop: '1rem', padding: '1.5rem', background: 'var(--bg-tertiary)', borderRadius: '16px', border: '1.5px solid var(--border)' }}>
                      <h4 style={{ fontSize: '0.8rem', fontWeight: 900, color: accentGreen, textTransform: 'uppercase', marginBottom: '1rem' }}>In-text Preview</h4>
                      <p style={{ fontSize: '1.1rem', fontWeight: 700, textAlign: 'center' }}>{selectedCitation.inText}</p>
                    </div>

                    <button 
                      onClick={() => { setManualData(selectedCitation); setShowManualModal(true); }}
                      style={{ width: '100%', background: '#1a1c2e', color: 'var(--bg-primary)', border: 'none', padding: '1.15rem', borderRadius: '16px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', marginTop: '1rem' }}
                    >
                      <Edit2 size={18} /> Edit metadata
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
                  <LayoutPanelLeft size={64} color="#e5e9e7" style={{ marginBottom: '2rem' }} />
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Source Inspector</h3>
                  <p style={{ color: '#8c8c8c', fontSize: '0.95rem', maxWidth: '250px', margin: '1rem auto 0' }}>Select any citation to view full metadata, fix suggestions, or customize formats.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* 6. MODALS */}
      <AnimatePresence>
        {/* Manual Entry Modal (Full) */}
        {showManualModal && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(26,28,46,0.6)', backdropFilter: 'blur(6px)' }}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', borderRadius: '30px', width: '900px', height: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '2rem 3rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ fontSize: '1.75rem', fontWeight: 900 }}>{selectedCitation ? 'Edit Source' : 'Cite manually'}</h2>
                <X size={28} color="#8c8c8c" cursor="pointer" onClick={() => setShowManualModal(false)} />
              </div>

              <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                {/* Type Sidebar */}
                <div style={{ width: '260px', background: 'var(--bg-secondary)', borderRight: '1px solid var(--border)', padding: '1.5rem', overflowY: 'auto' }}>
                  <p style={{ fontSize: '0.75rem', fontWeight: 900, color: '#8c8c8c', textTransform: 'uppercase', marginBottom: '1.5rem' }}>Source Type</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {SOURCE_TYPES.map(type => (
                      <div 
                        key={type.id} 
                        onClick={() => setManualData({...manualData, sourceType: type.id})}
                        style={{ padding: '0.85rem 1rem', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', background: manualData.sourceType === type.id ? 'var(--bg-primary)' : 'transparent', color: manualData.sourceType === type.id ? accentGreen : 'var(--text-primary)', fontWeight: manualData.sourceType === type.id ? 800 : 500, boxShadow: manualData.sourceType === type.id ? '0 4px 12px rgba(0,0,0,0.05)' : 'none' }}
                      >
                        {type.icon} {type.label}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Form Content */}
                <div style={{ flex: 1, padding: '3rem', overflowY: 'auto' }}>
                  <form onSubmit={handleManualSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
                    <SettingField label="Full Title"><input placeholder="Article, Book, or Page title" value={manualData.title} onChange={e => setManualData({...manualData, title: e.target.value})} style={{ width: '100%', border: 'none', outline: 'none', fontSize: '1.1rem', fontWeight: 700 }} /></SettingField>
                    
                    <div>
                      <label style={{ fontSize: '0.8rem', fontWeight: 900, color: accentGreen, display: 'block', marginBottom: '1rem' }}>Contributors</label>
                      {manualData.authorList?.map((author, idx) => (
                        <div key={idx} style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                          <input placeholder="First name" value={author.first} onChange={e => {
                            const list = [...(manualData.authorList || [])];
                            list[idx].first = e.target.value;
                            setManualData({...manualData, authorList: list});
                          }} style={{ flex: 1, padding: '0.85rem', borderRadius: '12px', border: '2.5px solid var(--border)', fontWeight: 600 }} />
                          <input placeholder="Last name" value={author.last} onChange={e => {
                            const list = [...(manualData.authorList || [])];
                            list[idx].last = e.target.value;
                            setManualData({...manualData, authorList: list});
                          }} style={{ flex: 1, padding: '0.85rem', borderRadius: '12px', border: '2.5px solid var(--border)', fontWeight: 600 }} />
                        </div>
                      ))}
                      <button type="button" onClick={() => setManualData({...manualData, authorList: [...(manualData.authorList || []), { role: "Author", first: "", last: "" }]})} style={{ color: accentGreen, fontWeight: 800, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'transparent', border: 'none', cursor: 'pointer' }}><Plus size={16} /> Add contributor</button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '1.5rem' }}>
                      <SettingField label="Source Name"><input value={manualData.sourceName} onChange={e => setManualData({...manualData, sourceName: e.target.value})} style={{ width: '100%', border: 'none', outline: 'none' }} /></SettingField>
                      <SettingField label="Year"><input placeholder="YYYY" value={manualData.year} onChange={e => setManualData({...manualData, year: e.target.value})} style={{ width: '100%', border: 'none', outline: 'none' }} /></SettingField>
                      <SettingField label="Volume"><input value={manualData.volume} onChange={e => setManualData({...manualData, volume: e.target.value})} style={{ width: '100%', border: 'none', outline: 'none' }} /></SettingField>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem' }}>
                      <SettingField label="Issue"><input value={manualData.issue} onChange={e => setManualData({...manualData, issue: e.target.value})} style={{ width: '100%', border: 'none', outline: 'none' }} /></SettingField>
                      <SettingField label="Pages"><input value={manualData.pages} onChange={e => setManualData({...manualData, pages: e.target.value})} style={{ width: '100%', border: 'none', outline: 'none' }} /></SettingField>
                      <SettingField label="Edition"><input value={manualData.edition} onChange={e => setManualData({...manualData, edition: e.target.value})} style={{ width: '100%', border: 'none', outline: 'none' }} /></SettingField>
                    </div>

                    <SettingField label="URL / DOI"><input value={manualData.doi || manualData.url} onChange={e => setManualData({...manualData, url: e.target.value})} style={{ width: '100%', border: 'none', outline: 'none' }} /></SettingField>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1.5rem', marginTop: '2rem' }}>
                      <button type="button" onClick={() => setShowManualModal(false)} style={{ padding: '1rem 3rem', borderRadius: '40px', border: `2.5px solid ${accentGreen}`, background: 'var(--bg-primary)', color: accentGreen, fontWeight: 800, cursor: 'pointer' }}>Cancel</button>
                      <button type="submit" style={{ padding: '1rem 3rem', borderRadius: '40px', border: 'none', background: accentGreen, color: 'var(--bg-primary)', fontWeight: 800, cursor: 'pointer' }}>Save Citation</button>
                    </div>
                  </form>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* Style Selector Modal */}
        {showStyleSelector && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(26,28,46,0.6)', backdropFilter: 'blur(6px)' }}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', borderRadius: '24px', width: '550px', padding: '2.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}><h2 style={{ fontSize: '1.5rem', fontWeight: 900 }}>Citation Style</h2><X size={24} cursor="pointer" onClick={() => setShowStyleSelector(false)} /></div>
              <div style={{ background: 'var(--bg-secondary)', padding: '0.85rem 1.25rem', borderRadius: '15px', display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}><Search size={20} color="#8c8c8c" /><input placeholder="Search for styles..." style={{ background: 'transparent', border: 'none', outline: 'none', flex: 1, fontSize: '1rem', color: 'var(--text-primary)' }} /></div>
              <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
                {POPULAR_STYLES.map(s => (
                  <div key={s} onClick={() => { setSelectedStyle(s); setShowStyleSelector(false); setCitations(citations.map(c => ({...c, formatted: formatCitation(c, s)}))); }} style={{ padding: '0.85rem 1rem', borderRadius: '12px', cursor: 'pointer', background: selectedStyle === s ? 'var(--bg-secondary)' : 'transparent', color: selectedStyle === s ? accentGreen : 'var(--text-primary)', fontWeight: selectedStyle === s ? 800 : 500 }} className="hover:bg-gray-800/30">{s}</div>
                ))}
              </div>
            </motion.div>
          </div>
        )}

        {/* PDF Upload Modal */}
        {showUploadModal && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(26,28,46,0.6)', backdropFilter: 'blur(6px)' }}>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', borderRadius: '30px', width: '700px', overflow: 'hidden' }}>
              <div style={{ padding: '2rem 3rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 900 }}>Upload PDF</h2>
                <X size={28} color="#8c8c8c" cursor="pointer" onClick={() => setShowUploadModal(false)} />
              </div>
              <div style={{ padding: '4rem 3rem', textAlign: 'center' }}>
                <div style={{ border: '3px dashed var(--border)', borderRadius: '24px', padding: '4rem 2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', background: 'var(--bg-secondary)' }}>
                  <CloudUpload size={48} color={accentGreen} />
                  <div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 900 }}>Drag and drop a PDF file here</h3>
                    <p style={{ color: '#8c8c8c', marginTop: '0.5rem', fontWeight: 600 }}>We will extract the metadata automatically.</p>
                  </div>
                </div>
                <button style={{ marginTop: '3rem', background: 'var(--bg-secondary)', color: '#8c8c8c', padding: '1rem 3rem', borderRadius: '40px', fontWeight: 800, border: 'none', cursor: 'not-allowed' }}>Extract Metadata</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );

  function AppBarIcon({ icon, active = false }: { icon: React.ReactNode, active?: boolean }) { return <div style={{ width: '42px', height: '42px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: active ? 'rgba(255,255,255,0.1)' : 'transparent', color: active ? accentGreen : '#8c8c8c' }}>{icon}</div>; }
  function InspectorField({ label, value }: { label: string, value: any }) { return <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}><span style={{ fontSize: '0.75rem', fontWeight: 900, color: '#8c8c8c', textTransform: 'uppercase' }}>{label}</span><span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>{value || "---"}</span></div>; }
  function SettingField({ label, children }: { label: string, children: React.ReactNode }) { return <div style={{ padding: '1.25rem 1.5rem', border: '2.5px solid var(--border)', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>{label && <label style={{ fontSize: '0.8rem', fontWeight: 800, color: accentGreen }}>{label}</label>}{children}</div>; }
  function BulkBtn({ icon, label, onClick, color = 'var(--text-primary)' }: { icon: React.ReactNode, label: string, onClick: () => void, color?: string }) { return <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', background: 'transparent', border: 'none', color, fontSize: '0.9rem', fontWeight: 800, cursor: 'pointer' }}>{icon}{label}</button>; }
  function SearchResultsOverlay() { return <AnimatePresence>{searchResults && (
    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, background: 'var(--bg-primary)', borderRadius: '30px', border: '1.5px solid var(--border)', boxShadow: '0 30px 80px rgba(0,0,0,0.15)', marginTop: '10px', overflow: 'hidden' }}>
      <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
        {searchResults.map((res, i) => (
          <div key={i} onClick={() => addCitation(res)} style={{ padding: '1.25rem 2.5rem', cursor: 'pointer', borderBottom: '1px solid #f9fafb' }} className="hover:bg-gray-50">
            <h4 style={{ fontSize: '1rem', fontWeight: 800, display: 'flex', justifyContent: 'space-between' }}>{res.title} <ChevronRight size={18} color={accentGreen} /></h4>
            <p style={{ fontSize: '0.85rem', color: '#8c8c8c', marginTop: '0.4rem' }}>{res.year} · {res.authors} · {res.sourceName}</p>
          </div>
        ))}
      </div>
      <div style={{ padding: '1.25rem', textAlign: 'center', background: '#f8faf9', borderTop: '1px solid #f0f0f0' }}>
        <span onClick={() => setShowManualModal(true)} style={{ color: accentGreen, fontWeight: 800, cursor: 'pointer' }}>Can't find it? Cite manually</span>
      </div>
    </motion.div>
  )}</AnimatePresence>; }
}
