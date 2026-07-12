import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSessionFromRequest } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

function daysAgo(n: number) {
  return new Date(Date.now() - n * DAY_MS);
}

function hoursAgo(n: number) {
  return new Date(Date.now() - n * HOUR_MS);
}

const SEVERITY_ORDER: Record<string, number> = { low: 1, medium: 2, high: 3, critical: 4 };

async function ensureAlert(
  detectorKey: string,
  data: {
    type: string;
    severity: string;
    title: string;
    description: string;
    entityType?: string;
    entityId?: string;
    entityLabel?: string;
    metadata?: any;
  }
) {
  const existing = await prisma.anomalyAlert.findFirst({
    where: { detectorKey, status: { notIn: ["resolved", "dismissed"] } },
    orderBy: { createdAt: "desc" },
  });
  if (existing) {
    const existingSev = SEVERITY_ORDER[existing.severity] || 0;
    const newSev = SEVERITY_ORDER[data.severity] || 0;
    if (newSev > existingSev) {
      await prisma.anomalyAlert.update({
        where: { id: existing.id },
        data: { severity: data.severity, description: data.description, metadata: data.metadata ? JSON.stringify(data.metadata) : existing.metadata },
      });
    }
    return existing;
  }
  return prisma.anomalyAlert.create({
    data: {
      type: data.type,
      severity: data.severity,
      title: data.title,
      description: data.description,
      entityType: data.entityType || null,
      entityId: data.entityId || null,
      entityLabel: data.entityLabel || null,
      metadata: data.metadata ? JSON.stringify(data.metadata) : null,
      source: "auto_detect",
      status: "open",
      detectorKey,
    },
  });
}

const DETECTOR_REGISTRY: Record<string, { name: string; description: string }> = {};

function registerDetector(key: string, name: string, description: string) {
  DETECTOR_REGISTRY[key] = { name, description };
}

async function runDetector(key: string, fn: () => Promise<void>) {
  try {
    await fn();
  } catch (err: any) {
    console.error(`[anomaly-detector:${key}] Error:`, err);
  }
}

// ══════════════════════════════════════════════════════════
//  DETECTORS — USER
// ══════════════════════════════════════════════════════════

registerDetector("user_ip_hopping", "IP Hopping", "Detects users with sessions from 4+ distinct locations in 7 days");
async function detectIPHopping() {
  const multiLoc = await prisma.userSession.groupBy({
    by: ["userId"],
    where: { createdAt: { gte: daysAgo(7) } },
    _count: { location: true },
    having: { location: { _count: { gt: 3 } } },
  });
  const ids = multiLoc.map((u) => u.userId).filter(Boolean) as string[];
  if (ids.length === 0) return;
  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, email: true },
  });
  for (const u of users) {
    await ensureAlert("user_ip_hopping_" + u.id, {
      type: "ip_hopping",
      severity: "low",
      title: "IP Hopping Detected",
      description: `${u.name} (${u.email}) logged in from 4+ locations in 7 days`,
      entityType: "user",
      entityId: u.id,
      entityLabel: u.email,
    });
  }
}

registerDetector("user_usage_spike", "Usage Spike", "Detects users with token consumption 3σ above their mean");
async function detectUsageSpikes() {
  const dailyStats = await prisma.aiUsageLog.groupBy({
    by: ["userId"],
    where: { createdAt: { gte: daysAgo(7) }, userId: { not: null } },
    _sum: { totalTokens: true },
  });
  const dailyTotals = dailyStats.map((d) => d._sum.totalTokens || 0).filter(Boolean);
  if (dailyTotals.length < 2) return;
  const mean = dailyTotals.reduce((s, v) => s + v, 0) / dailyTotals.length;
  const stdDev = Math.sqrt(dailyTotals.reduce((s, v) => s + (v - mean) ** 2, 0) / dailyTotals.length);
  const threshold = mean + 3 * stdDev;
  const spikeUsers = dailyStats.filter((d) => (d._sum.totalTokens || 0) > threshold && d.userId);
  if (spikeUsers.length === 0) return;
  const ids = spikeUsers.map((u) => u.userId).filter(Boolean) as string[];
  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, email: true },
  });
  const userMap: Record<string, any> = {};
  users.forEach((u) => { userMap[u.id] = u; });
  for (const su of spikeUsers) {
    if (!su.userId) continue;
    const u = userMap[su.userId];
    const tokens = su._sum.totalTokens || 0;
    const ratio = mean > 0 ? (tokens / mean).toFixed(1) : "N/A";
    await ensureAlert("user_usage_spike_" + su.userId, {
      type: "usage_spike",
      severity: tokens > mean * 5 ? "high" : "medium",
      title: "Usage Spike Detected",
      description: `${u?.name || "Unknown"} consumed ${tokens.toLocaleString()} tokens in 7 days (${ratio}× above avg)`,
      entityType: "user",
      entityId: su.userId,
      entityLabel: u?.email || su.userId,
      metadata: { totalTokens: tokens, mean: Math.round(mean), threshold: Math.round(threshold) },
    });
  }
}

registerDetector("user_rate_abuse", "Rate Abuse", "Detects users exceeding 5 AI calls per minute");
async function detectRateAbuse() {
  const oneMinuteAgo = new Date(Date.now() - 60_000);
  const groups = await prisma.aiUsageLog.groupBy({
    by: ["userId"],
    _count: { id: true },
    where: { createdAt: { gte: oneMinuteAgo }, userId: { not: null } },
  });
  const abusers = groups.filter((g) => g._count.id > 5 && g.userId);
  if (abusers.length === 0) return;
  const ids = abusers.map((u) => u.userId).filter(Boolean) as string[];
  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, email: true, status: true },
  });
  for (const u of users) {
    const count = abusers.find((a) => a.userId === u.id)?._count.id || 0;
    await ensureAlert("user_rate_abuse_" + u.id, {
      type: "api_rate",
      severity: "medium",
      title: "Abnormal AI Rate Detected",
      description: `${u.name} (${u.email}) made ${count} AI calls in 1 minute (threshold: 5)`,
      entityType: "user",
      entityId: u.id,
      entityLabel: u.email,
      metadata: { requestCount: count },
    });
    if (u.status === "active") {
      await prisma.user.update({ where: { id: u.id }, data: { status: "abnormal" } });
    }
  }
}

registerDetector("user_status_change", "Status Change", "Tracks recently flagged/blacklisted users");
async function detectUserStatusChanges() {
  const flagged = await prisma.user.findMany({
    where: { status: { in: ["abnormal", "blacklisted"] }, updatedAt: { gte: hoursAgo(24) } },
    select: { id: true, name: true, email: true, status: true, blacklistReason: true },
  });
  for (const u of flagged) {
    await ensureAlert("user_status_change_" + u.id, {
      type: "user_status_change",
      severity: u.status === "blacklisted" ? "high" : "medium",
      title: `User ${u.status === "blacklisted" ? "Blacklisted" : "Flagged"}`,
      description: `${u.name} (${u.email}) — ${u.blacklistReason || "Manual flag for audit"}`,
      entityType: "user",
      entityId: u.id,
      entityLabel: u.email,
      metadata: { status: u.status, reason: u.blacklistReason },
    });
  }
}

// ══════════════════════════════════════════════════════════
//  DETECTORS — ADMIN
// ══════════════════════════════════════════════════════════

registerDetector("admin_mass_action", "Mass Action", "Detects admins modifying >50 records in 10 minutes");
async function detectAdminMassActions() {
  const recentLogs = await prisma.auditLog.findMany({
    where: { createdAt: { gte: hoursAgo(1) } },
  });
  const adminCounts: Record<string, { count: number; tables: Set<string>; lastAction: string }> = {};
  for (const log of recentLogs) {
    if (!adminCounts[log.adminId]) adminCounts[log.adminId] = { count: 0, tables: new Set(), lastAction: "" };
    adminCounts[log.adminId].count++;
    adminCounts[log.adminId].tables.add(log.targetTable);
    adminCounts[log.adminId].lastAction = `${log.action} on ${log.targetTable}`;
  }
  for (const [adminId, info] of Object.entries(adminCounts)) {
    if (info.count > 50) {
      await ensureAlert("admin_mass_action_" + adminId, {
        type: "mass_operation",
        severity: info.count > 200 ? "critical" : "high",
        title: "Mass Admin Action Detected",
        description: `Admin ${adminId} performed ${info.count} actions across [${[...info.tables].join(", ")}] in the last hour`,
        entityType: "admin",
        entityId: adminId,
        entityLabel: adminId,
        metadata: { actionCount: info.count, tables: [...info.tables] },
      });
    }
  }
}

registerDetector("admin_suspicious_action", "Suspicious Action", "Detects admin actions on critical tables outside business hours");
async function detectSuspiciousAdminActions() {
  const now = new Date();
  const hour = now.getHours();
  const isBizHours = hour >= 8 && hour < 20;
  if (isBizHours) return;
  const criticalTables = ["ai_cap_plans", "ai_cap_rules", "user_ai_caps", "offers", "promo_codes", "membership_plans"];
  const suspicious = await prisma.auditLog.findMany({
    where: {
      targetTable: { in: criticalTables },
      createdAt: { gte: hoursAgo(12) },
    },
    orderBy: { createdAt: "desc" },
  });
  const adminActions: Record<string, { count: number; tables: Set<string> }> = {};
  for (const log of suspicious) {
    if (!adminActions[log.adminId]) adminActions[log.adminId] = { count: 0, tables: new Set() };
    adminActions[log.adminId].count++;
    adminActions[log.adminId].tables.add(log.targetTable);
  }
  for (const [adminId, info] of Object.entries(adminActions)) {
    await ensureAlert("admin_suspicious_action_" + adminId, {
      type: "suspicious_admin",
      severity: "medium",
      title: "Suspicious Admin Action (Off-Hours)",
      description: `Admin ${adminId} modified ${[...info.tables].join(", ")} ${info.count} times outside business hours`,
      entityType: "admin",
      entityId: adminId,
      entityLabel: adminId,
      metadata: { actionCount: info.count, tables: [...info.tables], hour },
    });
  }
}

// ══════════════════════════════════════════════════════════
//  DETECTORS — BILLING & TRANSACTIONS
// ══════════════════════════════════════════════════════════

registerDetector("billing_failed_payments", "Failed Payments", "Detects users with >2 failed payments in 24h");
async function detectFailedPayments() {
  const failed = await prisma.membershipTransaction.findMany({
    where: { paymentStatus: "failed", createdAt: { gte: hoursAgo(24) } },
    select: { userId: true, amount: true, planType: true, createdAt: true },
  });
  if (failed.length === 0) return;
  const userFailCounts: Record<string, { count: number; total: number; plans: Set<string> }> = {};
  for (const f of failed) {
    if (!f.userId) continue;
    if (!userFailCounts[f.userId]) userFailCounts[f.userId] = { count: 0, total: 0, plans: new Set() };
    userFailCounts[f.userId].count++;
    userFailCounts[f.userId].total += f.amount;
    if (f.planType) userFailCounts[f.userId].plans.add(f.planType);
  }
  const abusers = Object.entries(userFailCounts).filter(([, info]) => info.count > 2);
  if (abusers.length === 0) return;
  const userIds = abusers.map(([id]) => id);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, email: true },
  });
  const userMap: Record<string, any> = {};
  users.forEach((u) => { userMap[u.id] = u; });
  for (const [userId, info] of abusers) {
    const u = userMap[userId];
    await ensureAlert("billing_failed_payments_" + userId, {
      type: "payment_failure",
      severity: info.count > 5 ? "critical" : "high",
      title: "Recurring Payment Failures",
      description: `${u?.name || userId} had ${info.count} failed payment${info.count > 1 ? "s" : ""} (₹${info.total.toLocaleString()}) in 24h`,
      entityType: "user",
      entityId: userId,
      entityLabel: u?.email || userId,
      metadata: { failedCount: info.count, totalAmount: info.total, plans: [...info.plans] },
    });
  }
}

registerDetector("billing_large_transaction", "Large Transaction", "Detects unusually large transactions");
async function detectLargeTransactions() {
  const allTx = await prisma.membershipTransaction.findMany({
    where: { paymentStatus: "paid", createdAt: { gte: daysAgo(30) } },
    select: { amount: true },
  });
  const amounts = allTx.map((t) => t.amount);
  if (amounts.length < 5) return;
  const mean = amounts.reduce((s, v) => s + v, 0) / amounts.length;
  const stdDev = Math.sqrt(amounts.reduce((s, v) => s + (v - mean) ** 2, 0) / amounts.length);
  const threshold = mean + 3 * stdDev;
  const large = await prisma.membershipTransaction.findMany({
    where: { paymentStatus: "paid", amount: { gt: threshold }, createdAt: { gte: hoursAgo(24) } },
    orderBy: { amount: "desc" },
    select: { id: true, userId: true, amount: true, planType: true },
  });
  if (large.length === 0) return;
  const userIds = large.map((t) => t.userId).filter(Boolean) as string[];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, email: true },
  });
  const userMap: Record<string, any> = {};
  users.forEach((u) => { userMap[u.id] = u; });
  for (const tx of large) {
    if (!tx.userId) continue;
    const u = userMap[tx.userId];
    await ensureAlert("billing_large_transaction_" + tx.id, {
      type: "large_transaction",
      severity: "medium",
      title: "Unusually Large Transaction",
      description: `${u?.name || "Unknown"} made a ₹${tx.amount.toLocaleString()} transaction (${tx.planType || "N/A"}) — ${stdDev > 0 ? ((tx.amount - mean) / stdDev).toFixed(1) : "?"}σ above mean`,
      entityType: "transaction",
      entityId: tx.id,
      entityLabel: u?.email || tx.userId,
      metadata: { amount: tx.amount, mean: Math.round(mean), threshold: Math.round(threshold), planType: tx.planType },
    });
  }
}

registerDetector("billing_rapid_transactions", "Rapid Transactions", "Detects >5 transactions in 5 minutes");
async function detectRapidTransactions() {
  const recent = await prisma.membershipTransaction.findMany({
    where: { createdAt: { gte: hoursAgo(1) } },
    select: { id: true, userId: true, amount: true, paymentStatus: true },
    orderBy: { createdAt: "desc" },
  });
  const userBuckets: Record<string, { count: number; ids: string[]; total: number }> = {};
  for (const tx of recent) {
    if (!tx.userId) continue;
    if (!userBuckets[tx.userId]) userBuckets[tx.userId] = { count: 0, ids: [], total: 0 };
    userBuckets[tx.userId].count++;
    userBuckets[tx.userId].ids.push(tx.id);
    userBuckets[tx.userId].total += tx.amount;
  }
  const rapid = Object.entries(userBuckets).filter(([, info]) => info.count > 5);
  if (rapid.length === 0) return;
  const userIds = rapid.map(([id]) => id);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, email: true },
  });
  const userMap: Record<string, any> = {};
  users.forEach((u) => { userMap[u.id] = u; });
  for (const [userId, info] of rapid) {
    const u = userMap[userId];
    await ensureAlert("billing_rapid_transactions_" + userId, {
      type: "rapid_transaction",
      severity: "high",
      title: "Rapid Transactions Detected",
      description: `${u?.name || userId} made ${info.count} transactions totalling ₹${info.total.toLocaleString()} in the last hour`,
      entityType: "user",
      entityId: userId,
      entityLabel: u?.email || userId,
      metadata: { transactionCount: info.count, totalAmount: info.total },
    });
  }
}

// ══════════════════════════════════════════════════════════
//  DETECTORS — PLAN & CAPPING
// ══════════════════════════════════════════════════════════

registerDetector("cap_repeated_hits", "Repeated Cap Hits", "Detects users hitting their daily cap >5 times in 7 days");
async function detectRepeatedCapHits() {
  const allUsers = await prisma.user.findMany({
    where: { aiDailyCapOverride: { not: null } },
    select: { id: true, name: true, email: true, aiDailyCapOverride: true },
  });
  for (const u of allUsers) {
    if (!u.aiDailyCapOverride || u.aiDailyCapOverride <= 0) continue;
    const summaries = await prisma.aiUsageDailySummary.findMany({
      where: {
        userId: u.id,
        date: { gte: daysAgo(7).toISOString().split("T")[0] },
      },
      select: { date: true, totalTokens: true },
      orderBy: { date: "desc" },
    });
    const hits = summaries.filter((s) => s.totalTokens >= (u.aiDailyCapOverride || 0) * 0.95);
    if (hits.length > 5) {
      await ensureAlert("cap_repeated_hits_" + u.id, {
        type: "cap_abuse",
        severity: hits.length > 10 ? "high" : "medium",
        title: "Repeated Cap Hits",
        description: `${u.name} (${u.email}) hit the daily cap ${hits.length} times in 7 days (cap: ${u.aiDailyCapOverride.toLocaleString()})`,
        entityType: "user",
        entityId: u.id,
        entityLabel: u.email,
        metadata: { capHits: hits.length, dailyCap: u.aiDailyCapOverride, dates: hits.map((h) => h.date) },
      });
    }
  }
}

registerDetector("plan_hopping", "Plan Hopping", "Detects users changing plans >3 times in 30 days");
async function detectPlanHopping() {
  const allLogs = await prisma.membershipLifecycleLog.findMany({
    where: { createdAt: { gte: daysAgo(30) }, eventType: { in: ["upgrade", "downgrade", "activation", "cancellation"] } },
    orderBy: { createdAt: "desc" },
    select: { userId: true, eventType: true, source: true },
  });
  const userChanges: Record<string, number> = {};
  for (const log of allLogs) {
    if (!log.userId) continue;
    userChanges[log.userId] = (userChanges[log.userId] || 0) + 1;
  }
  const hoppers = Object.entries(userChanges).filter(([, count]) => count > 3);
  if (hoppers.length === 0) return;
  const userIds = hoppers.map(([id]) => id);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, email: true, membership: true },
  });
  for (const u of users) {
    const count = userChanges[u.id] || 0;
    await ensureAlert("plan_hopping_" + u.id, {
      type: "plan_hopping",
      severity: count > 6 ? "high" : "low",
      title: "Frequent Plan Changes",
      description: `${u.name} (${u.email}) changed their plan ${count} times in 30 days (current: ${u.membership})`,
      entityType: "user",
      entityId: u.id,
      entityLabel: u.email,
      metadata: { changeCount: count, currentPlan: u.membership },
    });
  }
}

// ══════════════════════════════════════════════════════════
//  DETECTORS — PROMOCODE
// ══════════════════════════════════════════════════════════

registerDetector("promo_bulk_redemption", "Bulk Promo Redemption", "Detects promocodes used >10 times in 1 hour");
async function detectPromoBulkRedemption() {
  const recentOffers = await prisma.offer.findMany({
    where: { createdAt: { gte: hoursAgo(1) } },
    select: { id: true, code: true, userEmail: true },
  });
  const codeCounts: Record<string, { count: number; users: string[] }> = {};
  for (const o of recentOffers) {
    const code = o.code || "unknown";
    if (!codeCounts[code]) codeCounts[code] = { count: 0, users: [] };
    codeCounts[code].count++;
    if (o.userEmail) codeCounts[code].users.push(o.userEmail);
  }
  for (const [code, info] of Object.entries(codeCounts)) {
    if (info.count > 10) {
      await ensureAlert("promo_bulk_redemption_" + code, {
        type: "promo_abuse",
        severity: info.count > 50 ? "critical" : "high",
        title: "Bulk Promo Code Redemption",
        description: `Promo code "${code}" was used ${info.count} times in 1 hour by ${info.users.length} unique users`,
        entityType: "promocode",
        entityId: code,
        entityLabel: code,
        metadata: { redemptionCount: info.count, uniqueUsers: info.users.length, sampleUsers: info.users.slice(0, 10) },
      });
    }
  }
}

// ══════════════════════════════════════════════════════════
//  DETECTORS — API
// ══════════════════════════════════════════════════════════

registerDetector("api_service_health", "Service Health", "Detects services in degraded/down state");
async function detectServiceHealth() {
  const services = await prisma.serviceHealth.findMany({
    where: { status: { in: ["degraded", "down"] } },
  });
  for (const svc of services) {
    await ensureAlert("api_service_health_" + svc.id, {
      type: "api_rate",
      severity: svc.status === "down" ? "critical" : "high",
      title: `Service ${svc.status === "down" ? "Down" : "Degraded"}: ${svc.name}`,
      description: `${svc.name} (${svc.serviceKey}) — uptime: ${svc.uptime}%, latency: ${svc.latencyMs}ms, queue: ${svc.queueJobs}, usage: ${svc.usagePercent}%`,
      entityType: "api",
      entityId: svc.id,
      entityLabel: svc.name,
      metadata: { serviceKey: svc.serviceKey, uptime: svc.uptime, latencyMs: svc.latencyMs, queueJobs: svc.queueJobs, usagePercent: svc.usagePercent },
    });
  }
}

// ══════════════════════════════════════════════════════════
//  MAIN DETECTION ROUTE
// ══════════════════════════════════════════════════════════

export async function POST(req: NextRequest) {
  const session = await getAdminSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const specificDetectors: string[] | undefined = body.detectors;

    const allDetectors: [string, () => Promise<void>][] = [
      ["user_ip_hopping", detectIPHopping],
      ["user_usage_spike", detectUsageSpikes],
      ["user_rate_abuse", detectRateAbuse],
      ["user_status_change", detectUserStatusChanges],
      ["admin_mass_action", detectAdminMassActions],
      ["admin_suspicious_action", detectSuspiciousAdminActions],
      ["billing_failed_payments", detectFailedPayments],
      ["billing_large_transaction", detectLargeTransactions],
      ["billing_rapid_transactions", detectRapidTransactions],
      ["cap_repeated_hits", detectRepeatedCapHits],
      ["plan_hopping", detectPlanHopping],
      ["promo_bulk_redemption", detectPromoBulkRedemption],
      ["api_service_health", detectServiceHealth],
    ];

    const toRun = specificDetectors
      ? allDetectors.filter(([key]) => specificDetectors.includes(key))
      : allDetectors;

    const startedAt = Date.now();
    const results: { detector: string; name: string; status: string; error?: string }[] = [];

    for (const [key, fn] of toRun) {
      const info = DETECTOR_REGISTRY[key];
      try {
        await runDetector(key, fn);
        results.push({ detector: key, name: info?.name || key, status: "ok" });
      } catch (err: any) {
        results.push({ detector: key, name: info?.name || key, status: "error", error: err.message });
      }
    }

    const elapsed = Date.now() - startedAt;

    return NextResponse.json({
      success: true,
      elapsed,
      total: toRun.length,
      ok: results.filter((r) => r.status === "ok").length,
      errors: results.filter((r) => r.status === "error").length,
      results,
    });
  } catch (error: any) {
    console.error("[ANOMALY-DETECT] Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const session = await getAdminSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json({
    success: true,
    detectors: Object.entries(DETECTOR_REGISTRY).map(([key, info]) => ({
      key,
      name: info.name,
      description: info.description,
    })),
  });
}
