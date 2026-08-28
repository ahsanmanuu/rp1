import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const MIME_MAP: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  pdf: 'application/pdf',
  eps: 'application/postscript',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  bmp: 'image/bmp',
  heic: 'image/heic',
  heif: 'image/heif',
  avif: 'image/avif',
};

/**
 * Dynamic File Serving Route for /uploads/...
 *
 * Serves runtime uploaded project assets (figures, images, documents) that are
 * saved to public/uploads/projects/... after the initial next build.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const resolvedParams = await params;
    const pathSegments = resolvedParams?.path || [];
    if (!pathSegments || pathSegments.length === 0) {
      return NextResponse.json({ error: 'File path required' }, { status: 400 });
    }

    // Sanitize path against directory traversal
    const safeRelativePath = path.normalize(pathSegments.join('/')).replace(/^(\.\.[\/\\])+/, '');
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    const fullDiskPath = path.join(uploadsDir, safeRelativePath);

    // Prevent directory traversal outside uploadsDir
    if (!fullDiskPath.startsWith(uploadsDir)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const ext = path.extname(fullDiskPath).toLowerCase().replace(/^\./, '');
    const contentType = MIME_MAP[ext] || 'application/octet-stream';

    // 1. Try reading directly from server disk
    if (fs.existsSync(fullDiskPath) && fs.statSync(fullDiskPath).isFile()) {
      const buffer = fs.readFileSync(fullDiskPath);
      return new NextResponse(buffer, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Content-Length': buffer.length.toString(),
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    }

    // 2. Fallback: Lookup in database (ProjectFile table)
    // pathSegments: ['projects', projectId, ...filenameParts]
    if (pathSegments.length >= 3 && pathSegments[0] === 'projects') {
      const projectId = pathSegments[1];
      const filename = pathSegments.slice(2).join('/');

      try {
        const baseName = path.basename(filename);
        const fileRecord = await prisma.projectFile.findFirst({
          where: {
            projectId,
            OR: [
              { filename: filename },
              { filename: baseName },
              { filename: `assets/${baseName}` },
              { filename: `figures/${baseName}` },
            ]
          },
          select: { content: true, fileType: true }
        });

        if (fileRecord?.content && fileRecord.content.length > 20) {
          const raw = fileRecord.content;
          const base64Data = raw.startsWith('data:') ? (raw.split(',')[1] || '') : raw;
          const buffer = Buffer.from(base64Data, 'base64');
          if (buffer.length > 0) {
            return new NextResponse(buffer, {
              status: 200,
              headers: {
                'Content-Type': contentType,
                'Content-Length': buffer.length.toString(),
                'Cache-Control': 'public, max-age=31536000, immutable',
              },
            });
          }
        }
      } catch (dbErr) {
        console.warn('[UPLOADS-SERVE] Database lookup error:', dbErr);
      }
    }

    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  } catch (err: any) {
    console.error('[UPLOADS-SERVE] Error:', err?.message || err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
