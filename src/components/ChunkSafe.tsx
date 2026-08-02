"use client";

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  failed: boolean;
}

/**
 * Local error boundary for lazily-loaded widgets (dynamic imports with
 * ssr:false). If a widget's chunk fails to load (ChunkLoadError, transient
 * dev-server rebuild timeouts, stale manifests), the widget is hidden instead
 * of crashing the entire page. The global chunk-retry handler in the root
 * layout still owns recovery; this boundary only keeps the page alive.
 */
export default class ChunkSafe extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    const msg =
      (error as any)?.message || (error as any)?.name || String(error) || "";
    if (
      /Loading chunk|ChunkLoadError|ImportModuleError|dynamic import failed|Failed to fetch dynamically imported module/i.test(
        msg
      )
    ) {
      console.warn("[ChunkSafe] Lazy widget chunk failed, hiding widget:", msg);
    } else {
      console.error("[ChunkSafe] Lazy widget error:", error);
    }
  }

  render() {
    if (this.state.failed) {
      return this.props.fallback ?? null;
    }
    return this.props.children;
  }
}
