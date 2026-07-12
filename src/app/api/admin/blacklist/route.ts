/**
 * /api/admin/blacklist
 *
 * Dedicated blacklist management API.
 * GET  ?userId=xxx   → Returns full blacklist history for a user
 * GET  (no userId)   → Returns all blacklisted users + stats
 * POST               → Blacklist a user (action: 'blacklist')
 * DELETE             → Deactivate/remove blacklist (action: 'reactivate')
 *
 * All mutations are logged to BlacklistRecord for full audit trail.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSessionFromRequest } from "@/lib/adminAuth";
import { sendBlacklistEmail, sendReactivationEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "";

// ─── GET ─────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const session = await getAdminSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");

  try {
    if (userId) {
      // Return full audit history for a specific user
      const records = await prisma.blacklistRecord.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 20,
      });
      return NextResponse.json({ success: true, records });
    }

    // Return aggregate stats + all currently blacklisted users
    const [blacklistedUsers, totalRecords, recentRecords] = await Promise.all([
      prisma.user.findMany({
        where: { status: "blacklisted" },
        select: {
          id: true,
          name: true,
          email: true,
          blacklistReason: true,
          updatedAt: true,
          membership: true,
        },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.blacklistRecord.count(),
      prisma.blacklistRecord.findMany({
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
          user: { select: { name: true, email: true } },
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      stats: {
        totalBlacklisted: blacklistedUsers.length,
        totalActions: totalRecords,
      },
      blacklistedUsers,
      recentActivity: recentRecords,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// ─── POST — Blacklist a user ──────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const session = await getAdminSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { userId, reason } = await req.json();
    if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, status: true },
    });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
    if (user.status === "blacklisted") {
      return NextResponse.json({ error: "User is already blacklisted" }, { status: 409 });
    }

    const finalReason = reason?.trim() || "Violation of platform terms of service.";

    // Atomic: update user + create audit record
    const [updatedUser, auditRecord] = await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { status: "blacklisted", blacklistReason: finalReason },
        select: { id: true, status: true, blacklistReason: true },
      }),
      prisma.blacklistRecord.create({
        data: {
          userId,
          action: "blacklisted",
          reason: finalReason,
          adminEmail: session.email || ADMIN_EMAIL,
          adminId: session.adminId || null,
        },
      }),
    ]);

    // Non-blocking email
    sendBlacklistEmail(user.email, user.name || "User", finalReason, user.id).catch(() => {});

    return NextResponse.json({
      success: true,
      user: updatedUser,
      auditRecord,
      message: `User ${user.email} has been blacklisted.`,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// ─── DELETE — Reactivate (deactivate blacklist) ───────────────────────────────
export async function DELETE(req: NextRequest) {
  const session = await getAdminSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { userId, note } = await req.json();
    if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, status: true },
    });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
    if (user.status !== "blacklisted") {
      return NextResponse.json({ error: "User is not currently blacklisted" }, { status: 409 });
    }

    // Atomic: clear status + create audit record
    const [updatedUser, auditRecord] = await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { status: "active", blacklistReason: null, blockedUntil: null },
        select: { id: true, status: true, blacklistReason: true, blockedUntil: true },
      }),
      prisma.blacklistRecord.create({
        data: {
          userId,
          action: "reactivated",
          reason: note?.trim() || null,
          adminEmail: session.email || ADMIN_EMAIL,
          adminId: session.adminId || null,
        },
      }),
    ]);

    // Non-blocking email
    sendReactivationEmail(user.email, user.name || "User", user.id).catch(() => {});

    return NextResponse.json({
      success: true,
      user: updatedUser,
      auditRecord,
      message: `User ${user.email} has been reactivated.`,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
