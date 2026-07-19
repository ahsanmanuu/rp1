import { NextRequest, NextResponse } from 'next/server';
import { pbAdmin } from '@/lib/pb';
import JSZip from 'jszip';
import { BACKUP_COLLECTIONS, getFileFields, getUrlFields } from '@/lib/backup-collections';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * GET /api/admin/backup
 * Creates a full PocketBase backup as a downloadable ZIP.
 */
export async function GET(req: NextRequest) {
  const startTime = Date.now();

  try {
    const pb = await pbAdmin();
    const { searchParams } = new URL(req.url);
    const includeFiles = searchParams.get('includeFiles') !== 'false';
    const requestedCollections = searchParams.get('collections')?.split(',').filter(Boolean);

    const collections = requestedCollections
      ? BACKUP_COLLECTIONS.filter(c => requestedCollections.includes(c.name))
      : BACKUP_COLLECTIONS;

    console.log(`[Backup] Starting — ${collections.length} collections, includeFiles=${includeFiles}`);

    // ── Pre-flight: verify PB auth works ──
    try {
      const test = await pb.collection('users').getList(1, 1, { requestKey: null });
      console.log(`[Backup] Pre-flight OK — users has ${test.totalItems} records`);
    } catch (preErr: any) {
      console.error(`[Backup] Pre-flight FAILED: ${preErr.message}`);
      return NextResponse.json(
        { success: false, error: `PocketBase auth failed: ${preErr.message}` },
        { status: 500 }
      );
    }

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
    const PARALLEL_BATCH = 10;

    // ── Phase 1: Export all collections (parallel batches) ──
    let consecutiveErrors = 0; // tracked across all batches
    for (let batchStart = 0; batchStart < collections.length; batchStart += PARALLEL_BATCH) {
      if (Date.now() - startTime > 120000) {
        console.warn(`[Backup] Stopping at batch ${batchStart} — exceeded 120s`);
        break;
      }

      const batch = collections.slice(batchStart, batchStart + PARALLEL_BATCH);

      const results = await Promise.allSettled(
        batch.map(async (col) => {
          let allRecords: any[] = [];
          let page = 1;
          let hasMore = true;

          while (hasMore) {
            const result = await pb.collection(col.name).getList(page, BATCH_SIZE, {
              requestKey: null,
              // NOTE: No `sort` here — some collections don't have a `created` field
              // and sorting by it would cause a DB error for those collections.
            });
            allRecords = allRecords.concat(result.items);
            hasMore = result.items.length === BATCH_SIZE;
            page++;
          }

          const cleanRecords = allRecords.map(r => {
            const clean: Record<string, any> = { id: r.id };
            for (const [k, v] of Object.entries(r)) {
              if (!['collectionId', 'collectionName', 'expand'].includes(k)) {
                clean[k] = v;
              }
            }
            return clean;
          });

          return { name: col.name, records: cleanRecords };
        })
      );

      for (let j = 0; j < results.length; j++) {
        const result = results[j];
        const col = batch[j];

        if (result.status === 'fulfilled') {
          consecutiveErrors = 0;
          const { name, records } = result.value;
          zip.file(`collections/${name}.json`, JSON.stringify(records, null, 2));
          metadata.collections[name] = { recordCount: records.length };
          metadata.totalRecords += records.length;
        } else {
          const errMsg = result.reason?.message || 'Unknown error';
          const errStatus = result.reason?.status ?? result.reason?.statusCode ?? 0;
          // Schema/404 errors = optional collection doesn't exist → skip non-fatally
          const isSchemaError = errStatus === 404 ||
            errMsg.includes('Missing collection context') ||
            errMsg.includes('no such table') ||
            errMsg.includes('The requested resource wasn\'t found') ||
            errMsg.toLowerCase().includes('not found');

          if (!isSchemaError) {
            // Only count real connectivity/auth errors toward the abort threshold
            consecutiveErrors++;
          }
          console.warn(`[Backup] Skipping ${col.name} (${isSchemaError ? 'schema/404' : 'error'}): ${errMsg}`);
          metadata.collections[col.name] = { recordCount: 0, error: errMsg };

          // Abort only on genuine auth/connectivity failures (not schema/404 errors)
          if (consecutiveErrors >= 5 && metadata.totalRecords === 0) {
            console.error(`[Backup] ${consecutiveErrors} consecutive auth/connectivity failures with 0 records — aborting`);
            return NextResponse.json(
              { success: false, error: `PB auth or connectivity failed: ${errMsg}` },
              { status: 500 }
            );
          }
        }
      }
    }

    const phase1Time = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[Backup] Phase 1 done in ${phase1Time}s — ${metadata.totalRecords} records`);

    if (metadata.totalRecords === 0) {
      const errorSamples = Object.entries(metadata.collections)
        .filter(([, v]: [string, any]) => v.error)
        .slice(0, 5)
        .map(([name, v]: [string, any]) => `${name}: ${(v as any).error}`)
        .join(' | ');
      console.error(`[Backup] 0 records. Errors: ${errorSamples}`);
      return NextResponse.json(
        { success: false, error: `Backup produced 0 records. ${errorSamples || 'All collections empty.'}` },
        { status: 500 }
      );
    }

    // ── Phase 2: Download file attachments (if enabled and time permits) ──
    if (includeFiles && (Date.now() - startTime) < 90000) {
      const fileCollections = collections.filter(c => getFileFields(c.name).length > 0);

      for (const col of fileCollections) {
        if ((Date.now() - startTime) > 110000) break;

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

    // ── Phase 2b: Download URL-based assets (if enabled and time permits) ──
    if (includeFiles && (Date.now() - startTime) < 110000) {
      const urlCollections = collections.filter(c => getUrlFields(c.name).length > 0);

      for (const col of urlCollections) {
        if ((Date.now() - startTime) > 115000) break;

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

                let isPbFileUrl = false;
                try {
                  const parsed = new URL(urlVal);
                  isPbFileUrl = parsed.pathname.startsWith('/api/files/');
                } catch {
                  continue;
                }
                if (!isPbFileUrl) continue;

                try {
                  const resp = await fetch(urlVal);
                  if (!resp.ok) continue;

                  const arrayBuffer = await resp.arrayBuffer();
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

    // ── Phase 3: Package ZIP ──
    zip.file('metadata.json', JSON.stringify(metadata, null, 2));

    const zipBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    if (!zipBuffer || zipBuffer.length < 200) {
      console.error(`[Backup] ZIP buffer suspiciously small: ${zipBuffer?.length || 0} bytes`);
      return NextResponse.json(
        { success: false, error: 'Generated backup file is too small. PocketBase may have no data.' },
        { status: 500 }
      );
    }

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `latexify-backup-${timestamp}.zip`;

    const errorCount = Object.values(metadata.collections).filter((c: any) => c.error).length;

    console.log(`[Backup] Complete in ${totalTime}s — ${metadata.totalRecords} records, ${metadata.totalFiles} files, ${zipBuffer.length} bytes, ${errorCount} collection errors`);

    return new NextResponse(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'X-Backup-Records': String(metadata.totalRecords),
        'X-Backup-Files': String(metadata.totalFiles),
        'X-Backup-Collections': String(Object.keys(metadata.collections).length),
        'X-Backup-Errors': String(errorCount),
      },
    });
  } catch (err: any) {
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    console.error(`[Backup] Fatal error after ${totalTime}s:`, err);
    return NextResponse.json(
      { success: false, error: err.message || 'Backup failed' },
      { status: 500 }
    );
  }
}
