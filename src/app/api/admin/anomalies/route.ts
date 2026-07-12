import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSessionFromRequest } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

const SEVERITY_ORDER: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };

export async function GET(req: NextRequest) {
  const session = await getAdminSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)));
    const type = searchParams.get("type") || "";
    const severity = searchParams.get("severity") || "";
    const status = searchParams.get("status") || "";
    const entityType = searchParams.get("entityType") || "";
    const sortBy = searchParams.get("sortBy") || "createdAt";
    const sortOrder = searchParams.get("sortOrder") || "desc";
    const skip = (page - 1) * limit;

    const where: any = {};
    if (type) where.type = type;
    if (severity) where.severity = severity;
    if (status) where.status = status;
    if (entityType) where.entityType = entityType;

    const [alerts, total] = await Promise.all([
      prisma.anomalyAlert.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
      }),
      prisma.anomalyAlert.count({ where }),
    ]);

    const severityCounts = await prisma.anomalyAlert.groupBy({
      by: ["severity"],
      where: { status: { notIn: ["resolved", "dismissed"] } },
      _count: { id: true },
    });

    const typeCounts = await prisma.anomalyAlert.groupBy({
      by: ["type"],
      where: { status: { notIn: ["resolved", "dismissed"] } },
      _count: { id: true },
    });

    return NextResponse.json({
      success: true,
      alerts,
      total,
      page,
      limit,
      severityCounts: Object.fromEntries(severityCounts.map((s: any) => [s.severity, s._count.id])),
      typeCounts: Object.fromEntries(typeCounts.map((t: any) => [t.type, t._count.id])),
    });
  } catch (error: any) {
    console.error("[ANOMALIES] GET Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const session = await getAdminSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { id, status: newStatus, resolvedBy } = body;

    if (!id || !newStatus) {
      return NextResponse.json({ error: "Missing id or status" }, { status: 400 });
    }

    const existing = await prisma.anomalyAlert.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Alert not found" }, { status: 404 });
    }

    const updateData: any = { status: newStatus };
    if (newStatus === "resolved" || newStatus === "dismissed") {
      updateData.resolvedBy = resolvedBy || session.email || "unknown";
      updateData.resolvedAt = new Date();
    }

    const updated = await prisma.anomalyAlert.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, alert: updated });
  } catch (error: any) {
    console.error("[ANOMALIES] PUT Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getAdminSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { id, dismissAll, type, severity } = body;

    if (dismissAll) {
      const where: any = { status: { notIn: ["resolved", "dismissed"] } };
      if (type) where.type = type;
      if (severity) where.severity = severity;
      const result = await prisma.anomalyAlert.updateMany({
        where,
        data: { status: "dismissed", resolvedBy: session.email || "admin", resolvedAt: new Date() },
      });
      return NextResponse.json({ success: true, dismissed: result.count });
    }

    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    await prisma.anomalyAlert.update({
      where: { id },
      data: { status: "dismissed", resolvedBy: session.email || "admin", resolvedAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[ANOMALIES] DELETE Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
