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
  return data;
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
