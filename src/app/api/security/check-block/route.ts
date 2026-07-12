import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logUserActivity } from "@/lib/security";

import { getServerSession } from "@/lib/auth-pb";
export const dynamic = 'force-dynamic';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "";

export async function GET(req: NextRequest) {
  const session = await getServerSession();
  if (!session?.user) return NextResponse.json({ success: true, blocked: false });

  try {
    const user = await prisma.user.findUnique({
      where: { id: (session.user as any).id },
      select: { blockedUntil: true, status: true, blacklistReason: true }
    });

    if (!user) return NextResponse.json({ success: true, blocked: false });

    const now = new Date();
    const isPermanentlyBlacklisted = user.status === 'blacklisted';
    const isTemporarilyBlocked = !isPermanentlyBlacklisted && !!(user.blockedUntil && user.blockedUntil > now);
    const isBlocked = isPermanentlyBlacklisted || isTemporarilyBlocked;

    return NextResponse.json({
      success: true,
      blocked: isBlocked,
      isBlacklisted: isPermanentlyBlacklisted,
      blockedUntil: isTemporarilyBlocked ? user.blockedUntil : null,
      blacklistReason: isPermanentlyBlacklisted ? (user.blacklistReason || 'Violation of platform terms of service.') : null,
      status: user.status,
      adminEmail: ADMIN_EMAIL
    }, {
      headers: { 'Cache-Control': 'private, max-age=5, stale-while-revalidate=15' },
    });
  } catch (error: any) {
    console.warn("[Check-Block API] Database or schema check failed, defaulting to unblocked:", error.message);
    return NextResponse.json({
      success: true,
      blocked: false,
      isBlacklisted: false,
      blockedUntil: null,
      blacklistReason: null,
      status: 'active',
      dbError: true
    });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session?.user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  try {
    const { ipAddress, location } = await req.json();
    const userId = (session.user as any).id;
    const userAgent = req.headers.get("user-agent") || "Unknown";

    if (ipAddress) {
      await logUserActivity(userId, ipAddress, location || "Unknown Location", userAgent);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
