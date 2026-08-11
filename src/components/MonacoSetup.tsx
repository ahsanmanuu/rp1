"use client";

import { useEffect } from "react";

/**
 * Configures @monaco-editor/react to use the local monaco-editor npm package
 * instead of loading from CDN (cdn.jsdelivr.net). This eliminates CDN
 * dependency failures ("Monaco initialization: error: {}") caused by network
 * restrictions, ad-blockers, or CDN outages.
 *
 * Must be mounted once before any Monaco Editor component.
 *
 * NOTE: Monaco's web worker (editorWorkerService) fails to resolve in
 * Next.js due to `new URL('...?esm', import.meta.url)` not being handled
 * by webpack. This is non-critical — the editor falls back to main-thread
 * services. The error is suppressed in layout.tsx's error handler.
 */
export default function MonacoSetup() {
  useEffect(() => {
    let cancelled = false;

    import("monaco-editor")
      .then((monaco) => {
        if (cancelled) return;
        import("@monaco-editor/react").then(({ loader }) => {
          if (!cancelled) {
            loader.config({ monaco });
          }
        });
      })
      .catch((err) => {
        console.warn(
          "[MonacoSetup] Failed to load local monaco-editor, falling back to CDN:",
          err
        );
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}