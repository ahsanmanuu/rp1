import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSessionFromRequest } from "@/lib/adminAuth";

export const dynamic = 'force-dynamic';

// ── Seed demo announcements when PocketBase is empty ──
async function seedDemoAnnouncements() {
  try {
    const count = await prisma.announcement.count();
    if (count > 0) return;

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86_400_000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 86_400_000);

    await prisma.announcement.createMany({
      data: [
        {
          title: "System Maintenance Tonight",
          content: "Scheduled maintenance at 2 AM PST. Compilation may experience brief interruptions (~10 min).",
          priority: "info",
          startsAt: now,
          isActive: true,
          createdAt: now,
        },
        {
          title: "New AI Features Released",
          content: "We've rolled out enhanced AI review analysis and diagram generation improvements. Check the changelog for details.",
          priority: "info",
          startsAt: sevenDaysAgo,
          endsAt: new Date(now.getTime() - 1 * 86_400_000),
          isActive: false,
          createdAt: sevenDaysAgo,
        },
        {
          title: "Scheduled Downtime — Complete",
          content: "The previously announced maintenance window has concluded. All services are operational.",
          priority: "warning",
          startsAt: fourteenDaysAgo,
          endsAt: new Date(fourteenDaysAgo.getTime() + 2 * 86_400_000),
          isActive: false,
          createdAt: fourteenDaysAgo,
        },
      ],
    });
  } catch (err) {
    console.warn("[ANNOUNCEMENTS] Seed error (non-fatal):", err);
  }
}

export async function GET(req: NextRequest) {
  const session = await getAdminSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    try { await seedDemoAnnouncements(); } catch { /* seed non-fatal */ }
    const announcements = await prisma.announcement.findMany({
      orderBy: { createdAt: "desc" }
    });
    return NextResponse.json({ success: true, announcements });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getAdminSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { title, content, priority } = await req.json();
    if (!title || !content) {
      return NextResponse.json({ error: "Missing title or content" }, { status: 400 });
    }

    const announcement = await prisma.announcement.create({
      data: {
        title,
        content,
        priority: priority || "info",
        startsAt: new Date(),
        isActive: true
      }
    });

    return NextResponse.json({ success: true, announcement });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getAdminSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "Missing announcement ID" }, { status: 400 });

    await prisma.announcement.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
