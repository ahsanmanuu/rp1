export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      const { ensureAndStartPocketBase } = await import('@/lib/pb-starter');
      await ensureAndStartPocketBase();
    } catch (err) {
      console.error('[Instrumentation] Failed to initialize PocketBase auto-starter:', err);
    }
  }
}
