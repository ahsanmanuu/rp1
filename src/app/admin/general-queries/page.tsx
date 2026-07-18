'use client';

import React, { useState, useEffect, useCallback } from 'react';
import ProLoader from '@/components/ProLoader';
import AdminSidebar from '@/components/AdminSidebar';
import { Theme, getAccentColor, themes } from '@/components/AdminThemeStyles';

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

const ALL_THEMES: Theme[] = ['indigo', 'emerald', 'rose', 'violet', 'amber', 'cyan', 'sky', 'pink', 'orange', 'lime', 'teal', 'fuchsia', 'red', 'yellow', 'stone', 'zinc'];

export default function AdminGeneralQueriesPage() {
  const [currentTheme, setCurrentTheme] = useState<Theme>('indigo');
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
  const [adminName, setAdminName] = useState('Admin Root');

  const [loading, setLoading] = useState(true);
  const [queries, setQueries] = useState<any[]>([]);
  const [stats, setStats] = useState<{ total: number; unread: number }>({ total: 0, unread: 0 });
  const [activeTab, setActiveTab] = useState<'recent' | 'history'>('recent');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  useEffect(() => {
    const savedTheme = localStorage.getItem('latexify-admin-theme') as Theme | null;
    const savedMode = localStorage.getItem('latexify-admin-mode');
    if (savedTheme && themes[savedTheme]) setCurrentTheme(savedTheme);
    if (savedMode) setIsDarkMode(savedMode === 'dark');
    const storedName = localStorage.getItem('latexify-admin-name');
    if (storedName) setAdminName(storedName);
  }, []);

  useEffect(() => {
    localStorage.setItem('latexify-admin-theme', currentTheme);
    localStorage.setItem('latexify-admin-mode', isDarkMode ? 'dark' : 'light');
    window.dispatchEvent(new Event('admin-theme-changed'));
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

  const accentColor = getAccentColor(currentTheme, isDarkMode);
  const bgColor = isDarkMode ? '#0b1326' : '#f8fafc';
  const surfaceColor = isDarkMode ? '#0b1326' : '#ffffff';
  const onSurfaceColor = isDarkMode ? '#dae2fd' : '#0f172a';
  const surfaceVariant = isDarkMode ? '#475569' : '#475569';
  const borderColor = isDarkMode ? '#2d3449' : '#e2e8f0';
  const cardBg = isDarkMode ? '#171f33' : '#ffffff';

  const toggleTheme = () => setIsThemeMenuOpen(!isThemeMenuOpen);
  const handleThemeSelect = (t: Theme) => { setCurrentTheme(t); setIsThemeMenuOpen(false); };

  return (
    <div className="min-h-screen transition-colors duration-500" style={{ backgroundColor: bgColor, color: onSurfaceColor }}>
      <div className="flex min-h-screen">
        <AdminSidebar isDarkMode={isDarkMode} adminName={adminName} />

        <main className="flex-1 ml-0 lg:ml-64 min-h-screen pb-16">
          <header className="flex justify-between items-center w-full px-4 sm:px-8 py-4 border-b backdrop-blur-md sticky top-0 z-40" style={{ backgroundColor: surfaceColor + 'cc', borderColor }}>
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <h1 className="text-lg font-bold truncate" style={{ color: onSurfaceColor }}>General Queries</h1>
              {stats.unread > 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0" style={{ backgroundColor: '#f59e0b' + '20', color: '#f59e0b' }}>
                  {stats.unread} unread
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 sm:gap-6 ml-4 shrink-0">
              <div className="relative">
                <button onClick={toggleTheme} className="flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors" style={{ borderColor, color: surfaceVariant }}>
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: accentColor }} />
                  <span className="hidden sm:inline">Theme</span>
                  <span className="material-symbols-outlined text-[18px]">expand_more</span>
                </button>
                {isThemeMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-48 max-h-80 overflow-y-auto rounded-xl border shadow-lg z-50 custom-scrollbar" style={{ backgroundColor: surfaceColor, borderColor }}>
                    {ALL_THEMES.map(t => (
                      <button key={t} onClick={() => handleThemeSelect(t)} className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-bold hover:brightness-90 transition-all border-b last:border-b-0" style={{ borderColor, color: onSurfaceColor, backgroundColor: currentTheme === t ? accentColor + '20' : 'transparent', textTransform: 'capitalize' }}>
                        <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: getAccentColor(t, true) }} />
                        {t}
                        {currentTheme === t && <span className="material-symbols-outlined ml-auto text-[14px]">check</span>}
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
                <div className="hidden sm:block">
                  <p className="text-sm font-semibold" style={{ color: onSurfaceColor }}>{adminName}</p>
                  <p className="text-[10px]" style={{ color: surfaceVariant }}>Administrator</p>
                </div>
              </div>
            </div>
          </header>

          <div className="px-4 sm:px-8 py-6 space-y-6">
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
