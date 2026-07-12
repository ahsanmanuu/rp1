'use client';

import { useState, useCallback } from 'react';
import { flushSync } from 'react-dom';
import { toPng, toSvg, toJpeg } from 'html-to-image';

export type ExportFormat = 'png' | 'svg' | 'jpeg';

export interface ExportOptions {
  background: 'transparent' | 'white' | 'blueprint' | 'grid' | 'current';
  resolution: 1 | 2 | 3;
  padding: number;
}

export interface ExportDialogState {
  isOpen: boolean;
  format: ExportFormat;
  options: ExportOptions;
}

interface UseExportParams {
  canvasRef: React.RefObject<HTMLDivElement | null>;
  nodes: any[];
  connections: any[];
  zoom: number;
  mermaidCode: string;
  multiSelect: { clearSelect: () => void };
  setSelectedNode: (id: string | null) => void;
  setSelectedConnId: (id: string | null) => void;
}

async function withInlinedStyles<T>(fn: () => Promise<T>): Promise<T> {
  const originalDescriptor = Object.getOwnPropertyDescriptor(CSSStyleSheet.prototype, 'cssRules');
  let overridden = false;
  if (originalDescriptor && originalDescriptor.get) {
    const originalGet = originalDescriptor.get;
    Object.defineProperty(CSSStyleSheet.prototype, 'cssRules', {
      get() {
        try { return originalGet.call(this); } catch { return []; }
      },
      configurable: true,
    });
    overridden = true;
  }

  const links = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'));
  const patches: Array<{ link: HTMLLinkElement; style: HTMLStyleElement }> = [];
  const bases = Array.from(document.querySelectorAll<HTMLBaseElement>('base'));
  const origBaseHrefs = bases.map(b => b.getAttribute('href'));
  bases.forEach(b => b.removeAttribute('href'));
  await Promise.allSettled(
    links.map(async (link) => {
      const href = link.href;
      if (!href || href.startsWith(window.location.origin + '/')) return;
      try {
        const resp = await fetch(href);
        const css = await resp.text();
        const style = document.createElement('style');
        style.textContent = css;
        link.parentNode?.replaceChild(style, link);
        patches.push({ link, style });
      } catch { }
    })
  );
  await document.fonts.ready;
  try {
    return await fn();
  } finally {
    if (overridden && originalDescriptor) {
      Object.defineProperty(CSSStyleSheet.prototype, 'cssRules', originalDescriptor);
    }
    for (const { link, style } of patches) {
      style.parentNode?.replaceChild(link, style);
    }
    bases.forEach((b, i) => {
      const orig = origBaseHrefs[i];
      if (orig) b.setAttribute('href', orig);
      else b.removeAttribute('href');
    });
  }
}

export function useExport({
  canvasRef, nodes, connections, zoom, mermaidCode,
  multiSelect, setSelectedNode, setSelectedConnId,
}: UseExportParams) {
  const [exportDialog, setExportDialog] = useState<ExportDialogState | null>(null);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const defaultExportOptions: ExportOptions = { background: 'current', resolution: 2, padding: 60 };

  const getNodeBounds = useCallback(() => {
    if (nodes.length === 0) return null;
    return nodes.reduce((acc: any, n: any) => ({
      minX: Math.min(acc.minX, n.x),
      minY: Math.min(acc.minY, n.y),
      maxX: Math.max(acc.maxX, n.x + n.width),
      maxY: Math.max(acc.maxY, n.y + n.height),
    }), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });
  }, [nodes]);

  const doExportPNG = useCallback(async (opts: ExportOptions) => {
    const stage = canvasRef.current?.querySelector('[data-stage]') as HTMLElement;
    if (!stage) return;
    setExportDialog(null);
    setIsExporting(true);
    flushSync(() => {
      setSelectedNode(null);
      setSelectedConnId(null);
      multiSelect.clearSelect();
    });
    try {
      const dataUrl = await withInlinedStyles(async () => {
        const bounds = getNodeBounds();
        const w = bounds ? bounds.maxX - bounds.minX + opts.padding * 2 : 2400;
        const h = bounds ? bounds.maxY - bounds.minY + opts.padding * 2 : 1600;
        const tx = bounds ? -(bounds.minX - opts.padding) : 0;
        const ty = bounds ? -(bounds.minY - opts.padding) : 0;
        const bgColors: Record<string, string> = { white: '#f8faff', blueprint: '#0a1e3c', grid: '#051424' };
        const bg = opts.background === 'current' ? undefined : bgColors[opts.background];
        return toPng(stage, {
          backgroundColor: bg,
          pixelRatio: opts.resolution,
          width: Math.round(w),
          height: Math.round(h),
          fetchRequestInit: { cache: 'force-cache' },
          style: { transform: `translate(${tx}px, ${ty}px) scale(${zoom / 100})` },
        });
      });
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = 'diagram.png';
      a.click();
    } catch (err) {
      console.error('Failed to export PNG', err);
    } finally {
      setIsExporting(false);
    }
  }, [canvasRef, getNodeBounds, zoom, multiSelect, setSelectedNode, setSelectedConnId]);

  const doExportJPEG = useCallback(async (opts: ExportOptions) => {
    const stage = canvasRef.current?.querySelector('[data-stage]') as HTMLElement;
    if (!stage) return;
    setExportDialog(null);
    setIsExporting(true);
    flushSync(() => {
      setSelectedNode(null);
      setSelectedConnId(null);
      multiSelect.clearSelect();
    });
    try {
      const dataUrl = await withInlinedStyles(async () => {
        const bounds = getNodeBounds();
        const w = bounds ? bounds.maxX - bounds.minX + opts.padding * 2 : 2400;
        const h = bounds ? bounds.maxY - bounds.minY + opts.padding * 2 : 1600;
        const tx = bounds ? -(bounds.minX - opts.padding) : 0;
        const ty = bounds ? -(bounds.minY - opts.padding) : 0;
        const bgColors: Record<string, string> = { white: '#f8faff', blueprint: '#0a1e3c', grid: '#051424' };
        let bg = opts.background === 'current' ? undefined : bgColors[opts.background];
        if (opts.background === 'transparent') bg = '#ffffff';
        return toJpeg(stage, {
          backgroundColor: bg || '#051424',
          pixelRatio: opts.resolution,
          width: Math.round(w),
          height: Math.round(h),
          quality: 0.95,
          fetchRequestInit: { cache: 'force-cache' },
          style: { transform: `translate(${tx}px, ${ty}px) scale(${zoom / 100})` },
        });
      });
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = 'diagram.jpg';
      a.click();
    } catch (err) {
      console.error('Failed to export JPEG', err);
    } finally {
      setIsExporting(false);
    }
  }, [canvasRef, getNodeBounds, zoom, multiSelect, setSelectedNode, setSelectedConnId]);

  const doExportSVG = useCallback(async (opts: ExportOptions) => {
    const stage = canvasRef.current?.querySelector('[data-stage]') as HTMLElement;
    if (!stage) return;
    setExportDialog(null);
    setIsExporting(true);
    flushSync(() => {
      setSelectedNode(null);
      setSelectedConnId(null);
      multiSelect.clearSelect();
    });
    try {
      const dataUrl = await withInlinedStyles(async () => {
        const bounds = getNodeBounds();
        const w = bounds ? bounds.maxX - bounds.minX + opts.padding * 2 : 2400;
        const h = bounds ? bounds.maxY - bounds.minY + opts.padding * 2 : 1600;
        const tx = bounds ? -(bounds.minX - opts.padding) : 0;
        const ty = bounds ? -(bounds.minY - opts.padding) : 0;
        return toSvg(stage, {
          pixelRatio: 1,
          width: Math.round(w),
          height: Math.round(h),
          fetchRequestInit: { cache: 'force-cache' },
          style: { transform: `translate(${tx}px, ${ty}px) scale(${zoom / 100})` },
        });
      });
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = 'diagram.svg';
      a.click();
    } catch (err) {
      console.error('Failed to export SVG', err);
    } finally {
      setIsExporting(false);
    }
  }, [canvasRef, getNodeBounds, zoom, multiSelect, setSelectedNode, setSelectedConnId]);

  const exportMermaid = useCallback(() => {
    const blob = new Blob([mermaidCode], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'diagram.md';
    a.click();
  }, [mermaidCode]);

  const exportJSON = useCallback(() => {
    const data = JSON.stringify({ nodes, connections }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'diagram.json';
    a.click();
  }, [nodes, connections]);

  return {
    exportDialog,
    setExportDialog,
    exportMenuOpen,
    setExportMenuOpen,
    isExporting,
    defaultExportOptions,
    doExportPNG,
    doExportJPEG,
    doExportSVG,
    exportMermaid,
    exportJSON,
  };
}
