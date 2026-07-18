'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { createPb } from '@/lib/pb';

interface EmailLog {
  id: string;
  to: string;
  toName: string | null;
  subject: string;
  emailType: string;
  status: string;
  userId: string | null;
  errorMsg: string | null;
  sentAt: string;
}

interface TypeStats {
  [key: string]: { sent: number; failed: number };
}

const EMAIL_TYPE_LABELS: Record<string, string> = {
  recovery: 'Password Recovery',
  blacklist: 'Account Suspended',
  reactivation: 'Account Reactivated',
  expiry_reminder: 'Expiry Reminder',
  ticket_created: 'Ticket Created',
  ticket_status: 'Ticket Status Update',
  ticket_reply: 'Ticket Reply',
};

const EMAIL_TYPE_ICONS: Record<string, string> = {
  recovery: 'lock_reset',
  blacklist: 'block',
  reactivation: 'check_circle',
  expiry_reminder: 'schedule',
  ticket_created: 'confirmation_number',
  ticket_status: 'update',
  ticket_reply: 'reply',
};

export default function AdminEmailsPage() {
  const [currentTheme, setCurrentTheme] = useState<'indigo' | 'emerald' | 'rose'>('indigo');
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
  const [adminName, setAdminName] = useState<string>('Admin Root');
  const [hydrated, setHydrated] = useState(false);

  const [emails, setEmails] = useState<EmailLog[]>([]);
  const [typeStats, setTypeStats] = useState<TypeStats>({});
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 0 });
  const [filterType, setFilterType] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedEmail, setSelectedEmail] = useState<EmailLog | null>(null);

  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [adminNotifications, setAdminNotifications] = useState<any[]>([]);
  const [adminUnreadCount, setAdminUnreadCount] = useState(0);
  const [showAdminNotifications, setShowAdminNotifications] = useState(false);
  const [lastSyncText, setLastSyncText] = useState<string>('Just now');

  const fetchData = async (page = 1) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '50',
      });
      if (filterType) params.set('type', filterType);
      if (filterStatus) params.set('status', filterStatus);
      if (searchQuery) params.set('search', searchQuery);

      const [emailRes, notifRes] = await Promise.allSettled([
        fetch(`/api/admin/emails?${params}`),
        fetch('/api/admin/notifications?unreadOnly=true'),
      ]);

      if (emailRes.status === 'fulfilled') {
        const data = await emailRes.value.json();
        if (data.success) {
          setEmails(data.emails);
          setPagination(data.pagination);
          setTypeStats(data.stats);
        }
      }
      if (notifRes.status === 'fulfilled') {
        const notifData = await notifRes.value.json();
        setAdminNotifications(notifData.notifications || []);
        setAdminUnreadCount(notifData.unreadCount || 0);
      }
      setLastSyncText('Just now');
    } catch (err) {
      console.error('Failed to load email logs', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { setHydrated(true); }, []);

  useEffect(() => {
    const savedTheme = localStorage.getItem('latexify-admin-theme') as 'indigo' | 'emerald' | 'rose' | null;
    const savedMode = localStorage.getItem('latexify-admin-mode');
    if (savedTheme) setCurrentTheme(savedTheme);
    if (savedMode) setIsDarkMode(savedMode === 'dark');
    const storedName = localStorage.getItem('latexify-admin-name');
    if (storedName) setAdminName(storedName);
    fetchData();
    const interval = setInterval(() => fetchData(), 30000);
    return () => clearInterval(interval);
  }, []);

  // ── PB Realtime Subscriptions ──
  useEffect(() => {
    const pb = createPb();
    const unsubFns: (() => void)[] = [];
    const setup = async () => {
      for (const coll of ['email_logs']) {
        try {
          const unsub = await pb.collection(coll).subscribe('*', () => { fetchData(); });
          unsubFns.push(unsub);
        } catch {}
      }
    };
    setup();
    return () => { for (const fn of unsubFns) { try { fn(); } catch {} } };
  }, []);

  useEffect(() => {
    localStorage.setItem('latexify-admin-theme', currentTheme);
    localStorage.setItem('latexify-admin-mode', isDarkMode ? 'dark' : 'light');
  }, [currentTheme, isDarkMode]);

  useEffect(() => {
    const syncInterval = setInterval(() => {
      setLastSyncText(prev => {
        if (prev === 'Just now') return '10s ago';
        if (prev === '10s ago') return '20s ago';
        return '30s ago';
      });
    }, 10000);
    return () => clearInterval(syncInterval);
  }, []);

  const handleSearch = () => fetchData(1);
  const handlePageChange = (newPage: number) => fetchData(newPage);

  const totalSent = Object.values(typeStats).reduce((sum, s) => sum + s.sent, 0);
  const totalFailed = Object.values(typeStats).reduce((sum, s) => sum + s.failed, 0);

  const toggleTheme = () => setIsThemeMenuOpen(!isThemeMenuOpen);
  const handleThemeSelect = (theme: 'indigo' | 'emerald' | 'rose') => {
    setCurrentTheme(theme);
    setIsThemeMenuOpen(false);
  };

  return (
    <div className="min-h-screen transition-colors duration-500" style={{ backgroundColor: 'var(--color-admin-background)', color: 'var(--color-admin-on-surface)' }}>
      <style dangerouslySetInnerHTML={{ __html: `
        :root {
          ${isDarkMode ? `
            --color-admin-primary: ${currentTheme === 'rose' ? '#fda4af' : currentTheme === 'emerald' ? '#6ee7b7' : '#c3c0ff'};
            --color-admin-primary-container: ${currentTheme === 'rose' ? '#e11d48' : currentTheme === 'emerald' ? '#059669' : '#4f46e5'};
            --color-admin-on-primary-container: ${currentTheme === 'rose' ? '#ffe4e6' : currentTheme === 'emerald' ? '#d1fae5' : '#dad7ff'};
            --color-admin-secondary: ${currentTheme === 'rose' ? '#fecdd3' : currentTheme === 'emerald' ? '#a7f3d0' : '#c0c1ff'};
            --color-admin-secondary-container: ${currentTheme === 'rose' ? '#be123c' : currentTheme === 'emerald' ? '#047857' : '#3131c0'};
            --color-admin-on-secondary-container: ${currentTheme === 'rose' ? '#fff1f2' : currentTheme === 'emerald' ? '#ecfdf5' : '#b0b2ff'};
            --color-admin-background: #0b1326;
            --color-admin-surface: #0b1326;
            --color-admin-surface-container: #171f33;
            --color-admin-surface-container-low: #131b2e;
            --color-admin-surface-container-high: #222a3d;
            --color-admin-surface-container-highest: #2d3449;
            --color-admin-on-surface: #dae2fd;
            --color-admin-on-surface-variant: #c7c4d8;
            --color-admin-outline: #918fa1;
            --color-admin-outline-variant: #2d3449;
            --color-admin-error: #ffb4ab;
            --color-admin-on-error: #690005;
            --color-admin-error-container: #93000a;
            --color-admin-on-error-container: #ffdad6;
            --color-admin-tertiary: #ffb695;
            --color-admin-tertiary-container: #a44100;
            --color-admin-on-tertiary-container: #ffd2be;
          ` : `
            --color-admin-primary: ${currentTheme === 'rose' ? '#e11d48' : currentTheme === 'emerald' ? '#059669' : '#4f46e5'};
            --color-admin-primary-container: ${currentTheme === 'rose' ? '#ffe4e6' : currentTheme === 'emerald' ? '#d1fae5' : '#dad7ff'};
            --color-admin-on-primary-container: ${currentTheme === 'rose' ? '#e11d48' : currentTheme === 'emerald' ? '#059669' : '#4f46e5'};
            --color-admin-secondary: ${currentTheme === 'rose' ? '#fecdd3' : currentTheme === 'emerald' ? '#a7f3d0' : '#c0c1ff'};
            --color-admin-secondary-container: ${currentTheme === 'rose' ? '#ffe4e6' : currentTheme === 'emerald' ? '#d1fae5' : '#e0e7ff'};
            --color-admin-on-secondary-container: ${currentTheme === 'rose' ? '#e11d48' : currentTheme === 'emerald' ? '#059669' : '#3730a3'};
            --color-admin-background: #f8fafc;
            --color-admin-surface: #ffffff;
            --color-admin-surface-container: #f1f5f9;
            --color-admin-surface-container-low: #f8fafc;
            --color-admin-surface-container-high: #e2e8f0;
            --color-admin-surface-container-highest: #cbd5e1;
            --color-admin-on-surface: #0f172a;
            --color-admin-on-surface-variant: #475569;
            --color-admin-outline: #94a3b8;
            --color-admin-outline-variant: #e2e8f0;
            --color-admin-error: #ba1a1a;
            --color-admin-on-error: #ffffff;
            --color-admin-error-container: #ffdad6;
            --color-admin-on-error-container: #410002;
            --color-admin-tertiary: #f59e0b;
            --color-admin-tertiary-container: #fffbeb;
            --color-admin-on-tertiary-container: #92400e;
          `}
        }
      `}} />

      {toastMessage && (
        <div className="fixed top-20 right-6 z-[10000] px-6 py-3 rounded-xl shadow-2xl flex items-center gap-2 border font-bold text-sm transition-all"
          style={{
            backgroundColor: toastMessage.type === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
            borderColor: toastMessage.type === 'success' ? '#10b981' : '#ef4444',
            color: toastMessage.type === 'success' ? '#10b981' : '#ef4444'
          }}>
          <span className="material-symbols-outlined">{toastMessage.type === 'success' ? 'check_circle' : 'error'}</span>
          {toastMessage.text}
        </div>
      )}

      {/* Sidebar */}
      <aside className="flex flex-col h-full p-4 gap-2 fixed h-screen w-64 left-0 top-0 border-r z-50 transition-colors duration-500"
        style={{ backgroundColor: 'var(--color-admin-surface-container)', borderColor: 'var(--color-admin-outline-variant)' }}>
        <div className="flex flex-col items-center gap-1 px-2 mb-6 mt-2 text-center">
          <Image src="/logo.png" alt="Latexify Logo" width={0} height={0} sizes="100%" className="w-48 h-12 object-contain"
            style={{ filter: isDarkMode ? 'brightness(0) invert(1)' : 'none' }} />
          <p className="text-[10px] font-bold uppercase tracking-wider opacity-85 mt-1"
            style={{ color: 'var(--color-admin-primary)' }}>Admin Console</p>
        </div>
        <nav className="flex flex-col gap-1 overflow-y-auto custom-scrollbar">
          <Link href="/admin/dashboard" className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-black/5 dark:hover:bg-white/5 transition-all rounded-lg"
            style={{ color: 'var(--color-admin-on-surface-variant)' }}>
            <span className="material-symbols-outlined">dashboard</span>Dashboard
          </Link>
          <Link href="/admin/billings" className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-black/5 dark:hover:bg-white/5 transition-all rounded-lg"
            style={{ color: 'var(--color-admin-on-surface-variant)' }}>
            <span className="material-symbols-outlined">payments</span>Bill and Payments
          </Link>
          <Link href="/admin/users" className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-black/5 dark:hover:bg-white/5 transition-all rounded-lg"
            style={{ color: 'var(--color-admin-on-surface-variant)' }}>
            <span className="material-symbols-outlined">group</span>Users
          </Link>
          <Link href="/admin/profile" className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-black/5 dark:hover:bg-white/5 transition-all rounded-lg"
            style={{ color: 'var(--color-admin-on-surface-variant)' }}>
            <span className="material-symbols-outlined">settings</span>Profile and Plan Setting
          </Link>
          <Link href="/admin/ai-caps" className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-black/5 dark:hover:bg-white/5 transition-all rounded-lg"
            style={{ color: 'var(--color-admin-on-surface-variant)' }}>
            <span className="material-symbols-outlined">speed</span>AI Usage &amp; Caps Rules
          </Link>
          <Link href="/admin/ai-analysis" className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-black/5 dark:hover:bg-white/5 transition-all rounded-lg"
            style={{ color: 'var(--color-admin-on-surface-variant)' }}>
            <span className="material-symbols-outlined">psychology</span>AI Analysis
          </Link>
          <Link href="/admin/help" className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-black/5 dark:hover:bg-white/5 transition-all rounded-lg"
            style={{ color: 'var(--color-admin-on-surface-variant)' }}>
            <span className="material-symbols-outlined">help</span>Help and Support
          </Link>
          <Link href="/admin/offers" className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-black/5 dark:hover:bg-white/5 transition-all rounded-lg"
            style={{ color: 'var(--color-admin-on-surface-variant)' }}>
            <span className="material-symbols-outlined">local_offer</span>Offers
          </Link>
          <a className="flex items-center gap-3 px-4 py-3 text-sm rounded-lg transition-all translate-x-1 duration-200 shadow-sm"
            style={{ backgroundColor: 'var(--color-admin-secondary-container)', color: 'var(--color-admin-on-secondary-container)' }} href="#">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>mail</span>Email History
          </a>
          <Link href="/admin/social-media" className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-black/5 dark:hover:bg-white/5 transition-all rounded-lg"
            style={{ color: 'var(--color-admin-on-surface-variant)' }}>
            <span className="material-symbols-outlined">share</span>Social Media
          </Link>
          <Link href="/admin/tax-calculation" className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-black/5 dark:hover:bg-white/5 transition-all rounded-lg"
            style={{ color: 'var(--color-admin-on-surface-variant)' }}>
            <span className="material-symbols-outlined">calculate</span>Tax Calculation
          </Link>
          <div className="border-t my-2" style={{ borderColor: 'var(--color-admin-outline-variant)' }}></div>
          <a href="/pb/_/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-black/5 dark:hover:bg-white/5 transition-all rounded-lg"
            style={{ color: 'var(--color-admin-primary)' }}>
            <span className="material-symbols-outlined">database</span>PB Dashboard
          </a>
        </nav>
        <div className="mt-auto p-4 rounded-xl border text-sm"
          style={{ backgroundColor: 'var(--color-admin-surface-container-low)', borderColor: 'var(--color-admin-outline-variant)' }}>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: 'var(--color-admin-primary)' }}></div>
            <span style={{ color: 'var(--color-admin-primary)' }}>System Online</span>
          </div>
          <p className="text-xs" style={{ color: 'var(--color-admin-on-surface-variant)' }}>Version 4.2.0-stable</p>
        </div>
      </aside>

      {/* Main Content */}
      <main className="ml-0 lg:ml-64 min-h-screen pb-16">
        <header className="flex justify-between items-center w-full px-8 py-4 border-b z-40 sticky top-0 transition-colors duration-500" style={{ backgroundColor: 'var(--color-admin-surface)', borderColor: 'var(--color-admin-outline-variant)' }}>
          <div className="flex items-center gap-4 flex-1">
            <div className="relative w-full max-w-3xl">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--color-admin-on-surface-variant)' }}>search</span>
              <input className="w-full border rounded-lg pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-primary-container focus:border-primary outline-none transition-all"
                style={{ backgroundColor: 'var(--color-admin-surface-container-lowest)', borderColor: 'var(--color-admin-outline-variant)', color: 'var(--color-admin-on-surface)' }}
                placeholder="Search emails by recipient, name, or subject..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <button onClick={handleSearch} className="px-4 py-2 rounded-lg text-sm font-medium transition-all" style={{ backgroundColor: 'var(--color-admin-primary)', color: 'white' }}>
              Search
            </button>
          </div>
          <div className="flex items-center gap-6 ml-4">
            <div className="relative">
              <button onClick={toggleTheme} className="flex items-center gap-2 px-3 py-1.5 rounded-full border hover:bg-black/5 dark:hover:bg-white/5 transition-colors" style={{ borderColor: 'var(--color-admin-outline-variant)', color: 'var(--color-admin-on-surface-variant)' }}>
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: 'var(--color-admin-primary)' }}></span>
                <span className="text-xs font-medium">Theme</span>
                <span className="material-symbols-outlined text-[18px]">expand_more</span>
              </button>
              {isThemeMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 rounded-xl border shadow-xl overflow-hidden z-50" style={{ backgroundColor: 'var(--color-admin-surface-container-high)', borderColor: 'var(--color-admin-outline-variant)' }}>
                  <div className="p-2 flex flex-col gap-1">
                    <button onClick={() => handleThemeSelect('indigo')} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition-colors w-full text-left" style={{ color: 'var(--color-admin-on-surface)' }}>
                      <span className="w-4 h-4 rounded-full bg-indigo-500"></span><span className="text-sm">Indigo</span>
                    </button>
                    <button onClick={() => handleThemeSelect('emerald')} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition-colors w-full text-left" style={{ color: 'var(--color-admin-on-surface)' }}>
                      <span className="w-4 h-4 rounded-full bg-emerald-500"></span><span className="text-sm">Emerald</span>
                    </button>
                    <button onClick={() => handleThemeSelect('rose')} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition-colors w-full text-left" style={{ color: 'var(--color-admin-on-surface)' }}>
                      <span className="w-4 h-4 rounded-full bg-rose-500"></span><span className="text-sm">Rose</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
            <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors" style={{ color: 'var(--color-admin-on-surface-variant)' }}>
              <span className="material-symbols-outlined">{isDarkMode ? 'light_mode' : 'dark_mode'}</span>
            </button>
            <div className="relative">
              <button onClick={() => setShowAdminNotifications(!showAdminNotifications)} className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors relative" style={{ color: 'var(--color-admin-on-surface-variant)' }}>
                <span className="material-symbols-outlined">notifications</span>
                {adminUnreadCount > 0 && <span className="absolute -top-1 -right-1 text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center text-white bg-red-500">{adminUnreadCount}</span>}
              </button>
              {showAdminNotifications && (
                <div className="absolute right-0 top-full mt-2 w-80 rounded-2xl border shadow-2xl z-[110] animate-in fade-in zoom-in-95 duration-150" style={{ backgroundColor: 'var(--color-admin-surface-container-high)', borderColor: 'var(--color-admin-outline-variant)' }}>
                  <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--color-admin-outline-variant)' }}>
                    <span className="text-xs font-bold" style={{ color: 'var(--color-admin-on-surface)' }}>Notifications</span>
                    {adminUnreadCount > 0 && (
                      <button onClick={async () => { try { await fetch('/api/admin/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ markAll: true }) }); setAdminNotifications([]); setAdminUnreadCount(0); } catch {} }}
                        className="text-[10px] font-bold hover:underline flex items-center gap-1" style={{ color: 'var(--color-admin-primary)' }}>
                        <span className="material-symbols-outlined text-xs">done_all</span> Mark all read
                      </button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto custom-scrollbar">
                    {adminNotifications.length === 0 ? (
                      <p className="p-6 text-xs text-center" style={{ color: 'var(--color-admin-on-surface-variant)' }}>No notifications yet</p>
                    ) : adminNotifications.map(n => (
                      <div key={n.id} className={`px-4 py-3 border-b transition-colors relative group ${n.isRead ? 'opacity-60' : ''}`} style={{ borderColor: 'var(--color-admin-outline-variant)', backgroundColor: n.isRead ? 'transparent' : 'var(--color-admin-primary-container)' }}>
                        <button onClick={async () => { try { await fetch('/api/admin/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ notificationId: n.id }) }); setAdminNotifications((prev: any[]) => prev.filter((x: any) => x.id !== n.id)); setAdminUnreadCount((p: number) => Math.max(0, p - 1)); } catch {} }}
                          className="absolute right-3 top-3 p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100" title="Dismiss">
                          <span className="material-symbols-outlined text-xs block" style={{ color: 'var(--color-admin-on-surface-variant)' }}>close</span>
                        </button>
                        <div className="pr-6">
                          <p className="text-[11px] font-bold mb-0.5" style={{ color: 'var(--color-admin-on-surface)' }}>{n.title}</p>
                          <p className="text-[10px] leading-relaxed" style={{ color: 'var(--color-admin-on-surface-variant)' }}>{n.body}</p>
                          <p className="text-[9px] mt-1" style={{ color: 'var(--color-admin-on-surface-variant)', opacity: 0.6 }}>
                            {new Date(n.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: 'var(--color-admin-primary)' }}>{adminName.charAt(0)}</div>
              <div><p className="text-sm font-semibold" style={{ color: 'var(--color-admin-on-surface)' }}>{adminName}</p><p className="text-[10px]" style={{ color: 'var(--color-admin-on-surface-variant)' }}>Last sync: {lastSyncText}</p></div>
            </div>
          </div>
        </header>

        <div className="px-8 py-6">
          {/* Page Title */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold" style={{ color: 'var(--color-admin-on-surface)' }}>Email History</h1>
              <p className="text-sm mt-1" style={{ color: 'var(--color-admin-on-surface-variant)' }}>Track all automated emails sent by the platform</p>
            </div>
            <button onClick={() => fetchData(pagination.page)} className="flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium hover:bg-black/5 dark:hover:bg-white/5 transition-all" style={{ borderColor: 'var(--color-admin-outline-variant)', color: 'var(--color-admin-on-surface)' }}>
              <span className="material-symbols-outlined text-[18px]">refresh</span>Refresh
            </button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="p-5 rounded-xl border transition-colors" style={{ backgroundColor: 'var(--color-admin-surface-container)', borderColor: 'var(--color-admin-outline-variant)' }}>
              <div className="flex items-center gap-3 mb-2">
                <span className="material-symbols-outlined text-[20px]" style={{ color: 'var(--color-admin-primary)' }}>mail</span>
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-admin-on-surface-variant)' }}>Total Sent</span>
              </div>
              <p className="text-3xl font-bold" style={{ color: 'var(--color-admin-on-surface)' }}>{totalSent}</p>
            </div>
            <div className="p-5 rounded-xl border transition-colors" style={{ backgroundColor: 'var(--color-admin-surface-container)', borderColor: 'var(--color-admin-outline-variant)' }}>
              <div className="flex items-center gap-3 mb-2">
                <span className="material-symbols-outlined text-[20px] text-red-500">error</span>
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-admin-on-surface-variant)' }}>Failed</span>
              </div>
              <p className="text-3xl font-bold text-red-500">{totalFailed}</p>
            </div>
            <div className="p-5 rounded-xl border transition-colors" style={{ backgroundColor: 'var(--color-admin-surface-container)', borderColor: 'var(--color-admin-outline-variant)' }}>
              <div className="flex items-center gap-3 mb-2">
                <span className="material-symbols-outlined text-[20px]" style={{ color: 'var(--color-admin-primary)' }}>lock_reset</span>
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-admin-on-surface-variant)' }}>Recovery</span>
              </div>
              <p className="text-3xl font-bold" style={{ color: 'var(--color-admin-on-surface)' }}>{(typeStats.recovery?.sent || 0)}</p>
            </div>
            <div className="p-5 rounded-xl border transition-colors" style={{ backgroundColor: 'var(--color-admin-surface-container)', borderColor: 'var(--color-admin-outline-variant)' }}>
              <div className="flex items-center gap-3 mb-2">
                <span className="material-symbols-outlined text-[20px]" style={{ color: 'var(--color-admin-primary)' }}>confirmation_number</span>
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-admin-on-surface-variant)' }}>Tickets</span>
              </div>
              <p className="text-3xl font-bold" style={{ color: 'var(--color-admin-on-surface)' }}>{(typeStats.ticket_created?.sent || 0) + (typeStats.ticket_status?.sent || 0) + (typeStats.ticket_reply?.sent || 0)}</p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-4 mb-6">
            <select value={filterType} onChange={e => { setFilterType(e.target.value); setTimeout(() => fetchData(1), 0); }}
              className="px-4 py-2 rounded-lg border text-sm" style={{ backgroundColor: 'var(--color-admin-surface-container-lowest)', borderColor: 'var(--color-admin-outline-variant)', color: 'var(--color-admin-on-surface)' }}>
              <option value="">All Types</option>
              <option value="recovery">Password Recovery</option>
              <option value="blacklist">Account Suspended</option>
              <option value="reactivation">Account Reactivated</option>
              <option value="expiry_reminder">Expiry Reminder</option>
              <option value="ticket_created">Ticket Created</option>
              <option value="ticket_status">Ticket Status</option>
              <option value="ticket_reply">Ticket Reply</option>
            </select>
            <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setTimeout(() => fetchData(1), 0); }}
              className="px-4 py-2 rounded-lg border text-sm" style={{ backgroundColor: 'var(--color-admin-surface-container-lowest)', borderColor: 'var(--color-admin-outline-variant)', color: 'var(--color-admin-on-surface)' }}>
              <option value="">All Status</option>
              <option value="sent">Sent</option>
              <option value="failed">Failed</option>
            </select>
            <span className="text-sm ml-auto" style={{ color: 'var(--color-admin-on-surface-variant)' }}>
              {pagination.total} total emails
            </span>
          </div>

          {/* Table */}
          <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: 'var(--color-admin-surface)', borderColor: 'var(--color-admin-outline-variant)' }}>
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: 'var(--color-admin-primary)' }}></div>
              </div>
            ) : emails.length === 0 ? (
              <div className="text-center py-20">
                <span className="material-symbols-outlined text-[48px] mb-4 block" style={{ color: 'var(--color-admin-on-surface-variant)' }}>mail</span>
                <p className="text-lg font-semibold" style={{ color: 'var(--color-admin-on-surface)' }}>No emails found</p>
                <p className="text-sm" style={{ color: 'var(--color-admin-on-surface-variant)' }}>Emails sent by the platform will appear here</p>
              </div>
            ) : (
              <table className="w-full text-left">
                <thead className="border-b" style={{ borderColor: 'var(--color-admin-outline-variant)' }}>
                  <tr>
                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-admin-on-surface-variant)' }}>Type</th>
                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-admin-on-surface-variant)' }}>Recipient</th>
                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-admin-on-surface-variant)' }}>Subject</th>
                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-admin-on-surface-variant)' }}>Status</th>
                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-admin-on-surface-variant)' }}>Date</th>
                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-admin-on-surface-variant)' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {emails.map(email => (
                    <tr key={email.id} className="border-b hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer" style={{ borderColor: 'var(--color-admin-outline-variant)' }} onClick={() => setSelectedEmail(selectedEmail?.id === email.id ? null : email)}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-[18px]" style={{ color: 'var(--color-admin-primary)' }}>{EMAIL_TYPE_ICONS[email.emailType] || 'email'}</span>
                          <span className="text-sm font-medium" style={{ color: 'var(--color-admin-on-surface)' }}>{EMAIL_TYPE_LABELS[email.emailType] || email.emailType}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-medium" style={{ color: 'var(--color-admin-on-surface)' }}>{email.toName || '—'}</p>
                        <p className="text-xs" style={{ color: 'var(--color-admin-on-surface-variant)' }}>{email.to}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm max-w-xs truncate" style={{ color: 'var(--color-admin-on-surface)' }}>{email.subject}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${email.status === 'sent' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {email.status === 'sent' ? 'Sent' : 'Failed'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm" style={{ color: 'var(--color-admin-on-surface)' }}>{new Date(email.sentAt).toLocaleDateString()}</p>
                        <p className="text-xs" style={{ color: 'var(--color-admin-on-surface-variant)' }}>{new Date(email.sentAt).toLocaleTimeString()}</p>
                      </td>
                      <td className="px-6 py-4">
                        <button className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors" onClick={e => { e.stopPropagation(); setSelectedEmail(selectedEmail?.id === email.id ? null : email); }}>
                          <span className="material-symbols-outlined text-[18px]" style={{ color: 'var(--color-admin-on-surface-variant)' }}>{selectedEmail?.id === email.id ? 'expand_less' : 'expand_more'}</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Expanded Detail */}
            {selectedEmail && (
              <div className="px-6 py-4 border-t" style={{ borderColor: 'var(--color-admin-outline-variant)', backgroundColor: 'var(--color-admin-surface-container)' }}>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div><span className="font-semibold" style={{ color: 'var(--color-admin-on-surface-variant)' }}>To:</span> <span style={{ color: 'var(--color-admin-on-surface)' }}>{selectedEmail.to}</span></div>
                  <div><span className="font-semibold" style={{ color: 'var(--color-admin-on-surface-variant)' }}>Name:</span> <span style={{ color: 'var(--color-admin-on-surface)' }}>{selectedEmail.toName || '—'}</span></div>
                  <div><span className="font-semibold" style={{ color: 'var(--color-admin-on-surface-variant)' }}>User ID:</span> <span className="font-mono text-xs" style={{ color: 'var(--color-admin-on-surface)' }}>{selectedEmail.userId || '—'}</span></div>
                  <div className="col-span-3"><span className="font-semibold" style={{ color: 'var(--color-admin-on-surface-variant)' }}>Subject:</span> <span style={{ color: 'var(--color-admin-on-surface)' }}>{selectedEmail.subject}</span></div>
                  {selectedEmail.errorMsg && <div className="col-span-3"><span className="font-semibold text-red-500">Error:</span> <span className="text-red-500">{selectedEmail.errorMsg}</span></div>}
                </div>
              </div>
            )}
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <button onClick={() => handlePageChange(pagination.page - 1)} disabled={pagination.page <= 1}
                className="px-3 py-1.5 rounded-lg border text-sm disabled:opacity-50" style={{ borderColor: 'var(--color-admin-outline-variant)', color: 'var(--color-admin-on-surface)' }}>
                Previous
              </button>
              <span className="text-sm px-4" style={{ color: 'var(--color-admin-on-surface-variant)' }}>Page {pagination.page} of {pagination.totalPages}</span>
              <button onClick={() => handlePageChange(pagination.page + 1)} disabled={pagination.page >= pagination.totalPages}
                className="px-3 py-1.5 rounded-lg border text-sm disabled:opacity-50" style={{ borderColor: 'var(--color-admin-outline-variant)', color: 'var(--color-admin-on-surface)' }}>
                Next
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
