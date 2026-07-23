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

import toast from 'react-hot-toast';

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

  const getStageElement = useCallback((): HTMLElement | null => {
    if (!canvasRef.current) return null;
    const stage = canvasRef.current.querySelector('[data-stage]') as HTMLElement;
    return stage || canvasRef.current;
  }, [canvasRef]);

  const doExportPNG = useCallback(async (opts: ExportOptions) => {
    const stage = getStageElement();
    if (!stage) {
      toast.error("Canvas element not found. Please try again.");
      return;
    }
    setExportDialog(null);
    setIsExporting(true);
    const toastId = toast.loading("Generating high-resolution PNG export...");

    flushSync(() => {
      setSelectedNode(null);
      setSelectedConnId(null);
      multiSelect.clearSelect();
    });

    try {
      const bounds = getNodeBounds();
      const w = bounds ? bounds.maxX - bounds.minX + opts.padding * 2 : 2400;
      const h = bounds ? bounds.maxY - bounds.minY + opts.padding * 2 : 1600;
      const tx = bounds ? -(bounds.minX - opts.padding) : 0;
      const ty = bounds ? -(bounds.minY - opts.padding) : 0;
      const bgColors: Record<string, string> = { white: '#f8faff', blueprint: '#0a1e3c', grid: '#051424' };
      const bg = opts.background === 'current' ? undefined : bgColors[opts.background];

      let dataUrl: string;
      try {
        dataUrl = await withInlinedStyles(async () => {
          return toPng(stage, {
            backgroundColor: bg,
            pixelRatio: opts.resolution,
            width: Math.round(w),
            height: Math.round(h),
            fetchRequestInit: { cache: 'force-cache' },
            style: { transform: `translate(${tx}px, ${ty}px) scale(${zoom / 100})` },
          });
        });
      } catch {
        // Fallback without inlined styles if CSS rules traversal is blocked by CORS
        dataUrl = await toPng(stage, {
          backgroundColor: bg || '#051424',
          pixelRatio: opts.resolution,
          width: Math.round(w),
          height: Math.round(h),
          style: { transform: `translate(${tx}px, ${ty}px) scale(${zoom / 100})` },
        });
      }

      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `diagram_${Date.now()}.png`;
      a.click();
      toast.success("PNG exported successfully!", { id: toastId });
    } catch (err: any) {
      console.error('Failed to export PNG', err);
      toast.error("Export failed: " + (err?.message || "Render timeout"), { id: toastId });
    } finally {
      setIsExporting(false);
    }
  }, [getStageElement, getNodeBounds, zoom, multiSelect, setSelectedNode, setSelectedConnId]);

  const doExportJPEG = useCallback(async (opts: ExportOptions) => {
    const stage = getStageElement();
    if (!stage) {
      toast.error("Canvas element not found. Please try again.");
      return;
    }
    setExportDialog(null);
    setIsExporting(true);
    const toastId = toast.loading("Generating JPEG export...");

    flushSync(() => {
      setSelectedNode(null);
      setSelectedConnId(null);
      multiSelect.clearSelect();
    });

    try {
      const bounds = getNodeBounds();
      const w = bounds ? bounds.maxX - bounds.minX + opts.padding * 2 : 2400;
      const h = bounds ? bounds.maxY - bounds.minY + opts.padding * 2 : 1600;
      const tx = bounds ? -(bounds.minX - opts.padding) : 0;
      const ty = bounds ? -(bounds.minY - opts.padding) : 0;
      const bgColors: Record<string, string> = { white: '#f8faff', blueprint: '#0a1e3c', grid: '#051424' };
      let bg = opts.background === 'current' ? undefined : bgColors[opts.background];
      if (opts.background === 'transparent') bg = '#ffffff';

      let dataUrl: string;
      try {
        dataUrl = await withInlinedStyles(async () => {
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
      } catch {
        dataUrl = await toJpeg(stage, {
          backgroundColor: bg || '#051424',
          pixelRatio: opts.resolution,
          width: Math.round(w),
          height: Math.round(h),
          quality: 0.95,
          style: { transform: `translate(${tx}px, ${ty}px) scale(${zoom / 100})` },
        });
      }

      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `diagram_${Date.now()}.jpg`;
      a.click();
      toast.success("JPEG exported successfully!", { id: toastId });
    } catch (err: any) {
      console.error('Failed to export JPEG', err);
      toast.error("Export failed: " + (err?.message || "Render timeout"), { id: toastId });
    } finally {
      setIsExporting(false);
    }
  }, [getStageElement, getNodeBounds, zoom, multiSelect, setSelectedNode, setSelectedConnId]);

  const doExportSVG = useCallback(async (opts: ExportOptions) => {
    const stage = getStageElement();
    if (!stage) {
      toast.error("Canvas element not found. Please try again.");
      return;
    }
    setExportDialog(null);
    setIsExporting(true);
    const toastId = toast.loading("Generating SVG vector export...");

    flushSync(() => {
      setSelectedNode(null);
      setSelectedConnId(null);
      multiSelect.clearSelect();
    });

    try {
      const bounds = getNodeBounds();
      const w = bounds ? bounds.maxX - bounds.minX + opts.padding * 2 : 2400;
      const h = bounds ? bounds.maxY - bounds.minY + opts.padding * 2 : 1600;
      const tx = bounds ? -(bounds.minX - opts.padding) : 0;
      const ty = bounds ? -(bounds.minY - opts.padding) : 0;

      let dataUrl: string;
      try {
        dataUrl = await withInlinedStyles(async () => {
          return toSvg(stage, {
            pixelRatio: 1,
            width: Math.round(w),
            height: Math.round(h),
            fetchRequestInit: { cache: 'force-cache' },
            style: { transform: `translate(${tx}px, ${ty}px) scale(${zoom / 100})` },
          });
        });
      } catch {
        dataUrl = await toSvg(stage, {
          pixelRatio: 1,
          width: Math.round(w),
          height: Math.round(h),
          style: { transform: `translate(${tx}px, ${ty}px) scale(${zoom / 100})` },
        });
      }

      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `diagram_${Date.now()}.svg`;
      a.click();
      toast.success("SVG vector exported successfully!", { id: toastId });
    } catch (err: any) {
      console.error('Failed to export SVG', err);
      toast.error("SVG export failed: " + (err?.message || "Render timeout"), { id: toastId });
    } finally {
      setIsExporting(false);
    }
  }, [getStageElement, getNodeBounds, zoom, multiSelect, setSelectedNode, setSelectedConnId]);

  const exportMermaid = useCallback(() => {
    try {
      const blob = new Blob([mermaidCode || "flowchart TD\n  A[Start] --> B[End]"], { type: 'text/plain' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `diagram_${Date.now()}.md`;
      a.click();
      toast.success("Mermaid code exported!");
    } catch {
      toast.error("Failed to export Mermaid file");
    }
  }, [mermaidCode]);

  const exportJSON = useCallback(() => {
    try {
      const data = JSON.stringify({ nodes, connections }, null, 2);
      const blob = new Blob([data], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `diagram_backup_${Date.now()}.json`;
      a.click();
      toast.success("Studio JSON backup exported!");
    } catch {
      toast.error("Failed to export JSON backup");
    }
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
