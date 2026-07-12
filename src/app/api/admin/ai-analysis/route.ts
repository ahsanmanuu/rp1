import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSessionFromRequest } from "@/lib/adminAuth";
import { seedAiCapsDemoData } from "@/lib/seedAiCaps";

export const dynamic = 'force-dynamic';

// ── Helpers ────────────────────────────────────────────────────────────────

/** Estimate revenue (INR) from a point recharge transaction */
function estimateRevenue(amount: number): number {
  if (amount === 50) return 415;
  if (amount === 200) return 1245;
  if (amount === 1000) return 4150;
  return amount * 8.3;
}

/** Build a date-range lookup key = YYYY-MM-DD */
function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ── Route ──────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const session = await getAdminSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Seed demo AI usage data if empty
  await seedAiCapsDemoData();

  try {
    const now = new Date();
    const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);

    // ===================================================================
    // 1. FISCAL ANALYSIS
    // ===================================================================

    // Total AI Revenue from point recharges
    const rechargeTx = await prisma.pointTransaction.findMany({
      where: { type: 'recharge' },
      select: { amount: true, createdAt: true },
    });
    let totalAiRevenue = 0;
    const revenueByPlan: Record<string, number> = {};
    for (const tx of rechargeTx) {
      const rev = estimateRevenue(tx.amount);
      totalAiRevenue += rev;
    }

    // Revenue from membership subscriptions
    const paidMemberships = await prisma.membershipTransaction.findMany({
      where: { paymentStatus: 'paid' },
      select: { amount: true, planType: true, createdAt: true },
    });
    let totalMembershipRevenue = 0;
    for (const m of paidMemberships) {
      totalMembershipRevenue += m.amount;
      const key = m.planType || 'unknown';
      revenueByPlan[key] = (revenueByPlan[key] || 0) + m.amount;
    }

    const totalRevenue = totalAiRevenue + totalMembershipRevenue;

    // Token consumption & infrastructure cost
    const tokensAgg = await prisma.aiUsageLog.aggregate({
      _sum: { totalTokens: true },
    });
    const totalTokensUsed = tokensAgg._sum.totalTokens || 0;
    const infrastructureCost = (totalTokensUsed / 1_000_000) * 10 * 83; // $10/1M tokens → INR
    const netMargin = totalRevenue > 0
      ? ((totalRevenue - infrastructureCost) / totalRevenue) * 100
      : 0; // zero revenue → zero margin, not 100%

    // Revenue trend (last 30 days)
    const revenueTrend: { date: string; revenue: number; cost: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = daysAgo(i);
      const key = dateKey(d);
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const dayEnd = new Date(dayStart.getTime() + 86_400_000);

      const dayRecharges = rechargeTx.filter((tx: any) => {
        const t = new Date(tx.createdAt);
        return t >= dayStart && t < dayEnd;
      });
      const dayRevenue = dayRecharges.reduce((s: any, tx: any) => s + estimateRevenue(tx.amount), 0);

      const dayMemberships = paidMemberships.filter((m: any) => {
        const t = new Date(m.createdAt);
        return t >= dayStart && t < dayEnd;
      });
      const dayMRev = dayMemberships.reduce((s: any, m: any) => s + m.amount, 0);

      const dayTokens = await prisma.aiUsageLog.aggregate({
        where: { createdAt: { gte: dayStart, lt: dayEnd } },
        _sum: { totalTokens: true },
      });
      const dt = dayTokens._sum.totalTokens || 0;
      const dayCost = (dt / 1_000_000) * 10 * 83;

      revenueTrend.push({
        date: key,
        revenue: Math.round(dayRevenue + dayMRev),
        cost: Math.round(dayCost),
      });
    }

    // Revenue by plan type (for pie chart)
    const revenueByPlanArr = Object.entries(revenueByPlan).map(([plan, rev]) => ({
      plan,
      revenue: Math.round(rev),
    }));

    // ===================================================================
    // 2. RETENTION PREDICTOR
    // ===================================================================

    const totalUsers = await prisma.user.count();

    // Users active in last 30 days (have AiUsageLog entries)
    const thirtyDaysAgo = daysAgo(30);
    const activeUserIds30d = await prisma.aiUsageLog.groupBy({
      by: ['userId'],
      where: { createdAt: { gte: thirtyDaysAgo }, userId: { not: null } },
      _count: { id: true },
    });
    const activeUsers30d = activeUserIds30d.length;

    // Users with sessions in last 30 days
    const usersWithSessions30d = await prisma.userSession.groupBy({
      by: ['userId'],
      where: { createdAt: { gte: thirtyDaysAgo } },
    });

    const combinedActive30d = new Set([
      ...activeUserIds30d.map((u: any) => u.userId).filter(Boolean),
      ...usersWithSessions30d.map((u: any) => u.userId),
    ]);

    // Churned: users registered >30 days ago but no activity in last 30 days
    const thirtyDaysAgoDate = new Date(thirtyDaysAgo.getTime());
    const usersBefore30d = await prisma.user.count({
      where: { createdAt: { lt: thirtyDaysAgoDate } },
    });
    const churnedUsers30d = Math.max(0, usersBefore30d - combinedActive30d.size);

    // New users in last 30 days
    const newUsers30d = await prisma.user.count({
      where: { createdAt: { gte: thirtyDaysAgoDate } },
    });

    // Retention score = (active unique users in last 30d) / (total users registered >30d ago) * 100
    // If no users registered >30d ago, default to 100
    const retentionScore = usersBefore30d > 0
      ? Math.round((combinedActive30d.size / usersBefore30d) * 100)
      : 100;

    // Retention trend (last 30 days, 7-day rolling window)
    const retentionTrend: { date: string; score: number }[] = [];
    for (let i = 29; i >= 6; i--) {
      const windowEnd = daysAgo(i - 7);
      const windowStart = daysAgo(i + 7);

      const windowActive = await prisma.aiUsageLog.groupBy({
        by: ['userId'],
        where: {
          createdAt: { gte: windowStart, lt: windowEnd },
          userId: { not: null },
        },
      });

      const usersBeforeWindow = await prisma.user.count({
        where: { createdAt: { lt: windowStart } },
      });

      const score = usersBeforeWindow > 0
        ? Math.round((windowActive.length / usersBeforeWindow) * 100)
        : 100;

      retentionTrend.push({
        date: dateKey(windowStart),
        score,
      });
    }

    // ===================================================================
    // 3. POWER USER TRENDS
    // ===================================================================

    const powerUserGroups = await prisma.aiUsageLog.groupBy({
      by: ['userId'],
      _sum: { totalTokens: true, promptTokens: true, completionTokens: true },
      _count: { id: true },
      orderBy: { _sum: { totalTokens: 'desc' } },
      take: 10,
    });

    const puIds = powerUserGroups.map((g: any) => g.userId).filter((id: any): id is string => !!id);
    const puUsers = await prisma.user.findMany({
      where: { id: { in: puIds } },
      select: { id: true, name: true, email: true, membership: true, points: true, createdAt: true },
    });
    const puMap: Record<string, any> = {};
    puUsers.forEach((u: any) => { puMap[u.id] = u; });

    // Last active date for each power user
    const puLastActiveRaw = await Promise.all(
      puIds.map((id: any) =>
        prisma.aiUsageLog.findFirst({
          where: { userId: id },
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true },
        })
      )
    );
    const puLastActive: Record<string, Date | null> = {};
    puLastActiveRaw.forEach((r, i) => {
      puLastActive[puIds[i]] = r?.createdAt || null;
    });

    const powerUsers = powerUserGroups
      .map((g: any) => {
        if (!g.userId || !puMap[g.userId]) return null;
        return {
          id: g.userId,
          name: puMap[g.userId].name || 'Unnamed Scholar',
          email: puMap[g.userId].email,
          plan: puMap[g.userId].membership,
          points: puMap[g.userId].points,
          totalTokens: g._sum.totalTokens || 0,
          promptTokens: g._sum.promptTokens || 0,
          completionTokens: g._sum.completionTokens || 0,
          requestCount: g._count.id,
          lastActive: puLastActive[g.userId]?.toISOString() || null,
        };
      })
      .filter(Boolean);

    // ===================================================================
    // 4. ANOMALY DETECTION
    // ===================================================================

    const flaggedUsers = await prisma.user.findMany({
      where: { status: { in: ['abnormal', 'blacklisted'] } },
      take: 20,
      select: { id: true, name: true, email: true, status: true, updatedAt: true, blacklistReason: true },
      orderBy: { updatedAt: 'desc' },
    });

    // Detect usage spikes: users with >3σ from mean daily tokens
    const dailyStats = await prisma.aiUsageLog.groupBy({
      by: ['userId'],
      where: { createdAt: { gte: daysAgo(7) }, userId: { not: null } },
      _sum: { totalTokens: true },
    });
    const dailyTotals = dailyStats.map((d: any) => d._sum.totalTokens || 0).filter(Boolean);
    const mean = dailyTotals.length > 0
      ? dailyTotals.reduce((s: any, v: any) => s + v, 0) / dailyTotals.length
      : 0;
    const stdDev = dailyTotals.length > 1
      ? Math.sqrt(dailyTotals.reduce((s: any, v: any) => s + (v - mean) ** 2, 0) / dailyTotals.length)
      : 0;
    const spikeThreshold = mean + 3 * stdDev;

    const spikeUsers = dailyStats.filter((d: any) => (d._sum.totalTokens || 0) > spikeThreshold && d.userId);
    const spikeUserIds = spikeUsers.map((u: any) => u.userId).filter(Boolean) as string[];
    const spikeUserDetails = spikeUserIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: spikeUserIds } },
          select: { id: true, name: true, email: true },
        })
      : [];
    const spikeMap: Record<string, any> = {};
    spikeUserDetails.forEach((u: any) => { spikeMap[u.id] = u; });

    const anomalies: any[] = [];

    // Flagged users
    for (const fu of flaggedUsers) {
      anomalies.push({
        type: fu.status === 'blacklisted' ? 'security' : 'behavioral',
        severity: fu.status === 'blacklisted' ? 'high' : 'medium',
        title: `User ${fu.status === 'blacklisted' ? 'Blacklisted' : 'Flagged'}`,
        description: `${fu.name} (${fu.email}) — ${fu.blacklistReason || 'Manual flag for audit'}`,
        userId: fu.id,
        timestamp: fu.updatedAt.toISOString(),
      });
    }

    // Usage spikes
    for (const su of spikeUsers) {
      if (!su.userId) continue;
      const ud = spikeMap[su.userId];
      anomalies.push({
        type: 'usage_spike',
        severity: 'medium',
        title: 'Usage Spike Detected',
        description: `${ud?.name || 'Unknown'} consumed ${(su._sum.totalTokens || 0).toLocaleString()} tokens in 7 days (${(su._sum.totalTokens || 0) > mean * 5 ? '5× above avg' : '3× above avg'})`,
        userId: su.userId,
        timestamp: now.toISOString(),
      });
    }

    // Detect IP-hopping (users with sessions from multiple distinct locations)
    const multiLocationUsers = await prisma.userSession.groupBy({
      by: ['userId'],
      where: { createdAt: { gte: daysAgo(7) } },
      _count: { location: true },
      having: { location: { _count: { gt: 3 } } },
    });
    const multiLocIds = multiLocationUsers.map((u: any) => u.userId).filter(Boolean) as string[];
    if (multiLocIds.length > 0) {
      const multiLocDetails = await prisma.user.findMany({
        where: { id: { in: multiLocIds } },
        select: { id: true, name: true, email: true },
      });
      for (const ml of multiLocDetails) {
        anomalies.push({
          type: 'ip_hopping',
          severity: 'low',
          title: 'IP Hopping Detected',
          description: `${ml.name} (${ml.email}) logged in from 4+ locations in 7 days`,
          userId: ml.id,
          timestamp: now.toISOString(),
        });
      }
    }

    anomalies.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // ===================================================================
    // 5. CHARTS & TRENDS
    // ===================================================================

    // 30-day token trend
    const tokenTrend30d: { date: string; totalTokens: number; requestCount: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = daysAgo(i);
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const dayEnd = new Date(dayStart.getTime() + 86_400_000);
      const dayData = await prisma.aiUsageLog.aggregate({
        where: { createdAt: { gte: dayStart, lt: dayEnd } },
        _sum: { totalTokens: true },
        _count: { id: true },
      });
      tokenTrend30d.push({
        date: dateKey(dayStart),
        totalTokens: dayData._sum.totalTokens || 0,
        requestCount: dayData._count.id,
      });
    }

    // Token consumption by agent
    const agentGroups = await prisma.aiUsageLog.groupBy({
      by: ['agent'],
      _sum: { totalTokens: true },
      _count: { id: true },
      orderBy: { _sum: { totalTokens: 'desc' } },
    });
    const tokenByAgent = agentGroups.map((g: any) => ({
      agent: g.agent || 'unknown',
      tokens: g._sum.totalTokens || 0,
      requests: g._count.id,
    }));

    // Per-agent token consumption by user (all studios)
    const AGENT_LABELS: Record<string, string> = {
      'chat': 'LaTeXify Studio',
      'reviewer': 'AI Peer Reviewer',
      'diagram': 'AI Diagram Studio',
      'extract': 'Citation Studio',
      'ai-fix': 'Template Migrator',
      'doc2latex': 'Doc2LaTeX Studio',
    };
    const AGENT_KEYS = Object.keys(AGENT_LABELS);
    const allAgentUserGroups = await prisma.aiUsageLog.groupBy({
      by: ['agent', 'userId'],
      where: { agent: { in: AGENT_KEYS }, userId: { not: null } },
      _sum: { totalTokens: true, promptTokens: true, completionTokens: true },
      _count: { id: true },
    });
    // Collect all unique userIds across all agents
    const allAgentUserIds = [...new Set(allAgentUserGroups.map((g: any) => g.userId).filter(Boolean))] as string[];
    const allAgentUsers = allAgentUserIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: allAgentUserIds } },
          select: { id: true, name: true, email: true },
        })
      : [];
    const allAgentUserMap: Record<string, any> = {};
    allAgentUsers.forEach((u: any) => { allAgentUserMap[u.id] = u; });

    const agentUsageByUser: Record<string, { userId: string; name: string; email: string; totalTokens: number; promptTokens: number; completionTokens: number; requestCount: number; share: number }[]> = {};
    const agentTotals: Record<string, number> = {};
    for (const agent of AGENT_KEYS) {
      const groups = allAgentUserGroups.filter((g: any) => g.agent === agent && g.userId);
      const totalTokens = groups.reduce((s: any, g: any) => s + (g._sum.totalTokens || 0), 0);
      agentTotals[agent] = totalTokens;
      agentUsageByUser[agent] = groups.map((g: any) => {
        const u = allAgentUserMap[g.userId!];
        return {
          userId: g.userId!,
          name: u?.name || 'Unknown',
          email: u?.email || '',
          totalTokens: g._sum.totalTokens || 0,
          promptTokens: g._sum.promptTokens || 0,
          completionTokens: g._sum.completionTokens || 0,
          requestCount: g._count.id,
          share: totalTokens > 0 ? Math.round(((g._sum.totalTokens || 0) / totalTokens) * 100) : 0,
        };
      });
    }

    // Token consumption by model
    const modelGroups = await prisma.aiUsageLog.groupBy({
      by: ['model'],
      _sum: { totalTokens: true },
      _count: { id: true },
      orderBy: { _sum: { totalTokens: 'desc' } },
    });
    const tokenByModel = modelGroups.map((g: any) => ({
      model: g.model || 'unknown',
      tokens: g._sum.totalTokens || 0,
      requests: g._count.id,
    }));

    // Daily active users trend (last 30 days)
    const dailyActiveUsers: { date: string; count: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = daysAgo(i);
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const dayEnd = new Date(dayStart.getTime() + 86_400_000);
      const dayUsers = await prisma.aiUsageLog.groupBy({
        by: ['userId'],
        where: { createdAt: { gte: dayStart, lt: dayEnd }, userId: { not: null } },
      });
      dailyActiveUsers.push({
        date: dateKey(dayStart),
        count: dayUsers.length,
      });
    }

    // ===================================================================
    // 6. SUPPLEMENTARY
    // ===================================================================

    const activeSessions = await prisma.userSession.count({
      where: { expiresAt: { gte: now } },
    });

    const recentLogs30d = await prisma.aiUsageLog.count({
      where: { createdAt: { gte: thirtyDaysAgo } },
    });

    // ===================================================================
    // RESPONSE
    // ===================================================================

    return NextResponse.json({
      success: true,
      stats: {
        // Fiscal
        totalAiRevenue: Math.round(totalAiRevenue),
        totalMembershipRevenue: Math.round(totalMembershipRevenue),
        totalRevenue: Math.round(totalRevenue),
        totalTokensUsed,
        infrastructureCost: Math.round(infrastructureCost),
        netMargin: Math.round(netMargin * 100) / 100,
        revenueByPlan: revenueByPlanArr,
        revenueTrend,

        // Retention
        retentionScore,
        totalUsers,
        activeSessions,
        activeUsers30d: combinedActive30d.size,
        churnedUsers30d,
        newUsers30d,
        retentionTrend,

        // Power users
        powerUsers,

        // Anomalies
        flaggedUsers,
        anomalies,

        // Charts
        tokenTrend30d,
        tokenByAgent,
        tokenByModel,
        dailyActiveUsers,

        // Per-agent user breakdown (all studios)
        agentUsageByUser,
        agentTotals,
        AGENT_LABELS,

        // Supplementary
        recentLogs30d,
      },
    });
  } catch (error: any) {
    console.error('[AI-ANALYSIS] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
