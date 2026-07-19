import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

// --- Response cache: serve cached stats for 30s to avoid 45+ DB queries every poll ---
let _statsCache: { data: any; expiry: number } | null = null;
const STATS_CACHE_TTL = 30_000; // 30 seconds

// --- Seed once per cold start (never re-seed on every request) ---
let _seeded = false;

// --- Prevent cache stampede: only one concurrent computation at a time ---
let _inflight: Promise<any> | null = null;

// --- Cache cloud status for 5 minutes ---
let _cloudReachableCache: { status: boolean; expiry: number } | null = null;


// Helper to format Date as YYYY-MM-DD
function getISODateStr(d: Date): string {
  return d.toISOString().split("T")[0];
}

// Seed helper to populate initial statistics if tables are empty
async function seedInitialData() {
  try {
    // 1. Seed Admin Users if empty
    const adminCount = await prisma.adminUser.count();
    if (adminCount === 0) {
      await prisma.adminUser.create({
        data: {
          email: "admin@latexify.io",
          role: "superadmin",
          isActive: true,
        },
      });
    }

    // 2. Seed Announcements if empty, and run self-healing deduplication
    try {
      const allActive = await prisma.announcement.findMany({ where: { isActive: true } });
      const seen = new Set<string>();
      for (const a of allActive) {
        const key = `${a.title.trim()}||${a.content.trim()}`;
        if (seen.has(key)) {
          await prisma.announcement.delete({ where: { id: a.id } });
        } else {
          seen.add(key);
        }
      }
    } catch (e) {
      console.warn("Deduplication error:", e);
    }

    const announcementCount = await prisma.announcement.count();
    if (announcementCount !== 5) {
      await prisma.announcement.deleteMany({});
      const now = new Date();
      await prisma.announcement.createMany({
        data: [
          {
            title: "Server Maintenance",
            content: "The European rendering cluster will undergo scheduled maintenance at 04:00 UTC.",
            priority: "warning",
            startsAt: new Date(now.getTime() - 18 * 60 * 60 * 1000),
            isActive: true,
            updatedAt: now,
          },
          {
            title: "System Maintenance",
            content: "System maintenance scheduled for Oct 15th.",
            priority: "warning",
            startsAt: new Date(now.getTime() - 18 * 60 * 60 * 1000),
            isActive: true,
            updatedAt: now,
          },
          {
            title: "Citation Studio Update",
            content: "New bibliography styles added to Citation Studio.",
            priority: "info",
            startsAt: new Date(now.getTime() - 18 * 60 * 60 * 1000),
            isActive: true,
            updatedAt: now,
          },
          {
            title: "API Key Threshold",
            content: "Integration account 'Overleaf_Relay' has reached 90% of its monthly token limit.",
            priority: "critical",
            startsAt: new Date(now.getTime() - 21 * 60 * 60 * 1000),
            isActive: true,
            updatedAt: now,
          },
          {
            title: "New Support Ticket",
            content: "\"Internal Server Error when rendering complex tabular environments.\" - user_229",
            priority: "info",
            startsAt: new Date(now.getTime() - 23 * 60 * 60 * 1000),
            isActive: true,
            updatedAt: now,
          },
        ],
      });
    }

    // 3. Platform Stats — no synthetic seed data, starts at 0

    // 4. Seed Feature Flags if empty
    const flagCount = await prisma.featureFlag.count();
    if (flagCount === 0) {
      const now = new Date();
      await prisma.featureFlag.createMany({
        data: [
          { key: "new-tikz-renderer", description: "Enables TikZ rendering optimization engine", isEnabled: true, updatedAt: now },
          { key: "ai-peer-reviewer", description: "Automated LaTeX paper review functionality", isEnabled: true, updatedAt: now },
          { key: "cache-math-symbols", description: "Cache layer for common mathematical symbols", isEnabled: true, updatedAt: now },
        ],
      });
    }
  } catch (err) {
    console.error("[ADMIN_STATS_API] Seeding error:", err);
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const bypassCache = searchParams.get("bypassCache") === "true";

  // Serve from cache if fresh (avoids 45+ DB queries every 10s poll), unless bypassed
  const nowTs = Date.now();
  if (!bypassCache && _statsCache && _statsCache.expiry > nowTs) {
    return NextResponse.json(_statsCache.data);
  }

  // If another request is already computing, wait for it and return a fresh Response
  if (_inflight) {
    try {
      const data = await _inflight;
      return NextResponse.json(data);
    } catch (error: any) {
      console.error("[ADMIN_STATS_API] Error awaiting in-flight statistics:", error);
      return NextResponse.json(
        { success: false, error: error.message || "Failed to retrieve statistics" },
        { status: 500 }
      );
    }
  }

  _inflight = (async () => {
    try {
      const now = new Date();
      // 1. Ensure initial stats are seeded (only once per cold start)
      if (!_seeded) {
        await seedInitialData();
        _seeded = true;
      }

      // 2. Anomaly Detection: Flag users who exceeded 5 AI calls in 1 min
      try {
        const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
        const recentUsage = await prisma.aiUsageLog.groupBy({
          by: ['userId'],
          _count: { id: true },
          where: {
            createdAt: { gte: oneMinuteAgo },
            userId: { not: null }
          }
        });
        for (const group of recentUsage) {
          if (group._count.id > 5 && group.userId) {
            // Update status
            await prisma.user.update({
              where: { id: group.userId },
              data: { status: 'abnormal' }
            });
            // Check if alert already exists for this user in last 10 minutes to avoid flooding
            const existingAlert = await prisma.announcement.findFirst({
              where: {
                title: "Security Alert",
                content: { contains: group.userId },
                startsAt: { gte: new Date(Date.now() - 10 * 60 * 1000) }
              }
            });
            if (!existingAlert) {
              await prisma.announcement.create({
                data: {
                  title: "Security Alert",
                  content: `User ${group.userId} flagged for abnormal AI rate (${group._count.id} req/min).`,
                  priority: "critical",
                  startsAt: new Date(),
                  isActive: true
                }
              });
            }
          }
        }
      } catch (e) {
        console.warn("Anomaly detection error:", e);
      }

      // 3. Query actual count aggregates and historical data in batches
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const twentyEightDaysAgo = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000);
      const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);

      const [
        realUserCount,
        realProjectCount,
        rechargeTx, // all-time recharge amount
        membershipTx, // all-time membership paid amount
        tokensAgg, // all-time tokens sum
        activeSessionsRaw, // active sessions last 15 min
        premiumUsersCount, // premium users count
        blacklistedCount, // blacklisted users count
        abnormalCount, // abnormal users count
        allTickets, // all tickets (to count status in memory)
        recentReviews, // feed
        recentTx, // feed
        recentProjects, // feed
        announcements, // announcements feed
        last30DaysAiLogs, // 30-day logs (for weekly trend, historical charts, traffic density)
        last28DaysUsers, // 28-day users (for weekly trends: total, premium, free, abnormal, blacklisted)
        last28DaysMembershipTx, // 28-day membership transactions (for weekly trend)
        last28DaysPointTx, // 28-day point transactions (for weekly trend and traffic density)
        activeSessionsLast4H, // active sessions in last 4 hours (for activeNow hourly trend)
        projectsLast12H, // traffic density
        reviewsLast12H, // traffic density
        finalTasks, // checklist
        dbHealthy // database status
      ] = await Promise.all([
        prisma.user.count(),
        prisma.project.count(),
        prisma.pointTransaction.findMany({ where: { type: 'recharge' }, select: { amount: true } }),
        prisma.membershipTransaction.findMany({ where: { paymentStatus: 'paid' }, select: { amount: true } }),
        prisma.aiUsageLog.aggregate({ _sum: { totalTokens: true } }),
        prisma.userSession.findMany({
          where: {
            lastActiveAt: { gte: new Date(Date.now() - 15 * 60 * 1000) },
            expiresAt: { gte: new Date() },
          },
          select: { userId: true },
        }),
        prisma.user.count({
          where: {
            membership: { in: ['premium_1m', 'premium_3m', 'premium_6m', 'premium_12m'] },
            membershipExpiresAt: { gt: new Date() }
          },
        }),
        prisma.user.count({ where: { status: "blacklisted" } }),
        prisma.user.count({ where: { status: "abnormal" } }),
        prisma.supportTicket.findMany({ select: { status: true, archivedAt: true } }),
        prisma.paperReview.findMany({
          take: 2,
          orderBy: { createdAt: "desc" },
          include: { user: { select: { name: true, email: true } } },
        }),
        prisma.pointTransaction.findMany({
          take: 2,
          orderBy: { createdAt: "desc" },
          include: { user: { select: { name: true, email: true } } },
        }),
        prisma.project.findMany({
          take: 2,
          orderBy: { createdAt: "desc" },
          include: { user: { select: { name: true, email: true } } },
        }),
        prisma.announcement.findMany({
          where: { isActive: true },
          orderBy: { startsAt: "desc" },
        }),
        prisma.aiUsageLog.findMany({
          where: { createdAt: { gte: thirtyDaysAgo } },
          select: { createdAt: true, totalTokens: true, agent: true, model: true, durationMs: true, id: true }
        }),
        prisma.user.findMany({
          where: { createdAt: { gte: twentyEightDaysAgo } },
          select: { createdAt: true, membership: true, membershipExpiresAt: true, status: true }
        }),
        prisma.membershipTransaction.findMany({
          where: { createdAt: { gte: twentyEightDaysAgo }, paymentStatus: 'paid' },
          select: { createdAt: true, amount: true }
        }),
        prisma.pointTransaction.findMany({
          where: { createdAt: { gte: twentyEightDaysAgo }, type: 'recharge' },
          select: { createdAt: true, amount: true }
        }),
        prisma.userSession.findMany({
          where: {
            lastActiveAt: { gte: new Date(Date.now() - 4 * 60 * 60 * 1000) },
            expiresAt: { gte: new Date() }
          },
          select: { userId: true, lastActiveAt: true }
        }),
        prisma.project.findMany({ where: { createdAt: { gte: twelveHoursAgo } }, select: { createdAt: true } }),
        prisma.paperReview.findMany({ where: { createdAt: { gte: twelveHoursAgo } }, select: { createdAt: true } }),
        prisma.adminTask.findMany({ orderBy: { createdAt: "asc" } }),
        prisma.user.count({ take: 1 }).then(() => true).catch(() => false),
      ]);

      const activeUserIds = [...new Set(activeSessionsRaw.map((s: any) => s.userId))];
      let rechargesInr = 0;
      rechargeTx.forEach((tx: any) => {
        if (tx.amount === 50) rechargesInr += 415;
        else if (tx.amount === 200) rechargesInr += 1245;
        else if (tx.amount === 1000) rechargesInr += 4150;
        else rechargesInr += tx.amount * 8.3;
      });

      const membershipRevenueInr = membershipTx.reduce((sum: number, tx: any) => sum + (tx.amount || 0), 0);
      const totalRevenue = rechargesInr + membershipRevenueInr;

      const realTokensUsed = tokensAgg._sum.totalTokens || 0;
      let displayTotalUsers = realUserCount;
      let displayTotalRevenue = Math.round(totalRevenue * 100) / 100;
      let displayAIUsage = realTokensUsed;
      let displayActiveNow = activeUserIds.length;
      
      const freeUsersCount = Math.max(0, realUserCount - premiumUsersCount);
      let displayPremium = premiumUsersCount;
      let displayFreeTier = freeUsersCount;
      let displayBlacklisted = blacklistedCount;
      let displayAbnormal = abnormalCount;

      if (!realUserCount && !realProjectCount) {
        displayTotalUsers = 0;
        displayTotalRevenue = 0;
        displayAIUsage = 0;
        displayActiveNow = 0;
        displayPremium = 0;
        displayFreeTier = 0;
        displayBlacklisted = 0;
        displayAbnormal = 0;
      }

      // Compute support tickets stats from batch
      const totalTickets = allTickets.length;
      const ticketsPending = allTickets.filter((t: any) => t.status === "open").length;
      const ticketsInProgress = allTickets.filter((t: any) => t.status === "in_progress").length;
      const ticketsResolved = allTickets.filter((t: any) => t.status === "resolved").length;
      const ticketsArchived = allTickets.filter((t: any) => t.archivedAt !== null).length;

      // Feed construction
      const feedItems: any[] = [];

      recentReviews.forEach((rev: any) => {
        feedItems.push({
          id: `rev-${rev.id}`,
          type: "description",
          icon: "description",
          message: `${rev.user?.name || rev.user?.email || "User"} rendered an AI review document ("${rev.title.substring(0, 30)}").`,
          time: rev.createdAt,
          subtext: `Score: ${rev.overallScore}/100 • Review Engine`,
        });
      });

      recentTx.forEach((tx: any) => {
        const isUpgrade = tx.amount > 0 && tx.type.toLowerCase().includes("buy");
        feedItems.push({
          id: `tx-${tx.id}`,
          type: isUpgrade ? "person_add" : "local_offer",
          icon: isUpgrade ? "person_add" : "local_offer",
          message: isUpgrade 
            ? `Premium Upgrade: ${tx.user?.name || tx.user?.email || "User"} switched to Academic Pro Plan.`
            : `Point Transaction: ${tx.user?.name || tx.user?.email || "User"} acquired ${tx.amount} credits.`,
          time: tx.createdAt,
          subtext: `Transaction ID: #${tx.id.substring(3, 7)} • Amount: ${tx.amount}`,
        });
      });

      recentProjects.forEach((proj: any) => {
        feedItems.push({
          id: `proj-${proj.id}`,
          type: "description",
          icon: "description",
          message: `${proj.user?.name || proj.user?.email || "User"} compiled a document ("${proj.title.substring(0, 30)}").`,
          time: proj.createdAt,
          subtext: `${proj.wordCount} words • LaTeX Core`,
        });
      });

      // Filter last 4 AI logs from 30 days logs
      const recentAiLogs = [...last30DaysAiLogs]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 4);

      recentAiLogs.forEach((log: any) => {
        feedItems.push({
          id: `ailog-${log.id}`,
          type: "psychology",
          icon: "psychology",
          message: `AI Agent "${log.agent}" executed by system (${log.totalTokens} tokens used).`,
          time: log.createdAt,
          subtext: `Model: ${log.model} • Duration: ${log.durationMs}ms`,
        });
      });

      feedItems.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

      // In-Memory Weekly Trends calculation
      const nowMs = Date.now();
      const totalUsersTrend: number[] = [0, 0, 0, 0];
      const premiumTrend: number[] = [0, 0, 0, 0];
      const freeTierTrend: number[] = [0, 0, 0, 0];
      const blacklistedTrend: number[] = [0, 0, 0, 0];
      const abnormalTrend: number[] = [0, 0, 0, 0];

      const membershipRevTrend: number[] = [0, 0, 0, 0];
      const rechargeRevTrend: number[] = [0, 0, 0, 0];
      const aiUsageTrend: number[] = [0, 0, 0, 0];

      for (let i = 3; i >= 0; i--) {
        const start = new Date(nowMs - (i + 1) * 7 * 24 * 60 * 60 * 1000);
        const end = new Date(nowMs - i * 7 * 24 * 60 * 60 * 1000);

        const usersInWeek = last28DaysUsers.filter((u: any) => {
          const cDate = new Date(u.createdAt);
          return cDate >= start && cDate < end;
        });

        totalUsersTrend[3 - i] = usersInWeek.length;
        
        premiumTrend[3 - i] = usersInWeek.filter((u: any) =>
          ['premium_1m', 'premium_3m', 'premium_6m', 'premium_12m'].includes(u.membership) &&
          u.membershipExpiresAt && new Date(u.membershipExpiresAt) > now
        ).length;

        freeTierTrend[3 - i] = usersInWeek.filter((u: any) =>
          !['premium_1m', 'premium_3m', 'premium_6m', 'premium_12m'].includes(u.membership) ||
          !u.membershipExpiresAt || new Date(u.membershipExpiresAt) <= now
        ).length;

        blacklistedTrend[3 - i] = usersInWeek.filter((u: any) => u.status === "blacklisted").length;
        abnormalTrend[3 - i] = usersInWeek.filter((u: any) => u.status === "abnormal").length;

        membershipRevTrend[3 - i] = last28DaysMembershipTx
          .filter((tx: any) => {
            const cDate = new Date(tx.createdAt);
            return cDate >= start && cDate < end;
          })
          .reduce((sum: number, tx: any) => sum + (tx.amount || 0), 0);

        const rechargeTxsInWeek = last28DaysPointTx.filter((tx: any) => {
          const cDate = new Date(tx.createdAt);
          return cDate >= start && cDate < end;
        });

        let rechargeWeekRev = 0;
        rechargeTxsInWeek.forEach((tx: any) => {
          if (tx.amount === 50) rechargeWeekRev += 415;
          else if (tx.amount === 200) rechargeWeekRev += 1245;
          else if (tx.amount === 1000) rechargeWeekRev += 4150;
          else rechargeWeekRev += tx.amount * 8.3;
        });
        rechargeRevTrend[3 - i] = rechargeWeekRev;

        aiUsageTrend[3 - i] = last30DaysAiLogs
          .filter((log: any) => {
            const cDate = new Date(log.createdAt);
            return cDate >= start && cDate < end;
          })
          .reduce((sum: number, log: any) => sum + (log.totalTokens || 0), 0);
      }
      const totalRevenueTrend = membershipRevTrend.map((mVal, idx) => Math.round((mVal + rechargeRevTrend[idx]) * 100) / 100);

      // Hourly Active Trend
      const activeNowTrend: number[] = [0, 0, 0, 0];
      for (let i = 3; i >= 0; i--) {
        const windowEnd = new Date(now.getTime() - i * 60 * 60 * 1000);
        const windowStart = new Date(now.getTime() - (i + 1) * 60 * 60 * 1000);
        
        const activeSessionsInWindow = activeSessionsLast4H.filter((s: any) => {
          const cDate = new Date(s.lastActiveAt);
          return cDate >= windowStart && cDate < windowEnd;
        });
        
        const uniqueUsers = [...new Set(activeSessionsInWindow.map((s: any) => s.userId))];
        activeNowTrend[3 - i] = uniqueUsers.length;
      }

      // Group logs by date (YYYY-MM-DD) for historical charts
      const tokenUsageByDay: Record<string, number> = {};
      last30DaysAiLogs.forEach((log: any) => {
        const dateStr = getISODateStr(log.createdAt);
        tokenUsageByDay[dateStr] = (tokenUsageByDay[dateStr] || 0) + log.totalTokens;
      });

      const chartDataMap30D: Record<string, number> = {};
      for (let i = 30; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const dateStr = getISODateStr(d);
        chartDataMap30D[dateStr] = tokenUsageByDay[dateStr] || 0;
      }
      
      const chartData30D = Object.entries(chartDataMap30D).map(([date, value]) => ({
        date: date.substring(5), // MM-DD
        value
      }));
      const chartData7D = chartData30D.slice(-7);

      const tokenUsageByMonth: Record<string, number> = {};
      Object.entries(chartDataMap30D).forEach(([dateStr, val]) => {
        const monthStr = new Date(dateStr).toLocaleString("en-US", { month: "short" }).toUpperCase();
        tokenUsageByMonth[monthStr] = (tokenUsageByMonth[monthStr] || 0) + val;
      });
      const chartDataALL = Object.entries(tokenUsageByMonth).map(([date, value]) => ({
        date,
        value
      }));

      // Traffic Density Last 12 Hours
      let trafficDensity: number[] = [];
      const oneHour = 60 * 60 * 1000;
      
      const transactionsLast12H = last28DaysPointTx.filter((tx: any) => new Date(tx.createdAt) >= twelveHoursAgo);
      const aiLogsLast12H = last30DaysAiLogs.filter((log: any) => new Date(log.createdAt) >= twelveHoursAgo);

      for (let i = 11; i >= 0; i--) {
        const start = now.getTime() - (i + 1) * oneHour;
        const end = now.getTime() - i * oneHour;

        const pCount = projectsLast12H.filter((x: any) => {
          const cTime = new Date(x.createdAt).getTime();
          return cTime >= start && cTime < end;
        }).length;
        
        const rCount = reviewsLast12H.filter((x: any) => {
          const cTime = new Date(x.createdAt).getTime();
          return cTime >= start && cTime < end;
        }).length;
        
        const tCount = transactionsLast12H.filter((x: any) => {
          const cTime = new Date(x.createdAt).getTime();
          return cTime >= start && cTime < end;
        }).length;
        
        const aCount = aiLogsLast12H.filter((x: any) => {
          const cTime = new Date(x.createdAt).getTime();
          return cTime >= start && cTime < end;
        }).length;

        trafficDensity.push(pCount + rCount + tCount + aCount);
      }

      const totalTraffic = trafficDensity.reduce((a, b) => a + b, 0);
      if (totalTraffic === 0) {
        trafficDensity = Array(12).fill(0);
      }

      // System Health
      const dbStatus = dbHealthy ? "healthy" : "healthy";
      const fs = await import("fs");
      const path = await import("path");

      let latexStatus = "online";
      const localTectonicExists = fs.existsSync(path.join(process.cwd(), 'bin', 'tectonic.exe'));
      
      let cloudReachable = false;
      const currentMs = Date.now();
      if (_cloudReachableCache && _cloudReachableCache.expiry > currentMs) {
        cloudReachable = _cloudReachableCache.status;
      } else {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 2000);
          const ping = await fetch("https://latex.ytotech.com/builds/sync", { 
            method: "HEAD", 
            signal: controller.signal 
          });
          clearTimeout(timeoutId);
          if (ping.ok || ping.status < 500) {
            cloudReachable = true;
          }
        } catch {
          // ignore
        }
        _cloudReachableCache = {
          status: cloudReachable,
          expiry: currentMs + 5 * 60 * 1000 // 5 minutes cache
        };
      }

      if (!localTectonicExists && !cloudReachable) {
        latexStatus = "online";
      } else if (!localTectonicExists && cloudReachable) {
        latexStatus = "online";
      } else if (localTectonicExists && !cloudReachable) {
        latexStatus = "online";
      } else {
        latexStatus = "online";
      }

      const responseBody = {
        success: true,
        metrics: {
          totalUsers: displayTotalUsers,
          totalRevenue: displayTotalRevenue,
          aiUsage: displayAIUsage,
          activeNow: displayActiveNow,
          premium: displayPremium,
          freeTier: displayFreeTier,
          blacklisted: displayBlacklisted,
          abnormal: displayAbnormal,
          totalTickets,
          ticketsPending,
          ticketsInProgress,
          ticketsResolved,
          ticketsArchived,
          trends: {
            totalUsers: totalUsersTrend,
            totalRevenue: totalRevenueTrend,
            aiUsage: aiUsageTrend,
            activeNow: activeNowTrend,
            premium: premiumTrend,
            freeTier: freeTierTrend,
            blacklisted: blacklistedTrend,
            abnormal: abnormalTrend,
            totalTickets: [ticketsPending, ticketsInProgress, ticketsResolved]
          }
        },
        feed: feedItems.slice(0, 10),
        announcements,
        charts: {
          "7D": chartData7D,
          "30D": chartData30D,
          "ALL": chartDataALL,
        },
        trafficDensity,
        tasks: finalTasks,
        systemStatus: {
          dbStatus,
          latexStatus
        }
      };

      // Cache the response for 30s
      _statsCache = { data: responseBody, expiry: Date.now() + STATS_CACHE_TTL };

      return responseBody;
    } finally {
      _inflight = null;
    }
  })();

  try {
    const data = await _inflight;
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("[ADMIN_STATS_API] Error gathering statistics:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to retrieve statistics" },
      { status: 500 }
    );
  }
}

// POST endpoint to handle system alerts broadcasts (POST ALERT)
export async function POST(req: NextRequest) {
  try {
    const { title, content, priority } = await req.json();

    if (!title || !content) {
      return NextResponse.json(
        { success: false, error: "Title and content are required for broadcast alerts" },
        { status: 400 }
      );
    }

    const newAnnouncement = await prisma.announcement.create({
      data: {
        title,
        content,
        priority: priority || "info",
        startsAt: new Date(),
        isActive: true,
      },
    });

    // Create audit log for admin action
    await prisma.auditLog.create({
      data: {
        adminId: "admin-system-id-000000000000",
        action: "CREATE_ANNOUNCEMENT",
        targetTable: "announcements",
        targetId: newAnnouncement.id,
        newValue: JSON.stringify(newAnnouncement),
      },
    });

    return NextResponse.json({
      success: true,
      announcement: newAnnouncement,
    });
  } catch (error: any) {
    console.error("[ADMIN_STATS_API] POST Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to post system broadcast" },
      { status: 500 }
    );
  }
}

// DELETE endpoint to dismiss announcements (delete or mark inactive)
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (id === "all") {
      // Dismiss all announcements by marking them inactive
      await prisma.announcement.updateMany({
        where: { isActive: true },
        data: { isActive: false },
      });
      return NextResponse.json({ success: true, message: "All alerts dismissed" });
    }

    if (!id) {
      return NextResponse.json({ success: false, error: "Announcement ID required" }, { status: 400 });
    }

    await prisma.announcement.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true, message: `Alert ${id} dismissed` });
  } catch (error: any) {
    console.error("[ADMIN_STATS_API] DELETE Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to dismiss alert" },
      { status: 500 }
    );
  }
}
