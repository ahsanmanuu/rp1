'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { createPb } from '@/lib/pb';
import ProLoader from '@/components/ProLoader';

const TOOL_TITLES = [
  'Latexify Dashboard', 'Doc2LaTeX Studio', 'Diagram Studio',
  'Template Migrator', 'Citation Studio', 'AI Peer Reviewer',
];

const SIDEBAR_LINKS = [
  { href: '/admin/dashboard', icon: 'dashboard', label: 'Dashboard' },
  { href: '/admin/billings', icon: 'payments', label: 'Bill & Payments' },
  { href: '/admin/users', icon: 'group', label: 'Users' },
  { href: '/admin/profile', icon: 'settings', label: 'Profile & Plan Setting' },
  { href: '/admin/ai-caps', icon: 'speed', label: 'AI Usage & Caps Rules' },
  { href: '/admin/ai-analysis', icon: 'psychology', label: 'AI Analysis' },
  { href: '/admin/anomalies', icon: 'bug_report', label: 'Anomaly Detection' },
  { href: '/admin/help', icon: 'help', label: 'Help and Support' },
  { href: '/admin/offers', icon: 'local_offer', label: 'Offers' },
  { href: '/admin/emails', icon: 'mail', label: 'Email History' },
  { href: '/admin/general-queries', icon: 'question_answer', label: 'General Queries' },
  { href: '/admin/banners', icon: 'view_carousel', label: 'Banners' },
  { href: '/admin/testimonials', icon: 'star', label: 'Testimonials' },
  { href: '/admin/tax-calculation', icon: 'calculate', label: 'Tax Calculation' },
];

export default function AdminBannersPage() {
  const [currentTheme, setCurrentTheme] = useState<'indigo' | 'emerald' | 'rose'>('indigo');
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
  const [adminName, setAdminName] = useState('Admin Root');

  const [loading, setLoading] = useState(true);
  const [banners, setBanners] = useState<any[]>([]);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ title: '', subtitle: '', imageUrl: '', linkUrl: '', isActive: true, sortOrder: 0 });
  const [uploadingImage, setUploadingImage] = useState(false);

  const pathname = usePathname();

  useEffect(() => {
    const savedTheme = localStorage.getItem('latexify-admin-theme') as 'indigo' | 'emerald' | 'rose' | null;
    const savedMode = localStorage.getItem('latexify-admin-mode');
    if (savedTheme) setCurrentTheme(savedTheme);
    if (savedMode) setIsDarkMode(savedMode === 'dark');
    const storedName = localStorage.getItem('latexify-admin-name');
    if (storedName) setAdminName(storedName);
  }, []);

  useEffect(() => {
    localStorage.setItem('latexify-admin-theme', currentTheme);
    localStorage.setItem('latexify-admin-mode', isDarkMode ? 'dark' : 'light');
  }, [currentTheme, isDarkMode]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/banners');
      const d = await res.json();
      if (d.success) setBanners(d.data);
    } catch (err) { console.error('Banners fetch error:', err); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const pb = createPb();
    const unsubFns: (() => void)[] = [];
    (async () => {
      try { const u = await pb.collection('banners').subscribe('*', () => { fetchData(); }); unsubFns.push(u); } catch {}
    })();
    return () => { for (const fn of unsubFns) { try { fn(); } catch {} } };
  }, [fetchData]);

  const save = async () => {
    try {
      if (editing) {
        await fetch('/api/admin/banners', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editing.id, ...form }) });
      } else {
        await fetch('/api/admin/banners', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      }
      setShowForm(false); setEditing(null); fetchData();
    } catch {}
  };

  const deleteBanner = async (id: string) => {
    if (!confirm('Delete this banner?')) return;
    try { await fetch(`/api/admin/banners?id=${id}`, { method: 'DELETE' }); fetchData(); } catch {}
  };

  const toggleActive = async (banner: any) => {
    try { await fetch('/api/admin/banners', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: banner.id, isActive: !banner.isActive }) }); fetchData(); } catch {}
  };

  const openNew = () => {
    setEditing(null);
    setForm({ title: '', subtitle: '', imageUrl: '', linkUrl: '', isActive: true, sortOrder: 0 });
    setShowForm(true);
  };

  const openEdit = (banner: any) => {
    setEditing(banner);
    setForm({ title: banner.title, subtitle: banner.subtitle || '', imageUrl: banner.imageUrl, linkUrl: banner.linkUrl || '', isActive: banner.isActive, sortOrder: banner.sortOrder });
    setShowForm(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('collection', 'banners');
      const res = await fetch('/api/admin/upload-pb', { method: 'POST', body: fd });
      const d = await res.json();
      if (d.success) {
        setForm(prev => ({ ...prev, imageUrl: d.url }));
      }
    } catch (err) {
      console.error('Image upload failed:', err);
    }
    setUploadingImage(false);
  };

  const toggleTheme = () => setIsThemeMenuOpen(!isThemeMenuOpen);
  const handleThemeSelect = (t: 'indigo' | 'emerald' | 'rose') => { setCurrentTheme(t); setIsThemeMenuOpen(false); };

  const accentColor = currentTheme === 'rose' ? '#e11d48' : currentTheme === 'emerald' ? '#059669' : '#4f46e5';
  const bgColor = isDarkMode ? '#0b1326' : '#f8fafc';
  const surfaceColor = isDarkMode ? '#0b1326' : '#ffffff';
  const onSurfaceColor = isDarkMode ? '#dae2fd' : '#0f172a';
  const surfaceVariant = isDarkMode ? '#475569' : '#475569';
  const borderColor = isDarkMode ? '#2d3449' : '#e2e8f0';
  const cardBg = isDarkMode ? '#171f33' : '#ffffff';

  return (
    <div className="min-h-screen transition-colors duration-500" style={{ backgroundColor: bgColor, color: onSurfaceColor }}>
      <style dangerouslySetInnerHTML={{ __html: `
        :root { ${isDarkMode ? `
          --color-admin-primary: ${currentTheme === 'rose' ? '#fda4af' : currentTheme === 'emerald' ? '#6ee7b7' : '#c3c0ff'};
          --color-admin-primary-container: ${currentTheme === 'rose' ? '#e11d48' : currentTheme === 'emerald' ? '#059669' : '#4f46e5'};
          --color-admin-on-primary-container: ${currentTheme === 'rose' ? '#ffe4e6' : currentTheme === 'emerald' ? '#d1fae5' : '#dad7ff'};
          --color-admin-secondary: ${currentTheme === 'rose' ? '#fecdd3' : currentTheme === 'emerald' ? '#a7f3d0' : '#c0c1ff'};
          --color-admin-secondary-container: ${currentTheme === 'rose' ? '#be123c' : currentTheme === 'emerald' ? '#047857' : '#3131c0'};
          --color-admin-on-secondary-container: ${currentTheme === 'rose' ? '#fff1f2' : currentTheme === 'emerald' ? '#ecfdf5' : '#b0b2ff'};
          --color-admin-background: ${bgColor};
          --color-admin-surface: ${surfaceColor};
          --color-admin-surface-container: ${isDarkMode ? '#171f33' : '#f1f5f9'};
          --color-admin-surface-container-low: ${isDarkMode ? '#131b2e' : '#f8fafc'};
          --color-admin-surface-container-high: ${isDarkMode ? '#222a3d' : '#e2e8f0'};
          --color-admin-surface-container-highest: ${isDarkMode ? '#2d3449' : '#cbd5e1'};
          --color-admin-on-surface: ${onSurfaceColor};
          --color-admin-on-surface-variant: ${surfaceVariant};
          --color-admin-outline: ${isDarkMode ? '#918fa1' : '#94a3b8'};
          --color-admin-outline-variant: ${borderColor};
          --color-admin-error: ${isDarkMode ? '#ffb4ab' : '#ba1a1a'};
          --color-admin-on-error: ${isDarkMode ? '#690005' : '#ffffff'};
          --color-admin-error-container: ${isDarkMode ? '#93000a' : '#ffdad6'};
          --color-admin-on-error-container: ${isDarkMode ? '#ffdad6' : '#410002'};
          --color-admin-tertiary: ${isDarkMode ? '#ffb695' : '#f59e0b'};
          --color-admin-tertiary-container: ${isDarkMode ? '#a44100' : '#fffbeb'};
          --color-admin-on-tertiary-container: ${isDarkMode ? '#ffd2be' : '#92400e'};
        ` : `
          --color-admin-primary: ${accentColor};
          --color-admin-primary-container: ${currentTheme === 'rose' ? '#ffe4e6' : currentTheme === 'emerald' ? '#d1fae5' : '#dad7ff'};
          --color-admin-on-primary-container: ${currentTheme === 'rose' ? '#e11d48' : currentTheme === 'emerald' ? '#059669' : '#4f46e5'};
          --color-admin-secondary: ${currentTheme === 'rose' ? '#fecdd3' : currentTheme === 'emerald' ? '#a7f3d0' : '#c0c1ff'};
          --color-admin-secondary-container: ${currentTheme === 'rose' ? '#ffe4e6' : currentTheme === 'emerald' ? '#d1fae5' : '#e0e7ff'};
          --color-admin-on-secondary-container: ${currentTheme === 'rose' ? '#e11d48' : currentTheme === 'emerald' ? '#059669' : '#3730a3'};
          --color-admin-background: ${bgColor};
          --color-admin-surface: ${surfaceColor};
          --color-admin-surface-container: ${isDarkMode ? '#171f33' : '#f1f5f9'};
          --color-admin-surface-container-low: ${isDarkMode ? '#131b2e' : '#f8fafc'};
          --color-admin-surface-container-high: ${isDarkMode ? '#222a3d' : '#e2e8f0'};
          --color-admin-surface-container-highest: ${isDarkMode ? '#2d3449' : '#cbd5e1'};
          --color-admin-on-surface: ${onSurfaceColor};
          --color-admin-on-surface-variant: ${surfaceVariant};
          --color-admin-outline: ${isDarkMode ? '#918fa1' : '#94a3b8'};
          --color-admin-outline-variant: ${borderColor};
          --color-admin-error: ${isDarkMode ? '#ffb4ab' : '#ba1a1a'};
          --color-admin-on-error: ${isDarkMode ? '#690005' : '#ffffff'};
          --color-admin-error-container: ${isDarkMode ? '#93000a' : '#ffdad6'};
          --color-admin-on-error-container: ${isDarkMode ? '#ffdad6' : '#410002'};
          --color-admin-tertiary: ${isDarkMode ? '#ffb695' : '#f59e0b'};
          --color-admin-tertiary-container: ${isDarkMode ? '#a44100' : '#fffbeb'};
          --color-admin-on-tertiary-container: ${isDarkMode ? '#ffd2be' : '#92400e'};
        `}
        .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: ${borderColor}; border-radius: 4px; }
        @keyframes pulse-slow { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
        .animate-pulse-slow { animation: pulse-slow 3s infinite; } `}}
      />

      <div className="flex h-screen">
        <aside className="flex flex-col h-full p-4 gap-2 fixed h-screen w-64 left-0 top-0 z-50 border-r transition-colors duration-500 custom-scrollbar" style={{ backgroundColor: surfaceColor, borderColor }}>
          <div className="flex flex-col items-center gap-1 px-2 mb-6 mt-2 text-center">
            <Image src="/logo.png" alt="Logo" width={36} height={36} className="rounded-xl" />
            <p className="text-[10px] font-bold uppercase tracking-wider opacity-80" style={{ color: onSurfaceColor }}>Admin Console</p>
          </div>
          <nav className="flex flex-col gap-1 overflow-y-auto custom-scrollbar">
            {SIDEBAR_LINKS.map(item => (
              <Link key={item.href} href={item.href}
                className="flex items-center gap-3 px-4 py-3 text-sm rounded-lg transition-all hover:translate-x-1"
                style={{ color: pathname === item.href ? 'var(--color-admin-on-primary-container)' : surfaceVariant, backgroundColor: pathname === item.href ? 'var(--color-admin-secondary-container)' : 'transparent', fontWeight: pathname === item.href ? 700 : 500 }}>
                <span className="material-symbols-outlined">{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="mt-auto p-4 rounded-xl border text-sm" style={{ backgroundColor: cardBg, borderColor }}>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: '#22c55e' }} />
              <span style={{ color: onSurfaceColor }} className="font-semibold">System Online</span>
            </div>
            <p className="text-xs" style={{ color: surfaceVariant }}>Version 4.2.0-stable</p>
          </div>
        </aside>

        <main className="ml-64 min-h-screen pb-16">
          <header className="flex justify-between items-center w-full px-8 py-4 border-b backdrop-blur-md sticky top-0 z-40" style={{ backgroundColor: surfaceColor + 'cc', borderColor }}>
            <div className="flex items-center gap-4 flex-1">
              <h1 className="text-lg font-bold" style={{ color: onSurfaceColor }}>Banners</h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: accentColor + '20', color: accentColor }}>Home Page Slides</span>
            </div>
            <div className="flex items-center gap-6 ml-4">
              <div className="relative">
                <button onClick={toggleTheme} className="flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors" style={{ borderColor, color: surfaceVariant }}>
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: accentColor }} />
                  <span>Theme</span>
                  <span className="material-symbols-outlined text-[18px]">expand_more</span>
                </button>
                {isThemeMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-36 rounded-xl border shadow-lg z-50" style={{ backgroundColor: surfaceColor, borderColor }}>
                    {(['indigo', 'emerald', 'rose'] as const).map(t => (
                      <button key={t} onClick={() => handleThemeSelect(t)} className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-bold hover:brightness-90 transition-all border-b last:border-b-0" style={{ borderColor, color: onSurfaceColor, backgroundColor: currentTheme === t ? accentColor + '20' : 'transparent', textTransform: 'capitalize' }}>
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: t === 'rose' ? '#e11d48' : t === 'emerald' ? '#059669' : '#4f46e5' }} />
                        {t}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors" style={{ color: surfaceVariant }}>
                <span className="material-symbols-outlined">{isDarkMode ? 'light_mode' : 'dark_mode'}</span>
              </button>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold" style={{ backgroundColor: accentColor + '30', color: accentColor }}>A</div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: onSurfaceColor }}>{adminName}</p>
                  <p className="text-[10px]" style={{ color: surfaceVariant }}>Administrator</p>
                </div>
              </div>
            </div>
          </header>

          <div className="px-8 py-6 space-y-6">
            {loading ? (
              <ProLoader variant="admin" fullScreen={false} />
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-sm" style={{ color: surfaceVariant }}>{banners.length} banner(s) configured</p>
                  <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-all hover:brightness-110" style={{ backgroundColor: accentColor }}>
                    <span className="material-symbols-outlined text-[18px]">add</span>
                    Add Banner
                  </button>
                </div>

                {banners.length === 0 ? (
                  <div className="p-12 text-center rounded-xl border" style={{ backgroundColor: cardBg, borderColor }}>
                    <span className="material-symbols-outlined text-4xl" style={{ color: surfaceVariant }}>view_carousel</span>
                    <p className="mt-3 text-sm font-semibold" style={{ color: onSurfaceColor }}>No banners yet.</p>
                    <p className="mt-1 text-xs" style={{ color: surfaceVariant }}>Add your first banner to display on the home page.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {banners.map(banner => (
                      <div key={banner.id} className="p-4 rounded-xl border transition-all hover:brightness-95" style={{ backgroundColor: cardBg, borderColor }}>
                        <div className="flex gap-3">
                          <div className="w-20 h-14 rounded-lg overflow-hidden shrink-0" style={{ backgroundColor: bgColor }}>
                            {banner.imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={banner.imageUrl} alt={banner.title} className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-xs" style={{ color: surfaceVariant }}>No img</div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold truncate" style={{ color: onSurfaceColor }}>{banner.title}</p>
                            {banner.subtitle && <p className="text-xs truncate mt-0.5" style={{ color: surfaceVariant }}>{banner.subtitle}</p>}
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${banner.isActive ? 'text-green-600 bg-green-500/10' : 'text-red-600 bg-red-500/10'}`}>
                                {banner.isActive ? 'Active' : 'Inactive'}
                              </span>
                              <span className="text-[10px] font-bold" style={{ color: surfaceVariant }}>Sort: {banner.sortOrder}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-3 pt-3 border-t" style={{ borderColor }}>
                          <button onClick={() => toggleActive(banner)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors" title="Toggle Active">
                            <span className="material-symbols-outlined text-[16px]" style={{ color: banner.isActive ? '#22c55e' : surfaceVariant }}>{banner.isActive ? 'toggle_on' : 'toggle_off'}</span>
                          </button>
                          <button onClick={() => openEdit(banner)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors" title="Edit">
                            <span className="material-symbols-outlined text-[16px]" style={{ color: surfaceVariant }}>edit</span>
                          </button>
                          <button onClick={() => deleteBanner(banner.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors ml-auto" title="Delete">
                            <span className="material-symbols-outlined text-[16px] text-red-500">delete</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </main>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="w-full max-w-lg p-6 rounded-2xl border shadow-2xl" style={{ backgroundColor: surfaceColor, borderColor }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold" style={{ color: onSurfaceColor }}>{editing ? 'Edit Banner' : 'Add Banner'}</h3>
              <button onClick={() => setShowForm(false)} className="p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/5"><span className="material-symbols-outlined">close</span></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider" style={{ color: surfaceVariant }}>title</label>
                <input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-lg border text-sm" style={{ backgroundColor: bgColor, borderColor, color: onSurfaceColor }} placeholder="e.g. Latexify Dashboard" />
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {TOOL_TITLES.map(t => (
                    <button key={t} type="button" onClick={() => setForm({ ...form, title: t })}
                      className={`text-[9px] font-bold px-2 py-0.5 rounded-full border transition-all cursor-pointer ${form.title === t ? 'text-white' : ''}`}
                      style={{ borderColor, backgroundColor: form.title === t ? accentColor : 'transparent', color: form.title === t ? '#fff' : surfaceVariant }}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider" style={{ color: surfaceVariant }}>subtitle</label>
                <input type="text" value={form.subtitle} onChange={e => setForm({ ...form, subtitle: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-lg border text-sm" style={{ backgroundColor: bgColor, borderColor, color: onSurfaceColor }} />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider" style={{ color: surfaceVariant }}>image</label>
                <div className="flex gap-2 mt-1">
                  <input type="text" value={form.imageUrl} onChange={e => setForm({ ...form, imageUrl: e.target.value })}
                    className="flex-1 px-3 py-2 rounded-lg border text-sm" style={{ backgroundColor: bgColor, borderColor, color: onSurfaceColor }} placeholder="Paste image URL or upload below" />
                  <label className={`px-3 py-2 rounded-lg text-sm font-bold text-white cursor-pointer transition-all hover:brightness-110 flex items-center gap-1 ${uploadingImage ? 'opacity-60' : ''}`}
                    style={{ backgroundColor: accentColor }}>
                    <span className="material-symbols-outlined text-[16px]">{uploadingImage ? 'hourglass_top' : 'upload'}</span>
                    {uploadingImage ? 'Uploading...' : 'Upload'}
                    <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" disabled={uploadingImage} />
                  </label>
                </div>
                {form.imageUrl && (
                  <div className="mt-2 w-full h-20 rounded-lg overflow-hidden border" style={{ borderColor }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={form.imageUrl} alt="preview" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  </div>
                )}
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider" style={{ color: surfaceVariant }}>linkUrl</label>
                <input type="text" value={form.linkUrl} onChange={e => setForm({ ...form, linkUrl: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-lg border text-sm" style={{ backgroundColor: bgColor, borderColor, color: onSurfaceColor }} placeholder="/latex-studio" />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider" style={{ color: surfaceVariant }}>sortOrder</label>
                <input type="number" value={form.sortOrder} onChange={e => setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })}
                  className="w-full mt-1 px-3 py-2 rounded-lg border text-sm" style={{ backgroundColor: bgColor, borderColor, color: onSurfaceColor }} />
              </div>
              <label className="flex items-center gap-2 text-sm font-medium mt-2" style={{ color: onSurfaceColor }}>
                <input type="checkbox" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} />
                isActive
              </label>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-lg border text-sm font-bold" style={{ borderColor, color: surfaceVariant }}>Cancel</button>
              <button onClick={save} className="flex-1 py-2.5 rounded-lg text-sm font-bold text-white" style={{ backgroundColor: accentColor }}>{editing ? 'Update' : 'Create'} Banner</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
