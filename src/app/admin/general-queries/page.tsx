'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import ProLoader from '@/components/ProLoader';

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diff = now - date;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'Just now';
  if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function truncate(str: string, len: number): string {
  if (str.length <= len) return str;
  return str.slice(0, len) + '...';
}

export default function AdminGeneralQueriesPage() {
  const [currentTheme, setCurrentTheme] = useState<'indigo' | 'emerald' | 'rose'>('indigo');
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
  const [adminName, setAdminName] = useState('Admin Root');

  const [loading, setLoading] = useState(true);
  const [queries, setQueries] = useState<any[]>([]);
  const [stats, setStats] = useState<{ total: number; unread: number }>({ total: 0, unread: 0 });
  const [activeTab, setActiveTab] = useState<'recent' | 'history'>('recent');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

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

  const fetchQueries = useCallback(async () => {
    setLoading(true);
    try {
      const typeParam = activeTab === 'history' ? '?type=history' : '';
      const [queriesRes, statsRes] = await Promise.all([
        fetch(`/api/admin/general-queries${typeParam}`),
        fetch('/api/admin/general-queries/stats'),
      ]);
      if (queriesRes.ok) {
        const d = await queriesRes.json();
        if (d.success) setQueries(d.data);
      }
      if (statsRes.ok) {
        const d = await statsRes.json();
        if (d.success) setStats(d.data);
      }
    } catch (err) {
      console.error('Failed to fetch queries:', err);
    }
    setLoading(false);
  }, [activeTab]);

  useEffect(() => { fetchQueries(); }, [fetchQueries]);

  const toggleRead = async (id: string, currentIsRead: boolean) => {
    setQueries(prev => prev.map(q => q.id === id ? { ...q, isRead: !currentIsRead } : q));
    try {
      await fetch('/api/admin/general-queries', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, isRead: !currentIsRead }),
      });
      const statsRes = await fetch('/api/admin/general-queries/stats');
      if (statsRes.ok) {
        const d = await statsRes.json();
        if (d.success) setStats(d.data);
      }
    } catch (err) {
      console.error('Toggle read failed:', err);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    setQueries(prev => prev.filter(q => q.id !== id));
    setDeleteTarget(null);
    try {
      await fetch('/api/admin/general-queries', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const statsRes = await fetch('/api/admin/general-queries/stats');
      if (statsRes.ok) {
        const d = await statsRes.json();
        if (d.success) setStats(d.data);
      }
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const accentColor = currentTheme === 'rose' ? '#e11d48' : currentTheme === 'emerald' ? '#059669' : '#4f46e5';
  const bgColor = isDarkMode ? '#0b1326' : '#f8fafc';
  const surfaceColor = isDarkMode ? '#0b1326' : '#ffffff';
  const onSurfaceColor = isDarkMode ? '#dae2fd' : '#0f172a';
  const surfaceVariant = isDarkMode ? '#475569' : '#475569';
  const borderColor = isDarkMode ? '#2d3449' : '#e2e8f0';
  const cardBg = isDarkMode ? '#171f33' : '#ffffff';

  const toggleTheme = () => setIsThemeMenuOpen(!isThemeMenuOpen);
  const handleThemeSelect = (t: 'indigo' | 'emerald' | 'rose') => { setCurrentTheme(t); setIsThemeMenuOpen(false); };

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
        {/* Sidebar */}
        <aside className="flex flex-col h-full p-4 gap-2 fixed h-screen w-64 left-0 top-0 z-50 border-r transition-colors duration-500 custom-scrollbar" style={{ backgroundColor: surfaceColor, borderColor }}>
          <div className="flex flex-col items-center gap-1 px-2 mb-6 mt-2 text-center">
            <Image src="/logo.png" alt="Logo" width={36} height={36} className="rounded-xl" />
            <p className="text-[10px] font-bold uppercase tracking-wider opacity-80" style={{ color: onSurfaceColor }}>Admin Console</p>
          </div>
          <nav className="flex flex-col gap-1 overflow-y-auto custom-scrollbar">
            {[
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
              { href: '/admin/general-queries', icon: 'forum', label: 'General Queries' },
              { href: '/admin/banners', icon: 'view_carousel', label: 'Banners' },
              { href: '/admin/testimonials', icon: 'star', label: 'Testimonials' },
              { href: '/admin/tax-calculation', icon: 'calculate', label: 'Tax Calculation' },
            ].map(item => (
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

        {/* Main */}
        <main className="ml-64 min-h-screen pb-16">
          {/* Header */}
          <header className="flex justify-between items-center w-full px-8 py-4 border-b backdrop-blur-md sticky top-0 z-40" style={{ backgroundColor: surfaceColor + 'cc', borderColor }}>
            <div className="flex items-center gap-4 flex-1">
              <h1 className="text-lg font-bold" style={{ color: onSurfaceColor }}>General Queries</h1>
              {stats.unread > 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: '#f59e0b' + '20', color: '#f59e0b' }}>
                  {stats.unread} unread
                </span>
              )}
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
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-5 rounded-xl border transition-colors" style={{ backgroundColor: cardBg, borderColor }}>
                <div className="flex items-center gap-3 mb-2">
                  <span className="material-symbols-outlined text-[20px]" style={{ color: accentColor }}>forum</span>
                  <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: surfaceVariant }}>Total Queries</span>
                </div>
                <p className="text-3xl font-bold" style={{ color: onSurfaceColor }}>{stats.total}</p>
              </div>
              <div className="p-5 rounded-xl border transition-colors" style={{ backgroundColor: cardBg, borderColor }}>
                <div className="flex items-center gap-3 mb-2">
                  <span className="material-symbols-outlined text-[20px]" style={{ color: '#f59e0b' }}>mark_email_unread</span>
                  <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: surfaceVariant }}>Unread Queries</span>
                </div>
                <p className="text-3xl font-bold" style={{ color: '#f59e0b' }}>{stats.unread}</p>
              </div>
            </div>

            {/* Tab Switcher */}
            <div className="flex items-center gap-2 border-b pb-2" style={{ borderColor }}>
              <button onClick={() => setActiveTab('recent')}
                className="px-4 py-2 text-sm font-bold rounded-t-lg transition-all"
                style={{ color: activeTab === 'recent' ? accentColor : surfaceVariant, borderBottom: activeTab === 'recent' ? `2px solid ${accentColor}` : '2px solid transparent' }}>
                Recent (10)
              </button>
              <button onClick={() => setActiveTab('history')}
                className="px-4 py-2 text-sm font-bold rounded-t-lg transition-all"
                style={{ color: activeTab === 'history' ? accentColor : surfaceVariant, borderBottom: activeTab === 'history' ? `2px solid ${accentColor}` : '2px solid transparent' }}>
                History
              </button>
            </div>

            {/* Query List */}
            {loading ? (
              <ProLoader variant="admin" fullScreen={false} />
            ) : queries.length === 0 ? (
              <div className="p-12 text-center rounded-xl border" style={{ backgroundColor: cardBg, borderColor }}>
                <span className="material-symbols-outlined text-4xl" style={{ color: surfaceVariant }}>forum</span>
                <p className="mt-3 text-sm font-medium" style={{ color: surfaceVariant }}>No queries yet. Queries from the Contact Us form will appear here.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {queries.map(q => (
                  <div key={q.id} className="rounded-xl border transition-all hover:brightness-95" style={{ backgroundColor: cardBg, borderColor }}>
                    {/* Card Header */}
                    <div className="p-5 cursor-pointer" onClick={() => setExpandedId(expandedId === q.id ? null : q.id)}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-bold truncate" style={{ color: onSurfaceColor }}>{q.subject}</span>
                            {!q.isRead && <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: '#f59e0b' }} />}
                          </div>
                          <div className="flex items-center gap-3 text-xs" style={{ color: surfaceVariant }}>
                            <span>{q.name}</span>
                            <span>{q.email}</span>
                            {q.phone && <span>{q.phone}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${q.isRead ? 'text-green-600 bg-green-500/10' : 'text-orange-600 bg-orange-500/10'}`}>
                            {q.isRead ? 'Read' : 'Unread'}
                          </span>
                          <span className="text-[10px] whitespace-nowrap" style={{ color: surfaceVariant }}>{timeAgo(q.createdAt)}</span>
                        </div>
                      </div>

                      {/* Message Preview */}
                      <div className="mt-3">
                        {expandedId === q.id ? (
                          <p className="text-sm whitespace-pre-wrap" style={{ color: onSurfaceColor }}>{q.message}</p>
                        ) : (
                          <p className="text-sm" style={{ color: surfaceVariant }}>
                            {truncate(q.message, 100)}
                            {q.message.length > 100 && (
                              <span className="font-semibold ml-1 cursor-pointer" style={{ color: accentColor }}>Read More</span>
                            )}
                          </p>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t" style={{ borderColor }}>
                        <button onClick={(e) => { e.stopPropagation(); toggleRead(q.id, q.isRead); }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all hover:brightness-95 border"
                          style={{ borderColor, color: q.isRead ? surfaceVariant : '#f59e0b', backgroundColor: q.isRead ? 'transparent' : '#f59e0b' + '10' }}>
                          <span className="material-symbols-outlined text-[14px]">{q.isRead ? 'mark_email_unread' : 'mark_email_read'}</span>
                          {q.isRead ? 'Mark Unread' : 'Mark Read'}
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(q); }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all hover:brightness-95 border"
                          style={{ borderColor, color: '#ef4444', backgroundColor: '#ef4444' + '08' }}>
                          <span className="material-symbols-outlined text-[14px]">delete</span>
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="w-full max-w-sm p-6 rounded-2xl border shadow-2xl" style={{ backgroundColor: surfaceColor, borderColor }}>
            <div className="flex items-center gap-3 mb-4">
              <span className="material-symbols-outlined text-2xl" style={{ color: '#ef4444' }}>warning</span>
              <h3 className="text-lg font-bold" style={{ color: onSurfaceColor }}>Delete Query</h3>
            </div>
            <p className="text-sm mb-6" style={{ color: surfaceVariant }}>
              Are you sure you want to delete this query from {deleteTarget.name}?
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 py-2.5 rounded-lg border text-sm font-bold" style={{ borderColor, color: surfaceVariant }}>Cancel</button>
              <button onClick={confirmDelete} className="flex-1 py-2.5 rounded-lg text-sm font-bold text-white" style={{ backgroundColor: '#ef4444' }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
