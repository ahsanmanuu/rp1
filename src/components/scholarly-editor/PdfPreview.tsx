"use client";
import { useState, useCallback, useEffect, useRef } from "react";

interface PdfPreviewProps {
  status: 'idle' | 'compiling' | 'success' | 'error';
  pdfUrl: string | null;
  projectId?: string | null;
  isStaticReview?: boolean;
}

export default function PdfPreview({ status, pdfUrl, projectId = null, isStaticReview = false }: PdfPreviewProps) {
  const [zoom, setZoom] = useState(100);
  const [internalPdfUrl, setInternalPdfUrl] = useState<string | null>(null);
  const previousBlobUrl = useRef<string | null>(null);

  const zoomIn = useCallback(() => setZoom(z => Math.min(z + 15, 200)), []);
  const zoomOut = useCallback(() => setZoom(z => Math.max(z - 15, 40)), []);
  const zoomReset = useCallback(() => setZoom(100), []);



  useEffect(() => {
    if (!pdfUrl) {
      setInternalPdfUrl(null);
      return;
    }

    // 1. PROJECT DIRECT FETCH (STABLE BINARY)
    // If we have a projectId and the URL seems to be a project-relative or network-based URL
    // We prefer the direct binary endpoint. Do NOT add Date.now() here — it creates a new
    // URL string on every render which causes the iframe to remount and triggers auto-downloads.
    if (projectId && (pdfUrl.startsWith('/') || pdfUrl.startsWith(window.location.origin) || !pdfUrl.includes('base64'))) {
      // Use the url as-is; cache-busting is handled by the compile caller via ?t= param
      setInternalPdfUrl(pdfUrl);
      return;
    }

    // 2. DATA/BASE64 HARDENING
    const dataUrlRX = /^data:application\/(pdf|octet-stream);base64,/;
    if (dataUrlRX.test(pdfUrl) || (pdfUrl.length > 100 && !pdfUrl.startsWith('http') && !pdfUrl.startsWith('blob:') && !pdfUrl.startsWith('/'))) {
      const loadBlob = async () => {
        try {
          const prefix = pdfUrl.startsWith('data:') ? '' : 'data:application/pdf;base64,';
          const fetchRes = await fetch(prefix + pdfUrl);
          const blob = await fetchRes.blob();
          const newUrl = URL.createObjectURL(blob);
          
          // Rolling Revocation: 3s delay for high-payload manuscripts
          if (previousBlobUrl.current) {
            const old = previousBlobUrl.current;
            setTimeout(() => URL.revokeObjectURL(old), 3000);
          }
          
          previousBlobUrl.current = newUrl;
          setInternalPdfUrl(newUrl);
        } catch (e) {
          console.error("[PDF-PREVIEW] Base64 conversion failed:", e);
        }
      };
      loadBlob();
    } else {
      setInternalPdfUrl(pdfUrl);
    }
  }, [pdfUrl, projectId]);

  // Global Revocation on unmount
  useEffect(() => {
    return () => {
      if (previousBlobUrl.current) URL.revokeObjectURL(previousBlobUrl.current);
    };
  }, []);

  if (status === 'compiling') {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-secondary)' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem', animation: 'spin 2s linear infinite' }}>⚙️</div>
        <h3 style={{ color: 'var(--text-secondary)' }}>Compiling your LaTeX PDF...</h3>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-secondary)', padding: '2rem', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
        <h3 style={{ color: 'var(--error)', marginBottom: '0.5rem' }}>Compilation Failed</h3>
        <p style={{ color: 'var(--text-secondary)' }}>Check the error console below to fix the LaTeX syntax.</p>
      </div>
    );
  }

  if (!internalPdfUrl) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-secondary)', padding: '2rem', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.5 }}>{isStaticReview ? '📜' : '📄'}</div>
        <h3 style={{ color: 'var(--text-secondary)' }}>
          {isStaticReview ? 'Source code view' : "Click 'Compile PDF' to preview"}
        </h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.5rem', opacity: 0.7 }}>
          Ctrl + Enter to compile
        </p>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', background: '#525659' }}>
      {/* Zoom Toolbar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.5rem',
        padding: '6px 12px',
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(8px)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        flexShrink: 0,
      }}>
        <button
          onClick={zoomOut}
          title="Zoom Out"
          style={{
            width: 30, height: 30,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 6,
            color: '#fff',
            cursor: 'pointer',
            fontSize: '1.1rem',
            fontWeight: 700,
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.2)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
        >
          −
        </button>

        <button
          onClick={zoomReset}
          title="Reset Zoom"
          style={{
            minWidth: 54, height: 30,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 6,
            color: '#ccc',
            cursor: 'pointer',
            fontSize: '0.8rem',
            fontFamily: 'monospace',
            fontWeight: 600,
            letterSpacing: '-0.5px',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.15)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
        >
          {zoom}%
        </button>

        <button
          onClick={zoomIn}
          title="Zoom In"
          style={{
            width: 30, height: 30,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 6,
            color: '#fff',
            cursor: 'pointer',
            fontSize: '1.1rem',
            fontWeight: 700,
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.2)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
        >
          +
        </button>

        <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.7rem', marginLeft: '0.5rem' }}>
          Ctrl+Enter to compile
        </span>
      </div>

      {/* PDF Content */}
      <div style={{
        flex: 1,
        overflow: 'hidden',
        display: 'flex',
        justifyContent: 'center',
      }}>
        <iframe 
          key={internalPdfUrl} // FORCE RE-MOUNT: Prevents iframe cache poisoning
          src={`${internalPdfUrl}#zoom=${zoom}&toolbar=0&navpanes=0&scrollbar=1`} 
          style={{ width: '100%', height: '100%', border: 'none' }}
          title="PDF Preview"
        />
      </div>
    </div>
  );
}
