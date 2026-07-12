'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createPb } from '@/lib/pb';

export type PbRealtimeEvent = 'create' | 'update' | 'delete';

export interface PbRealtimeOptions<T = any> {
  collection: string;
  userId?: string;
  filter?: string;
  sort?: string;
  expand?: string;
  batchSize?: number;
  enabled?: boolean;
  onEvent?: (event: PbRealtimeEvent, record: T, records: T[]) => void;
  mapRecord?: (r: any) => T;
  transform?: (records: T[]) => T[];
  pollIntervalMs?: number;
  subscribeRealtime?: boolean;
  subscribeFilter?: string;
}

function toParams(obj: Record<string, any>): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== null) params.set(k, String(v));
  }
  return params.toString();
}

export function usePbRealtime<T = any>(options: PbRealtimeOptions<T>) {
  const {
    collection,
    userId,
    filter,
    sort = '-created',
    expand,
    batchSize = 100,
    enabled = true,
    onEvent,
    mapRecord: customMapper,
    transform,
    pollIntervalMs = 30000,
    subscribeRealtime = false,
    subscribeFilter,
  } = options;

  const [records, setRecords] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const subRef = useRef<(() => void) | null>(null);
  const mountedRef = useRef(true);

  const mapperRef = useRef(customMapper);
  const transformRef = useRef(transform);
  const onEventRef = useRef(onEvent);

  useEffect(() => {
    mapperRef.current = customMapper;
    transformRef.current = transform;
    onEventRef.current = onEvent;
  });

  const fetchRecords = useCallback(async () => {
    try {
      const params = toParams({ sort, filter, expand, batchSize, page: 1 });
      const res = await fetch(`/api/data/${collection}?${params}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const errMsg = body?.error || '';
        if (errMsg.includes('aborted') || errMsg.includes('autocancelled') || errMsg.includes('autocancel') || errMsg === 'offline') {
          return [];
        }
        throw new Error(errMsg || `Failed to fetch ${collection} (${res.status})`);
      }
      const json = await res.json();
      let items = (json.items || []).map((r: any) => (mapperRef.current ? mapperRef.current(r) : r as any as T));
      if (transformRef.current) items = transformRef.current(items);
      
      setRecords(prev => {
        if (JSON.stringify(prev) === JSON.stringify(items)) return prev;
        return items;
      });
      setError(null);
      return items;
    } catch (err: any) {
      const msg = err?.message || '';
      if (msg.includes('aborted') || msg.includes('autocancelled') || msg.includes('autocancel') || msg === 'offline') {
        return [];
      }
      console.error(`[usePbRealtime] Fetch error for ${collection}:`, err);
      setError(msg || `Failed to fetch ${collection}`);
      return [];
    } finally {
      setLoading(false);
    }
  }, [collection, filter, sort, expand, batchSize]);

  useEffect(() => {
    if (!enabled) {
      setRecords([]);
      setLoading(false);
      return;
    }

    mountedRef.current = true;

    const init = async () => {
      await fetchRecords();

      // Poll for updates
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(async () => {
        if (!mountedRef.current) return;
        await fetchRecords();
      }, pollIntervalMs);

      // PB Realtime subscription (in addition to polling)
      if (subscribeRealtime && typeof window !== 'undefined') {
        try {
          const pb = createPb();
          const tokenCookie = document.cookie.split('; ').find(c => c.startsWith('pb_token='));
          if (tokenCookie) {
            const token = tokenCookie.split('=')[1];
            pb.authStore.save(token, null);
          }
          const subFilter = subscribeFilter || (userId ? `userId = "${userId}"` : undefined);
          const unsub = await pb.collection(collection).subscribe('*', (e: any) => {
            if (!mountedRef.current) return;
            fetchRecords();
            if (onEventRef.current) {
              const mapped = mapperRef.current ? mapperRef.current(e.record) : e.record as T;
              onEventRef.current(e.action as PbRealtimeEvent, mapped, []);
            }
          }, subFilter ? { filter: subFilter } : undefined);
          subRef.current = unsub;
        } catch (err) {
          // PB subscription silently fails (e.g., no permission, unauthenticated)
          // polling fallback still works
        }
      }
    };

    init();

    return () => {
      mountedRef.current = false;
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      if (subRef.current) {
        try { subRef.current(); } catch {}
        subRef.current = null;
      }
    };
  }, [collection, enabled, filter, subscribeFilter, userId, fetchRecords, pollIntervalMs, subscribeRealtime]);

  const refetch = useCallback(async () => {
    setLoading(true);
    await fetchRecords();
    setLoading(false);
  }, [fetchRecords]);

  return { records, loading, error, refetch };
}

export function usePbRealtimeReports(userId?: string) {
  return usePbRealtime({
    collection: 'report_history',
    userId,
    filter: userId ? `userId = "${userId}"` : undefined,
    sort: '-created',
    subscribeRealtime: !!userId,
    subscribeFilter: userId ? `userId = "${userId}"` : undefined,
    mapRecord: (r: any) => ({
      id: r.id,
      userId: r.userId,
      projectId: r.projectId,
      title: r.title,
      stats: typeof r.statsJson === 'string' ? JSON.parse(r.statsJson || '{}') : (r.statsJson || {}),
      words: typeof r.statsJson === 'string' ? JSON.parse(r.statsJson || '{}').words || 0 : (r.statsJson?.words || 0),
      authors: typeof r.authorsJson === 'string' ? JSON.parse(r.authorsJson || '[]') : (r.authorsJson || []),
      affiliations: typeof r.affiliationsJson === 'string' ? JSON.parse(r.affiliationsJson || '[]') : (r.affiliationsJson || []),
      keywords: typeof r.keywordsJson === 'string' ? JSON.parse(r.keywordsJson || '[]') : (r.keywordsJson || []),
      status: r.status || 'verified',
      pdfUrl: r.pdfUrl,
      latexUrl: r.latexUrl,
      zipUrl: r.zipUrl,
      date: r.created || r.createdAt,
      createdAt: r.created,
      updatedAt: r.updated,
      type: 'DOC2LATEX',
      isLocal: false,
    }),
  });
}

export function usePbRealtimeProjects(userId?: string, projectType?: string) {
  let filterStr: string | undefined;
  const filters: string[] = [];
  if (userId) filters.push(`userId = "${userId}"`);
  if (projectType) filters.push(`projectType = "${projectType}"`);
  if (filters.length > 0) filterStr = filters.join(' && ');

  return usePbRealtime({
    collection: 'projects',
    userId,
    filter: filterStr,
    sort: '-updated',
    subscribeRealtime: !!userId,
    subscribeFilter: filterStr,
    mapRecord: (r: any) => ({
      id: r.id,
      userId: r.userId,
      title: r.title,
      projectType: r.projectType || 'DOC2LATEX',
      status: r.status,
      wordCount: r.wordCount || 0,
      charCount: r.charCount || 0,
      imageCount: r.imageCount || 0,
      chartCount: r.chartCount || 0,
      tableCount: r.tableCount || 0,
      equationCount: r.equationCount || 0,
      citationCount: r.citationCount || 0,
      referenceCount: r.referenceCount || 0,
      pseudocodeCount: r.pseudocodeCount || 0,
      latexContent: r.latexContent || '',
      content: r.content || '',
      structuredContent: typeof r.structuredContent === 'string' ? r.structuredContent : JSON.stringify(r.structuredContent || {}),
      date: r.updated || r.updatedAt,
      createdAt: r.created,
      updatedAt: r.updated,
      type: r.projectType || 'DOC2LATEX',
      isLocal: false,
      stats: {
        words: r.wordCount || 0,
        images: r.imageCount || 0,
        tables: r.tableCount || 0,
        equations: r.equationCount || 0,
        citations: r.citationCount || 0,
        references: r.referenceCount || 0,
        pseudocode: r.pseudocodeCount || 0,
        charts: r.chartCount || 0,
        characters: r.charCount || 0,
      },
    }),
  });
}
