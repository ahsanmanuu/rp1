import { NextRequest, NextResponse } from 'next/server';
import { pbAdmin } from '@/lib/pb';
import JSZip from 'jszip';
import { BACKUP_COLLECTIONS, getFileFields, getUrlFields } from '@/lib/backup-collections';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

interface BackupProgress {
  phase: 'init' | 'collections' | 'files' | 'packaging' | 'done';
  current: number;
  total: number;
  collectionName: string;
  recordCount: number;
}

/**
 * GET /api/admin/backup
 * Creates a full PocketBase backup as a downloadable ZIP.
 *
 * Query params:
 *   ?includeFiles=true|false  — download file attachments (default true)
 *   ?collections=a,b,c        — optional subset (default all)
 *
 * Returns a streaming ZIP download.
 */
export async function GET(req: NextRequest) {
  try {
    const pb = await pbAdmin();
    const { searchParams } = new URL(req.url);
    const includeFiles = searchParams.get('includeFiles') !== 'false';
    const requestedCollections = searchParams.get('collections')?.split(',').filter(Boolean);

    const collections = requestedCollections
      ? BACKUP_COLLECTIONS.filter(c => requestedCollections.includes(c.name))
      : BACKUP_COLLECTIONS;

    const zip = new JSZip();
    const metadata: Record<string, any> = {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      includeFiles,
      collections: {},
      totalRecords: 0,
      totalFiles: 0,
    };

    const BATCH_SIZE = 200;

    // ── Phase 1: Export all collections ──
    let consecutiveErrors = 0;
    for (let i = 0; i < collections.length; i++) {
      const col = collections[i];
      try {
        let allRecords: any[] = [];
        let page = 1;
        let hasMore = true;

        while (hasMore) {
          const result = await pb.collection(col.name).getList(page, BATCH_SIZE, {
            requestKey: null,
            sort: '-created',
          });
          allRecords = allRecords.concat(result.items);
          hasMore = result.items.length === BATCH_SIZE;
          page++;
        }

        consecutiveErrors = 0;

        // Strip PocketBase internal fields for cleaner restore
        const cleanRecords = allRecords.map(r => {
          const clean: Record<string, any> = { id: r.id };
          for (const [k, v] of Object.entries(r)) {
            if (!['collectionId', 'collectionName', 'expand'].includes(k)) {
              clean[k] = v;
            }
          }
          return clean;
        });

        zip.file(`collections/${col.name}.json`, JSON.stringify(cleanRecords, null, 2));
        metadata.collections[col.name] = { recordCount: cleanRecords.length };
        metadata.totalRecords += cleanRecords.length;
      } catch (err: any) {
        consecutiveErrors++;
        console.warn(`[Backup] Skipping collection ${col.name}: ${err.message}`);
        metadata.collections[col.name] = { recordCount: 0, error: err.message };

        if (consecutiveErrors >= 3 && metadata.totalRecords === 0) {
          console.error(`[Backup] ${consecutiveErrors} consecutive collection failures with 0 total records — aborting`);
          return NextResponse.json(
            { success: false, error: `PocketBase query failed after ${consecutiveErrors} collections: ${err.message}. Admin auth may be invalid.` },
            { status: 500 }
          );
        }
      }
    }

    // ── Phase 2: Download file attachments ──
    if (includeFiles) {
      const fileCollections = collections.filter(c => getFileFields(c.name).length > 0);

      for (const col of fileCollections) {
        const fileFields = getFileFields(col.name);
        try {
          let page = 1;
          let hasMore = true;

          while (hasMore) {
            const result = await pb.collection(col.name).getList(page, BATCH_SIZE, {
              requestKey: null,
            });

            for (const record of result.items) {
              for (const field of fileFields) {
                const fileVal = record[field];
                if (!fileVal || typeof fileVal !== 'string') continue;

                try {
                  const fileUrl = pb.files.getUrl(record, fileVal);
                  const resp = await fetch(fileUrl);
                  if (!resp.ok) continue;

                  const arrayBuffer = await resp.arrayBuffer();
                  const safeName = fileVal.replace(/[^a-zA-Z0-9._-]/g, '_');
                  const filePath = `files/${col.name}/${record.id}/${field}/${safeName}`;
                  zip.file(filePath, Buffer.from(arrayBuffer));
                  metadata.totalFiles++;
                } catch (fileErr: any) {
                  console.warn(`[Backup] File skip ${col.name}/${record.id}/${field}: ${fileErr.message}`);
                }
              }
            }

            hasMore = result.items.length === BATCH_SIZE;
            page++;
          }
        } catch (err: any) {
          console.warn(`[Backup] File collection skip ${col.name}: ${err.message}`);
        }
      }
    }

    // ── Phase 2b: Download URL-based assets ──
    if (includeFiles) {
      const urlCollections = collections.filter(c => getUrlFields(c.name).length > 0);

      for (const col of urlCollections) {
        const urlFields = getUrlFields(col.name);
        try {
          let page = 1;
          let hasMore = true;

          while (hasMore) {
            const result = await pb.collection(col.name).getList(page, BATCH_SIZE, {
              requestKey: null,
            });

            for (const record of result.items) {
              for (const field of urlFields) {
                const urlVal = record[field];
                if (!urlVal || typeof urlVal !== 'string') continue;

                // Only download PB-hosted files — check if URL path matches PB file pattern
                let isPbFileUrl = false;
                try {
                  const parsed = new URL(urlVal);
                  isPbFileUrl = parsed.pathname.startsWith('/api/files/');
                } catch {
                  // Not a valid URL — skip
                  continue;
                }
                if (!isPbFileUrl) continue;

                try {
                  const resp = await fetch(urlVal);
                  if (!resp.ok) continue;

                  const arrayBuffer = await resp.arrayBuffer();
                  // Extract filename from URL path: /api/files/{collection}/{id}/{filename}
                  const urlParts = urlVal.split('/');
                  const safeName = (urlParts[urlParts.length - 1] || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
                  const filePath = `files/${col.name}/${record.id}/${field}/${safeName}`;
                  zip.file(filePath, Buffer.from(arrayBuffer));
                  metadata.totalFiles++;
                } catch (fileErr: any) {
                  console.warn(`[Backup] URL skip ${col.name}/${record.id}/${field}: ${fileErr.message}`);
                }
              }
            }

            hasMore = result.items.length === BATCH_SIZE;
            page++;
          }
        } catch (err: any) {
          console.warn(`[Backup] URL collection skip ${col.name}: ${err.message}`);
        }
      }
    }

    // ── Phase 3: Write metadata + package ──
    zip.file('metadata.json', JSON.stringify(metadata, null, 2));

    const zipBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `latexify-backup-${timestamp}.zip`;

    const errorCount = Object.values(metadata.collections).filter((c: any) => c.error).length;
    const errorSummary = Object.entries(metadata.collections)
      .filter(([, c]: [string, any]) => c.error)
      .slice(0, 10)
      .map(([name, c]: [string, any]) => `${name}: ${c.error}`)
      .join(' | ');

    return new NextResponse(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'X-Backup-Records': String(metadata.totalRecords),
        'X-Backup-Files': String(metadata.totalFiles),
        'X-Backup-Collections': String(Object.keys(metadata.collections).length),
        'X-Backup-Errors': String(errorCount),
        ...(errorSummary ? { 'X-Backup-Error-Details': errorSummary.slice(0, 500) } : {}),
      },
    });
  } catch (err: any) {
    console.error('[Backup] Fatal error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Backup failed' },
      { status: 500 }
    );
  }
}
