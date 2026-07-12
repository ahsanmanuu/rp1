import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSessionFromRequest } from "@/lib/adminAuth";

export const dynamic = 'force-dynamic';

const MANUAL_OVERRIDE_MINUTES = 5; // respect manual edits for 5 minutes

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Return a random integer in [min, max]. */
const randInt = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

/** Return a random float (1 decimal) in [min, max] clamped to [0, 100]. */
const clampedFloat = (current: number, drift: number) => {
  const raw = current + (Math.random() - 0.5) * 2 * drift;
  return Math.round(Math.min(100, Math.max(0, raw)) * 10) / 10;
};

/** Return a random int in [current - drift, current + drift], clamped to >= 0. */
const clampedInt = (current: number, drift: number) =>
  Math.max(0, current + randInt(-drift, drift));

// ---------------------------------------------------------------------------
// Auto-status evaluator
// ---------------------------------------------------------------------------

interface ServiceInput {
  id: string;
  status: string;
  uptime: number;
  latencyMs: number;
  queueJobs: number;
  usagePercent: number;
  manualOverrideAt: Date | null;
}

/**
 * Determine the health status from raw metrics.
 *   stable     – everything nominal
 *   normal     – minor load increase
 *   high_load  – one metric is elevated
 *   degraded   – one metric is severe
 *   down       – uptime critically low
 */
function deriveStatus(svc: ServiceInput): string {
  const { uptime, latencyMs, queueJobs, usagePercent } = svc;

  if (uptime < 95)                                return "down";
  if (latencyMs > 1000 || queueJobs > 150)        return "degraded";
  if (usagePercent > 92 || uptime < 98.5)         return "degraded";
  if (latencyMs > 400 || queueJobs > 50)          return "high_load";
  if (usagePercent > 75)                          return "high_load";
  if (latencyMs > 200 || queueJobs > 20)          return "normal";
  if (usagePercent > 50)                          return "normal";
  return "stable";
}

/**
 * Apply slight random drift to numeric metrics so the dashboard looks alive.
 * Each call nudges values within a small window.
 */
function applyDrift(svc: ServiceInput): {
  uptime: number;
  latencyMs: number;
  queueJobs: number;
  usagePercent: number;
} {
  // Each service has a different drift range to give variety
  const drifts: Record<string, { u: number; l: number; q: number; p: number }> = {
    latex_editor:       { u: 0.02, l: 5,   q: 1,  p: 2  },
    doc2latex:          { u: 0.05, l: 15,  q: 1,  p: 3  },
    template_migrator:  { u: 0.03, l: 5,   q: 5,  p: 2  },
    ai_diagram:         { u: 0.04, l: 10,  q: 2,  p: 5  },
    ai_reviewer:        { u: 0.02, l: 8,   q: 2,  p: 3  },
    citation_studio:    { u: 0.01, l: 3,   q: 1,  p: 1  },
  };
  // Default drift if key not found
  const d = drifts[svc.status] ?? { u: 0.03, l: 8, q: 2, p: 3 };

  return {
    uptime:       clampedFloat(svc.uptime, d.u),
    latencyMs:    clampedInt(svc.latencyMs, d.l),
    queueJobs:    clampedInt(svc.queueJobs, d.q),
    usagePercent: clampedInt(svc.usagePercent, d.p),
  };
}

/**
 * Auto-evaluate all services:
 *   - Skip services that were manually overridden within the last N minutes
 *   - For the rest, apply drift → derive new status → persist
 */
async function autoEvaluateServices(): Promise<void> {
  const services = await prisma.serviceHealth.findMany();

  const cutoff = new Date(Date.now() - MANUAL_OVERRIDE_MINUTES * 60_000);

  for (const svc of services) {
    // Respect manual override window
    if (svc.manualOverrideAt && svc.manualOverrideAt > cutoff) continue;

    const drifted = applyDrift(svc);
    const newStatus = deriveStatus({ ...svc, ...drifted });

    await prisma.serviceHealth.update({
      where: { id: svc.id },
      data: {
        status: newStatus,
        uptime: drifted.uptime,
        latencyMs: drifted.latencyMs,
        queueJobs: drifted.queueJobs,
        usagePercent: drifted.usagePercent,
        manualOverrideAt: null, // clear expired override
      },
    });
  }
}

// ---------------------------------------------------------------------------
// Seeding
// ---------------------------------------------------------------------------

async function ensureHealthSeeded() {
  const defaultServices = [
    { serviceKey: "latex_editor", name: "LaTeX Editor", status: "stable", uptime: 99.98, latencyMs: 0, queueJobs: 0, usagePercent: 0 },
    { serviceKey: "doc2latex", name: "Doc2Latex Converter", status: "stable", uptime: 99.9, latencyMs: 142, queueJobs: 0, usagePercent: 0 },
    { serviceKey: "template_migrator", name: "Template Migrator", status: "normal", uptime: 99.9, latencyMs: 0, queueJobs: 12, usagePercent: 0 },
    { serviceKey: "ai_diagram", name: "AI Diagram Generator", status: "high_load", uptime: 99.9, latencyMs: 0, queueJobs: 0, usagePercent: 84 },
    { serviceKey: "ai_reviewer", name: "AI Peer Reviewer", status: "stable", uptime: 99.95, latencyMs: 0, queueJobs: 0, usagePercent: 0 },
    { serviceKey: "citation_studio", name: "Citation Studio", status: "stable", uptime: 99.99, latencyMs: 0, queueJobs: 0, usagePercent: 0 }
  ];

  for (const s of defaultServices) {
    await prisma.serviceHealth.upsert({
      where: { serviceKey: s.serviceKey },
      update: {},
      create: s,
    });
  }
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const session = await getAdminSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    try { await ensureHealthSeeded(); } catch { /* seed non-fatal */ }
    try { await autoEvaluateServices(); } catch { /* eval non-fatal */ }

    const services = await prisma.serviceHealth.findMany({
      orderBy: { name: "asc" },
    });

    // Determine overall system operational status
    const anyDown = services.some(s => s.status === "down");
    const anyDegraded = services.some(s => s.status === "degraded");
    const overallStatus = anyDown ? "degraded" : anyDegraded ? "degraded" : "operational";

    // Mock graph data (slight randomisation each poll)
    const graphData = [
      { time: "08:00", value: randInt(30, 50) },
      { time: "12:00", value: randInt(50, 70) },
      { time: "16:00", value: randInt(45, 65) },
      { time: "20:00", value: randInt(70, 90) },
      { time: "00:00", value: randInt(55, 75) },
    ];

    const engineConfig = {
      engine: "TeX Live 2024",
      apiStatus: "CONNECTED",
      region: "US-East",
      activeNodes: randInt(16, 20),
      idleNodes: randInt(1, 4),
    };

    return NextResponse.json({
      success: true,
      services,
      overallStatus,
      graphData,
      engineConfig,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const session = await getAdminSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { id, status, uptime, latencyMs, queueJobs, usagePercent } = body;

    if (!id) {
      return NextResponse.json({ error: "Missing service health record id" }, { status: 400 });
    }

    const updatedHealth = await prisma.serviceHealth.update({
      where: { id },
      data: {
        status,
        uptime: uptime !== undefined ? parseFloat(uptime) : undefined,
        latencyMs: latencyMs !== undefined ? parseInt(latencyMs, 10) : undefined,
        queueJobs: queueJobs !== undefined ? parseInt(queueJobs, 10) : undefined,
        usagePercent: usagePercent !== undefined ? parseInt(usagePercent, 10) : undefined,
        manualOverrideAt: new Date(), // mark as manually set
      },
    });

    await prisma.auditLog.create({
      data: {
        adminId: session.email || "admin",
        action: "UPDATE_SERVICE_HEALTH",
        targetTable: "service_health",
        targetId: updatedHealth.id,
        newValue: JSON.stringify(updatedHealth),
      },
    });

    return NextResponse.json({ success: true, service: updatedHealth });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
