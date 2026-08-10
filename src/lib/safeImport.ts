/**
 * Retries dynamic component imports on ChunkLoadError or transient network timeouts.
 */
export function safeDynamicImport<T>(importFn: () => Promise<T>, retries = 3, delayMs = 500): Promise<T> {
  return new Promise((resolve, reject) => {
    const attempt = (remaining: number) => {
      importFn()
        .then(resolve)
        .catch((err) => {
          const msg = String(err?.message || err || "");
          const isChunkErr = /chunk|loading|failed|timeout|ImportModuleError|Failed to fetch dynamically imported module/i.test(msg);
          if (remaining > 0 && isChunkErr) {
            setTimeout(() => attempt(remaining - 1), delayMs);
          } else {
            reject(err);
          }
        });
    };
    attempt(retries);
  });
}
