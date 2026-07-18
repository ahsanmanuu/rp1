'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { usePbRealtime } from '@/lib/usePbRealtime';

export interface HomeData {
  banners: any[];
  testimonials: any[];
  howItWorks: any[];
  galleryItems: any[];
  institutionLogos: any[];
  features: any[];
  benefits: any[];
  productDetails: any[];
  footerLinks: any[];
  tasarStats: any[];
  platformStats: any[];
  videos: any[];
  floatingBanners: any[];
}

const FALLBACK_DATA: HomeData = {
  banners: [
    { title: 'Academic Publishing, Reimagined', subtitle: 'The modern, intelligent platform for the entire research writing lifecycle.', imageUrl: '', linkUrl: '/latex-studio', sortOrder: 1 },
    { title: 'AI-Powered Peer Review', subtitle: 'Get instant, scholarly feedback on clarity, argumentation, and methodology.', imageUrl: '', linkUrl: '/reviewer', sortOrder: 2 },
  ],
  testimonials: [
    { name: 'Dr. Elena Rostova', role: 'Postdoctoral Fellow, MIT', content: 'Latexify\'s template migrator saved me weeks of reformatting when my paper was transferred between journals.', rating: 5, sortOrder: 1 },
    { name: 'James Chen', role: 'PhD Candidate, Stanford University', content: 'The AI Peer Reviewer caught several logical gaps in my methodology section before submission.', rating: 5, sortOrder: 2 },
    { name: 'Prof. Sarah Jenkins', role: 'Principal Investigator, University of Oxford', content: 'I\'ve moved my entire lab to Latexify. Collaborative writing is finally seamless.', rating: 5, sortOrder: 3 },
  ],
  howItWorks: [
    { stepNumber: 1, title: 'Upload or Write', description: 'Start from a template or upload a Word document. The editor supports full LaTeX with real-time preview.', sortOrder: 1 },
    { stepNumber: 2, title: 'Collaborate & Refine', description: 'Invite co-authors, use AI-powered suggestions, and manage citations effortlessly.', sortOrder: 2 },
    { stepNumber: 3, title: 'Export & Publish', description: 'Compile to PDF, switch journal templates with one click, and submit with confidence.', sortOrder: 3 },
  ],
  galleryItems: [],
  institutionLogos: [
    { name: 'MIT', icon: 'School', sortOrder: 1 },
    { name: 'Stanford', icon: 'Building2', sortOrder: 2 },
    { name: 'Oxford', icon: 'BookOpen', sortOrder: 3 },
    { name: 'CERN', icon: 'Atom', sortOrder: 4 },
    { name: 'Harvard', icon: 'GraduationCap', sortOrder: 5 },
  ],
  features: [
    { title: 'Latexify Dashboard', description: 'A modern, powerful, collaborative LaTeX editor designed for the web. Write with joy, compile with speed, share with ease.', icon: 'FileEdit', iconBg: 'var(--accent-primary)', glow: 'var(--accent-primary)', tags: ['Real-time Collab', 'Cloud Sync'], href: '/latex-studio/projects' },
    { title: 'Doc2Latex', description: 'Instantly convert Word documents into clean, well-structured LaTeX code.', icon: 'Wand2', iconBg: 'var(--accent-secondary)', glow: 'var(--accent-secondary)', tags: ['DOCX → LaTeX', 'Smart Parsing'], href: '/upload' },
    { title: 'Diagram Studio', description: 'Create beautiful TikZ diagrams with an intuitive visual canvas.', icon: 'PenTool', iconBg: '#f59e0b', glow: '#f59e0b', tags: ['Visual Editor', 'TikZ Export'], href: '/diagrams/editor' },
    { title: 'Template Migrator', description: 'Switch journals effortlessly. One click updates your entire document styling.', icon: 'Layout', iconBg: '#0891b2', glow: '#0891b2', tags: ['55+ Templates', 'IEEE, Nature, ACM'], href: '/template-migrator/studio' },
    { title: 'Citation Studio', description: 'Manage your bibliography seamlessly. Auto-fetch metadata via DOI.', icon: 'Library', iconBg: '#059669', glow: '#059669', tags: ['DOI Auto-fetch', 'BibTeX Export'], href: '/citations/studio' },
    { title: 'AI Peer Reviewer', description: 'Get instant, scholarly feedback on clarity, argumentation, and methodology.', icon: 'Brain', iconBg: '#dc2626', glow: '#dc2626', tags: ['Logic Check', 'Grammar AI'], href: '/reviewer/studio' },
  ],
  benefits: [
    { title: 'Real-time Collaboration', desc: 'Work simultaneously with co-authors across the globe. See changes as they happen.', icon: 'Globe', color: 'var(--accent-primary)', sortOrder: 1 },
    { title: 'AI-Powered Assistance', desc: 'Smart suggestions, auto-completions, and grammar checks powered by advanced AI.', icon: 'Zap', color: 'var(--accent-secondary)', sortOrder: 2 },
    { title: 'Journal-Ready Output', desc: 'One-click template switching for 55+ journals. IEEE, Nature, ACM, and more.', icon: 'Shield', color: '#f59e0b', sortOrder: 3 },
    { title: 'Seamless Collaboration', desc: 'Share projects, manage permissions, and track changes with full version history.', icon: 'Users', color: '#0891b2', sortOrder: 4 },
  ],
  productDetails: [
    { key: 'latexify', title: 'Latexify Dashboard', desc: 'A powerful collaborative LaTeX editor.', icon: 'FileEdit', color: 'var(--accent-primary)', features: ['Real-time collaboration', 'Cloud sync', 'Version history', 'Smart autocomplete'] },
    { key: 'doc2latex', title: 'Doc2Latex', desc: 'Convert Word to LaTeX instantly.', icon: 'Wand2', color: 'var(--accent-secondary)', features: ['DOCX import', 'Smart parsing', 'Format preservation', 'Batch conversion'] },
    { key: 'diagrams', title: 'Diagram Studio', desc: 'Visual TikZ diagram creation.', icon: 'PenTool', color: '#f59e0b', features: ['Drag & drop canvas', 'TikZ export', 'Shape library', 'SVG import'] },
    { key: 'templates', title: 'Template Migrator', desc: 'Switch journal templates instantly.', icon: 'Layout', color: '#0891b2', features: ['55+ journal templates', 'One-click switching', 'Style preservation', 'Custom templates'] },
    { key: 'citations', title: 'Citation Studio', desc: 'Manage references seamlessly.', icon: 'Library', color: '#059669', features: ['DOI auto-fetch', 'BibTeX export', 'Tag organization', 'RIS import'] },
    { key: 'reviewer', title: 'AI Peer Reviewer', desc: 'AI-powered manuscript review.', icon: 'Brain', color: '#dc2626', features: ['Logic checking', 'Grammar analysis', 'Methodology review', 'Citation validation'] },
  ],
  footerLinks: [
    { groupTitle: 'Products', label: 'Latexify Studio', href: '/latex-studio', linkKey: 'Latexify Studio', sortOrder: 1 },
    { groupTitle: 'Products', label: 'Doc2Latex', href: '/upload', linkKey: 'Doc2Latex', sortOrder: 2 },
    { groupTitle: 'Products', label: 'Diagram Studio', href: '/diagrams/editor', linkKey: 'Diagram Studio', sortOrder: 3 },
    { groupTitle: 'Products', label: 'Template Migrator', href: '/template-migrator/studio', linkKey: 'Template Migrator', sortOrder: 4 },
    { groupTitle: 'Products', label: 'Citation Studio', href: '/citations/studio', linkKey: 'Citation Studio', sortOrder: 5 },
    { groupTitle: 'Products', label: 'AI Peer Reviewer', href: '/reviewer/studio', linkKey: 'AI Peer Reviewer', sortOrder: 6 },
    { groupTitle: 'Resources', label: 'Pricing', href: '/pricing', sortOrder: 7 },
    { groupTitle: 'Resources', label: 'Templates Gallery', href: '/templates', sortOrder: 8 },
    { groupTitle: 'Resources', label: 'Help Center', href: '/help', sortOrder: 9 },
    { groupTitle: 'Company', label: 'About Us', href: '/about', sortOrder: 10 },
    { groupTitle: 'Company', label: 'Careers', href: '/careers', sortOrder: 11 },
    { groupTitle: 'Company', label: 'Blog', href: '/blog', sortOrder: 12 },
    { groupTitle: 'Company', label: 'Contact', href: '/contact', sortOrder: 13 },
    { groupTitle: 'Legal', label: 'Privacy Policy', href: '/privacy', sortOrder: 14 },
    { groupTitle: 'Legal', label: 'Terms of Service', href: '/terms', sortOrder: 15 },
    { groupTitle: 'Legal', label: 'Cookie Policy', href: '/cookies', sortOrder: 16 },
    { groupTitle: 'Legal', label: 'GDPR', href: '/gdpr', sortOrder: 17 },
  ],
  tasarStats: [
    { label: 'Papers Processed', value: '12500', suffix: '+', sortOrder: 1, category: 'tools' },
    { label: 'Active Users', value: '8450', suffix: '+', sortOrder: 2, category: 'academic' },
    { label: 'AI Reviews', value: '32000', suffix: '+', sortOrder: 3, category: 'analytics' },
    { label: 'Templates', value: '55', suffix: '', sortOrder: 4, category: 'research' },
  ],
  platformStats: [
    { key: 'totalResearchers', value: 50000 },
    { key: 'pagesCompiled', value: 1200000 },
    { key: 'journalTemplates', value: 55 },
    { key: 'uptime', value: 99.9 },
    { key: 'scholarsActive', value: 18450 },
    { key: 'systemsOperational', value: 1 },
  ],
  videos: [],
  floatingBanners: [
    { id: 'fallback-1', title: 'Welcome to Latexify', imageUrl: 'https://placehold.co/400x600/4f46e5/ffffff?text=Try+AI+Review', linkUrl: '/reviewer', targetType: 'global', width: 4, height: 6, duration: 5, isActive: true, sortOrder: 1 },
  ],
};

const INITIAL_DATA: HomeData = {
  banners: [], testimonials: [], howItWorks: [], galleryItems: [],
  institutionLogos: [], features: [], benefits: [], productDetails: [],
  footerLinks: [], tasarStats: [], platformStats: [], videos: [], floatingBanners: [],
};

const HOME_KEYS: (keyof HomeData)[] = [
  'banners', 'testimonials', 'howItWorks', 'galleryItems', 'institutionLogos',
  'features', 'benefits', 'productDetails', 'footerLinks', 'tasarStats',
  'platformStats', 'videos', 'floatingBanners',
];

const CACHE_TTL_MS = 30_000; // 30 seconds

interface CacheEntry {
  data: HomeData;
  timestamp: number;
}

let cache: CacheEntry | null = null;

function mergeWithFallback(fetched: HomeData): HomeData {
  const merged = { ...fetched };
  for (const key of HOME_KEYS) {
    if (!merged[key] || merged[key].length === 0) {
      merged[key] = FALLBACK_DATA[key];
    }
  }
  return merged;
}

async function fetchAllCollections(): Promise<HomeData> {
  try {
    const res = await fetch('/api/content/homepage', {
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json.success && json.data) {
      return mergeWithFallback(json.data);
    }
  } catch (err) {
    console.warn('[useHomeRealtime] Fetch failed:', err);
  }
  return mergeWithFallback({ ...INITIAL_DATA });
}

export function useHomeRealtime(skip = false, pollIntervalMs = 30_000) {
  const [data, setData] = useState<HomeData>(() => {
    if (cache && Date.now() - cache.timestamp < CACHE_TTL_MS) {
      return cache.data;
    }
    return INITIAL_DATA;
  });
  const [loading, setLoading] = useState(!cache);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const result = await fetchAllCollections();
      cache = { data: result, timestamp: Date.now() };
      setData(result);
    } catch (err) {
      console.error('[useHomeRealtime] Fetch error:', err);
      if (!cache || Date.now() - cache.timestamp > CACHE_TTL_MS) {
        setData(INITIAL_DATA);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (skip) return;
    fetchAll();
  }, [skip, fetchAll]);

  // Polling fallback for auto-refresh
  useEffect(() => {
    if (skip || pollIntervalMs <= 0) return;
    
    pollRef.current = setInterval(() => {
      fetchAll();
    }, pollIntervalMs);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [skip, pollIntervalMs, fetchAll]);

  // Real-time subscription for immediate updates
  usePbRealtime('banners', () => fetchAll(), { enabled: !skip });
  usePbRealtime('testimonials', () => fetchAll(), { enabled: !skip });
  usePbRealtime('floating_banners', () => fetchAll(), { enabled: !skip });
  usePbRealtime('features', () => fetchAll(), { enabled: !skip });

  return { data, loading, refresh: fetchAll };
}
