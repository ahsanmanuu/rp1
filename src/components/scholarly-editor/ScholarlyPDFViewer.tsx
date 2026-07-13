"use client";
import React, { useEffect, useRef, useState, useCallback, memo } from 'react';
// @ts-ignore
import * as pdfjs from 'pdfjs-dist/build/pdf.min.mjs';
import { Printer, Download, ExternalLink, ChevronsUp, ChevronsDown } from 'lucide-react';
import { SyncTexParser } from '@/lib/studio-core/synctex-parser';

// Initialize worker safely with defensive checks
if (typeof window !== 'undefined' && pdfjs) {
  try {
    if (pdfjs.GlobalWorkerOptions) {
      pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
    }
  } catch (e) {
    console.warn('[PDFJS_WORKER_INIT_FAILED]', e);
  }
}

interface PDFSyncViewerProps {
  pdfUrl: string | null;
  syncTexStr?: string | null;
  compiling: boolean;
  onJumpToLatexCode?: (percentage: number) => void;
  onExactSync?: (line: number, file?: string) => void;
  jumpTo?: { percentage: number; timestamp: number } | null;
  jumpToLine?: { line: number; timestamp: number } | null;
  onSync?: () => void;
  onDownload?: () => void;
}

// Virtualized memory-safe page component
const PDFPage = memo(({ pageNum, pdf, scale, handleSyncClick }: { pageNum: number, pdf: pdfjs.PDFDocumentProxy, scale: number, handleSyncClick: (e: React.MouseEvent, pageNum: number, rect: DOMRect) => void }) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 600, height: 840 });
  
  // Get page dimensions on load
  useEffect(() => {
    let isMounted = true;
    pdf.getPage(pageNum).then((page: any) => {
      if (!isMounted) return;
      const viewport = page.getViewport({ scale: 1 });
      setDimensions({ width: viewport.width * scale, height: viewport.height * scale });
    }).catch(console.error);
    return () => { isMounted = false; };
  }, [pdf, pageNum, scale]);

  // Intersection Observer to track visibility
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      setIsVisible(entry.isIntersecting);
    }, { 
      root: wrapperRef.current?.parentElement, 
      rootMargin: '600px 0px' // Pre-render well before coming into view
    });
    
    const currentWrapper = wrapperRef.current;
    if (currentWrapper) observer.observe(currentWrapper);
    
    return () => {
      if (currentWrapper) observer.unobserve(currentWrapper);
    };
  }, []);

  // Render page content
  useEffect(() => {
    let isMounted = true;
    let renderTask: any = null;

    const render = async () => {
      if (!isVisible || !pdf || !canvasRef.current) return;
      
      try {
        const page = await pdf.getPage(pageNum);
        // Re-check after first await — component may have unmounted
        if (!isMounted || !canvasRef.current) return;

        const rawDpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
        const dpr = Math.min(rawDpr, 2.0); // CAP DPR at 2.0 for performance on 4K/Retina
        const viewport = page.getViewport({ scale: scale * dpr });
        const canvas = canvasRef.current; // capture ref before any await
        const canvasContext = canvas.getContext('2d');
        
        if (!canvasContext || !isMounted) return;
        
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        canvas.style.width = `${viewport.width / dpr}px`;
        canvas.style.height = `${viewport.height / dpr}px`;

        // Clear old text layers
        const existing = wrapperRef.current?.querySelector('.textLayer');
        if (existing) wrapperRef.current?.removeChild(existing);

        renderTask = page.render({ canvasContext, viewport });
        await renderTask.promise;
        
        // Re-check after render await — component may have unmounted while rendering
        if (!isMounted || !wrapperRef.current || !canvasRef.current) return;

        // Render Text Layer for selection/bidirectional sync
        const textContent = await page.getTextContent();

        // Re-check again after the second await boundary
        if (!isMounted || !wrapperRef.current || !canvasRef.current) return;

        const textLayerDiv = document.createElement('div');
        textLayerDiv.className = 'textLayer';
        textLayerDiv.style.width = `${viewport.width / dpr}px`;
        textLayerDiv.style.height = `${viewport.height / dpr}px`;
        textLayerDiv.onclick = (e) => {
          if (wrapperRef.current) {
             handleSyncClick(e as any, pageNum, wrapperRef.current.getBoundingClientRect());
          }
        };
        wrapperRef.current.appendChild(textLayerDiv);
        
        const visualViewport = page.getViewport({ scale });
        const tLayer = new pdfjs.TextLayer({
          textContentSource: textContent,
          container: textLayerDiv,
          viewport: visualViewport,
        });
        await tLayer.render();
      } catch (e: any) {
        if (e.name !== 'RenderingCancelledException') {
          console.error(`[PDF_RENDER_ERROR] Page ${pageNum}:`, e);
        }
      }
    };

    if (isVisible) {
      render();
    } else {
      // Memory Cleanup: Destroy canvas contents when offscreen
      if (canvasRef.current) {
        canvasRef.current.width = 0;
        canvasRef.current.height = 0;
      }
      const existing = wrapperRef.current?.querySelector('.textLayer');
      if (existing) wrapperRef.current?.removeChild(existing);
    }

    return () => {
      isMounted = false;
      if (renderTask) {
        try { renderTask.cancel(); } catch (_) {}
      }
      // Clean up text layer on unmount / pdfUrl change to prevent ghost text
      if (wrapperRef.current) {
        const textLayer = wrapperRef.current.querySelector('.textLayer');
        if (textLayer) wrapperRef.current.removeChild(textLayer);
      }
    };
  }, [isVisible, pdf, scale, pageNum, handleSyncClick]);

  return (
    <div 
      ref={wrapperRef} 
      className="pdf-page-wrapper"
      style={{ 
        boxShadow: '0 10px 30px rgba(0,0,0,0.5)', 
        background: '#fff', 
        lineHeight: 0,
        position: 'relative',
        width: dimensions.width,
        height: dimensions.height
      }}
    >
      <canvas ref={canvasRef} style={{ display: 'block', backgroundColor: '#fff' }} />
      <div style={{ position: 'absolute', right: '-40px', top: '0', color: '#888', fontSize: '0.7rem' }}>
        P{pageNum}
      </div>
    </div>
  );
});
PDFPage.displayName = 'PDFPage';

const ScholarlyPDFViewer = memo(({ pdfUrl, syncTexStr, compiling, onJumpToLatexCode, onExactSync, jumpTo, jumpToLine, onDownload }: PDFSyncViewerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [pdf, setPdf] = useState<pdfjs.PDFDocumentProxy | null>(null);
  const [scale, setScale] = useState(1.0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [synctex, setSynctex] = useState<SyncTexParser | null>(null);

  useEffect(() => {
    if (syncTexStr) {
      setSynctex(new SyncTexParser(syncTexStr));
    } else {
      setSynctex(null);
    }
  }, [syncTexStr]);

  // Load PDF Document safely
  useEffect(() => {
    if (!pdfUrl) { setLoadError(null); setPdf(null); setNumPages(0); return; }
    setLoadError(null);
    setPdf(null);
    setNumPages(0);

    let cancelled = false;

    const load = async () => {
      try {
        let loadingTask;

        if (pdfUrl.startsWith('data:application/pdf;base64,') || pdfUrl.startsWith('data:application/pdf;')) {
          // ── Base64 data-URI — already in memory, no HTTP race possible ─────
          const b64 = pdfUrl.split(',')[1];
          if (!b64 || b64.length === 0) throw new Error('PDF data is empty.');
          const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
          if (bytes.length === 0) throw new Error('PDF data decoded to zero bytes.');
          loadingTask = pdfjs.getDocument({ data: bytes });

        } else if (pdfUrl.startsWith('blob:')) {
          loadingTask = pdfjs.getDocument(pdfUrl);

        } else {
          // ── HTTP URL — retry with back-off if file is still flushing ──────
          const cacheBuster = `cb=${Date.now()}`;
          const separator = pdfUrl.includes('?') ? '&' : '?';
          const fetchUrl = `${pdfUrl}${separator}${cacheBuster}`;

          let arrayBuffer: ArrayBuffer | null = null;
          const delays = [300, 700, 1200, 2000, 3000];
          for (let attempt = 0; attempt < delays.length; attempt++) {
            if (cancelled) return;
            try {
              const res = await fetch(fetchUrl, { cache: 'no-store' });
              if (!res.ok) {
                // 404 = not compiled yet (normal). Any other error = API issue.
                // In both cases silently show "no PDF" placeholder — don't throw.
                console.warn(`[PDF_VIEWER] Attempt ${attempt + 1}: HTTP ${res.status} — no PDF available yet.`);
                setLoadError(null);
                return;
              }
              const buf = await res.arrayBuffer();
              if (buf.byteLength > 0) { arrayBuffer = buf; break; }
              console.warn(`[PDF_VIEWER] Attempt ${attempt + 1}: 0-byte PDF, retrying in ${delays[attempt]}ms…`);
            } catch (e: any) {
              console.warn(`[PDF_VIEWER] Attempt ${attempt + 1} Error: ${e.message}, retrying…`);
            }
            await new Promise(r => setTimeout(r, delays[attempt]));
          }
          if (cancelled) return;
          if (!arrayBuffer || arrayBuffer.byteLength === 0) {
            // After all retries, no valid PDF was found — show empty state silently
            console.warn('[PDF_VIEWER] No valid PDF received after retries. Showing empty state.');
            setLoadError(null);
            return;
          }
          loadingTask = pdfjs.getDocument({ data: new Uint8Array(arrayBuffer) });
        }

        const pdfDoc = await loadingTask.promise;
        if (cancelled) return;
        setPdf(pdfDoc);
        setNumPages(pdfDoc.numPages);
      } catch (err: any) {
        if (cancelled) return;
        console.error('[PDF_VIEWER] Load error:', err);
        setLoadError(err.message || 'Failed to load PDF structure.');
      }
    };

    load();
    return () => { cancelled = true; };
  }, [pdfUrl]);



  // Sync: UI -> Code (Unified Handler)
  const handleSyncClick = useCallback((e: React.MouseEvent, pageNum?: number, rect?: DOMRect) => {
    if (synctex && onExactSync && pageNum !== undefined && rect !== undefined) {
      // Calculate exact X,Y in PDF points
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      
      const pdfX = clickX / scale;
      const pdfY = clickY / scale;

      const mapped = synctex.getLineForPosition(pageNum, pdfX, pdfY);
      if (mapped) {
        onExactSync(mapped.line, mapped.file);
        return;
      }
    }

    if (!containerRef.current || !onJumpToLatexCode) return;
    const container = containerRef.current;
    const scrollRect = container.getBoundingClientRect();
    const globalY = e.clientY - scrollRect.top + container.scrollTop;
    const totalHeight = container.scrollHeight;
    
    const percentage = globalY / Math.max(1, totalHeight);
    onJumpToLatexCode(percentage);
  }, [onJumpToLatexCode, onExactSync, synctex, scale]);

  // Handle Scroll -> update page number
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const wrappers = container.querySelectorAll('.pdf-page-wrapper');
      if (wrappers.length === 0) return;
      
      let bestPage = 1;
      let minDiff = Infinity;
      const containerRect = container.getBoundingClientRect();
      const containerCenter = containerRect.top + containerRect.height / 2;

      wrappers.forEach((w, index) => {
        const rect = w.getBoundingClientRect();
        const center = rect.top + rect.height / 2;
        const diff = Math.abs(center - containerCenter);
        if (diff < minDiff) {
          minDiff = diff;
          bestPage = index + 1;
        }
      });

      setCurrentPage(bestPage);
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [numPages]);

  // Sync: Code -> PDF scroll
  useEffect(() => {
    if (jumpToLine && synctex && containerRef.current) {
      const pos = synctex.getPositionForLine(jumpToLine.line);
      if (pos) {
        const container = containerRef.current;
        const wrappers = container.querySelectorAll('.pdf-page-wrapper');
        const pageWrapper = Array.from(wrappers)[pos.page - 1] as HTMLElement;
        
        if (pageWrapper) {
           const rect = pageWrapper.getBoundingClientRect();
           const scrollY = container.scrollTop + rect.top - container.getBoundingClientRect().top;
           // Add Y offset inside the page
           const finalY = scrollY + (pos.y * scale) - 50; // 50px visual padding
           container.scrollTo({ top: Math.max(0, finalY), behavior: 'smooth' });
           return;
        }
      }
    }

    // Fallback Code -> PDF
    if (!jumpTo || !containerRef.current) return;
    const container = containerRef.current;
    const totalHeight = container.scrollHeight;
    container.scrollTo({
      top: totalHeight * jumpTo.percentage,
      behavior: 'smooth'
    });
  }, [jumpTo, jumpToLine, synctex, scale]);

  const BTN: React.CSSProperties = {
    background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: '6px',
    padding: '4px 10px', cursor: 'pointer', color: 'var(--text-primary)', fontSize: '0.75rem',
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#3a3a3a', position: 'relative' }}>
      <div style={{
        height: '44px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
           <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 600 }}>SYNC READY</span>
           <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#4cd137', boxShadow: '0 0 8px #4cd137' }} />
           {numPages > 0 && (
             <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 700, background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '12px', marginLeft: '4px' }}>
               {currentPage}/{numPages}
             </span>
           )}
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button style={BTN} onClick={() => setScale(s => Math.max(0.5, s - 0.2))}>-</button>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', minWidth: '40px', textAlign: 'center' }}>{Math.round(scale * 100)}%</span>
          <button style={BTN} onClick={() => setScale(s => Math.min(3, s + 0.2))}>+</button>
          
          <div style={{ width: 1, height: 16, background: 'var(--border)', margin: '0 4px' }} />

          <button 
            style={{ ...BTN, display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.05)' }} 
            onClick={() => containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })} 
            title="Go to First Page"
          >
            <ChevronsUp size={14} />
          </button>

          <button 
            style={{ ...BTN, display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.05)' }} 
            onClick={() => containerRef.current?.scrollTo({ top: containerRef.current.scrollHeight, behavior: 'smooth' })} 
            title="Go to Last Page"
          >
            <ChevronsDown size={14} />
          </button>

          {pdfUrl && (
            <button 
              style={{ ...BTN, display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.05)', color: 'var(--accent-primary)' }} 
              onClick={() => {
                // Use anchor with target=_blank for reliable cross-browser PDF opening
                // window.open with blob: URLs is blocked by popup blockers in most browsers
                const a = document.createElement('a');
                a.href = pdfUrl;
                a.target = '_blank';
                a.rel = 'noopener noreferrer';
                // Do NOT set a.download — we want to open, not download
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
              }} 
              title="Open PDF in Browser"
            >
              <ExternalLink size={14} />
              <span style={{ fontSize: '0.65rem', fontWeight: 800 }}>OPEN IN BROWSER</span>
            </button>
          )}


          {onDownload && (
            <button style={BTN} onClick={onDownload} title="Download PDF">
              <Download size={14} />
            </button>
          )}

          <button 
            style={{ ...BTN, display: 'flex', alignItems: 'center', gap: '4px' }} 
            onClick={() => {
              if (!pdfUrl) return;
              const iframe = document.createElement('iframe');
              iframe.style.display = 'none';
              iframe.src = pdfUrl;
              document.body.appendChild(iframe);
              iframe.onload = () => {
                iframe.contentWindow?.focus();
                iframe.contentWindow?.print();
              };
            }}
            title="Print PDF"
          >
            <Printer size={14} />
          </button>
        </div>
      </div>

      <div 
        ref={containerRef}
        onClick={handleSyncClick}
        style={{ 
          flex: 1, 
          overflowY: 'auto', 
          position: 'relative', 
          padding: '20px 0', 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          gap: '20px',
          scrollBehavior: 'smooth',
          background: '#2d2d2d'
        }}
      >
        {loadError ? (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ff4757', flexDirection: 'column', gap: '15px', padding: '40px', textAlign: 'center' }}>
            <span style={{ fontSize: '3rem' }}>⚠️</span>
            <span style={{ fontSize: '1rem', fontWeight: 600 }}>PDF Load Error</span>
            <p style={{ maxWidth: '420px', fontSize: '0.85rem', color: '#ccc', lineHeight: 1.5 }}>{loadError}</p>
            <p style={{ maxWidth: '420px', fontSize: '0.75rem', color: '#888' }}>Check the Console log for compilation errors, then recompile.</p>
          </div>
        ) : numPages > 0 && pdf ? (
          Array.from({ length: numPages }).map((_, i) => (
            <PDFPage 
              key={i}
              pageNum={i + 1}
              pdf={pdf}
              scale={scale}
              handleSyncClick={handleSyncClick}
            />
          ))
        ) : (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontSize: '2rem' }}>📄</span>
            <span>No compiled PDF available</span>
          </div>
        )}

        {compiling && (
          <div style={{ 
            position: 'absolute', inset: 0, 
            background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(3px)', 
            display: 'flex', alignItems: 'center', justifyContent: 'center', 
            color: '#fff', fontSize: '1.2rem', fontWeight: 600, zIndex: 100
          }}>
             <div style={{ width: '24px', height: '24px', border: '3px solid var(--accent-primary)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', marginRight: '8px' }} />
            Compiling...
          </div>
        )}
      </div>

    </div>
  );
});
ScholarlyPDFViewer.displayName = 'ScholarlyPDFViewer';

export default ScholarlyPDFViewer;
