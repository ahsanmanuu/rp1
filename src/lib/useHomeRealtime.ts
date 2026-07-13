'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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

function fetchWithTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(v => { clearTimeout(timer); resolve(v); }).catch(e => { clearTimeout(timer); reject(e); });
  });
}

export function useHomeRealtime() {
  const [data, setData] = useState<HomeData>({
    banners: [], testimonials: [], howItWorks: [], galleryItems: [],
    institutionLogos: [], features: [], benefits: [], productDetails: [],
    footerLinks: [], tasarStats: [], platformStats: [],
  });
  const [loading, setLoading] = useState(true);
  const unsubsRef = useRef<(() => void)[]>([]);

  const fetchAll = useCallback(async () => {
    try {
      const pb = createPb();
      const results = await Promise.allSettled(
        COLLECTIONS.map(({ key, collection, filter, sort }) =>
          fetchWithTimeout((async () => {
            try {
              const opts: any = { sort: sort || undefined };
              if (filter) opts.filter = filter;
              const records = await pb.collection(collection).getFullList(opts);
              return { key, records } as const;
            } catch { return { key, records: [] as any[] } as const; }
          })(), 4000)
        )
      );
      setData(prev => {
        const next = { ...prev };
        for (const result of results) {
          if (result.status === 'fulfilled') {
            next[result.value.key] = result.value.records;
          }
        }
        return next;
      });
    } catch (e) {
      console.warn('useHomeRealtime fetch failed:', e);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const pb = createPb();
    const subs = COLLECTIONS.map(({ key, collection, filter }) =>
      pb.collection(collection).subscribe('*', (e) => {
        setData(prev => {
          const arr = [...(prev[key] as any[])];
          if (e.action === 'create') arr.push(e.record);
          else if (e.action === 'update') {
            const idx = arr.findIndex((x: any) => x.id === e.record.id);
            if (idx >= 0) arr[idx] = e.record;
          } else if (e.action === 'delete') {
            return { ...prev, [key]: arr.filter((x: any) => x.id !== e.record.id) };
          }
          return { ...prev, [key]: arr };
        });
      }, filter ? { filter } : undefined)
    );
    Promise.all(subs).then(u => { unsubsRef.current = u; });
    fetchAll();
    const interval = setInterval(fetchAll, 120000);
    return () => {
      clearInterval(interval);
      for (const fn of unsubsRef.current) try { fn(); } catch {}
    };
  }, [fetchAll]);

  return { data, loading, refresh: fetchAll };
}
