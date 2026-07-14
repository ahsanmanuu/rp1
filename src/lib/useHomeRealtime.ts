'use client';

import { useState, useEffect, useCallback } from 'react';
import { createPb } from './pb';

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
}

const ACTIVE_FILTER = 'isActive=true';

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
    { groupTitle: 'Platform', label: 'Latexify', href: '/', sortOrder: 1 },
    { groupTitle: 'Platform', label: 'Pricing', href: '/pricing', sortOrder: 2 },
    { groupTitle: 'Platform', label: 'About Us', href: '/about', sortOrder: 3 },
    { groupTitle: 'Platform', label: 'Contact Us', href: '/contact', sortOrder: 4 },
    { groupTitle: 'Features', label: 'Latex Studio', href: '/latex-studio', sortOrder: 5 },
    { groupTitle: 'Features', label: 'Templates', href: '/templates', sortOrder: 6 },
    { groupTitle: 'Features', label: 'AI Review', href: '/reviewer', sortOrder: 7 },
    { groupTitle: 'Support', label: 'Help Center', href: '/help', sortOrder: 8 },
    { groupTitle: 'Support', label: 'Documentation', href: '/docs', sortOrder: 9 },
    { groupTitle: 'Legal', label: 'Terms of Service', href: '/terms', sortOrder: 10 },
    { groupTitle: 'Legal', label: 'Privacy Policy', href: '/privacy', sortOrder: 11 },
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
};

const COLLECTIONS: { key: keyof HomeData; collection: string; filter?: string; sort: string }[] = [
  { key: 'banners', collection: 'banners', filter: ACTIVE_FILTER, sort: 'sortOrder' },
  { key: 'testimonials', collection: 'testimonials', filter: ACTIVE_FILTER, sort: 'sortOrder' },
  { key: 'howItWorks', collection: 'how_it_works', filter: ACTIVE_FILTER, sort: 'sortOrder' },
  { key: 'galleryItems', collection: 'gallery_items', filter: ACTIVE_FILTER, sort: 'sortOrder' },
  { key: 'institutionLogos', collection: 'institution_logos', filter: ACTIVE_FILTER, sort: 'sortOrder' },
  { key: 'features', collection: 'features', filter: ACTIVE_FILTER, sort: 'sortOrder' },
  { key: 'benefits', collection: 'benefits', filter: ACTIVE_FILTER, sort: 'sortOrder' },
  { key: 'productDetails', collection: 'product_details', filter: ACTIVE_FILTER, sort: 'sortOrder' },
  { key: 'footerLinks', collection: 'footer_links', filter: ACTIVE_FILTER, sort: 'sortOrder' },
  { key: 'tasarStats', collection: 'tasar_stats', filter: ACTIVE_FILTER, sort: 'sortOrder' },
  { key: 'platformStats', collection: 'platform_stats', filter: undefined, sort: '' },
];

const INITIAL_DATA: HomeData = {
  banners: [], testimonials: [], howItWorks: [], galleryItems: [],
  institutionLogos: [], features: [], benefits: [], productDetails: [],
  footerLinks: [], tasarStats: [], platformStats: [],
};

function mergeWithFallback(fetched: HomeData): HomeData {
  const merged = { ...fetched };
  for (const key of Object.keys(FALLBACK_DATA) as (keyof HomeData)[]) {
    if (!merged[key] || merged[key].length === 0) {
      merged[key] = FALLBACK_DATA[key];
    }
  }
  return merged;
}

let cachedData: HomeData | null = null;

async function fetchAllCollections(timeout = 2000): Promise<HomeData> {
  const pb = createPb();
  const results = await Promise.allSettled(
    COLLECTIONS.map(({ key, collection, filter, sort }) =>
      new Promise<{ key: keyof HomeData; records: any[] }>((resolve) => {
        const timer = setTimeout(() => resolve({ key, records: [] }), timeout);
        (async () => {
          try {
            const opts: any = { sort: sort || undefined };
            if (filter) opts.filter = filter;
            const records = await pb.collection(collection).getFullList(opts);
            clearTimeout(timer);
            resolve({ key, records });
          } catch {
            clearTimeout(timer);
            resolve({ key, records: [] });
          }
        })();
      })
    )
  );
  const data = { ...INITIAL_DATA };
  for (const r of results) {
    if (r.status === 'fulfilled') {
      (data as any)[r.value.key] = r.value.records;
    }
  }
  return mergeWithFallback(rewriteUrls(data));
}

function rewriteUrls(obj: any): any {
  if (typeof obj === 'string') {
    return obj.replace(/http:\/\/(127\.0\.0\.1|localhost):8090/g, '/pb');
  }
  if (Array.isArray(obj)) {
    return obj.map(rewriteUrls);
  }
  if (obj !== null && typeof obj === 'object') {
    const newObj: any = {};
    for (const [key, value] of Object.entries(obj)) {
      newObj[key] = rewriteUrls(value);
    }
    return newObj;
  }
  return obj;
}

export function useHomeRealtime(skip = false) {
  const [data, setData] = useState<HomeData>(cachedData || INITIAL_DATA);

  const fetchAll = useCallback(async () => {
    const result = await fetchAllCollections(2000);
    cachedData = result;
    setData(result);
  }, []);

  useEffect(() => {
    if (skip) return;
    if (cachedData) return;
    fetchAll();
  }, [skip, fetchAll]);

  useEffect(() => {
    if (skip) return;
    const onOnline = () => { cachedData = null; fetchAll(); };
    window.addEventListener('online', onOnline);
    window.addEventListener('online-restored', onOnline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('online-restored', onOnline);
    };
  }, [skip, fetchAll]);

  return { data, loading: !cachedData && !skip, refresh: fetchAll };
}
