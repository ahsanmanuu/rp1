'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { createPb } from '@/lib/pb';
import { useSiteLogo } from '@/lib/useSiteLogo';
import ProLoader from '@/components/ProLoader';
import { Theme, themes, getAccentColor } from '@/components/AdminThemeStyles';

const TOOL_TITLES = [
  'Latexify Dashboard', 'Doc2LaTeX Studio', 'Diagram Studio',
  'Template Migrator', 'Citation Studio', 'AI Peer Reviewer',
];

const SIDEBAR_LINKS = [
  { href: '/admin/dashboard', icon: 'dashboard', label: 'Dashboard' },
  { href: '/admin/billings', icon: 'payments', label: 'Bill and Payments' },
  { href: '/admin/users', icon: 'group', label: 'Users' },
  { href: '/admin/profile', icon: 'settings', label: 'Profile and Plan Setting' },
  { href: '/admin/ai-caps', icon: 'speed', label: 'AI Usage & Caps Rules' },
  { href: '/admin/ai-analysis', icon: 'psychology', label: 'AI Analysis' },
  { href: '/admin/anomalies', icon: 'warning', label: 'Anomaly Center' },
  { href: '/admin/help', icon: 'help', label: 'Help and Support' },
  { href: '/admin/offers', icon: 'local_offer', label: 'Offers' },
  { href: '/admin/emails', icon: 'mail', label: 'Email History' },
  { href: '/admin/social-media', icon: 'share', label: 'Social Media' },
  { href: '/admin/tax-calculation', icon: 'calculate', label: 'Tax Calculation' },
];

type ContentTab = 'banners' | 'testimonials' | 'how_it_works' | 'gallery_items' | 'institution_logos' | 'features' | 'benefits' | 'product_details' | 'footer_links' | 'tasar_stats' | 'platform_stats' | 'floating_banners' | 'videos' | 'settings';

const COLLECTION_CONFIGS: Record<string, { label: string; icon: string; apiEndpoint: string; pbCollection: string }> = {
  how_it_works: { label: 'How It Works', icon: 'format_list_numbered', apiEndpoint: '/api/content/how_it_works', pbCollection: 'how_it_works' },
  gallery_items: { label: 'Gallery', icon: 'photo_library', apiEndpoint: '/api/content/gallery_items', pbCollection: 'gallery_items' },
  institution_logos: { label: 'Institutions', icon: 'business', apiEndpoint: '/api/content/institution_logos', pbCollection: 'institution_logos' },
  features: { label: 'Features', icon: 'featured_play_list', apiEndpoint: '/api/content/features', pbCollection: 'features' },
  benefits: { label: 'Benefits', icon: 'verified', apiEndpoint: '/api/content/benefits', pbCollection: 'benefits' },
  product_details: { label: 'Products', icon: 'inventory_2', apiEndpoint: '/api/content/product_details', pbCollection: 'product_details' },
  footer_links: { label: 'Footer Links', icon: 'link', apiEndpoint: '/api/content/footer_links', pbCollection: 'footer_links' },
  tasar_stats: { label: 'TASAR Stats', icon: 'bar_chart', apiEndpoint: '/api/content/tasar_stats', pbCollection: 'tasar_stats' },
  platform_stats: { label: 'Platform Stats', icon: 'analytics', apiEndpoint: '/api/content/platform_stats', pbCollection: 'platform_stats' },
  floating_banners: { label: 'Floating Banners', icon: 'ads_click', apiEndpoint: '/api/content/floating_banners', pbCollection: 'floating_banners' },
  videos: { label: 'Videos', icon: 'smart_display', apiEndpoint: '/api/content/videos', pbCollection: 'videos' },
};

const TASAR_CATEGORIES = ['tools', 'academic', 'statistical', 'analytics', 'research'];

function StarRating({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} className="material-symbols-outlined text-[14px]" style={{ color: i <= rating ? '#f59e0b' : '#94a3b8' }}>
          {i <= rating ? 'star' : 'star_outline'}
        </span>
      ))}
    </span>
  );
}

function ModalField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-bold tracking-wider" style={{ color: 'var(--c-surf-var)' }}>{label}</label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

export default function AdminSocialMediaPage() {
  const [currentTheme, setCurrentTheme] = useState<Theme>('indigo');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isThemeOpen, setIsThemeOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [adminName, setAdminName] = useState('Admin Root');
  const [adminEmail, setAdminEmail] = useState('admin@latexify.io');
  const [loggingOut, setLoggingOut] = useState(false);
  const [tab, setTab] = useState<ContentTab>('banners');

  const [loadingBanners, setLoadingBanners] = useState(true);
  const [loadingTestimonials, setLoadingTestimonials] = useState(true);
  const [banners, setBanners] = useState<any[]>([]);
  const [testimonials, setTestimonials] = useState<any[]>([]);
  const [showBannerForm, setShowBannerForm] = useState(false);
  const [editingBanner, setEditingBanner] = useState<any>(null);
  const [bannerForm, setBannerForm] = useState({ title: '', subtitle: '', imageUrl: '', linkUrl: '', isActive: true, sortOrder: 0 });
  const [uploadingBannerImage, setUploadingBannerImage] = useState(false);
  const [showTestimonialForm, setShowTestimonialForm] = useState(false);
  const [editingTestimonial, setEditingTestimonial] = useState<any>(null);
  const [testimonialForm, setTestimonialForm] = useState({ name: '', role: '', avatarUrl: '', content: '', rating: 5, isActive: true, sortOrder: 0 });
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [genericLoading, setGenericLoading] = useState<Record<string, boolean>>({});
  const [genericItems, setGenericItems] = useState<Record<string, any[]>>({});
  const [showGenericForm, setShowGenericForm] = useState(false);
  const [editingGeneric, setEditingGeneric] = useState<any>(null);
  const [genericForm, setGenericForm] = useState<Record<string, any>>({});
  const [uploadingGeneric, setUploadingGeneric] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoMessage, setLogoMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [ticketNotifications, setTicketNotifications] = useState<any[]>([]);
  const [ticketUnreadCount, setTicketUnreadCount] = useState(0);
  const [isTicketNotifOpen, setIsTicketNotifOpen] = useState(false);
  const ticketNotifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const themeRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);

  const { logoUrl, loading: logoLoading } = useSiteLogo();

  const pathname = usePathname();

  useEffect(() => {
    const savedTheme = localStorage.getItem('latexify-admin-theme') as Theme | null;
    const savedMode = localStorage.getItem('latexify-admin-mode');
    if (savedTheme) setCurrentTheme(savedTheme);
    if (savedMode) setIsDarkMode(savedMode === 'dark');
    const storedName = localStorage.getItem('latexify-admin-name');
    if (storedName) setAdminName(storedName);
  }, []);

  useEffect(() => {
    localStorage.setItem('latexify-admin-theme', currentTheme);
    localStorage.setItem('latexify-admin-mode', isDarkMode ? 'dark' : 'light');
    window.dispatchEvent(new Event('admin-theme-changed'));
  }, [currentTheme, isDarkMode]);

  useEffect(() => {
    const fetchAdminInfo = async () => {
      try {
        const res = await fetch('/api/admin/me');
        const data = await res.json();
        if (data.email) setAdminEmail(data.email);
        if (data.name) setAdminName(data.name);
      } catch {}
    };
    fetchAdminInfo();
  }, []);

  useEffect(() => {
    const fetchAnnouncements = async () => {
      try {
        const res = await fetch('/api/admin/announcements');
        const data = await res.json();
        if (data.success) setAnnouncements(data.data || []);
      } catch {}
    };
    fetchAnnouncements();
  }, []);

  useEffect(() => {
    const fetchTicketNotifs = async () => {
      try {
        const res = await fetch('/api/admin/notifications?unreadOnly=true');
        const data = await res.json();
        if (data.notifications) {
          setTicketNotifications(data.notifications);
          setTicketUnreadCount(data.notifications.filter((n: any) => !n.isRead).length);
        }
      } catch {}
    };
    fetchTicketNotifs();
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setIsProfileOpen(false);
      if (themeRef.current && !themeRef.current.contains(e.target as Node)) setIsThemeOpen(false);
      if (notificationsRef.current && !notificationsRef.current.contains(e.target as Node)) setIsNotificationsOpen(false);
      if (ticketNotifRef.current && !ticketNotifRef.current.contains(e.target as Node)) setIsTicketNotifOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchBanners = useCallback(async () => {
    setLoadingBanners(true);
    try {
      const res = await fetch('/api/admin/banners');
      const d = await res.json();
      if (d.success) setBanners(d.data);
    } catch (err) { console.error('Banners fetch error:', err); }
    setLoadingBanners(false);
  }, []);

  const fetchTestimonials = useCallback(async () => {
    setLoadingTestimonials(true);
    try {
      const res = await fetch('/api/admin/testimonials');
      const d = await res.json();
      if (d.success) setTestimonials(d.data);
    } catch (err) { console.error('Testimonials fetch error:', err); }
    setLoadingTestimonials(false);
  }, []);

  const fetchGeneric = useCallback(async (key: string) => {
    setGenericLoading(prev => ({ ...prev, [key]: true }));
    try {
      const cfg = COLLECTION_CONFIGS[key];
      if (!cfg) return;
      const res = await fetch(cfg.apiEndpoint);
      const d = await res.json();
      if (d.success) setGenericItems(prev => ({ ...prev, [key]: d.data }));
    } catch (err) { console.error(`${key} fetch error:`, err); }
    setGenericLoading(prev => ({ ...prev, [key]: false }));
  }, []);

  useEffect(() => { fetchBanners(); }, [fetchBanners]);
  useEffect(() => { fetchTestimonials(); }, [fetchTestimonials]);
  useEffect(() => {
    const collections = Object.keys(COLLECTION_CONFIGS);
    for (const key of collections) { fetchGeneric(key); }
  }, [fetchGeneric]);

  useEffect(() => {
    const pb = createPb();
    const unsubFns: (() => void)[] = [];
    (async () => {
      try {
        const ub = await pb.collection('banners').subscribe('*', () => { fetchBanners(); });
        unsubFns.push(ub);
      } catch {}
      try {
        const ut = await pb.collection('testimonials').subscribe('*', () => { fetchTestimonials(); });
        unsubFns.push(ut);
      } catch {}
      for (const [key, cfg] of Object.entries(COLLECTION_CONFIGS)) {
        try {
          const u = await pb.collection(cfg.pbCollection).subscribe('*', () => { fetchGeneric(key); });
          unsubFns.push(u);
        } catch {}
      }
    })();
    return () => { for (const fn of unsubFns) { try { fn(); } catch {} } };
  }, [fetchBanners, fetchTestimonials, fetchGeneric]);

  const saveBanner = async () => {
    try {
      if (editingBanner) {
        await fetch('/api/admin/banners', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editingBanner.id, ...bannerForm }) });
      } else {
        await fetch('/api/admin/banners', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(bannerForm) });
      }
      setShowBannerForm(false); setEditingBanner(null); fetchBanners();
    } catch {}
  };

  const deleteBanner = async (id: string) => {
    if (!confirm('Delete this banner?')) return;
    try { await fetch(`/api/admin/banners?id=${id}`, { method: 'DELETE' }); fetchBanners(); } catch {}
  };

  const toggleBannerActive = async (banner: any) => {
    try { await fetch('/api/admin/banners', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: banner.id, isActive: !banner.isActive }) }); fetchBanners(); } catch {}
  };

  const openNewBanner = () => {
    setEditingBanner(null);
    setBannerForm({ title: '', subtitle: '', imageUrl: '', linkUrl: '', isActive: true, sortOrder: 0 });
    setShowBannerForm(true);
  };

  const openEditBanner = (banner: any) => {
    setEditingBanner(banner);
    setBannerForm({ title: banner.title, subtitle: banner.subtitle || '', imageUrl: banner.imageUrl, linkUrl: banner.linkUrl || '', isActive: banner.isActive, sortOrder: banner.sortOrder });
    setShowBannerForm(true);
  };

  const handleBannerImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingBannerImage(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('collection', 'banners');
      const res = await fetch('/api/admin/upload-pb', { method: 'POST', body: fd });
      const d = await res.json();
      if (d.success) setBannerForm(prev => ({ ...prev, imageUrl: d.url }));
    } catch (err) { console.error('Image upload failed:', err); }
    setUploadingBannerImage(false);
  };

  const saveTestimonial = async () => {
    try {
      if (editingTestimonial) {
        await fetch('/api/admin/testimonials', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editingTestimonial.id, ...testimonialForm }) });
      } else {
        await fetch('/api/admin/testimonials', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(testimonialForm) });
      }
      setShowTestimonialForm(false); setEditingTestimonial(null); fetchTestimonials();
    } catch {}
  };

  const deleteTestimonial = async (id: string) => {
    if (!confirm('Delete this testimonial?')) return;
    try { await fetch(`/api/admin/testimonials?id=${id}`, { method: 'DELETE' }); fetchTestimonials(); } catch {}
  };

  const toggleTestimonialActive = async (t: any) => {
    try { await fetch('/api/admin/testimonials', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: t.id, isActive: !t.isActive }) }); fetchTestimonials(); } catch {}
  };

  const openNewTestimonial = () => {
    setEditingTestimonial(null);
    setTestimonialForm({ name: '', role: '', avatarUrl: '', content: '', rating: 5, isActive: true, sortOrder: 0 });
    setShowTestimonialForm(true);
  };

  const openEditTestimonial = (t: any) => {
    setEditingTestimonial(t);
    setTestimonialForm({ name: t.name, role: t.role || '', avatarUrl: t.avatarUrl || '', content: t.content, rating: t.rating, isActive: t.isActive, sortOrder: t.sortOrder });
    setShowTestimonialForm(true);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('collection', 'testimonials');
      const res = await fetch('/api/admin/upload-pb', { method: 'POST', body: fd });
      const d = await res.json();
      if (d.success) setTestimonialForm(prev => ({ ...prev, avatarUrl: d.url }));
    } catch (err) { console.error('Avatar upload failed:', err); }
    setUploadingAvatar(false);
  };

  const getDefaultsForKey = (key: string): Record<string, any> => {
    switch (key) {
      case 'how_it_works': return { title: '', description: '', stepNumber: 1, icon: '', videoUrl: '', imageUrl: '', isActive: true, sortOrder: 0 };
      case 'gallery_items': return { title: '', imageUrl: '', icon: '', category: '', isActive: true, sortOrder: 0 };
      case 'institution_logos': return { name: '', logoUrl: '', icon: '', isActive: true, sortOrder: 0 };
      case 'features': return { title: '', description: '', icon: '', iconBg: '', glow: '', tags: '', href: '', isActive: true, sortOrder: 0 };
      case 'benefits': return { title: '', description: '', icon: '', color: '', isActive: true, sortOrder: 0 };
      case 'product_details': return { key: '', title: '', description: '', icon: '', color: '', features: '', href: '', isActive: true, sortOrder: 0 };
      case 'footer_links': return { groupTitle: '', label: '', href: '', linkKey: '', isTargetBlank: false, isActive: true, sortOrder: 0 };
      case 'tasar_stats': return { label: '', value: '', suffix: '', icon: '', color: '', category: 'tools', isActive: true, sortOrder: 0 };
      case 'platform_stats': return { key: '', label: '', value: '', suffix: '', decimals: 0, isActive: true };
      case 'floating_banners': return { title: '', imageUrl: '', linkUrl: '', targetType: 'global', targetEmail: '', width: 4, height: 6, duration: 5, isActive: true, sortOrder: 0 };
      case 'videos': return { title: '', description: '', videoUrl: '', posterUrl: '', isActive: true, sortOrder: 0 };
      default: return {};
    }
  };

  const mapItemToForm = (key: string, item: any): Record<string, any> => {
    const defaults = getDefaultsForKey(key);
    const mapped: Record<string, any> = {};
    for (const k of Object.keys(defaults)) {
      if (k === 'tags' || k === 'features') {
        mapped[k] = Array.isArray(item[k]) ? item[k].join(', ') : (item[k] || '');
      } else {
        mapped[k] = item[k] ?? defaults[k];
      }
    }
    return mapped;
  };

  const mapFormToPayload = (key: string, form: Record<string, any>): Record<string, any> => {
    const payload = { ...form };
    if ('tags' in payload && typeof payload.tags === 'string') {
      payload.tags = payload.tags.split(',').map((s: string) => s.trim()).filter(Boolean);
    }
    if ('features' in payload && typeof payload.features === 'string') {
      payload.features = payload.features.split(',').map((s: string) => s.trim()).filter(Boolean);
    }
    for (const k of ['isActive', 'isTargetBlank']) {
      if (k in payload && typeof payload[k] === 'string') payload[k] = payload[k] === 'true';
    }
    for (const k of ['sortOrder', 'stepNumber', 'decimals']) {
      if (k in payload) payload[k] = Number(payload[k]) || 0;
    }
    if ('value' in payload) payload.value = String(payload.value);
    if ('suffix' in payload) payload.suffix = payload.suffix || '';
    return payload;
  };

  const openNewGeneric = (key: string) => {
    setEditingGeneric(null);
    setGenericForm(getDefaultsForKey(key));
    setShowGenericForm(true);
  };

  const openEditGeneric = (key: string, item: any) => {
    setEditingGeneric(item);
    setGenericForm(mapItemToForm(key, item));
    setShowGenericForm(true);
  };

  const saveGeneric = async () => {
    const key = tab;
    if (key === 'banners' || key === 'testimonials') return;
    const cfg = COLLECTION_CONFIGS[key];
    if (!cfg) return;
    try {
      const payload = mapFormToPayload(key, genericForm);
      if (editingGeneric) {
        await fetch(cfg.apiEndpoint, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editingGeneric.id, ...payload }) });
      } else {
        await fetch(cfg.apiEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      }
      setShowGenericForm(false); setEditingGeneric(null); fetchGeneric(key);
    } catch {}
  };

  const deleteGeneric = async (id: string) => {
    const key = tab;
    if (key === 'banners' || key === 'testimonials') return;
    const cfg = COLLECTION_CONFIGS[key];
    if (!cfg) return;
    if (!confirm(`Delete this ${cfg.label} item?`)) return;
    try { await fetch(`${cfg.apiEndpoint}?id=${id}`, { method: 'DELETE' }); fetchGeneric(key); } catch {}
  };

  const toggleGenericActive = async (item: any) => {
    const key = tab;
    if (key === 'banners' || key === 'testimonials') return;
    const cfg = COLLECTION_CONFIGS[key];
    if (!cfg) return;
    try {
      await fetch(cfg.apiEndpoint, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: item.id, isActive: !item.isActive }) });
      fetchGeneric(key);
    } catch {}
  };

  const handleGenericUpload = async (e: React.ChangeEvent<HTMLInputElement>, fieldName: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const key = tab;
    if (key === 'banners' || key === 'testimonials') return;
    const cfg = COLLECTION_CONFIGS[key];
    if (!cfg) return;
    setUploadingGeneric(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('collection', 'uploads');
      const res = await fetch('/api/admin/upload-pb', { method: 'POST', body: fd });
      const d = await res.json();
      if (d.success) setGenericForm((prev: Record<string, any>) => ({ ...prev, [fieldName]: d.url }));
      else console.error('Upload failed:', d.error);
    } catch (err) { console.error('Upload failed:', err); }
    setUploadingGeneric(false);
  };

  const toggleTheme = () => setIsThemeOpen(!isThemeOpen);
  const handleThemeSelect = (t: Theme) => { setCurrentTheme(t); setIsThemeOpen(false); };

  const formatTimeAgo = (dt: string) => {
    const diff = Date.now() - new Date(dt).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      const pb = await (await import('@/lib/pb')).createPb();
      await pb.authStore.clear();
      window.location.href = '/auth/login';
    } catch { window.location.href = '/auth/login'; }
    setLoggingOut(false);
  };

  const handleDismissAlert = async (id: string) => {
    try { await fetch(`/api/admin/announcements?id=${id}`, { method: 'DELETE' }); setAnnouncements(prev => prev.filter(a => a.id !== id)); } catch {}
  };

  const handleDismissAll = async () => {
    try { await fetch('/api/admin/announcements', { method: 'DELETE' }); setAnnouncements([]); } catch {}
  };

  const markTicketNotifRead = async (id: string) => {
    try {
      await fetch('/api/admin/notifications', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ notificationId: id }) });
      setTicketNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
      setTicketUnreadCount(prev => Math.max(0, prev - 1));
    } catch {}
  };

  const markAllTicketNotifRead = async () => {
    try {
      await fetch('/api/admin/notifications', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ markAllRead: true }) });
      setTicketNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setTicketUnreadCount(0);
    } catch {}
  };

  const accentColor = getAccentColor(currentTheme, isDarkMode);
  const bgColor = isDarkMode ? '#0b1326' : '#f8fafc';
  const surfaceColor = isDarkMode ? '#0b1326' : '#ffffff';
  const onSurfaceColor = isDarkMode ? '#dae2fd' : '#0f172a';
  const surfaceVariant = isDarkMode ? '#475569' : '#475569';
  const borderColor = isDarkMode ? '#2d3449' : '#e2e8f0';
  const cardBg = isDarkMode ? '#171f33' : '#ffffff';

  const isGenericTab = tab !== 'banners' && tab !== 'testimonials' && tab !== 'settings';
  const genericKey = isGenericTab ? tab : '';
  const genericCfg = isGenericTab ? COLLECTION_CONFIGS[tab] : null;
  const genericData = isGenericTab && genericKey ? (genericItems[genericKey] || []) : [];
  const genericIsLoading = isGenericTab && genericKey ? !!(genericLoading[genericKey]) : false;

  const renderGenericField = (fieldName: string, fieldType: string, placeholder?: string) => {
    const value = genericForm[fieldName] ?? '';
    if (fieldType === 'textarea') {
      return (
        <textarea value={value} onChange={e => setGenericForm((prev: any) => ({ ...prev, [fieldName]: e.target.value }))}
          className="modal-input w-full mt-1.5 px-3.5 py-2.5 rounded-xl border text-sm transition-all resize-none" rows={3} placeholder={placeholder || ''} />
      );
    }
    if (fieldType === 'number') {
      return (
        <input type="number" value={value} onChange={e => setGenericForm((prev: any) => ({ ...prev, [fieldName]: parseInt(e.target.value) || 0 }))}
          className="modal-input w-full mt-1.5 px-3.5 py-2.5 rounded-xl border text-sm transition-all" placeholder={placeholder || '0'} />
      );
    }
    if (fieldType === 'image') {
      return (
        <div>
          <div className="flex gap-2">
            <input type="text" value={value} onChange={e => setGenericForm((prev: any) => ({ ...prev, [fieldName]: e.target.value }))}
              className="modal-input flex-1 px-3.5 py-2.5 rounded-xl border text-sm transition-all" placeholder={placeholder || 'Paste URL or upload'} />
            <label className={`px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:brightness-110 hover:scale-[1.02] active:scale-95 flex items-center gap-1.5 shrink-0 ${uploadingGeneric ? 'opacity-60 pointer-events-none' : ''}`}
              style={{ backgroundColor: accentColor }}>
              <span className="material-symbols-outlined text-lg">{uploadingGeneric ? 'hourglass_top' : 'cloud_upload'}</span>
              {uploadingGeneric ? 'Uploading...' : 'Upload'}
              <input type="file" accept="image/*" onChange={e => handleGenericUpload(e, fieldName)} className="hidden" disabled={uploadingGeneric} />
            </label>
          </div>
          {value && (
            <div className="mt-3 rounded-xl overflow-hidden border" style={{ borderColor }}>
              <div className="relative w-full h-28 group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={value} alt="preview" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              </div>
            </div>
          )}
        </div>
      );
    }
    if (fieldType === 'checkbox') {
      return (
        <div className="flex items-center gap-3 p-3 rounded-xl" style={{ backgroundColor: bgColor, border: `1px solid ${borderColor}` }}>
          <div className="relative">
            <input type="checkbox" id={`gf-${fieldName}`} checked={!!value} onChange={e => setGenericForm((prev: any) => ({ ...prev, [fieldName]: e.target.checked }))} className="sr-only" />
            <label htmlFor={`gf-${fieldName}`} className={`w-10 h-6 rounded-full transition-all flex items-center px-0.5 ${value ? 'justify-end' : 'justify-start'}`}
              style={{ backgroundColor: value ? accentColor : '#64748b' }}>
              <div className="w-5 h-5 rounded-full bg-white shadow-sm transition-all" />
            </label>
          </div>
          <span className="text-sm font-semibold" style={{ color: value ? '#22c55e' : surfaceVariant }}>{value ? 'Yes' : 'No'}</span>
        </div>
      );
    }
    if (fieldType === 'select' && fieldName === 'category') {
      return (
        <select value={value} onChange={e => setGenericForm((prev: any) => ({ ...prev, category: e.target.value }))}
          className="modal-input w-full mt-1.5 px-3.5 py-2.5 rounded-xl border text-sm transition-all">
          {TASAR_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>)}
        </select>
      );
    }
    // default text input
    return (
      <input type="text" value={value} onChange={e => setGenericForm((prev: any) => ({ ...prev, [fieldName]: e.target.value }))}
        className="modal-input w-full mt-1.5 px-3.5 py-2.5 rounded-xl border text-sm transition-all" placeholder={placeholder || ''} />
    );
  };

  const renderGenericFormFields = () => {
    switch (tab) {
      case 'how_it_works':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ModalField label="Title">{renderGenericField('title', 'text', 'e.g. Create Your Account')}</ModalField>
              <ModalField label="Step Number">{renderGenericField('stepNumber', 'number')}</ModalField>
            </div>
            <ModalField label="Description">{renderGenericField('description', 'textarea', 'Describe this step...')}</ModalField>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ModalField label="Icon">{renderGenericField('icon', 'text', 'material-symbols-outlined name')}</ModalField>
              <ModalField label="Video URL">{renderGenericField('videoUrl', 'text', 'https://...')}</ModalField>
            </div>
            <ModalField label="Image">{renderGenericField('imageUrl', 'image')}</ModalField>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ModalField label="Sort Order">{renderGenericField('sortOrder', 'number')}</ModalField>
              <ModalField label="Active">{renderGenericField('isActive', 'checkbox')}</ModalField>
            </div>
          </div>
        );
      case 'gallery_items':
        return (
          <div className="space-y-4">
            <ModalField label="Title">{renderGenericField('title', 'text', 'e.g. Research Paper Dashboard')}</ModalField>
            <ModalField label="Image">{renderGenericField('imageUrl', 'image')}</ModalField>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ModalField label="Icon">{renderGenericField('icon', 'text', 'material-symbols-outlined name')}</ModalField>
              <ModalField label="Category">{renderGenericField('category', 'text', 'e.g. dashboard, tools')}</ModalField>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ModalField label="Sort Order">{renderGenericField('sortOrder', 'number')}</ModalField>
              <ModalField label="Active">{renderGenericField('isActive', 'checkbox')}</ModalField>
            </div>
          </div>
        );
      case 'institution_logos':
        return (
          <div className="space-y-4">
            <ModalField label="Name">{renderGenericField('name', 'text', 'e.g. Harvard University')}</ModalField>
            <ModalField label="Logo">{renderGenericField('logoUrl', 'image')}</ModalField>
            <ModalField label="Icon">{renderGenericField('icon', 'text', 'Optional icon name')}</ModalField>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ModalField label="Sort Order">{renderGenericField('sortOrder', 'number')}</ModalField>
              <ModalField label="Active">{renderGenericField('isActive', 'checkbox')}</ModalField>
            </div>
          </div>
        );
      case 'features':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ModalField label="Title">{renderGenericField('title', 'text', 'e.g. Real-Time Collaboration')}</ModalField>
              <ModalField label="Icon">{renderGenericField('icon', 'text', 'material icon name')}</ModalField>
            </div>
            <ModalField label="Description">{renderGenericField('description', 'textarea', 'Describe this feature...')}</ModalField>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ModalField label="Icon Background">{renderGenericField('iconBg', 'text', 'Hex color e.g. #4f46e5')}</ModalField>
              <ModalField label="Glow">{renderGenericField('glow', 'text', 'Hex color e.g. #4f46e5')}</ModalField>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ModalField label="Tags (comma-separated)">{renderGenericField('tags', 'text', 'e.g. AI, Real-time, Secure')}</ModalField>
              <ModalField label="Link URL">{renderGenericField('href', 'text', '/feature-page')}</ModalField>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ModalField label="Sort Order">{renderGenericField('sortOrder', 'number')}</ModalField>
              <ModalField label="Active">{renderGenericField('isActive', 'checkbox')}</ModalField>
            </div>
          </div>
        );
      case 'benefits':
        return (
          <div className="space-y-4">
            <ModalField label="Title">{renderGenericField('title', 'text', 'e.g. Save Time')}</ModalField>
            <ModalField label="Description">{renderGenericField('description', 'textarea', 'Describe this benefit...')}</ModalField>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ModalField label="Icon">{renderGenericField('icon', 'text', 'material icon name')}</ModalField>
              <ModalField label="Color">{renderGenericField('color', 'text', 'Hex color e.g. #22c55e')}</ModalField>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ModalField label="Sort Order">{renderGenericField('sortOrder', 'number')}</ModalField>
              <ModalField label="Active">{renderGenericField('isActive', 'checkbox')}</ModalField>
            </div>
          </div>
        );
      case 'product_details':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ModalField label="Key (unique)">{renderGenericField('key', 'text', "e.g. 'Latexify Studio'")}</ModalField>
              <ModalField label="Title">{renderGenericField('title', 'text', 'e.g. Latexify Studio')}</ModalField>
            </div>
            <ModalField label="Description">{renderGenericField('description', 'textarea', 'Describe this product...')}</ModalField>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ModalField label="Icon">{renderGenericField('icon', 'text', 'material icon name')}</ModalField>
              <ModalField label="Color">{renderGenericField('color', 'text', 'Hex color e.g. #4f46e5')}</ModalField>
            </div>
            <ModalField label="Features (comma-separated)">{renderGenericField('features', 'text', 'e.g. AI-powered, Templates, Export')}</ModalField>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ModalField label="Link URL">{renderGenericField('href', 'text', '/product-page')}</ModalField>
              <ModalField label="Sort Order">{renderGenericField('sortOrder', 'number')}</ModalField>
            </div>
            <ModalField label="Active">{renderGenericField('isActive', 'checkbox')}</ModalField>
          </div>
        );
      case 'footer_links':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ModalField label="Group Title">{renderGenericField('groupTitle', 'text', 'e.g. Product, Company')}</ModalField>
              <ModalField label="Label">{renderGenericField('label', 'text', 'e.g. About Us')}</ModalField>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ModalField label="URL">{renderGenericField('href', 'text', '/about-us')}</ModalField>
              <ModalField label="Link Key">{renderGenericField('linkKey', 'text', 'Unique identifier')}</ModalField>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ModalField label="Sort Order">{renderGenericField('sortOrder', 'number')}</ModalField>
              <ModalField label="Open in New Tab">{renderGenericField('isTargetBlank', 'checkbox')}</ModalField>
            </div>
            <ModalField label="Active">{renderGenericField('isActive', 'checkbox')}</ModalField>
          </div>
        );
      case 'tasar_stats':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ModalField label="Label">{renderGenericField('label', 'text', 'e.g. Tools Developed')}</ModalField>
              <ModalField label="Value">{renderGenericField('value', 'text', 'e.g. 150+')}</ModalField>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ModalField label="Suffix">{renderGenericField('suffix', 'text', 'e.g. +, %, K')}</ModalField>
              <ModalField label="Icon">{renderGenericField('icon', 'text', 'material icon name')}</ModalField>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ModalField label="Color">{renderGenericField('color', 'text', 'Hex color e.g. #4f46e5')}</ModalField>
              <ModalField label="Category">{renderGenericField('category', 'select')}</ModalField>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ModalField label="Sort Order">{renderGenericField('sortOrder', 'number')}</ModalField>
              <ModalField label="Active">{renderGenericField('isActive', 'checkbox')}</ModalField>
            </div>
          </div>
        );
      case 'platform_stats':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ModalField label="Key (unique)">{renderGenericField('key', 'text', "e.g. 'totalResearchers'")}</ModalField>
              <ModalField label="Label">{renderGenericField('label', 'text', 'e.g. Total Researchers')}</ModalField>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ModalField label="Value">{renderGenericField('value', 'text', 'e.g. 50000')}</ModalField>
              <ModalField label="Suffix">{renderGenericField('suffix', 'text', 'e.g. +, K, %')}</ModalField>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ModalField label="Decimals">{renderGenericField('decimals', 'number')}</ModalField>
              <ModalField label="Active">{renderGenericField('isActive', 'checkbox')}</ModalField>
            </div>
          </div>
        );
      case 'videos':
        return (
          <div className="space-y-4">
            <ModalField label="Title">{renderGenericField('title', 'text', 'e.g. How to Use Latexify')}</ModalField>
            <ModalField label="Description">{renderGenericField('description', 'textarea', 'Video description...')}</ModalField>
            <ModalField label="Video URL">{renderGenericField('videoUrl', 'text', 'Upload an MP4 or paste a video URL')}</ModalField>
            <ModalField label="Poster / Thumbnail">{renderGenericField('posterUrl', 'image', 'Upload a poster image for the video')}</ModalField>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ModalField label="Sort Order">{renderGenericField('sortOrder', 'number')}</ModalField>
              <ModalField label="Active">{renderGenericField('isActive', 'checkbox')}</ModalField>
            </div>
          </div>
        );
      case 'floating_banners':
        return (
          <div className="space-y-4">
            <ModalField label="Title">{renderGenericField('title', 'text', 'e.g. Summer Sale')}</ModalField>
            <ModalField label="Image">{renderGenericField('imageUrl', 'image', 'Upload banner image (recommended 300x450)')}</ModalField>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ModalField label="Link URL (optional)">{renderGenericField('linkUrl', 'text', '/promo-page')}</ModalField>
              <ModalField label="Target">
                <div className="flex items-center gap-3 mt-1.5 p-2.5 rounded-xl border" style={{ backgroundColor: bgColor, borderColor }}>
                  {['global', 'specific'].map(t => (
                    <button key={t} type="button" onClick={() => setGenericForm((prev: any) => ({ ...prev, targetType: t, targetEmail: t === 'global' ? '' : prev.targetEmail }))}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${genericForm.targetType === t ? 'text-white' : ''}`}
                      style={{ backgroundColor: genericForm.targetType === t ? accentColor : 'transparent', color: genericForm.targetType === t ? '#fff' : surfaceVariant }}>
                      {t === 'global' ? 'Global' : 'Specific User'}
                    </button>
                  ))}
                </div>
              </ModalField>
            </div>
            {genericForm.targetType === 'specific' && (
              <ModalField label="Target Email">{renderGenericField('targetEmail', 'text', 'user@example.com')}</ModalField>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <ModalField label="Width (inches)">{renderGenericField('width', 'number')}</ModalField>
              <ModalField label="Height (inches)">{renderGenericField('height', 'number')}</ModalField>
              <ModalField label="Duration (sec)">{renderGenericField('duration', 'number')}</ModalField>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ModalField label="Sort Order">{renderGenericField('sortOrder', 'number')}</ModalField>
              <ModalField label="Active">{renderGenericField('isActive', 'checkbox')}</ModalField>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  const renderGenericCard = (item: any) => {
    const cfg = genericCfg;
    if (!cfg) return null;
    switch (tab) {
      case 'how_it_works':
        return (
          <div key={item.id} className="p-4 rounded-xl border transition-all hover:brightness-95 overflow-hidden" style={{ backgroundColor: cardBg, borderColor }}>
            <div className="flex gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold shrink-0" style={{ backgroundColor: accentColor + '20', color: accentColor }}>
                {item.stepNumber || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate" style={{ color: onSurfaceColor }}>{item.title}</p>
                {item.description && <p className="text-xs truncate mt-0.5" style={{ color: surfaceVariant }}>{item.description}</p>}
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${item.isActive ? 'text-green-600 bg-green-500/10' : 'text-red-600 bg-red-500/10'}`}>
                    {item.isActive ? 'Active' : 'Inactive'}
                  </span>
                  <span className="text-[10px] font-bold" style={{ color: surfaceVariant }}>Sort: {item.sortOrder}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-3 pt-3 border-t" style={{ borderColor }}>
              <button onClick={() => toggleGenericActive(item)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors" title="Toggle Active">
                <span className="material-symbols-outlined text-[16px]" style={{ color: item.isActive ? '#22c55e' : surfaceVariant }}>{item.isActive ? 'toggle_on' : 'toggle_off'}</span>
              </button>
              <button onClick={() => openEditGeneric(tab, item)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors" title="Edit">
                <span className="material-symbols-outlined text-[16px]" style={{ color: surfaceVariant }}>edit</span>
              </button>
              <button onClick={() => deleteGeneric(item.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors ml-auto" title="Delete">
                <span className="material-symbols-outlined text-[16px] text-red-500">delete</span>
              </button>
            </div>
          </div>
        );
      case 'gallery_items':
        return (
          <div key={item.id} className="p-4 rounded-xl border transition-all hover:brightness-95 overflow-hidden" style={{ backgroundColor: cardBg, borderColor }}>
            <div className="flex gap-3">
              <div className="w-20 h-14 rounded-lg overflow-hidden shrink-0" style={{ backgroundColor: bgColor }}>
                {item.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs" style={{ color: surfaceVariant }}>No img</div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate" style={{ color: onSurfaceColor }}>{item.title}</p>
                {item.category && <p className="text-xs truncate mt-0.5" style={{ color: surfaceVariant }}>{item.category}</p>}
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${item.isActive ? 'text-green-600 bg-green-500/10' : 'text-red-600 bg-red-500/10'}`}>
                    {item.isActive ? 'Active' : 'Inactive'}
                  </span>
                  <span className="text-[10px] font-bold" style={{ color: surfaceVariant }}>Sort: {item.sortOrder}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-3 pt-3 border-t" style={{ borderColor }}>
              <button onClick={() => toggleGenericActive(item)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors" title="Toggle Active">
                <span className="material-symbols-outlined text-[16px]" style={{ color: item.isActive ? '#22c55e' : surfaceVariant }}>{item.isActive ? 'toggle_on' : 'toggle_off'}</span>
              </button>
              <button onClick={() => openEditGeneric(tab, item)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors" title="Edit">
                <span className="material-symbols-outlined text-[16px]" style={{ color: surfaceVariant }}>edit</span>
              </button>
              <button onClick={() => deleteGeneric(item.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors ml-auto" title="Delete">
                <span className="material-symbols-outlined text-[16px] text-red-500">delete</span>
              </button>
            </div>
          </div>
        );
      case 'institution_logos':
        return (
          <div key={item.id} className="p-4 rounded-xl border transition-all hover:brightness-95 overflow-hidden" style={{ backgroundColor: cardBg, borderColor }}>
            <div className="flex gap-3">
              <div className="w-14 h-14 rounded-lg overflow-hidden shrink-0" style={{ backgroundColor: bgColor }}>
                {item.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.logoUrl} alt={item.name} className="w-full h-full object-contain p-1" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs" style={{ color: surfaceVariant }}>No logo</div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate" style={{ color: onSurfaceColor }}>{item.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${item.isActive ? 'text-green-600 bg-green-500/10' : 'text-red-600 bg-red-500/10'}`}>
                    {item.isActive ? 'Active' : 'Inactive'}
                  </span>
                  <span className="text-[10px] font-bold" style={{ color: surfaceVariant }}>Sort: {item.sortOrder}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-3 pt-3 border-t" style={{ borderColor }}>
              <button onClick={() => toggleGenericActive(item)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors" title="Toggle Active">
                <span className="material-symbols-outlined text-[16px]" style={{ color: item.isActive ? '#22c55e' : surfaceVariant }}>{item.isActive ? 'toggle_on' : 'toggle_off'}</span>
              </button>
              <button onClick={() => openEditGeneric(tab, item)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors" title="Edit">
                <span className="material-symbols-outlined text-[16px]" style={{ color: surfaceVariant }}>edit</span>
              </button>
              <button onClick={() => deleteGeneric(item.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors ml-auto" title="Delete">
                <span className="material-symbols-outlined text-[16px] text-red-500">delete</span>
              </button>
            </div>
          </div>
        );
      case 'features':
        return (
          <div key={item.id} className="p-4 rounded-xl border transition-all hover:brightness-95 overflow-hidden" style={{ backgroundColor: cardBg, borderColor }}>
            <div className="flex gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: item.iconBg || accentColor + '20', color: accentColor }}>
                <span className="material-symbols-outlined text-lg">{item.icon || 'featured_play_list'}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate" style={{ color: onSurfaceColor }}>{item.title}</p>
                {item.description && <p className="text-xs truncate mt-0.5" style={{ color: surfaceVariant }}>{item.description}</p>}
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${item.isActive ? 'text-green-600 bg-green-500/10' : 'text-red-600 bg-red-500/10'}`}>
                    {item.isActive ? 'Active' : 'Inactive'}
                  </span>
                  <span className="text-[10px] font-bold" style={{ color: surfaceVariant }}>Sort: {item.sortOrder}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-3 pt-3 border-t" style={{ borderColor }}>
              <button onClick={() => toggleGenericActive(item)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors" title="Toggle Active">
                <span className="material-symbols-outlined text-[16px]" style={{ color: item.isActive ? '#22c55e' : surfaceVariant }}>{item.isActive ? 'toggle_on' : 'toggle_off'}</span>
              </button>
              <button onClick={() => openEditGeneric(tab, item)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors" title="Edit">
                <span className="material-symbols-outlined text-[16px]" style={{ color: surfaceVariant }}>edit</span>
              </button>
              <button onClick={() => deleteGeneric(item.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors ml-auto" title="Delete">
                <span className="material-symbols-outlined text-[16px] text-red-500">delete</span>
              </button>
            </div>
          </div>
        );
      case 'benefits':
        return (
          <div key={item.id} className="p-4 rounded-xl border transition-all hover:brightness-95 overflow-hidden" style={{ backgroundColor: cardBg, borderColor }}>
            <div className="flex gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: (item.color || accentColor) + '20', color: item.color || accentColor }}>
                <span className="material-symbols-outlined text-lg">{item.icon || 'verified'}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate" style={{ color: onSurfaceColor }}>{item.title}</p>
                {item.description && <p className="text-xs truncate mt-0.5" style={{ color: surfaceVariant }}>{item.description}</p>}
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${item.isActive ? 'text-green-600 bg-green-500/10' : 'text-red-600 bg-red-500/10'}`}>
                    {item.isActive ? 'Active' : 'Inactive'}
                  </span>
                  <span className="text-[10px] font-bold" style={{ color: surfaceVariant }}>Sort: {item.sortOrder}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-3 pt-3 border-t" style={{ borderColor }}>
              <button onClick={() => toggleGenericActive(item)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors" title="Toggle Active">
                <span className="material-symbols-outlined text-[16px]" style={{ color: item.isActive ? '#22c55e' : surfaceVariant }}>{item.isActive ? 'toggle_on' : 'toggle_off'}</span>
              </button>
              <button onClick={() => openEditGeneric(tab, item)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors" title="Edit">
                <span className="material-symbols-outlined text-[16px]" style={{ color: surfaceVariant }}>edit</span>
              </button>
              <button onClick={() => deleteGeneric(item.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors ml-auto" title="Delete">
                <span className="material-symbols-outlined text-[16px] text-red-500">delete</span>
              </button>
            </div>
          </div>
        );
      case 'product_details':
        const ICON_MAP: Record<string, string> = { FileEdit: 'edit_note', Wand2: 'auto_fix_high', PenTool: 'draw', Layout: 'grid_view', Library: 'library_books', Brain: 'psychology' };
        return (
          <div key={item.id} className="p-4 rounded-xl border transition-all hover:brightness-95 overflow-hidden" style={{ backgroundColor: cardBg, borderColor }}>
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: (item.color || accentColor) + '20', color: item.color || accentColor }}>
                <span className="material-symbols-outlined text-lg">{ICON_MAP[item.icon] || item.icon || 'inventory_2'}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-base font-bold truncate" style={{ color: onSurfaceColor }}>{item.title}</p>
                {item.key && <p className="text-[11px] font-mono truncate" style={{ color: surfaceVariant }}>Key: {item.key}</p>}
                {item.description && <p className="text-xs mt-1 leading-relaxed" style={{ color: surfaceVariant }}>{item.description}</p>}
                <div className="flex items-center gap-3 mt-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${item.isActive ? 'text-green-600 bg-green-500/10' : 'text-red-600 bg-red-500/10'}`}>
                    {item.isActive ? 'Active' : 'Inactive'}
                  </span>
                  <span className="text-[10px] font-bold" style={{ color: surfaceVariant }}>Sort: {item.sortOrder}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 mt-4 pt-3 border-t" style={{ borderColor }}>
              <button onClick={() => toggleGenericActive(item)} className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors" title="Toggle Active">
                <span className="material-symbols-outlined text-lg" style={{ color: item.isActive ? '#22c55e' : surfaceVariant }}>{item.isActive ? 'toggle_on' : 'toggle_off'}</span>
              </button>
              <button onClick={() => openEditGeneric(tab, item)} className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors" title="Edit">
                <span className="material-symbols-outlined text-lg" style={{ color: surfaceVariant }}>edit</span>
              </button>
              <button onClick={() => deleteGeneric(item.id)} className="p-2 rounded-lg hover:bg-red-500/10 transition-colors ml-auto" title="Delete">
                <span className="material-symbols-outlined text-lg text-red-500">delete</span>
              </button>
            </div>
          </div>
        );
      case 'footer_links':
        return (
          <div key={item.id} className="p-4 rounded-xl border transition-all hover:brightness-95 overflow-hidden" style={{ backgroundColor: cardBg, borderColor }}>
            <div className="flex gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: accentColor + '20', color: accentColor }}>
                <span className="material-symbols-outlined text-lg">{item.isTargetBlank ? 'open_in_new' : 'link'}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate" style={{ color: onSurfaceColor }}>{item.label}</p>
                <p className="text-[10px] font-mono truncate" style={{ color: surfaceVariant }}>{item.groupTitle}<span className="hidden sm:inline"> — </span><span className="block sm:hidden truncate">{item.href}</span></p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${item.isActive ? 'text-green-600 bg-green-500/10' : 'text-red-600 bg-red-500/10'}`}>
                    {item.isActive ? 'Active' : 'Inactive'}
                  </span>
                  <span className="text-[10px] font-bold" style={{ color: surfaceVariant }}>Sort: {item.sortOrder}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-3 pt-3 border-t" style={{ borderColor }}>
              <button onClick={() => toggleGenericActive(item)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors" title="Toggle Active">
                <span className="material-symbols-outlined text-[16px]" style={{ color: item.isActive ? '#22c55e' : surfaceVariant }}>{item.isActive ? 'toggle_on' : 'toggle_off'}</span>
              </button>
              <button onClick={() => openEditGeneric(tab, item)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors" title="Edit">
                <span className="material-symbols-outlined text-[16px]" style={{ color: surfaceVariant }}>edit</span>
              </button>
              <button onClick={() => deleteGeneric(item.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors ml-auto" title="Delete">
                <span className="material-symbols-outlined text-[16px] text-red-500">delete</span>
              </button>
            </div>
          </div>
        );
      case 'tasar_stats':
        return (
          <div key={item.id} className="p-4 rounded-xl border transition-all hover:brightness-95 overflow-hidden" style={{ backgroundColor: cardBg, borderColor }}>
            <div className="flex gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: (item.color || accentColor) + '20', color: item.color || accentColor }}>
                <span className="material-symbols-outlined text-lg">{item.icon || 'bar_chart'}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate" style={{ color: onSurfaceColor }}>{item.label}</p>
                <p className="text-xs font-bold truncate" style={{ color: item.color || accentColor }}>{item.value}{item.suffix || ''}</p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap" style={{ backgroundColor: accentColor + '15', color: accentColor }}>{item.category}</span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap ${item.isActive ? 'text-green-600 bg-green-500/10' : 'text-red-600 bg-red-500/10'}`}>
                    {item.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-3 pt-3 border-t" style={{ borderColor }}>
              <button onClick={() => toggleGenericActive(item)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors" title="Toggle Active">
                <span className="material-symbols-outlined text-[16px]" style={{ color: item.isActive ? '#22c55e' : surfaceVariant }}>{item.isActive ? 'toggle_on' : 'toggle_off'}</span>
              </button>
              <button onClick={() => openEditGeneric(tab, item)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors" title="Edit">
                <span className="material-symbols-outlined text-[16px]" style={{ color: surfaceVariant }}>edit</span>
              </button>
              <button onClick={() => deleteGeneric(item.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors ml-auto" title="Delete">
                <span className="material-symbols-outlined text-[16px] text-red-500">delete</span>
              </button>
            </div>
          </div>
        );
      case 'platform_stats':
        return (
          <div key={item.id} className="p-4 rounded-xl border transition-all hover:brightness-95 overflow-hidden" style={{ backgroundColor: cardBg, borderColor }}>
            <div className="flex gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: accentColor + '20', color: accentColor }}>
                <span className="material-symbols-outlined text-lg">analytics</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate" style={{ color: onSurfaceColor }}>{item.label}</p>
                <p className="text-[10px] font-mono truncate" style={{ color: surfaceVariant }}>Key: {item.key}</p>
                <p className="text-xs font-bold truncate" style={{ color: accentColor }}>{item.value}{item.suffix || ''}</p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${item.isActive ? 'text-green-600 bg-green-500/10' : 'text-red-600 bg-red-500/10'}`}>
                    {item.isActive ? 'Active' : 'Inactive'}
                  </span>
                  {item.decimals !== undefined && <span className="text-[10px] font-bold" style={{ color: surfaceVariant }}>Decimals: {item.decimals}</span>}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-3 pt-3 border-t" style={{ borderColor }}>
              <button onClick={() => toggleGenericActive(item)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors" title="Toggle Active">
                <span className="material-symbols-outlined text-[16px]" style={{ color: item.isActive ? '#22c55e' : surfaceVariant }}>{item.isActive ? 'toggle_on' : 'toggle_off'}</span>
              </button>
              <button onClick={() => openEditGeneric(tab, item)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors" title="Edit">
                <span className="material-symbols-outlined text-[16px]" style={{ color: surfaceVariant }}>edit</span>
              </button>
              <button onClick={() => deleteGeneric(item.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors ml-auto" title="Delete">
                <span className="material-symbols-outlined text-[16px] text-red-500">delete</span>
              </button>
            </div>
          </div>
        );
      case 'videos':
        return (
          <div key={item.id} className="p-4 rounded-xl border transition-all hover:brightness-95 overflow-hidden" style={{ backgroundColor: cardBg, borderColor }}>
            <div className="flex gap-3">
              <div className="w-20 h-14 rounded-lg overflow-hidden shrink-0 flex items-center justify-center" style={{ backgroundColor: bgColor }}>
                {item.posterUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.posterUrl} alt={item.title} className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                ) : (
                  <span className="material-symbols-outlined text-2xl" style={{ color: surfaceVariant }}>smart_display</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate" style={{ color: onSurfaceColor }}>{item.title}</p>
                {item.description && <p className="text-xs truncate mt-0.5" style={{ color: surfaceVariant }}>{item.description}</p>}
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${item.isActive ? 'text-green-600 bg-green-500/10' : 'text-red-600 bg-red-500/10'}`}>
                    {item.isActive ? 'Active' : 'Inactive'}
                  </span>
                  <span className="text-[10px] font-bold" style={{ color: surfaceVariant }}>Sort: {item.sortOrder}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-3 pt-3 border-t" style={{ borderColor }}>
              <button onClick={() => toggleGenericActive(item)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors" title="Toggle Active">
                <span className="material-symbols-outlined text-[16px]" style={{ color: item.isActive ? '#22c55e' : surfaceVariant }}>{item.isActive ? 'toggle_on' : 'toggle_off'}</span>
              </button>
              <button onClick={() => openEditGeneric(tab, item)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors" title="Edit">
                <span className="material-symbols-outlined text-[16px]" style={{ color: surfaceVariant }}>edit</span>
              </button>
              <button onClick={() => deleteGeneric(item.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors ml-auto" title="Delete">
                <span className="material-symbols-outlined text-[16px] text-red-500">delete</span>
              </button>
            </div>
          </div>
        );
      case 'floating_banners':
        return (
          <div key={item.id} className="p-4 rounded-xl border transition-all hover:brightness-95 overflow-hidden" style={{ backgroundColor: cardBg, borderColor }}>
            <div className="flex gap-3">
              <div className="w-14 h-20 rounded-lg overflow-hidden shrink-0" style={{ backgroundColor: bgColor }}>
                {item.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs" style={{ color: surfaceVariant }}>No img</div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate" style={{ color: onSurfaceColor }}>{item.title}</p>
                <p className="text-[10px] font-mono truncate" style={{ color: surfaceVariant }}>{item.linkUrl ? `→ ${item.linkUrl}` : 'No link'}</p>
                <div className="flex flex-wrap items-center gap-1.5 mt-1">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${item.isActive ? 'text-green-600 bg-green-500/10' : 'text-red-600 bg-red-500/10'}`}>
                    {item.isActive ? 'Active' : 'Paused'}
                  </span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${item.targetType === 'specific' ? 'text-blue-600 bg-blue-500/10' : 'text-purple-600 bg-purple-500/10'}`}>
                    {item.targetType === 'global' ? 'Global' : 'Targeted'}
                  </span>
                  <span className="text-[10px] font-bold" style={{ color: surfaceVariant }}>{item.width}x{item.height}in</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px]" style={{ color: surfaceVariant }}>Sort: {item.sortOrder}</span>
                  {item.targetType === 'specific' && item.targetEmail && (
                    <span className="text-[10px] truncate max-w-[120px]" style={{ color: surfaceVariant }}>→ {item.targetEmail}</span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-3 pt-3 border-t" style={{ borderColor }}>
              <button onClick={() => toggleGenericActive(item)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors" title={item.isActive ? 'Pause' : 'Activate'}>
                <span className="material-symbols-outlined text-[16px]" style={{ color: item.isActive ? '#22c55e' : surfaceVariant }}>{item.isActive ? 'toggle_on' : 'toggle_off'}</span>
              </button>
              <button onClick={() => openEditGeneric(tab, item)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors" title="Edit">
                <span className="material-symbols-outlined text-[16px]" style={{ color: surfaceVariant }}>edit</span>
              </button>
              <button onClick={() => deleteGeneric(item.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors ml-auto" title="Delete">
                <span className="material-symbols-outlined text-[16px] text-red-500">delete</span>
              </button>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    setLogoMessage(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/admin/upload-logo', { method: 'POST', body: fd });
      const data = await res.json();
      if (data.success) {
        setLogoMessage({ type: 'success', text: 'Logo uploaded successfully! Refresh to see changes.' });
        setTimeout(() => setLogoMessage(null), 4000);
      } else {
        setLogoMessage({ type: 'error', text: data.error || 'Upload failed' });
      }
    } catch {
      setLogoMessage({ type: 'error', text: 'Upload failed' });
    }
    setUploadingLogo(false);
  };

  const handleLogoReset = async () => {
    setLogoMessage(null);
    try {
      const res = await fetch('/api/admin/upload-logo', { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setLogoMessage({ type: 'success', text: 'Logo reset to default. Refresh to see changes.' });
        setTimeout(() => setLogoMessage(null), 4000);
      } else {
        setLogoMessage({ type: 'error', text: data.error || 'Reset failed' });
      }
    } catch {
      setLogoMessage({ type: 'error', text: 'Reset failed' });
    }
  };

  const renderSettingsTab = () => {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <p className="text-sm" style={{ color: surfaceVariant }}>Manage site-wide settings</p>
        </div>

        <div className="p-6 rounded-xl border" style={{ backgroundColor: cardBg, borderColor }}>
          <h3 className="text-base font-bold mb-1" style={{ color: onSurfaceColor }}>Site Logo</h3>
          <p className="text-xs mb-4" style={{ color: surfaceVariant }}>Upload a custom logo that will appear across the entire site.</p>

          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-xl overflow-hidden border-2 shrink-0 flex items-center justify-center" style={{ borderColor, backgroundColor: bgColor }}>
              {logoLoading ? (
                <span className="material-symbols-outlined animate-spin text-lg" style={{ color: surfaceVariant }}>hourglass_top</span>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="Current logo" className="w-full h-full object-contain" onError={e => { (e.target as HTMLImageElement).src = '/logo.png'; }} />
              )}
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: onSurfaceColor }}>Current Logo</p>
              <p className="text-xs" style={{ color: surfaceVariant }}>This logo is displayed on the navbar, footer, and branding elements</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className={`px-4 py-2 rounded-xl text-sm font-bold text-white transition-all hover:brightness-110 active:scale-95 flex items-center gap-1.5 ${uploadingLogo ? 'opacity-60 pointer-events-none' : ''}`}
              style={{ backgroundColor: accentColor }}>
              <span className="material-symbols-outlined text-lg">{uploadingLogo ? 'hourglass_top' : 'cloud_upload'}</span>
              {uploadingLogo ? 'Uploading...' : 'Upload New Logo'}
              <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" disabled={uploadingLogo} />
            </label>
            <button onClick={handleLogoReset}
              className="px-4 py-2 rounded-xl border text-sm font-bold transition-all hover:brightness-95 active:scale-95"
              style={{ borderColor, color: surfaceVariant, backgroundColor: bgColor }}>
              <span className="material-symbols-outlined text-lg mr-1">restart_alt</span>
              Reset to Default
            </button>
          </div>

          {logoMessage && (
            <div className={`mt-3 px-4 py-2 rounded-lg text-xs font-semibold ${logoMessage.type === 'success' ? 'text-green-600 bg-green-500/10' : 'text-red-600 bg-red-500/10'}`}>
              {logoMessage.text}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderGenericTabContent = () => {
    const cfg = genericCfg;
    if (!cfg) return null;
    return (
      <>
        <div className="flex items-center justify-between">
          <p className="text-sm" style={{ color: surfaceVariant }}>{genericData.length} {cfg.label.toLowerCase()}(s)</p>
          <button onClick={() => openNewGeneric(tab)} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-all hover:brightness-110" style={{ backgroundColor: accentColor }}>
            <span className="material-symbols-outlined text-[18px]">add</span>
            Add {cfg.label}
          </button>
        </div>
        {genericData.length === 0 ? (
          <div className="p-12 text-center rounded-xl border" style={{ backgroundColor: cardBg, borderColor }}>
            <span className="material-symbols-outlined text-4xl" style={{ color: surfaceVariant }}>{cfg.icon}</span>
            <p className="mt-3 text-sm font-semibold" style={{ color: onSurfaceColor }}>No {cfg.label.toLowerCase()} yet.</p>
            <p className="mt-1 text-xs" style={{ color: surfaceVariant }}>Add your first {cfg.label.toLowerCase()} entry.</p>
          </div>
        ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {genericData.map(renderGenericCard)}
            </div>
        )}
      </>
    );
  };

  const handle = {
    banners: null,
    testimonials: null,
    how_it_works: null,
    gallery_items: null,
    institution_logos: null,
    features: null,
    benefits: null,
    product_details: null,
    footer_links: null,
    tasar_stats: null,
    platform_stats: null,
    floating_banners: null,
    videos: null,
  };
  const loading = tab === 'banners' ? loadingBanners : tab === 'testimonials' ? loadingTestimonials : genericIsLoading;
  const items = tab === 'banners' ? banners : tab === 'testimonials' ? testimonials : genericData;

  const ALL_TABS: { key: ContentTab; icon: string; label: string; count: number }[] = [
    { key: 'banners', icon: 'view_carousel', label: 'Banners', count: banners.length },
    { key: 'testimonials', icon: 'star', label: 'Testimonials', count: testimonials.length },
    { key: 'how_it_works', icon: 'format_list_numbered', label: 'How It Works', count: (genericItems['how_it_works'] || []).length },
    { key: 'gallery_items', icon: 'photo_library', label: 'Gallery', count: (genericItems['gallery_items'] || []).length },
    { key: 'institution_logos', icon: 'business', label: 'Institutions', count: (genericItems['institution_logos'] || []).length },
    { key: 'features', icon: 'featured_play_list', label: 'Features', count: (genericItems['features'] || []).length },
    { key: 'benefits', icon: 'verified', label: 'Benefits', count: (genericItems['benefits'] || []).length },
    { key: 'product_details', icon: 'inventory_2', label: 'Products', count: (genericItems['product_details'] || []).length },
    { key: 'footer_links', icon: 'link', label: 'Footer Links', count: (genericItems['footer_links'] || []).length },
    { key: 'tasar_stats', icon: 'bar_chart', label: 'TASAR Stats', count: (genericItems['tasar_stats'] || []).length },
    { key: 'platform_stats', icon: 'analytics', label: 'Platform Stats', count: (genericItems['platform_stats'] || []).length },
    { key: 'floating_banners', icon: 'ads_click', label: 'Floating Banners', count: (genericItems['floating_banners'] || []).length },
    { key: 'videos', icon: 'smart_display', label: 'Videos', count: (genericItems['videos'] || []).length },
    { key: 'settings', icon: 'settings', label: 'Settings', count: 0 },
  ];

  return (
    <div className="min-h-screen transition-colors duration-500" style={{ backgroundColor: bgColor, color: onSurfaceColor }}>
      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: var(--color-admin-outline-variant); border-radius: 4px; }
        @keyframes pulse-slow { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
        .animate-pulse-slow { animation: pulse-slow 3s infinite; }
        @keyframes modalFadeIn { from { opacity: 0; transform: scale(0.92) translateY(12px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        .animate-modal { animation: modalFadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1); }
        .modal-input { background-color: ${isDarkMode ? '#1a2340' : '#f1f5f9'} !important; border-color: ${isDarkMode ? '#3d4a6b' : '#cbd5e1'} !important; color: ${onSurfaceColor} !important; transition: all 0.2s ease; }
        .modal-input:hover { border-color: ${accentColor}80 !important; }
        .modal-input:focus { outline: none !important; box-shadow: 0 0 0 3px ${accentColor}30, 0 0 0 1px ${accentColor} !important; border-color: ${accentColor} !important; background-color: ${isDarkMode ? '#1e2a4a' : '#ffffff'} !important; }
        .modal-input::placeholder { color: ${isDarkMode ? '#5a6a8a' : '#94a3b8'} !important; }
        button, label { cursor: pointer; }
        .tabs-scroll { overflow-x: auto; overflow-y: hidden; scrollbar-width: thin; }`}}
      />

      <div className="flex h-screen">
        <aside className="flex flex-col h-full p-4 gap-2 fixed h-screen w-64 left-0 top-0 border-r z-50 transition-colors duration-500"
          style={{ backgroundColor: 'var(--color-admin-surface-container)', borderColor: 'var(--color-admin-outline-variant)' }}>
          <div className="flex flex-col items-center gap-1 px-2 mb-6 mt-2 text-center">
            <Image src="/logo.png" alt="Latexify Logo" width={0} height={0} sizes="100%" className="w-48 h-12 object-contain"
              style={{ filter: isDarkMode ? 'brightness(0) invert(1)' : 'none' }} />
            <p className="text-[10px] font-bold uppercase tracking-wider opacity-85 mt-1"
              style={{ color: 'var(--color-admin-primary)' }}>Admin Console</p>
          </div>
          <nav className="flex flex-col gap-1 overflow-y-auto custom-scrollbar">
            {SIDEBAR_LINKS.map(item => (
              <Link key={item.href} href={item.href}
                className="flex items-center gap-3 px-4 py-3 text-sm rounded-lg transition-all"
                style={{ color: pathname === item.href ? 'var(--color-admin-on-secondary-container)' : 'var(--color-admin-on-surface-variant)', backgroundColor: pathname === item.href ? 'var(--color-admin-secondary-container)' : 'transparent' }}>
                <span className="material-symbols-outlined" style={pathname === item.href ? { fontVariationSettings: "'FILL' 1" } : {}}>{item.icon}</span>
                {item.label}
              </Link>
            ))}
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

        <main className="ml-0 lg:ml-64 min-h-screen pt-24 pb-12">
          <header className="flex justify-between items-center fixed top-0 left-64 right-0 px-6 py-4 border-b z-40 transition-colors duration-500" style={{ backgroundColor: 'var(--color-admin-surface)', borderColor: 'var(--color-admin-outline-variant)' }}>
            <div className="flex items-center gap-4 flex-1">
              <div className="relative w-full max-w-3xl">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--color-admin-on-surface-variant)' }}>search</span>
                <input className="w-full border rounded-lg pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-primary-container focus:border-primary outline-none transition-all" style={{ backgroundColor: 'var(--color-admin-surface-container-lowest)', borderColor: 'var(--color-admin-outline-variant)', color: 'var(--color-admin-on-surface)' }} placeholder="Search parameters..." type="text" />
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="relative" ref={themeRef}>
                <button onClick={() => setIsThemeOpen(!isThemeOpen)} className="material-symbols-outlined transition-colors p-2 rounded-full hover:bg-opacity-20 hover:bg-gray-500" style={{ color: 'var(--color-admin-on-surface-variant)' }} title="Theme Settings">
                  palette
                </button>
                <div className={`absolute right-0 mt-2 w-56 border rounded-xl shadow-xl z-50 overflow-hidden ${isThemeOpen ? 'block' : 'hidden'}`} style={{ backgroundColor: 'var(--color-admin-surface-container-highest)', borderColor: 'var(--color-admin-outline-variant)' }}>
                  <div className="p-3 border-b" style={{ borderColor: 'var(--color-admin-outline-variant)' }}>
                    <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-admin-on-surface)' }}>Accent Color</p>
                  </div>
                  <div className="p-1 max-h-[50vh] overflow-y-auto custom-scrollbar">
                    {(Object.keys(themes) as Theme[]).map((t) => (
                      <button
                        key={t}
                        onClick={() => { setCurrentTheme(t); setIsThemeOpen(false); }}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all group/item hover:bg-opacity-20 hover:bg-gray-500"
                      >
                        <span className="w-4 h-4 rounded-full" style={{ backgroundColor: themes[t].primary }}></span>
                        <span className="text-sm font-medium capitalize" style={{ color: 'var(--color-admin-on-surface)' }}>{t} {t === 'indigo' ? '(Default)' : ''}</span>
                        {currentTheme === t && <span className="material-symbols-outlined text-[16px] ml-auto" style={{ color: 'var(--color-admin-primary)' }}>check</span>}
                      </button>
                    ))}
                  </div>
                  <div className="p-3 border-t" style={{ backgroundColor: 'var(--color-admin-surface-container)', borderColor: 'var(--color-admin-outline-variant)' }}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold" style={{ color: 'var(--color-admin-on-surface)' }}>Dark Mode</span>
                      <button onClick={() => setIsDarkMode(!isDarkMode)} className="w-10 h-5 rounded-full relative transition-colors" style={{ backgroundColor: 'var(--color-admin-primary)' }}>
                        <div className={`absolute top-0.5 w-4 h-4 rounded-full shadow-sm transition-all ${isDarkMode ? 'right-0.5' : 'left-0.5'}`} style={{ backgroundColor: '#ffffff' }}></div>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <div className="relative" ref={notificationsRef}>
                <button
                  onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                  className="material-symbols-outlined transition-colors p-2 rounded-full hover:bg-opacity-20 hover:bg-gray-500 relative flex items-center justify-center"
                  style={{ color: 'var(--color-admin-on-surface-variant)' }}
                  title="Notifications"
                >
                  notifications
                  {announcements.length > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                  )}
                </button>
                {isNotificationsOpen && (
                  <div
                    className="absolute right-0 mt-2 w-80 border rounded-2xl shadow-2xl z-50 overflow-hidden"
                    style={{ backgroundColor: 'var(--color-admin-surface-container-highest)', borderColor: 'var(--color-admin-outline-variant)' }}
                  >
                    <div className="p-4 border-b flex justify-between items-center" style={{ borderColor: 'var(--color-admin-outline-variant)', backgroundColor: 'var(--color-admin-surface-container-high)' }}>
                      <p className="text-sm font-bold" style={{ color: 'var(--color-admin-on-surface)' }}>Notifications</p>
                      {announcements.length > 0 && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-red-500/20 text-red-400">
                          {announcements.length} Alert{announcements.length > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    <div className="p-2 max-h-[320px] overflow-y-auto divide-y divide-white/5">
                      {announcements.length === 0 ? (
                        <div className="text-center text-xs py-8 text-opacity-65" style={{ color: 'var(--color-admin-on-surface-variant)' }}>
                          No new notifications.
                        </div>
                      ) : (
                        announcements.map((item) => (
                          <div key={item.id} className="p-3 hover:bg-black/5 dark:hover:bg-white/5 transition-colors relative group text-left">
                            <button
                              onClick={() => handleDismissAlert(item.id)}
                              className="absolute right-2 top-2 hidden group-hover:block hover:bg-black/5 dark:hover:bg-white/5 rounded p-0.5"
                              title="Dismiss"
                            >
                              <span className="material-symbols-outlined text-[14px] block" style={{ color: 'var(--color-admin-on-surface-variant)' }}>close</span>
                            </button>
                            <p className="text-xs font-bold" style={{ color: item.priority === 'critical' || item.priority === 'warning' ? 'var(--color-admin-primary)' : 'var(--color-admin-on-surface)' }}>
                              {item.title}
                            </p>
                            <p className="text-xs mt-1 leading-normal break-words" style={{ color: 'var(--color-admin-on-surface-variant)' }}>
                              {item.content}
                            </p>
                            <span className="text-[10px] mt-1.5 block opacity-50" style={{ color: 'var(--color-admin-outline)' }}>
                              {formatTimeAgo(item.startsAt)}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                    {announcements.length > 0 && (
                      <button
                        onClick={handleDismissAll}
                        className="block w-full text-center py-2.5 text-xs font-bold border-t transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                        style={{ color: 'var(--color-admin-on-surface-variant)', borderColor: 'var(--color-admin-outline-variant)' }}
                      >
                        DISMISS ALL
                      </button>
                    )}
                  </div>
                )}
              </div>
              <div className="relative" ref={ticketNotifRef}>
                <button
                  onClick={() => setIsTicketNotifOpen(!isTicketNotifOpen)}
                  className="material-symbols-outlined transition-colors p-2 rounded-full hover:bg-opacity-20 hover:bg-gray-500 relative flex items-center justify-center"
                  style={{ color: 'var(--color-admin-on-surface-variant)' }}
                  title="Ticket Notifications"
                >
                  support_agent
                  {ticketUnreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-rose-500 text-white text-[9px] font-black px-1">
                      {ticketUnreadCount > 99 ? '99+' : ticketUnreadCount}
                    </span>
                  )}
                </button>
                {isTicketNotifOpen && (
                  <div
                    className="absolute right-0 mt-2 w-80 border rounded-2xl shadow-2xl z-50 overflow-hidden"
                    style={{ backgroundColor: 'var(--color-admin-surface-container-highest)', borderColor: 'var(--color-admin-outline-variant)' }}
                  >
                    <div className="p-4 border-b flex justify-between items-center" style={{ borderColor: 'var(--color-admin-outline-variant)', backgroundColor: 'var(--color-admin-surface-container-high)' }}>
                      <p className="text-sm font-bold" style={{ color: 'var(--color-admin-on-surface)' }}>Ticket Notifications</p>
                      {ticketUnreadCount > 0 && (
                        <button onClick={markAllTicketNotifRead} className="text-[10px] font-bold hover:underline flex items-center gap-1" style={{ color: 'var(--color-admin-primary)' }}>
                          <span className="material-symbols-outlined text-[12px]">done_all</span> Mark all read
                        </button>
                      )}
                    </div>
                    <div className="p-2 max-h-[320px] overflow-y-auto divide-y divide-white/5">
                      {ticketNotifications.length === 0 ? (
                        <div className="text-center text-xs py-8 text-opacity-65" style={{ color: 'var(--color-admin-on-surface-variant)' }}>
                          No ticket notifications.
                        </div>
                      ) : (
                        ticketNotifications.map((n) => (
                          <div key={n.id} className={`p-3 transition-colors relative group ${n.isRead ? 'opacity-50' : ''}`} style={{ backgroundColor: n.isRead ? 'transparent' : 'var(--color-admin-primary-container)' }}>
                            <button
                              onClick={() => markTicketNotifRead(n.id)}
                              className="absolute right-2 top-2 p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                              title="Dismiss"
                            >
                              <span className="material-symbols-outlined text-[14px] block" style={{ color: 'var(--color-admin-on-surface-variant)' }}>close</span>
                            </button>
                            <div className="pr-6">
                              <p className="text-xs font-bold" style={{ color: 'var(--color-admin-on-surface)' }}>{n.title}</p>
                              <p className="text-xs mt-1 leading-normal break-words" style={{ color: 'var(--color-admin-on-surface-variant)' }}>{n.body}</p>
                              <span className="text-[10px] mt-1.5 block opacity-50" style={{ color: 'var(--color-admin-outline)' }}>
                                {new Date(n.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
              <div ref={profileRef} className="relative pl-4 border-l" style={{ borderColor: 'var(--color-admin-outline-variant)' }}>
                <button
                  onClick={() => setIsProfileOpen(!isProfileOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all hover:opacity-80"
                  style={{ backgroundColor: 'var(--color-admin-surface-container-high)' }}
                >
                  <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm" style={{ backgroundColor: 'var(--color-admin-primary-container)', color: 'var(--color-admin-on-primary-container)' }}>
                    {adminName.split(/\s+/).map((n: string) => n[0]).join('').slice(0,2).toUpperCase() || 'AR'}
                  </div>
                  <div className="text-left hidden md:block">
                    <p className="text-xs font-bold" style={{ color: 'var(--color-admin-on-surface)' }}>{adminName}</p>
                    <p className="text-[10px] truncate max-w-[120px]" style={{ color: 'var(--color-admin-on-surface-variant)' }}>{adminEmail}</p>
                  </div>
                  <span className="material-symbols-outlined text-[16px]" style={{ color: 'var(--color-admin-on-surface-variant)' }}>
                    {isProfileOpen ? 'keyboard_arrow_up' : 'keyboard_arrow_down'}
                  </span>
                </button>
                {isProfileOpen && (
                  <div
                    className="absolute right-0 mt-2 w-64 border rounded-2xl shadow-2xl z-50 overflow-hidden"
                    style={{ backgroundColor: 'var(--color-admin-surface-container-highest)', borderColor: 'var(--color-admin-outline-variant)' }}
                  >
                    <div className="p-4 border-b" style={{ borderColor: 'var(--color-admin-outline-variant)', backgroundColor: 'var(--color-admin-surface-container-high)' }}>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-base" style={{ backgroundColor: 'var(--color-admin-primary-container)', color: 'var(--color-admin-on-primary-container)' }}>
                          {adminName.split(/\s+/).map((n: string) => n[0]).join('').slice(0,2).toUpperCase() || 'AR'}
                        </div>
                        <div>
                          <p className="text-sm font-bold" style={{ color: 'var(--color-admin-on-surface)' }}>{adminName}</p>
                          <p className="text-xs truncate max-w-[160px]" style={{ color: 'var(--color-admin-on-surface-variant)' }}>{adminEmail}</p>
                        </div>
                      </div>
                    </div>
                    <div className="p-2">
                      <Link
                        href="/admin/change-password"
                        onClick={() => setIsProfileOpen(false)}
                        className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all hover:opacity-80"
                        style={{ color: 'var(--color-admin-on-surface)' }}
                      >
                        <span className="material-symbols-outlined text-[20px]" style={{ color: 'var(--color-admin-primary)' }}>lock_reset</span>
                        Change Password
                      </Link>
                      <button
                        onClick={handleLogout}
                        disabled={loggingOut}
                        className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all hover:opacity-80 mt-1 disabled:opacity-60"
                        style={{ color: '#ef4444' }}
                      >
                        <span className="material-symbols-outlined text-[20px]">logout</span>
                        {loggingOut ? 'Signing Out\u2026' : 'Sign Out'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </header>

          {/* Tabs */}
          <div className="flex flex-wrap items-center gap-1 px-8 pt-6 pb-2 border-b" style={{ borderColor }}>
            {ALL_TABS.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold rounded-t-lg transition-all whitespace-nowrap"
                style={{ color: tab === t.key ? accentColor : surfaceVariant, borderBottom: tab === t.key ? `2px solid ${accentColor}` : '2px solid transparent', backgroundColor: tab === t.key ? accentColor + '10' : 'transparent' }}>
                <span className="material-symbols-outlined text-[18px]">{t.icon}</span>
                {t.label}
                <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: accentColor + '20', color: accentColor }}>{t.count}</span>
              </button>
            ))}
          </div>

          <div className="px-8 py-6 space-y-6" style={loading ? { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 280px)' } : {}}>
            {loading ? (
              <ProLoader variant="admin" fullScreen={false} />
            ) : tab === 'banners' ? (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-sm" style={{ color: surfaceVariant }}>{banners.length} banner(s) configured</p>
                  <button onClick={openNewBanner} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-all hover:brightness-110" style={{ backgroundColor: accentColor }}>
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    {banners.map(banner => (
                      <div key={banner.id} className="p-4 rounded-xl border transition-all hover:brightness-95 overflow-hidden" style={{ backgroundColor: cardBg, borderColor }}>
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
                          <button onClick={() => toggleBannerActive(banner)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors" title="Toggle Active">
                            <span className="material-symbols-outlined text-[16px]" style={{ color: banner.isActive ? '#22c55e' : surfaceVariant }}>{banner.isActive ? 'toggle_on' : 'toggle_off'}</span>
                          </button>
                          <button onClick={() => openEditBanner(banner)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors" title="Edit">
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
            ) : tab === 'testimonials' ? (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-sm" style={{ color: surfaceVariant }}>{testimonials.length} testimonial(s)</p>
                  <button onClick={openNewTestimonial} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-all hover:brightness-110" style={{ backgroundColor: accentColor }}>
                    <span className="material-symbols-outlined text-[18px]">add</span>
                    Add Testimonial
                  </button>
                </div>
                {testimonials.length === 0 ? (
                  <div className="p-12 text-center rounded-xl border" style={{ backgroundColor: cardBg, borderColor }}>
                    <span className="material-symbols-outlined text-4xl" style={{ color: surfaceVariant }}>star</span>
                    <p className="mt-3 text-sm font-semibold" style={{ color: onSurfaceColor }}>No testimonials yet.</p>
                    <p className="mt-1 text-xs" style={{ color: surfaceVariant }}>Add testimonials to showcase on the home page.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    {testimonials.map(t => (
                      <div key={t.id} className="p-4 rounded-xl border transition-all hover:brightness-95 overflow-hidden" style={{ backgroundColor: cardBg, borderColor }}>
                        <div className="flex items-start gap-3">
                          {t.avatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={t.avatarUrl} alt={t.name} className="w-10 h-10 rounded-full object-cover shrink-0" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                          ) : (
                            <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0" style={{ backgroundColor: accentColor + '30', color: accentColor }}>
                              {t.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold truncate" style={{ color: onSurfaceColor }}>{t.name}</p>
                            {t.role && <p className="text-xs truncate" style={{ color: surfaceVariant }}>{t.role}</p>}
                          </div>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${t.isActive ? 'text-green-600 bg-green-500/10' : 'text-red-600 bg-red-500/10'}`}>
                            {t.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <div className="mt-2"><StarRating rating={t.rating} /></div>
                        <p className="text-xs mt-2 line-clamp-3" style={{ color: surfaceVariant }}>{t.content}</p>
                        <div className="flex items-center gap-2 mt-3 pt-3 border-t" style={{ borderColor }}>
                          <button onClick={() => toggleTestimonialActive(t)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors" title="Toggle Active">
                            <span className="material-symbols-outlined text-[16px]" style={{ color: t.isActive ? '#22c55e' : surfaceVariant }}>{t.isActive ? 'toggle_on' : 'toggle_off'}</span>
                          </button>
                          <button onClick={() => openEditTestimonial(t)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors" title="Edit">
                            <span className="material-symbols-outlined text-[16px]" style={{ color: surfaceVariant }}>edit</span>
                          </button>
                          <button onClick={() => deleteTestimonial(t.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors ml-auto" title="Delete">
                            <span className="material-symbols-outlined text-[16px] text-red-500">delete</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : tab === 'settings' ? (
              renderSettingsTab()
            ) : (
              renderGenericTabContent()
            )}
          </div>
        </main>
      </div>

      {/* Banner Form Modal */}
      {showBannerForm && (
        <div className="fixed inset-0 z-[9999] flex items-start sm:items-center justify-center bg-black/60 backdrop-blur-md p-4 overflow-y-auto" onClick={() => setShowBannerForm(false)}>
          <div className="animate-modal w-full sm:w-11/12 md:w-5/6 lg:w-3/4 xl:w-2/3 max-w-4xl p-6 sm:p-8 rounded-2xl border shadow-2xl max-h-[90vh] overflow-y-auto" style={{ backgroundColor: surfaceColor, borderColor }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: accentColor + '20' }}>
                  <span className="material-symbols-outlined text-lg" style={{ color: accentColor }}>view_carousel</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold" style={{ color: onSurfaceColor }}>{editingBanner ? 'Edit Banner' : 'Add Banner'}</h3>
                  <p className="text-xs" style={{ color: surfaceVariant }}>{editingBanner ? 'Update the banner details below' : 'Fill in the details to create a new banner'}</p>
                </div>
              </div>
              <button onClick={() => setShowBannerForm(false)} className="w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:rotate-90" style={{ backgroundColor: bgColor, color: surfaceVariant }}>
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold tracking-wider" style={{ color: surfaceVariant }}>Title</label>
                  <input type="text" value={bannerForm.title} onChange={e => setBannerForm({ ...bannerForm, title: e.target.value })}
                    className="modal-input w-full mt-1.5 px-3.5 py-2.5 rounded-xl border text-sm transition-all" placeholder="e.g. Latexify Dashboard" />
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {TOOL_TITLES.map(t => (
                      <button key={t} type="button" onClick={() => setBannerForm({ ...bannerForm, title: t })}
                        className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border transition-all ${bannerForm.title === t ? 'text-white scale-105' : 'hover:scale-105'}`}
                        style={{ borderColor, backgroundColor: bannerForm.title === t ? accentColor : 'transparent', color: bannerForm.title === t ? '#fff' : surfaceVariant }}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold tracking-wider" style={{ color: surfaceVariant }}>Subtitle</label>
                  <input type="text" value={bannerForm.subtitle} onChange={e => setBannerForm({ ...bannerForm, subtitle: e.target.value })}
                    className="modal-input w-full mt-1.5 px-3.5 py-2.5 rounded-xl border text-sm transition-all" placeholder="A short description for the banner" />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold tracking-wider" style={{ color: surfaceVariant }}>Image</label>
                <div className="flex gap-2 mt-1.5">
                  <input type="text" value={bannerForm.imageUrl} onChange={e => setBannerForm({ ...bannerForm, imageUrl: e.target.value })}
                    className="modal-input flex-1 px-3.5 py-2.5 rounded-xl border text-sm transition-all" placeholder="Paste image URL or upload below" />
                  <label className={`px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:brightness-110 hover:scale-[1.02] active:scale-95 flex items-center gap-1.5 shrink-0 ${uploadingBannerImage ? 'opacity-60 pointer-events-none' : ''}`}
                    style={{ backgroundColor: accentColor }}>
                    <span className="material-symbols-outlined text-lg">{uploadingBannerImage ? 'hourglass_top' : 'cloud_upload'}</span>
                    {uploadingBannerImage ? 'Uploading...' : 'Upload'}
                    <input type="file" accept="image/*" onChange={handleBannerImageUpload} className="hidden" disabled={uploadingBannerImage} />
                  </label>
                </div>
                {bannerForm.imageUrl && (
                  <div className="mt-3 rounded-xl overflow-hidden border" style={{ borderColor }}>
                    <div className="relative w-full h-28 sm:h-36 group">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={bannerForm.imageUrl} alt="preview" className="w-full h-full object-cover transition-all group-hover:scale-105" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-all" />
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold tracking-wider" style={{ color: surfaceVariant }}>Link URL</label>
                  <input type="text" value={bannerForm.linkUrl} onChange={e => setBannerForm({ ...bannerForm, linkUrl: e.target.value })}
                    className="modal-input w-full mt-1.5 px-3.5 py-2.5 rounded-xl border text-sm transition-all" placeholder="/latex-studio" />
                </div>
                <div>
                  <label className="text-xs font-bold tracking-wider" style={{ color: surfaceVariant }}>Sort Order</label>
                  <input type="number" value={bannerForm.sortOrder} onChange={e => setBannerForm({ ...bannerForm, sortOrder: parseInt(e.target.value) || 0 })}
                    className="modal-input w-full mt-1.5 px-3.5 py-2.5 rounded-xl border text-sm transition-all" placeholder="0" />
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-xl" style={{ backgroundColor: bgColor, border: `1px solid ${borderColor}` }}>
                <div className="relative">
                  <input type="checkbox" id="bannerActive" checked={bannerForm.isActive} onChange={e => setBannerForm({ ...bannerForm, isActive: e.target.checked })}
                    className="sr-only" />
                  <label htmlFor="bannerActive" className={`w-10 h-6 rounded-full transition-all flex items-center px-0.5 ${bannerForm.isActive ? 'justify-end' : 'justify-start'}`}
                    style={{ backgroundColor: bannerForm.isActive ? accentColor : '#64748b' }}>
                    <div className="w-5 h-5 rounded-full bg-white shadow-sm transition-all" />
                  </label>
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: onSurfaceColor }}>Active</p>
                  <p className="text-xs" style={{ color: surfaceVariant }}>Show this banner on the home page</p>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6 pt-5 border-t" style={{ borderColor }}>
              <button onClick={() => setShowBannerForm(false)} className="flex-1 py-2.5 rounded-xl border text-sm font-bold transition-all hover:brightness-95 active:scale-[0.98]" style={{ borderColor, color: surfaceVariant, backgroundColor: bgColor }}>Cancel</button>
              <button onClick={saveBanner} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:brightness-110 hover:scale-[1.01] active:scale-[0.98] flex items-center justify-center gap-2" style={{ backgroundColor: accentColor }}>
                <span className="material-symbols-outlined text-lg">{editingBanner ? 'save' : 'add_circle'}</span>
                {editingBanner ? 'Update' : 'Create'} Banner
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Testimonial Form Modal */}
      {showTestimonialForm && (
        <div className="fixed inset-0 z-[9999] flex items-start sm:items-center justify-center bg-black/60 backdrop-blur-md p-4 overflow-y-auto" onClick={() => setShowTestimonialForm(false)}>
          <div className="animate-modal w-full sm:w-11/12 md:w-5/6 lg:w-3/4 xl:w-2/3 max-w-4xl p-6 sm:p-8 rounded-2xl border shadow-2xl max-h-[90vh] overflow-y-auto" style={{ backgroundColor: surfaceColor, borderColor }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: accentColor + '20' }}>
                  <span className="material-symbols-outlined text-lg" style={{ color: accentColor }}>star</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold" style={{ color: onSurfaceColor }}>{editingTestimonial ? 'Edit Testimonial' : 'Add Testimonial'}</h3>
                  <p className="text-xs" style={{ color: surfaceVariant }}>{editingTestimonial ? 'Update the testimonial details below' : 'Fill in the details to add a new testimonial'}</p>
                </div>
              </div>
              <button onClick={() => setShowTestimonialForm(false)} className="w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:rotate-90" style={{ backgroundColor: bgColor, color: surfaceVariant }}>
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold tracking-wider" style={{ color: surfaceVariant }}>Name</label>
                  <input type="text" value={testimonialForm.name} onChange={e => setTestimonialForm({ ...testimonialForm, name: e.target.value })}
                    className="modal-input w-full mt-1.5 px-3.5 py-2.5 rounded-xl border text-sm transition-all" placeholder="e.g. John Doe" />
                </div>
                <div>
                  <label className="text-xs font-bold tracking-wider" style={{ color: surfaceVariant }}>Role</label>
                  <input type="text" value={testimonialForm.role} onChange={e => setTestimonialForm({ ...testimonialForm, role: e.target.value })}
                    className="modal-input w-full mt-1.5 px-3.5 py-2.5 rounded-xl border text-sm transition-all" placeholder="e.g. Professor at MIT" />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold tracking-wider" style={{ color: surfaceVariant }}>Avatar</label>
                <div className="flex gap-2 mt-1.5">
                  <input type="text" value={testimonialForm.avatarUrl} onChange={e => setTestimonialForm({ ...testimonialForm, avatarUrl: e.target.value })}
                    className="modal-input flex-1 px-3.5 py-2.5 rounded-xl border text-sm transition-all" placeholder="Paste avatar URL or upload below" />
                  <label className={`px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:brightness-110 hover:scale-[1.02] active:scale-95 flex items-center gap-1.5 shrink-0 ${uploadingAvatar ? 'opacity-60 pointer-events-none' : ''}`}
                    style={{ backgroundColor: accentColor }}>
                    <span className="material-symbols-outlined text-lg">{uploadingAvatar ? 'hourglass_top' : 'cloud_upload'}</span>
                    {uploadingAvatar ? 'Uploading...' : 'Upload'}
                    <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" disabled={uploadingAvatar} />
                  </label>
                </div>
                {testimonialForm.avatarUrl && (
                  <div className="mt-3 flex items-center gap-3 p-3 rounded-xl" style={{ backgroundColor: bgColor, border: `1px solid ${borderColor}` }}>
                    <div className="w-14 h-14 rounded-full overflow-hidden border-2 shrink-0" style={{ borderColor: accentColor + '40' }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={testimonialForm.avatarUrl} alt="avatar preview" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: onSurfaceColor }}>Avatar Preview</p>
                      <p className="text-xs" style={{ color: surfaceVariant }}>The avatar will be displayed as a circle</p>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs font-bold tracking-wider" style={{ color: surfaceVariant }}>Content</label>
                <textarea value={testimonialForm.content} onChange={e => setTestimonialForm({ ...testimonialForm, content: e.target.value })}
                  className="modal-input w-full mt-1.5 px-3.5 py-2.5 rounded-xl border text-sm transition-all resize-none" rows={3} placeholder="Write the testimonial content here..." />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-bold tracking-wider" style={{ color: surfaceVariant }}>Rating</label>
                  <div className="mt-1.5 flex items-center gap-2 p-2.5 rounded-xl border" style={{ backgroundColor: bgColor, borderColor }}>
                    {[1, 2, 3, 4, 5].map(i => (
                      <button key={i} type="button" onClick={() => setTestimonialForm({ ...testimonialForm, rating: i })}
                        className="transition-all hover:scale-110 active:scale-90">
                        <span className="material-symbols-outlined text-xl" style={{ color: i <= testimonialForm.rating ? '#f59e0b' : '#64748b', fontVariationSettings: i <= testimonialForm.rating ? "'FILL' 1" : "'FILL' 0" }}>
                          star
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold tracking-wider" style={{ color: surfaceVariant }}>Sort Order</label>
                  <input type="number" value={testimonialForm.sortOrder} onChange={e => setTestimonialForm({ ...testimonialForm, sortOrder: parseInt(e.target.value) || 0 })}
                    className="modal-input w-full mt-1.5 px-3.5 py-2.5 rounded-xl border text-sm transition-all" placeholder="0" />
                </div>
                <div>
                  <label className="text-xs font-bold tracking-wider" style={{ color: surfaceVariant }}>Status</label>
                  <div className="mt-1.5 flex items-center gap-3 p-2.5 rounded-xl border" style={{ backgroundColor: bgColor, borderColor }}>
                    <div className="relative">
                      <input type="checkbox" id="testimonialActive" checked={testimonialForm.isActive} onChange={e => setTestimonialForm({ ...testimonialForm, isActive: e.target.checked })}
                        className="sr-only" />
                      <label htmlFor="testimonialActive" className={`w-10 h-6 rounded-full transition-all flex items-center px-0.5 ${testimonialForm.isActive ? 'justify-end' : 'justify-start'}`}
                        style={{ backgroundColor: testimonialForm.isActive ? accentColor : '#64748b' }}>
                        <div className="w-5 h-5 rounded-full bg-white shadow-sm transition-all" />
                      </label>
                    </div>
                    <span className="text-sm font-semibold" style={{ color: testimonialForm.isActive ? '#22c55e' : surfaceVariant }}>{testimonialForm.isActive ? 'Active' : 'Inactive'}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6 pt-5 border-t" style={{ borderColor }}>
              <button onClick={() => setShowTestimonialForm(false)} className="flex-1 py-2.5 rounded-xl border text-sm font-bold transition-all hover:brightness-95 active:scale-[0.98]" style={{ borderColor, color: surfaceVariant, backgroundColor: bgColor }}>Cancel</button>
              <button onClick={saveTestimonial} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:brightness-110 hover:scale-[1.01] active:scale-[0.98] flex items-center justify-center gap-2" style={{ backgroundColor: accentColor }}>
                <span className="material-symbols-outlined text-lg">{editingTestimonial ? 'save' : 'add_circle'}</span>
                {editingTestimonial ? 'Update' : 'Create'} Testimonial
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Generic Form Modal */}
      {showGenericForm && isGenericTab && (
        <div className="fixed inset-0 z-[9999] flex items-start sm:items-center justify-center bg-black/60 backdrop-blur-md p-4 overflow-y-auto" onClick={() => setShowGenericForm(false)}>
          <div className="animate-modal w-full sm:w-11/12 md:w-5/6 lg:w-3/4 xl:w-2/3 max-w-4xl p-6 sm:p-8 rounded-2xl border shadow-2xl max-h-[90vh] overflow-y-auto" style={{ backgroundColor: surfaceColor, borderColor }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: accentColor + '20' }}>
                  <span className="material-symbols-outlined text-lg" style={{ color: accentColor }}>{genericCfg?.icon || 'folder'}</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold" style={{ color: onSurfaceColor }}>{editingGeneric ? `Edit ${genericCfg?.label}` : `Add ${genericCfg?.label}`}</h3>
                  <p className="text-xs" style={{ color: surfaceVariant }}>{editingGeneric ? 'Update the details below' : 'Fill in the details to create a new entry'}</p>
                </div>
              </div>
              <button onClick={() => setShowGenericForm(false)} className="w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:rotate-90" style={{ backgroundColor: bgColor, color: surfaceVariant }}>
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            {renderGenericFormFields()}

            <div className="flex gap-3 mt-6 pt-5 border-t" style={{ borderColor }}>
              <button onClick={() => setShowGenericForm(false)} className="flex-1 py-2.5 rounded-xl border text-sm font-bold transition-all hover:brightness-95 active:scale-[0.98]" style={{ borderColor, color: surfaceVariant, backgroundColor: bgColor }}>Cancel</button>
              <button onClick={saveGeneric} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:brightness-110 hover:scale-[1.01] active:scale-[0.98] flex items-center justify-center gap-2" style={{ backgroundColor: accentColor }}>
                <span className="material-symbols-outlined text-lg">{editingGeneric ? 'save' : 'add_circle'}</span>
                {editingGeneric ? 'Update' : 'Create'} {genericCfg?.label}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
