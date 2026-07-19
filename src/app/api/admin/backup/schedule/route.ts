import { NextRequest, NextResponse } from 'next/server';
import { pbAdmin } from '@/lib/pb';

export const dynamic = 'force-dynamic';

interface BackupScheduleConfig {
  id?: string;
  enabled: boolean;
  frequency: 'daily' | 'weekly' | 'monthly';
  time: string;       // HH:mm UTC
  lastRun?: string;
  nextRun?: string;
  includeFiles: boolean;
  googleDrive: {
    enabled: boolean;
    credentials: string;   // service account JSON or API key
    folderId: string;
  };
  retentionDays: number;   // auto-delete old backups after N days
}

/**
 * GET /api/admin/backup/schedule
 * Returns the current backup schedule configuration.
 */
export async function GET() {
  try {
    const pb = await pbAdmin();

    try {
      const records = await pb.collection('backup_schedules').getList(1, 1, {
        requestKey: null,
        sort: '-created',
      });
      if (records.items.length > 0) {
        return NextResponse.json({ success: true, schedule: records.items[0] });
      }
    } catch {
      // Collection might not exist yet — return defaults
    }

    return NextResponse.json({
      success: true,
      schedule: {
        enabled: false,
        frequency: 'daily',
        time: '03:00',
        includeFiles: true,
        googleDrive: { enabled: false, credentials: '', folderId: '' },
        retentionDays: 30,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/admin/backup/schedule
 * Creates or updates the backup schedule configuration.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const pb = await pbAdmin();
    const config: BackupScheduleConfig = body;

    // Validate
    if (!['daily', 'weekly', 'monthly'].includes(config.frequency)) {
      return NextResponse.json({ success: false, error: 'Invalid frequency' }, { status: 400 });
    }

    // Calculate next run
    const now = new Date();
    const [hours, minutes] = (config.time || '03:00').split(':').map(Number);
    const next = new Date(now);
    next.setUTCHours(hours, minutes, 0, 0);

    if (config.frequency === 'daily') {
      if (next <= now) next.setDate(next.getDate() + 1);
    } else if (config.frequency === 'weekly') {
      next.setDate(next.getDate() + 7);
      if (next <= now) next.setDate(next.getDate() + 7);
    } else if (config.frequency === 'monthly') {
      next.setMonth(next.getMonth() + 1);
      if (next <= now) next.setMonth(next.getMonth() + 1);
    }

    const data = {
      enabled: config.enabled,
      frequency: config.frequency,
      time: config.time || '03:00',
      includeFiles: config.includeFiles !== false,
      googleDriveEnabled: config.googleDrive?.enabled || false,
      googleDriveCredentials: config.googleDrive?.credentials || '',
      googleDriveFolderId: config.googleDrive?.folderId || '',
      retentionDays: config.retentionDays || 30,
      nextRun: next.toISOString(),
    };

    try {
      const records = await pb.collection('backup_schedules').getList(1, 1, { requestKey: null });
      if (records.items.length > 0) {
        await pb.collection('backup_schedules').update(records.items[0].id, data, { requestKey: null });
      } else {
        await pb.collection('backup_schedules').create(data, { requestKey: null });
      }
    } catch {
      // Try creating the collection first, then the record
      await pb.collection('backup_schedules').create(data, { requestKey: null });
    }

    return NextResponse.json({ success: true, schedule: { ...data, nextRun: next.toISOString() } });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
