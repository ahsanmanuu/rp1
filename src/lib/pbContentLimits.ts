import { pbAdmin } from "@/lib/pb";

let _ensureDone = false;
let _appliedMaxSize = 5 * 1024 * 1024;

export const PB_CONTENT_MAX_SIZE = 20 * 1024 * 1024;

/** Editor/json fields that need a raised maxSize (in bytes). */
const FIELD_TARGETS: Record<string, string[]> = {
  projects: ['latexContent', 'structuredContent', 'bibContent', 'content'],
  project_files: ['content'],
};

/** Text fields that need a raised max (in characters). PB defaults text max to
 *  5000 chars, far too low for base64-encoded file payloads or large source code. */
const TEXT_FIELD_TARGETS: Record<string, { field: string; max: number }[]> = {
  upload_jobs: [{ field: 'rawBytes', max: 100_000_000 }], // ~100 MB of base64 text
  project_files: [{ field: 'content', max: 20_000_000 }], // LaTeX source / large file content
};

/**
 * Idempotent runtime migration: PocketBase editor/json fields default to a
 * 5MB content limit (maxSize unset/0). Large DOCX uploads routinely exceed
 * this when rawHtml/rawXml are embedded in structuredContent. This raises
 * maxSize on the content-bearing fields to 20MB.
 *
 * Also raises text field max for large base64 payloads (e.g. upload_jobs.rawBytes).
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

    for (const [collectionName, targets] of Object.entries(TEXT_FIELD_TARGETS)) {
      const col = await admPb.collections.getOne(collectionName).catch(() => null);
      if (!col) continue;
      const fields = (col as any).fields || (col as any).schema || [];
      let changed = false;
      const nextFields = (fields as any[]).map((f: any) => {
        const target = targets.find(t => t.field === f.name);
        if (target && Number(f.max || 0) < target.max) {
          changed = true;
          return { ...f, max: target.max };
        }
        return f;
      });
      if (changed) {
        await admPb.collections.update(col.id, { fields: nextFields });
        console.log(`[PB_LIMITS] Raised ${collectionName} text fields max`);
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
