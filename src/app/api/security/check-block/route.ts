import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logUserActivity } from "@/lib/security";

import { getServerSession } from "@/lib/auth-pb";
export const dynamic = 'force-dynamic';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "";

// Per-user response cache to avoid DB hit on rapid re-checks
const BLOCK_CACHE = new Map<string, { data: any; expiry: number }>();
const BLOCK_CACHE_TTL = 10_000; // 10 seconds

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession().catch(() => null);
    if (!session?.user) return NextResponse.json({ success: true, blocked: false });

    const uid = (session.user as any).id;

    // Return cached response if still valid
    const cached = BLOCK_CACHE.get(uid);
    if (cached && cached.expiry > Date.now()) {
      return NextResponse.json(cached.data, {
        headers: { 'Cache-Control': 'private, max-age=5, stale-while-revalidate=15' },
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: uid },
      select: { blockedUntil: true, status: true, blacklistReason: true }
    });

    if (!user) return NextResponse.json({ success: true, blocked: false });

    const now = new Date();
    const isPermanentlyBlacklisted = user.status === 'blacklisted';
    const isTemporarilyBlocked = !isPermanentlyBlacklisted && !!(user.blockedUntil && user.blockedUntil > now);
    const isBlocked = isPermanentlyBlacklisted || isTemporarilyBlocked;

    const blockData = {
      success: true,
      blocked: isBlocked,
      isBlacklisted: isPermanentlyBlacklisted,
      blockedUntil: isTemporarilyBlocked ? user.blockedUntil : null,
      blacklistReason: isPermanentlyBlacklisted ? (user.blacklistReason || 'Violation of platform terms of service.') : null,
      status: user.status,
      adminEmail: ADMIN_EMAIL
    };
    BLOCK_CACHE.set(uid, { data: blockData, expiry: Date.now() + BLOCK_CACHE_TTL });
    return NextResponse.json(blockData, {
      headers: { 'Cache-Control': 'private, max-age=5, stale-while-revalidate=15' },
    });
  } catch (error: any) {
    console.warn("[Check-Block API] Check block failed, defaulting to unblocked:", error?.message || error);
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
  try {
    const session = await getServerSession().catch(() => null);
    if (!session?.user) return NextResponse.json({ success: true, logged: false, authenticated: false });

    const text = await req.text().catch(() => "");
    let body: any = {};
    if (text && text.trim().length > 0) {
      try { body = JSON.parse(text); } catch {}
    }

    const { ipAddress, location } = body;
    const userId = (session.user as any).id;
    const userAgent = req.headers.get("user-agent") || "Unknown";

    if (ipAddress) {
      await logUserActivity(userId, ipAddress, location || "Unknown Location", userAgent);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.warn("[Check-Block POST] Exception logging activity:", error?.message || error);
    return NextResponse.json({ success: true, logged: false });
  }
}
