import { NextRequest, NextResponse } from "next/server";
import { getAdminSessionFromRequest } from "@/lib/adminAuth";
import { pbAdmin } from "@/lib/pb";

export const dynamic = "force-dynamic";

// Helper: get or auto-create the admin_users profile record in PocketBase
async function getOrCreateAdminProfile(pb: any, email: string, name?: string) {
  try {
    const records = await pb.collection('admin_users').getFullList({
      filter: `email = "${email}"`,
    });
    if (records.length > 0) return records[0];

    // Auto-create if missing (e.g. fresh deploy before setup-pb ran)
    const created = await pb.collection('admin_users').create({
      email,
      name: name || 'Admin Root',
      role: 'superadmin',
      isActive: true,
      passwordHash: '',
    });
    return created;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const session = await getAdminSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const pb = await pbAdmin();
    const record = await getOrCreateAdminProfile(pb, session.email, session.name);

    if (!record) {
      return NextResponse.json({ success: false, error: "Admin profile not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      admin: {
        id: record.id,
        email: record.email,
        name: record.name,
        role: record.role || 'superadmin',
        createdAt: record.created,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const session = await getAdminSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { name } = await req.json();
    if (!name || !name.trim()) {
      return NextResponse.json({ success: false, error: "Name is required" }, { status: 400 });
    }

    const pb = await pbAdmin();

    // Ensure record exists first
    const record = await getOrCreateAdminProfile(pb, session.email, name.trim());
    if (!record) {
      return NextResponse.json({ success: false, error: "Admin profile not found" }, { status: 404 });
    }

    const updated = await pb.collection('admin_users').update(record.id, {
      name: name.trim(),
    });

    return NextResponse.json({
      success: true,
      admin: {
        id: updated.id,
        email: updated.email,
        name: updated.name,
        role: updated.role || 'superadmin',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
