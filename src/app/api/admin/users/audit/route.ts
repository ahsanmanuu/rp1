import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSessionFromRequest } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getAdminSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "User ID is required" }, { status: 400 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        status: true,
        blockedUntil: true,
        blacklistReason: true,
      }
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // 1. IP & Session Activity Audit
    const sessionActivities = await prisma.userSessionActivity.findMany({
      where: { userId, createdAt: { gte: oneDayAgo } },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    const uniqueIps = new Set(sessionActivities.map(a => a.ipAddress));
    const uniqueLocations = new Set(sessionActivities.map(a => a.location).filter(Boolean));

    let securityStatus = "clean";
    let securityMessage = "No security alerts in the past 24 hours.";
    
    if (uniqueIps.size > 5 || uniqueLocations.size > 3) {
      securityStatus = "critical";
      securityMessage = `Multiple simultaneous sessions detected: ${uniqueIps.size} distinct IPs across ${uniqueLocations.size} regions.`;
    } else if (uniqueIps.size > 2 || uniqueLocations.size > 1) {
      securityStatus = "warning";
      securityMessage = `IP hopping flagged: ${uniqueIps.size} distinct IPs detected.`;
    }

    // 2. AI Token / Prompt Usage Anomaly
    const aiLogs = await prisma.aiUsageLog.findMany({
      where: { userId, createdAt: { gte: oneDayAgo } },
      select: { totalTokens: true }
    });

    const aiRequestsCount = aiLogs.length;
    const totalAiTokens = aiLogs.reduce((sum, log) => sum + log.totalTokens, 0);

    let aiStatus = "clean";
    let aiMessage = "AI API resource usage levels normal.";

    if (totalAiTokens > 500000 || aiRequestsCount > 100) {
      aiStatus = "critical";
      aiMessage = `AI resource exploitation flagged: ${aiRequestsCount} calls, ${totalAiTokens.toLocaleString()} tokens in 24h.`;
    } else if (totalAiTokens > 200000 || aiRequestsCount > 50) {
      aiStatus = "warning";
      aiMessage = `Elevated AI consumption: ${totalAiTokens.toLocaleString()} tokens.`;
    }

    // 3. Tool Usage Rate Limits
    const toolLogs = await prisma.toolUsageLog.findMany({
      where: { userId, createdAt: { gte: oneDayAgo } },
      select: { toolName: true, action: true }
    });

    let toolStatus = "clean";
    let toolMessage = "Tool operations normal.";

    if (toolLogs.length > 50) {
      toolStatus = "warning";
      toolMessage = `High frequency tool operations detected: ${toolLogs.length} actions in 24h.`;
    }

    // 4. Financial & Transaction Logs
    const recentTransactions = await prisma.pointTransaction.findMany({
      where: { userId, createdAt: { gte: oneDayAgo } },
      orderBy: { createdAt: "desc" },
      take: 5
    });

    let billingStatus = "clean";
    let billingMessage = "No financial transaction warnings.";

    const failedCount = recentTransactions.filter(t => t.type === 'failed').length;
    const refundsCount = recentTransactions.filter(t => t.type === 'refund').length;

    if (failedCount > 2) {
      billingStatus = "critical";
      billingMessage = `Multiple failed payment attempts detected: ${failedCount} failures in 24h.`;
    } else if (refundsCount > 0) {
      billingStatus = "warning";
      billingMessage = `Refund history present: ${refundsCount} refund(s) processed.`;
    }

    // Determine overall user health risk
    let overallRisk = "Low Risk";
    if (securityStatus === "critical" || aiStatus === "critical" || billingStatus === "critical" || user.status === "abnormal") {
      overallRisk = "High Risk";
    } else if (securityStatus === "warning" || aiStatus === "warning" || toolStatus === "warning" || billingStatus === "warning") {
      overallRisk = "Medium Risk";
    }

    return NextResponse.json({
      success: true,
      audit: {
        userId,
        overallRisk,
        security: {
          status: securityStatus,
          message: securityMessage,
          uniqueIps: uniqueIps.size,
          uniqueLocations: uniqueLocations.size,
          recent: sessionActivities.slice(0, 3).map(a => ({
            ip: a.ipAddress,
            location: a.location || "Unknown",
            time: a.createdAt
          }))
        },
        ai: {
          status: aiStatus,
          message: aiMessage,
          requests: aiRequestsCount,
          tokens: totalAiTokens
        },
        tools: {
          status: toolStatus,
          message: toolMessage,
          count: toolLogs.length
        },
        billing: {
          status: billingStatus,
          message: billingMessage,
          recent: recentTransactions.map(t => ({
            amount: t.amount,
            type: t.type,
            time: t.createdAt
          }))
        }
      }
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
