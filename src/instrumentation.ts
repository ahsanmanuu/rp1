export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      console.log('[Instrumentation] Server booting — initializing PocketBase auto-starter...');
      const { ensureAndStartPocketBase } = await import('@/lib/pb-starter');
      const started = await ensureAndStartPocketBase();
      if (started) {
        console.log('[Instrumentation] PocketBase is active on port 8090.');
      } else {
        console.warn('[Instrumentation] PocketBase auto-start returned false.');
      }
    } catch (err) {
      console.error('[Instrumentation] Failed to initialize PocketBase auto-starter:', err);
    }
  }
}
