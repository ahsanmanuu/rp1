import { pbAdmin } from "@/lib/pb";

let _ensureDone = false;
let _appliedMaxSize = 5 * 1024 * 1024;

export const PB_CONTENT_MAX_SIZE = 20 * 1024 * 1024;

const FIELD_TARGETS: Record<string, string[]> = {
  projects: ['latexContent', 'structuredContent', 'bibContent', 'content'],
  project_files: ['content'],
};

/**
 * Idempotent runtime migration: PocketBase editor/json fields default to a
 * 5MB content limit (maxSize unset/0). Large DOCX uploads routinely exceed
 * this when rawHtml/rawXml are embedded in structuredContent. This raises
 * maxSize on the content-bearing fields to 20MB.
 *
 * Returns the effective field limit in bytes (20MB on success, 5MB if PB
 * admin access failed). Safe to call from any route; cached after first run.
 */
export async function ensureContentSizeLimits(): Promise<number> {
  if (_ensureDone) return _appliedMaxSize;
  try {
    const admPb = await pbAdmin();

    for (const [collectionName, fieldNames] of Object.entries(FIELD_TARGETS)) {
      const col = await admPb.collections.getOne(collectionName).catch(() => null);
      if (!col) continue;
      const fields = (col as any).fields || (col as any).schema || [];
      let changed = false;
      const nextFields = (fields as any[]).map((f: any) => {
        if (fieldNames.includes(f.name) && Number(f.maxSize || 0) < PB_CONTENT_MAX_SIZE) {
          changed = true;
          return { ...f, maxSize: PB_CONTENT_MAX_SIZE };
        }
        return f;
      });
      if (changed) {
        await admPb.collections.update(col.id, { fields: nextFields });
        console.log(`[PB_LIMITS] Raised ${collectionName} [${fieldNames.join(', ')}] maxSize to ${PB_CONTENT_MAX_SIZE}`);
      }
    }

    _appliedMaxSize = PB_CONTENT_MAX_SIZE;
    _ensureDone = true;
    return _appliedMaxSize;
  } catch (err: any) {
    console.warn("[PB_LIMITS] Ensure failed (non-fatal), keeping 5MB default:", err?.message);
    _ensureDone = true;
    return 5 * 1024 * 1024;
  }
}
