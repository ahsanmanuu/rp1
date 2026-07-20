import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';
import path from 'path';
import { pbAdmin, clearAdminCache } from '@/lib/pb';
import JSZip from 'jszip';
import { ALL_COLLECTION_NAMES, getFileFields } from '@/lib/backup-collections';

export const dynamic = 'force-dynamic';
export const maxDuration = 600;

/**
 * Collections that must NEVER be restored from backup.
 * Restoring _superusers would overwrite the active admin's bcrypt hash,
 * locking out pbAdmin() and breaking all authenticated user operations.
 */
const NEVER_RESTORE_COLLECTIONS = new Set(['_superusers']);

/**
 * Re-upsert superuser credentials via CLI after any restore,
 * ensuring the active server credentials always win over backup data.
 */
function reUpsertSuperusers(): void {
  const isWindows = process.platform === 'win32';
  const pbBinary = isWindows
    ? path.join(process.cwd(), 'pocketbase.exe')
    : path.join(process.cwd(), 'pocketbase');
  const pbDataDir = process.env.PB_DATA_DIR || path.join(process.cwd(), 'pb_data');

  const emailsToUpsert = Array.from(new Set([
    process.env.POCKETBASE_ADMIN_EMAIL || 'admin@latexify.io',
    process.env.ADMIN_EMAIL || '',
  ].filter(Boolean)));

  let password = process.env.POCKETBASE_ADMIN_PASSWORD || 'Sczone@123';
  if (password === 'admin123456') password = 'Sczone@123'; // ignore stale default

  for (const email of emailsToUpsert) {
    try {
      const cmd = isWindows
        ? `"${pbBinary}" superuser upsert ${email} ${password} --dir="${pbDataDir}"`
        : `"${pbBinary}" superuser upsert ${email} ${password} --dir="${pbDataDir}"`;
      execSync(cmd, { stdio: 'ignore' });
      console.log(`[Restore] Superuser re-upserted: ${email}`);
    } catch (err: any) {
      console.warn(`[Restore] Superuser re-upsert failed for ${email}: ${err.message}`);
    }
  }

  // Clear stale admin token cache so the next pbAdmin() call re-authenticates
  clearAdminCache();
  try {
    const fs = require('fs');
    const tokenPath = path.join(pbDataDir, 'admin_token.json');
    if (fs.existsSync(tokenPath)) fs.unlinkSync(tokenPath);
  } catch {}
}

interface RestoreResult {
  collection: string;
  imported: number;
  skipped: number;
  errors: string[];
}

/**
 * POST /api/admin/backup/restore
 * Accepts a ZIP backup file and restores all data into PocketBase.
 *
 * Body: multipart/form-data with field "file" (ZIP) + optional "mode" field:
 *   mode = "merge"  → upsert records, keep existing (default)
 *   mode = "replace" → clear collections before restoring
 *   mode = "skip"    → skip collections that already have data
 *
 * Returns JSON with per-collection restore results.
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const mode = (formData.get('mode') as string) || 'merge';

    if (!file) {
      return NextResponse.json({ success: false, error: 'No backup file provided' }, { status: 400 });
    }

    if (!file.name.endsWith('.zip')) {
      return NextResponse.json({ success: false, error: 'File must be a .zip archive' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);

    // Read metadata
    const metaFile = zip.file('metadata.json');
    if (!metaFile) {
      return NextResponse.json({ success: false, error: 'Invalid backup: missing metadata.json' }, { status: 400 });
    }
    const metadata = JSON.parse(await metaFile.async('text'));

    const pb = await pbAdmin();
    const results: RestoreResult[] = [];
    const errors: string[] = [];
    const BATCH_SIZE = 50;

    // ── Phase 1: Restore collections ──
    const collectionFiles = zip.folder('collections');
    if (!collectionFiles) {
      return NextResponse.json({ success: false, error: 'Invalid backup: missing collections folder' }, { status: 400 });
    }

    // Sort collections: simpler tables first, complex ones with relations later
    const priorityOrder = [
      'users', 'membership_plans', 'ai_cap_plans',
      'admin_users', 'site_settings', 'platform_stats',
    ];

    const collectionNames = Object.keys(metadata.collections || {})
      .sort((a, b) => {
        const ai = priorityOrder.indexOf(a);
        const bi = priorityOrder.indexOf(b);
        if (ai !== -1 && bi !== -1) return ai - bi;
        if (ai !== -1) return -1;
        if (bi !== -1) return 1;
        return a.localeCompare(b);
      });

    for (const colName of collectionNames) {
      const colFile = collectionFiles.file(`${colName}.json`);
      if (!colFile) continue;

      const result: RestoreResult = { collection: colName, imported: 0, skipped: 0, errors: [] };

      // SAFETY: Never restore _superusers — importing an old bcrypt hash would
      // overwrite the current admin credentials and lock out all admin operations,
      // breaking user sign-in for every user on the platform.
      if (NEVER_RESTORE_COLLECTIONS.has(colName)) {
        result.errors.push(`Collection "${colName}" is protected and cannot be restored from backup.`);
        results.push(result);
        console.warn(`[Restore] Skipping protected collection: ${colName}`);
        continue;
      }

      try {
        const records = JSON.parse(await colFile.async('text'));
        if (!Array.isArray(records) || records.length === 0) {
          results.push(result);
          continue;
        }

        // Check if collection is allowed
        if (!ALL_COLLECTION_NAMES.includes(colName)) {
          result.errors.push(`Collection "${colName}" not in allowlist — skipped`);
          results.push(result);
          continue;
        }

        // For replace mode, try to clear first (may fail on empty/non-existent collections)
        if (mode === 'replace') {
          try {
            const existing = await pb.collection(colName).getList(1, 1, { requestKey: null });
            if (existing.totalItems > 0) {
              // Delete in batches
              let delPage = 1;
              let delMore = true;
              while (delMore) {
                const delResult = await pb.collection(colName).getList(delPage, 100, { requestKey: null });
                for (const r of delResult.items) {
                  try {
                    await pb.collection(colName).delete(r.id, { requestKey: null });
                  } catch {}
                }
                delMore = delResult.items.length === 100;
                delPage++;
              }
            }
          } catch {}
        }

        // Import records in batches
        for (let i = 0; i < records.length; i += BATCH_SIZE) {
          const batch = records.slice(i, i + BATCH_SIZE);
          for (const record of batch) {
            try {
              const { id, ...data } = record;
              if (!id) { result.skipped++; continue; }

              if (mode === 'skip') {
                try {
                  await pb.collection(colName).getOne(id, { requestKey: null });
                  result.skipped++;
                  continue;
                } catch {
                  // Record doesn't exist — create it
                }
              }

              // Try update first, create if not found
              try {
                await pb.collection(colName).update(id, data, { requestKey: null });
                result.imported++;
              } catch (updateErr: any) {
                if (updateErr.status === 404) {
                  try {
                    await pb.collection(colName).create({ id, ...data }, { requestKey: null });
                    result.imported++;
                  } catch (createErr: any) {
                    result.errors.push(`${id}: ${createErr.message}`);
                  }
                } else {
                  result.errors.push(`${id}: ${updateErr.message}`);
                }
              }
            } catch (err: any) {
              result.errors.push(`${record.id || 'unknown'}: ${err.message}`);
            }
          }
        }
      } catch (err: any) {
        result.errors.push(`Parse/collection error: ${err.message}`);
      }

      results.push(result);
    }

    // ── Phase 2: Restore file attachments ──
    const filesFolder = zip.folder('files');
    let filesRestored = 0;

    if (filesFolder) {
      for (const colName of Object.keys(metadata.collections || {})) {
        const fileFields = getFileFields(colName);
        if (fileFields.length === 0) continue;

        const colFolder = filesFolder.folder(colName);
        if (!colFolder) continue;

        for (const recordFolder of colFolder.folder(colName) ? [colFolder] : []) {
          // Iterate record folders
          const recordEntries: Record<string, any> = {};
          colFolder.forEach((path, entry) => {
            // path format: <recordId>/<field>/<filename>
            const parts = path.split('/');
            if (parts.length >= 3) {
              const recId = parts[0];
              const field = parts[1];
              const filename = parts.slice(2).join('/');
              if (!recordEntries[recId]) recordEntries[recId] = {};
              recordEntries[recId][field] = { path, filename, entry };
            }
          });

          for (const [recId, fields] of Object.entries(recordEntries)) {
            for (const [field, rawFileInfo] of Object.entries(fields as Record<string, { path: string; filename: string; entry: any }>)) {
              try {
                const fileInfo = rawFileInfo;
                const blob = await fileInfo.entry.async('nodebuffer');
                const file = new File([blob], fileInfo.filename, { type: 'application/octet-stream' });
                const formData = new FormData();
                formData.append(field, file);

                // Update record with file
                await pb.collection(colName).update(recId, formData, { requestKey: null });
                filesRestored++;
              } catch (err: any) {
                console.warn(`[Restore] File skip ${colName}/${recId}/${field}: ${err.message}`);
              }
            }
          }
        }
      }
    }

    // ── Phase 3: Re-upsert superuser credentials ──
    // This is CRITICAL: even if _superusers was not in the backup, we always
    // re-assert the current server credentials after any restore to prevent
    // any accidental credential state drift from breaking admin auth.
    try {
      reUpsertSuperusers();
    } catch (suErr: any) {
      console.warn('[Restore] Post-restore superuser re-upsert failed (non-fatal):', suErr.message);
    }

    const summary = {
      success: true,
      mode,
      backupVersion: metadata.version,
      backupTimestamp: metadata.timestamp,
      collectionsRestored: results.length,
      totalImported: results.reduce((s, r) => s + r.imported, 0),
      totalSkipped: results.reduce((s, r) => s + r.skipped, 0),
      totalErrors: results.reduce((s, r) => s + r.errors.length, 0),
      filesRestored,
      results,
      errors: errors.slice(0, 50),
    };

    return NextResponse.json(summary);
  } catch (err: any) {
    console.error('[Restore] Fatal error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Restore failed' },
      { status: 500 }
    );
  }
}
