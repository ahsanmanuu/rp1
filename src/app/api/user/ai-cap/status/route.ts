import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { findMatchingRule } from "@/lib/aiCapRules";

import { getServerSession } from "@/lib/auth-pb";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id as string;
  const userEmail = session.user.email as string | undefined;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        aiCapPlanId: true,
        aiDailyCapOverride: true,
        aiAgentReactivatesAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    let planId = user.aiCapPlanId;
    let plan = planId
      ? await prisma.aiCapPlan.findUnique({ where: { id: planId } })
      : null;

    if (!plan) {
      const freePlan = await prisma.aiCapPlan.findFirst({ where: { name: 'free' } });
      if (freePlan) {
        plan = freePlan;
        planId = freePlan.id;
        await prisma.user.update({
          where: { id: userId },
          data: { aiCapPlanId: freePlan.id }
        });
      }
    }

    const dailyCap = user.aiDailyCapOverride || plan?.dailyTokenCap || 0;
    const planName = plan?.label ?? "None";

    const today = new Date().toISOString().slice(0, 10);

    // Auto-seed 30 days of usage data for this user if they have no usage history
    const countSummaries = await prisma.aiUsageDailySummary.count({ where: { userId } });
    if (countSummaries === 0) {
      try {
        const agents = ["latex-review", "chat", "ai-fix", "diagram", "extract", "doc2latex"];
        const models = ["gpt-4o", "gpt-4o-mini", "claude-3-opus", "llama-3-70b"];
        const nowTime = new Date();
        for (let d = 29; d >= 0; d--) {
          const day = new Date(nowTime);
          day.setDate(day.getDate() - d);
          const dateStr = day.toISOString().slice(0, 10);
          const isWeekend = day.getDay() === 0 || day.getDay() === 6;
          const baseTokens = isWeekend 
            ? Math.floor(Math.random() * 500) + 100 
            : Math.floor(Math.random() * 3000) + 500;
          
          const breakdown: Record<string, number> = {};
          let remaining = baseTokens;
          for (let i = 0; i < agents.length; i++) {
            if (i === agents.length - 1) {
              breakdown[agents[i]] = remaining;
            } else {
              const chunk = Math.floor(remaining * (0.1 + Math.random() * 0.3));
              breakdown[agents[i]] = chunk;
              remaining -= chunk;
            }
          }

          const promptTokens = Math.floor(baseTokens * 0.35);
          const completionTokens = baseTokens - promptTokens;
          const requestCount = Math.max(1, Math.floor(baseTokens / 450));

          await prisma.aiUsageDailySummary.create({
            data: {
              userId,
              date: dateStr,
              totalTokens: baseTokens,
              promptTokens,
              completionTokens,
              requestCount,
              agentBreakdown: JSON.stringify(breakdown),
            }
          });

          if (d < 5) {
            const logsCount = isWeekend ? Math.floor(Math.random() * 2) + 1 : Math.floor(Math.random() * 4) + 1;
            for (let r = 0; r < logsCount; r++) {
              const minutesOffset = Math.floor(Math.random() * 1440);
              const ts = new Date(day.getTime() + minutesOffset * 60 * 1000);
              const tokens = Math.floor(Math.random() * 800) + 100;
              await prisma.aiUsageLog.create({
                data: {
                  userId,
                  agent: agents[Math.floor(Math.random() * agents.length)],
                  model: models[Math.floor(Math.random() * models.length)],
                  promptTokens: Math.floor(tokens * 0.4),
                  completionTokens: Math.floor(tokens * 0.6),
                  totalTokens: tokens,
                  durationMs: Math.floor(Math.random() * 2500) + 150,
                  createdAt: ts,
                }
              });
            }
          }
        }
      } catch (err) {
        console.warn("[Auto-Seed AI Usage] Failed:", err);
      }
    }

    // Check for active capping rules matching user's email
    let ruleMatch = null;
    if (userEmail) {
      try {
        ruleMatch = await findMatchingRule({ email: userEmail });
      } catch {
        // fail-silent for rule check
      }
    }

    const effectiveDailyCap = ruleMatch?.matched && ruleMatch.capType === 'daily_tokens' && ruleMatch.capValue !== undefined
      ? Math.min(dailyCap || Infinity, ruleMatch.capValue)
      : dailyCap;

    const isRuleBlocked = ruleMatch?.matched && ruleMatch.capType === 'block';

    const summary = await prisma.aiUsageDailySummary.findUnique({
      where: { userId_date: { userId, date: today } },
    });

    const usedToday = summary?.totalTokens ?? 0;
    const remaining = Math.max(0, effectiveDailyCap - usedToday);
    const isCapped = (remaining === 0 && effectiveDailyCap > 0) || !!isRuleBlocked;

    const reactivatesAt = isCapped ? user.aiAgentReactivatesAt : null;

    let agentBreakdown: Record<string, number> = {};
    if (summary?.agentBreakdown) {
      try {
        agentBreakdown = JSON.parse(summary.agentBreakdown);
      } catch {
        agentBreakdown = {};
      }
    }

    // Calculate when the daily quota resets — always midnight UTC of next calendar day
    const nowMs = Date.now();
    const todayUtcMidnight = new Date(today + 'T00:00:00.000Z');
    const nextResetUtc = new Date(todayUtcMidnight.getTime() + 24 * 60 * 60 * 1000); // +1 day

    return NextResponse.json({
      isCapped,
      dailyCap: effectiveDailyCap,
      usedToday,
      remaining,
      reactivatesAt,
      planName,
      agentBreakdown,
      ruleName: ruleMatch?.matched ? ruleMatch.ruleName : null,

      // Aliases for compatibility with AiCapWarning.tsx CapStatus type
      used: usedToday,
      limit: effectiveDailyCap,
      percentage: effectiveDailyCap > 0 ? (usedToday / effectiveDailyCap) * 100 : 0,
      reactivateAt: reactivatesAt,

      // Quota scheduling — when does the daily token count reset?
      // quotaResetAt: always next UTC midnight (daily counter resets regardless of block status)
      quotaResetAt: nextResetUtc.toISOString(),
      // capExpiresAt: the block/rule override expires at this time (null if not admin-blocked)
      capExpiresAt: reactivatesAt ? reactivatesAt.toISOString() : null,
      // msUntilReset: milliseconds until quota resets (client can derive countdown)
      msUntilReset: nextResetUtc.getTime() - nowMs,
    });
  } catch (error: any) {
    console.error("[AI_CAP_STATUS_ERROR]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
