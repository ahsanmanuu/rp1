"use client";
import Link from 'next/link';
import Image from 'next/image';
import { useSession } from "@/lib/pb-auth-react";
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { StudioFS, type StudioProject } from '@/lib/studio-fs';
import { TEMPLATE_REGISTRY } from '@/lib/templates/registry';
import ProjectLimitModal from '@/components/ProjectLimitModal';
import { useProjectLimit } from '@/hooks/useProjectLimit';

export default function LaTeXStudioLanding() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [projects, setProjects] = useState<StudioProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('blank');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [fs, setFs] = useState<StudioFS | null>(null);
  const [customTemplates, setCustomTemplates] = useState<any[]>([]);
  const [showAllModal, setShowAllModal] = useState(false);
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'name-asc' | 'name-desc'>('date-desc');
  const [allFilterText, setAllFilterText] = useState('');
  const [isParsingZip, setIsParsingZip] = useState(false);
  const [dbProjectsCount, setDbProjectsCount] = useState(0);
  const [membership, setMembership] = useState("free");
  const { showLimitModal, setShowLimitModal } = useProjectLimit();

  const sortedProjects = [...projects]
    .filter(p => (p.title || '').toLowerCase().includes((allFilterText || '').toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'date-desc') return b.updatedAt - a.updatedAt;
      if (sortBy === 'date-asc') return a.updatedAt - b.updatedAt;
      if (sortBy === 'name-asc') return (a.title || '').localeCompare(b.title || '');
      if (sortBy === 'name-desc') return (b.title || '').localeCompare(a.title || '');
      return 0;
    });

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

  const categories = ['All', 'Custom', ...Array.from(new Set(TEMPLATE_REGISTRY.map(t => t.category)))];

  const filteredTemplates = allTemplates.filter(t => {
    const matchesSearch = t.label.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         t.desc.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || t.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  useEffect(() => {
    fetch('/api/templates', { cache: 'no-store' })
      .then(res => res.json())
      .then(data => setCustomTemplates(data.templates || []))
      .catch(console.error);

    fetch('/api/user/check-membership')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setDbProjectsCount(data.projectsCount || 0);
          setMembership(data.membership || "free");
        }
      })
      .catch(console.error);

    if (!session?.user?.email) return;
    const studioFs = new StudioFS(session.user.email);
    setFs(studioFs);
    studioFs.listProjects().then(ps => {
      setProjects(ps);
      setLoading(false);
    });
  }, [session]);

  const handleOpenNewModal = () => {
    const totalProjects = projects.length + dbProjectsCount;
    if (membership === "free" && totalProjects >= 7) {
      setShowLimitModal(true);
      return;
    }
    setSelectedTemplate('blank');
    setNewName('Blank Document Project');
    setShowNew(true);
  };

  const createProject = async () => {
    if (!fs || !newName.trim()) return;
    setCreating(true);
    try {
      const id = await fs.createProject(newName.trim(), selectedTemplate);
      router.push(`/latex-studio/${id}`);
    } finally {
      setCreating(false);
    }
  };

  const deleteProject = async (id: string) => {
    if (!window.confirm('Delete this project? This cannot be undone.')) return;
    try {
      const finalFs = fs || new StudioFS(session?.user?.email || 'guest');
      await finalFs.deleteProject(id);
      setProjects(ps => ps.filter(p => p.id !== id));
    } catch (err: any) {
      console.error('Failed to delete local project:', err);
      alert(`Failed to delete project: ${err.message}`);
    }
  };

  const downloadZip = async (projectId: string, projectName: string) => {
    try {
      const finalFs = fs || new StudioFS(session?.user?.email || 'guest');
      const blob = await finalFs.exportZip(projectId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${projectName}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert('Failed to export ZIP');
    }
  };

  const downloadPdf = async (projectId: string, projectName: string) => {
    try {
      const finalFs = fs || new StudioFS(session?.user?.email || 'guest');
      const proj = await finalFs.getProject(projectId);
      const files = await finalFs.listFiles(projectId);
      if (!proj) throw new Error("Project not found");
      
      const mainFile = proj.mainFile || 'main.tex';
      const mainFileObj = files.find(f => f.path === mainFile);
      const latexCode = mainFileObj ? mainFileObj.content : '';
      
      const res = await fetch('/api/latex-studio/compile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          mainFile,
          engine: proj.engine || 'pdflatex',
          files: files.map(f => ({ path: f.path, content: f.content }))
        })
      });
      
      const data = await res.json();
      if (!res.ok || !data.success || !data.pdfBase64) {
        throw new Error(data.error || 'Compilation failed');
      }
      
      const b64 = data.pdfBase64.startsWith('data:') ? data.pdfBase64 : `data:application/pdf;base64,${data.pdfBase64}`;
      const blobRes = await fetch(b64);
      const blob = await blobRes.blob();
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${projectName}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error(err);
      alert(`Failed to download PDF: ${err.message}`);
    }
  };

  if (status === 'loading') return <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', background: 'var(--background)' }}><div style={{ width: 40, height: 40, border: '3px solid #e0e0e0', borderTopColor: '#0f62fe', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /></div>;
  if (!session) return null;

  return (
    <div className="bg-background text-on-background min-h-screen flex flex-col font-body antialiased">
      <main className="flex-grow flex flex-col items-center w-full max-w-5xl mx-auto px-4 pt-24 pb-12 md:pb-16 gap-16">
        {/* Header & Actions */}
        <section className="flex flex-col items-center text-center gap-6 w-full max-w-2xl">
          <div className="w-16 h-16 bg-surface-container-high flex items-center justify-center mb-2">
            <span className="material-symbols-outlined text-4xl text-primary" data-icon="draw">draw</span>
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-headline font-semibold text-on-background tracking-tight mb-2">Latexify Studio</h1>
            <p className="text-on-surface-variant text-base md:text-lg">Your Personal Latex Editor</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 mt-4 w-full sm:w-auto">
            <button onClick={handleOpenNewModal} className="bg-primary text-on-primary px-6 py-3 font-semibold text-sm hover:bg-primary-fixed-dim transition-colors flex items-center justify-center gap-2 min-w-[160px] min-h-[48px]">
              <span className="material-symbols-outlined text-xl" data-icon="add">add</span>
              Create New Project
            </button>
            <label className="border border-primary text-primary px-6 py-3 font-semibold text-sm hover:bg-surface-container transition-colors flex items-center justify-center gap-2 min-w-[160px] min-h-[48px] cursor-pointer">
              <input
                type="file"
                accept=".zip"
                style={{ display: 'none' }}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file || !fs) return;

                  const totalProjects = projects.length + dbProjectsCount;
                  if (membership === "free" && totalProjects >= 7) {
                    setShowLimitModal(true);
                    return;
                  }

                  setIsParsingZip(true);
                  try {
                    const id = await fs.importZip(file);
                    router.push(`/latex-studio/${id}`);
                  } catch (err) {
                    console.error(err);
                    alert("Failed to process document ZIP");
                    setIsParsingZip(false);
                  }
                }}
              />
              <span className="material-symbols-outlined text-xl" data-icon="file_upload">file_upload</span>
              Import ZIP
            </label>
            <Link href="/dashboard" className="border border-secondary text-secondary px-6 py-3 font-semibold text-sm hover:bg-surface-container transition-colors flex items-center justify-center gap-2 min-w-[160px] min-h-[48px]">
              <span className="material-symbols-outlined text-xl" data-icon="dashboard">dashboard</span>
              Return to Dashboard
            </Link>
          </div>
        </section>

        {/* Features Bento Grid */}
        <section className="w-full">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 auto-rows-[minmax(140px,auto)]">
            <div className="bg-surface-container p-6 border-b border-secondary-fixed flex flex-col justify-between rounded-xl">
              <div className="flex items-center gap-3 mb-4 text-primary">
                <span className="material-symbols-outlined text-2xl" data-icon="sync">sync</span>
                <h3 className="font-semibold text-lg text-on-background">Bi-dir Sync</h3>
              </div>
              <p className="text-sm text-on-surface-variant leading-relaxed">Seamlessly synchronize your LaTeX documents across all devices. Work offline, and let our conflict resolution engine handle the merge when you reconnect.</p>
            </div>
            <div className="bg-surface-container p-6 border-b border-secondary-fixed flex flex-col justify-between rounded-xl">
              <div className="flex items-center gap-3 mb-4 text-primary">
                <span className="material-symbols-outlined text-2xl" data-icon="library_books">library_books</span>
                <h3 className="font-semibold text-lg text-on-background">100+ Templates</h3>
              </div>
              <p className="text-sm text-on-surface-variant leading-relaxed">Jumpstart your research with IEEE, ACM, and Springer compliant templates ready to deploy.</p>
            </div>
            <div className="bg-surface-container p-6 border-b border-secondary-fixed flex flex-col justify-between rounded-xl">
              <div className="flex items-center gap-3 mb-4 text-tertiary">
                <span className="material-symbols-outlined text-2xl" data-icon="lock">lock</span>
                <h3 className="font-semibold text-lg text-on-background">Encrypted Storage</h3>
              </div>
              <p className="text-sm text-on-surface-variant leading-relaxed">AES-256 encryption at rest ensures your pre-published research remains confidential.</p>
            </div>
            <div className="bg-surface-container p-6 border-b border-secondary-fixed flex flex-col justify-between rounded-xl">
              <div className="flex items-center gap-3 mb-4 text-primary">
                <span className="material-symbols-outlined text-2xl" data-icon="wifi_off">wifi_off</span>
                <h3 className="font-semibold text-lg text-on-background">Slow Network Mode</h3>
              </div>
              <p className="text-sm text-on-surface-variant leading-relaxed">Optimized delta-compilation saves bandwidth and accelerates preview generation.</p>
            </div>
            <div className="bg-surface-container p-6 border-b border-secondary-fixed flex flex-col justify-between rounded-xl">
              <div className="flex items-center gap-3 mb-4 text-primary">
                <span className="material-symbols-outlined text-2xl" data-icon="settings_applications">settings_applications</span>
                <h3 className="font-semibold text-lg text-on-background">Multi-engine Support</h3>
              </div>
              <p className="text-sm text-on-surface-variant leading-relaxed">Compile with pdfLaTeX, XeLaTeX, LuaLaTeX, and ConTeXt natively.</p>
            </div>
            <div className="bg-surface-container p-6 border-b border-secondary-fixed flex flex-col justify-between rounded-xl">
              <div className="flex items-center gap-3 mb-4 text-primary">
                <span className="material-symbols-outlined text-2xl" data-icon="smart_toy">smart_toy</span>
                <h3 className="font-semibold text-lg text-on-background">AI Chat Engine</h3>
              </div>
              <p className="text-sm text-on-surface-variant leading-relaxed">For Fast Code Debugging.</p>
            </div>
          </div>
        </section>

        {/* Recent Projects Section */}
        <section className="w-full">
          <div className="flex justify-between items-end mb-4 border-b border-secondary-fixed pb-2">
            <h2 className="text-xl font-headline font-semibold text-on-background">Recent Projects</h2>
            <button onClick={() => setShowAllModal(true)} className="text-sm text-primary hover:underline font-semibold flex items-center gap-1">View All <span className="material-symbols-outlined text-[16px]" data-icon="arrow_forward">arrow_forward</span></button>
          </div>

          {loading ? (
            <div style={{ color: '#525252', display: 'flex', gap: '0.5rem', alignItems: 'center', padding: '1rem' }}>
              <div style={{ width: '16px', height: '16px', border: '2px solid #0f62fe', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
              Loading projects from encrypted storage...
            </div>
          ) : projects.length === 0 ? (
            <div className="bg-surface-container text-center py-12">
              <p className="text-lg text-on-surface-variant mb-4">No LaTeX projects yet. Create your first one!</p>
              <button onClick={handleOpenNewModal} className="bg-primary text-on-primary px-6 py-3 font-semibold text-sm hover:bg-primary-fixed-dim">
                + New Project
              </button>
            </div>
          ) : (
            <div className="w-full overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-surface-container text-on-surface-variant">
                    <th className="p-3 font-semibold border-b border-secondary-fixed w-1/2">Project Name</th>
                    <th className="p-3 font-semibold border-b border-secondary-fixed">Status</th>
                    <th className="p-3 font-semibold border-b border-secondary-fixed text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map(p => (
                    <tr key={p.id} className="border-b border-secondary-fixed hover:bg-surface-container-low transition-colors group">
                      <td className="p-3 text-on-background font-semibold flex items-center gap-2">
                        <span className="material-symbols-outlined text-on-surface-variant text-[18px]" data-icon="article">article</span>
                        {p.title}.tex
                      </td>
                      <td className="p-3">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-tertiary-container text-on-tertiary-container text-xs font-semibold uppercase tracking-wider">
                          <span className="material-symbols-outlined text-[14px]" data-icon="check_circle">check_circle</span>
                          Synced
                        </span>
                      </td>
                      <td className="p-3 text-right text-on-surface-variant flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => downloadPdf(p.id, p.title)} className="p-1 hover:text-primary transition-colors" title="Download PDF">
                          <span className="material-symbols-outlined text-[20px]" data-icon="picture_as_pdf">picture_as_pdf</span>
                        </button>
                        <button onClick={() => downloadZip(p.id, p.title)} className="p-1 hover:text-primary transition-colors" title="Download ZIP">
                          <span className="material-symbols-outlined text-[20px]" data-icon="folder_zip">folder_zip</span>
                        </button>
                        <button onClick={() => router.push(`/latex-studio/${p.id}`)} className="p-1 hover:text-primary transition-colors" title="Open in Editor">
                          <span className="material-symbols-outlined text-[20px]" data-icon="open_in_new">open_in_new</span>
                        </button>
                        <button onClick={() => deleteProject(p.id)} className="p-1 hover:text-error transition-colors" title="Delete">
                          <span className="material-symbols-outlined text-[20px]" data-icon="delete">delete</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      {showAllModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, backdropFilter: 'blur(8px)', padding: '1.5rem'
        }} onClick={() => setShowAllModal(false)}>
          <div
            style={{ 
              width: '900px', maxWidth: '100%', maxHeight: '85vh', padding: '2rem', 
              display: 'flex', flexDirection: 'column',
              background: '#ffffff',
              color: '#161616',
              border: '1px solid #e0e0e0',
              borderRadius: '0px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.12)',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid #e0e0e0', paddingBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="material-symbols-outlined text-2xl text-primary" data-icon="folder">folder</span>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 600, fontFamily: 'IBM Plex Sans', color: '#161616', letterSpacing: '-0.02em' }}>All LaTeX Projects</h2>
              </div>
              <button onClick={() => setShowAllModal(false)} style={{ background: 'transparent', border: 'none', color: '#161616', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
            </div>

            {/* Filters & Controls */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div style={{ flex: 1, minWidth: '250px', position: 'relative' }}>
                <span className="material-symbols-outlined" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#525252', fontSize: '18px' }} data-icon="search">search</span>
                <input
                  type="text"
                  placeholder="Filter projects by name..."
                  value={allFilterText}
                  onChange={e => setAllFilterText(e.target.value)}
                  style={{
                    width: '100%', padding: '0.6rem 1rem 0.6rem 2.5rem',
                    background: '#f4f4f4', color: '#161616',
                    border: 'none', borderBottom: '2px solid #8d8d8d',
                    outline: 'none', fontFamily: 'IBM Plex Sans', fontSize: '0.85rem'
                  }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#525252', letterSpacing: '0.05em', fontFamily: 'IBM Plex Sans' }}>SORT BY:</span>
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value as any)}
                  style={{
                    background: '#f4f4f4', color: '#161616',
                    border: 'none', borderBottom: '2px solid #8d8d8d',
                    padding: '0.5rem 1rem', fontSize: '0.85rem', outline: 'none', cursor: 'pointer',
                    fontFamily: 'IBM Plex Sans'
                  }}
                >
                  <option value="date-desc">Modified (Newest First)</option>
                  <option value="date-asc">Modified (Oldest First)</option>
                  <option value="name-asc">Name (A - Z)</option>
                  <option value="name-desc">Name (Z - A)</option>
                </select>
              </div>
            </div>

            {/* Projects List */}
            <div className="custom-scroll" style={{ flex: 1, overflowY: 'auto', paddingRight: '0.5rem' }}>
              {sortedProjects.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#8d8d8d' }}>
                  <span className="material-symbols-outlined text-4xl mb-2" data-icon="folder_open">folder_open</span>
                  <p style={{ fontSize: '0.9rem' }}>No matching projects found.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {sortedProjects.map(p => (
                    <div 
                      key={p.id}
                      style={{
                        background: '#f4f4f4', padding: '1rem', borderRadius: '0px',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        border: '1px solid transparent', borderBottom: '1px solid #e0e0e0', transition: 'all 0.2s'
                      }}
                      onMouseOver={e => { e.currentTarget.style.background='#e0e0e0'; }}
                      onMouseOut={e => { e.currentTarget.style.background='#f4f4f4'; }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', minWidth: 0 }}>
                        <div style={{ width: '40px', height: '40px', background: 'rgba(15,98,254,0.1)', color: '#0f62fe', borderRadius: '0px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span className="material-symbols-outlined" data-icon="article">article</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                          <span style={{ fontWeight: 600, fontSize: '0.95rem', color: '#161616', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', fontFamily: 'IBM Plex Sans' }}>{p.title}.tex</span>
                          <span style={{ fontSize: '0.75rem', color: '#525252', marginTop: '2px', fontFamily: 'IBM Plex Sans' }}>
                            Updated {new Date(p.updatedAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                        <button 
                          onClick={() => { setShowAllModal(false); downloadPdf(p.id, p.title); }} 
                          style={{ padding: '0.5rem', color: '#525252', background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: '0px', transition: 'all 0.2s' }}
                          onMouseOver={e => { e.currentTarget.style.color='#0f62fe'; e.currentTarget.style.background='#e0e0e0'; }}
                          onMouseOut={e => { e.currentTarget.style.color='#525252'; e.currentTarget.style.background='transparent'; }}
                          title="Download PDF"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '20px' }} data-icon="picture_as_pdf">picture_as_pdf</span>
                        </button>
                        <button 
                          onClick={() => { setShowAllModal(false); downloadZip(p.id, p.title); }} 
                          style={{ padding: '0.5rem', color: '#525252', background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: '0px', transition: 'all 0.2s' }}
                          onMouseOver={e => { e.currentTarget.style.color='#0f62fe'; e.currentTarget.style.background='#e0e0e0'; }}
                          onMouseOut={e => { e.currentTarget.style.color='#525252'; e.currentTarget.style.background='transparent'; }}
                          title="Download ZIP"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '20px' }} data-icon="folder_zip">folder_zip</span>
                        </button>
                        <button 
                          onClick={() => { setShowAllModal(false); router.push(`/latex-studio/${p.id}`); }} 
                          style={{ padding: '0.5rem', color: '#525252', background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: '0px', transition: 'all 0.2s' }}
                          onMouseOver={e => { e.currentTarget.style.color='#0f62fe'; e.currentTarget.style.background='#e0e0e0'; }}
                          onMouseOut={e => { e.currentTarget.style.color='#525252'; e.currentTarget.style.background='transparent'; }}
                          title="Open in Editor"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '20px' }} data-icon="open_in_new">open_in_new</span>
                        </button>
                        <button 
                          onClick={() => { deleteProject(p.id); }} 
                          style={{ padding: '0.5rem', color: '#525252', background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: '0px', transition: 'all 0.2s' }}
                          onMouseOver={e => { e.currentTarget.style.color='#da1e28'; e.currentTarget.style.background='rgba(218,30,40,0.1)'; }}
                          onMouseOut={e => { e.currentTarget.style.color='#525252'; e.currentTarget.style.background='transparent'; }}
                          title="Delete Project"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '20px' }} data-icon="delete">delete</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Refined "New Project" Modal */}
      {showNew && (
        <div 
          className="fixed inset-0 z-[1000] flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-200"
          style={{ background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(12px)' }}
          onClick={() => setShowNew(false)}
        >
          <div
            className="bg-white dark:bg-gray-900 w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl border border-gray-200 dark:border-gray-800"
            style={{ borderRadius: '24px' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex justify-between items-center px-8 py-6 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-2xl" data-icon="add_box">add_box</span>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">Create New Project</h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Choose a template to jumpstart your research</p>
                </div>
              </div>
              <button 
                onClick={() => setShowNew(false)} 
                className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-400 hover:text-gray-900 dark:hover:text-white"
              >
                <span className="material-symbols-outlined" data-icon="close">close</span>
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex flex-1 overflow-hidden">
              {/* Left Sidebar: Settings & Categories */}
              <div className="w-80 border-r border-gray-100 dark:border-gray-800 p-8 flex flex-col gap-8 bg-gray-50/30 dark:bg-gray-950/20 overflow-y-auto">
                {/* Project Name Input */}
                <div className="space-y-3">
                  <label className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm" data-icon="edit">edit</span>
                    Project Name
                  </label>
                  <input
                    type="text"
                    className="w-full px-4 py-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm font-medium text-gray-900 dark:text-white placeholder:text-gray-400"
                    placeholder="E.g. Quantum Gravity Thesis"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    autoFocus
                  />
                </div>

                {/* Categories */}
                <div className="space-y-4">
                  <label className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm" data-icon="category">category</span>
                    Categories
                  </label>
                  <div className="flex flex-col gap-1.5">
                    {categories.map(c => (
                      <button
                        key={c}
                        onClick={() => setSelectedCategory(c)}
                        className={`group flex items-center justify-between px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                          selectedCategory === c 
                            ? 'bg-primary text-white shadow-lg shadow-primary/20' 
                            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                        }`}
                      >
                        {c}
                        {selectedCategory === c && (
                          <span className="material-symbols-outlined text-sm" data-icon="check">check</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Info Card */}
                <div className="mt-auto p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-800/30">
                  <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-2">
                    <span className="material-symbols-outlined text-sm" data-icon="info">info</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider">Pro Tip</span>
                  </div>
                  <p className="text-[11px] text-blue-800 dark:text-blue-300 leading-relaxed font-medium">
                    Templates include pre-configured document classes, citation styles, and bibliography files.
                  </p>
                </div>
              </div>

              {/* Right Main: Template Grid */}
              <div className="flex-1 p-8 flex flex-col gap-6 overflow-hidden">
                {/* Search Bar */}
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-xl" data-icon="search">search</span>
                  <input
                    type="text"
                    className="w-full pl-12 pr-4 py-4 bg-gray-100/50 dark:bg-gray-800/50 border-none rounded-2xl focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm font-medium text-gray-900 dark:text-white placeholder:text-gray-500"
                    placeholder="Search over 100+ templates (Journal, Conference, CV...)"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                </div>
                
                {/* Grid */}
                <div className="flex-1 overflow-y-auto pr-2 custom-scroll">
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 pb-4">
                    {filteredTemplates.map(t => (
                      <button
                        key={t.id}
                        onClick={() => {
                          setSelectedTemplate(t.id);
                          if (!newName.trim() || allTemplates.some(tmpl => newName === `${tmpl.label} Project`)) {
                            setNewName(`${t.label} Project`);
                          }
                        }}
                        className={`group relative flex flex-col items-start p-5 rounded-2xl border-2 transition-all text-left ${
                          selectedTemplate === t.id 
                            ? 'bg-primary/5 border-primary shadow-xl shadow-primary/5' 
                            : 'bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 hover:border-primary/30 hover:shadow-lg hover:shadow-gray-200/50 dark:hover:shadow-none'
                        }`}
                      >
                        {/* Custom Template Delete Action */}
                        {t.isCustom && (
                          <div 
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (!confirm('Delete custom template?')) return;
                              try {
                                await fetch(`/api/templates?id=${t.id}`, { method: 'DELETE' });
                                fetch('/api/templates', { cache: 'no-store' })
                                  .then(res => res.json())
                                  .then(data => setCustomTemplates(data.templates || []));
                              } catch (err) {
                                alert('Failed to delete template');
                              }
                            }}
                            className="absolute top-3 right-3 w-7 h-7 bg-red-50 dark:bg-red-900/20 text-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-500 hover:text-white transition-all z-10"
                            title="Delete template"
                          >
                            <span className="material-symbols-outlined text-[16px]" data-icon="delete">delete</span>
                          </div>
                        )}

                        <div className={`w-14 h-14 rounded-xl mb-4 flex items-center justify-center transition-transform group-hover:scale-110 overflow-hidden ${
                          selectedTemplate === t.id ? 'bg-primary text-white shadow-lg shadow-primary/30' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                        }`}>
                          {t.icon.startsWith('http') || t.icon.startsWith('/') ? (
                            <Image 
                              src={t.icon} 
                              alt={t.label} 
                              width={32}
                              height={32}
                              className="w-8 h-8 object-contain" 
                              unoptimized
                              onError={(e) => {
                                // Fallback to icon first letter or generic icon if image fails
                                e.currentTarget.style.display = 'none';
                                const parent = e.currentTarget.parentElement;
                                if (parent) {
                                  const span = document.createElement('span');
                                  span.className = 'text-2xl font-bold';
                                  span.innerText = t.label.charAt(0);
                                  parent.appendChild(span);
                                }
                              }}
                            />
                          ) : (
                            <span className="text-2xl">{t.icon}</span>
                          )}
                        </div>

                        <div className="space-y-1 w-full">
                          <h3 className={`font-bold text-sm truncate ${selectedTemplate === t.id ? 'text-primary' : 'text-gray-900 dark:text-white'}`}>
                            {t.label}
                          </h3>
                          <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium line-clamp-2 leading-snug">
                            {t.desc}
                          </p>
                        </div>

                        {/* Publisher Badge */}
                        {t.publisher && (
                          <div className="mt-4 flex items-center gap-1.5">
                            <div className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600"></div>
                            <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">{t.publisher}</span>
                          </div>
                        )}

                        {/* Selected Indicator */}
                        {selectedTemplate === t.id && (
                          <div className="absolute top-3 right-3 w-6 h-6 bg-primary text-white rounded-full flex items-center justify-center">
                            <span className="material-symbols-outlined text-sm" data-icon="check">check</span>
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-8 py-6 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-gray-400" data-icon="lock">lock</span>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">End-to-End Encrypted Creation</span>
              </div>
              <div className="flex gap-4">
                <button 
                  onClick={() => setShowNew(false)}
                  className="px-6 py-2.5 text-sm font-bold text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={createProject}
                  disabled={!newName.trim() || creating}
                  className={`px-8 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
                    !newName.trim() || creating
                      ? 'bg-gray-200 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
                      : 'bg-primary text-white shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98]'
                  }`}
                >
                  {creating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Initializing...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-lg" data-icon="bolt">bolt</span>
                      Create Project
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {isParsingZip && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 2000, backdropFilter: 'blur(12px)', padding: '1.5rem'
        }}>
          <div
            style={{ 
              width: '400px', maxWidth: '100%', padding: '2.5rem 2rem', 
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              background: 'var(--surface-container, #ffffff)',
              color: 'var(--on-background, #161616)',
              border: '1px solid var(--outline, #e0e0e0)',
              borderRadius: '12px',
              boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)',
              textAlign: 'center'
            }}
          >
            <div style={{
              width: '64px', height: '64px', 
              borderRadius: '50%', background: 'rgba(15,98,254,0.1)', 
              display: 'flex', alignItems: 'center', justifyContent: 'center', 
              marginBottom: '1.5rem'
            }}>
              <span className="material-symbols-outlined text-primary" style={{ fontSize: '36px', animation: 'spin 2s linear infinite' }}>
                sync
              </span>
            </div>
            
            <h2 style={{ 
              fontSize: '1.25rem', fontWeight: 700, 
              fontFamily: 'IBM Plex Sans', letterSpacing: '-0.02em',
              marginBottom: '0.75rem'
            }}>
              Please Process Documents with related information
            </h2>
            
            <p style={{ 
              fontSize: '0.875rem', color: 'var(--on-surface-variant, #525252)', 
              fontFamily: 'IBM Plex Sans', lineHeight: '1.5',
              marginBottom: '1.5rem'
            }}>
              Please wait while we parse, extract, and structure your LaTeX workspace files securely.
            </p>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--secondary, #525252)', fontWeight: 600 }}>
              <span className="material-symbols-outlined text-base" style={{ color: '#0f62fe' }}>lock</span>
              AES-256 Decryption Pipeline
            </div>
          </div>
        </div>
      )}
      {/* Footer */}
      <footer className="bg-gray-50 dark:bg-gray-900 text-blue-600 dark:text-blue-500 font-['IBM_Plex_Sans'] text-xs text-gray-500 dark:text-gray-400 full-width py-8 border-t border-gray-200 dark:border-gray-800 flat no shadows w-full mt-auto">
        <div className="max-w-7xl mx-auto px-4 md:px-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <span className="font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]" data-icon="edit_document">edit_document</span>
              Latexify Studio
            </span>
            <span className="hidden md:inline-block text-gray-300 dark:text-gray-700">|</span>
            <span>© 2024 Latexify Studio. Built for productive clarity.</span>
          </div>
          <div className="flex items-center gap-4 md:gap-6 flex-wrap justify-center">
            <a className="text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 underline transition-all focus:ring-2 focus:ring-blue-500" href="#">Documentation</a>
            <a className="text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 underline transition-all focus:ring-2 focus:ring-blue-500" href="#">Privacy Policy</a>
            <a className="text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 underline transition-all focus:ring-2 focus:ring-blue-500" href="#">Terms of Service</a>
            <a className="text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 underline transition-all focus:ring-2 focus:ring-blue-500" href="#">Support</a>
          </div>
          <div className="flex items-center gap-3 text-gray-400">
            <span className="flex items-center gap-1" title="SSL Secured"><span className="material-symbols-outlined text-[16px]" data-icon="verified_user">verified_user</span> SSL</span>
            <span className="flex items-center gap-1" title="AES-256 Encrypted"><span className="material-symbols-outlined text-[16px]" data-icon="lock">lock</span> AES-256</span>
          </div>
        </div>
      </footer>
      <ProjectLimitModal isOpen={showLimitModal} onClose={() => setShowLimitModal(false)} />
    </div>
  );
}
