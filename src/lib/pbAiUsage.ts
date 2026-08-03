import { prisma } from "@/lib/prisma";
import { pbAdmin } from "@/lib/pb";

let _usageColsEnsured = false;

/**
 * Idempotent migration to ensure PocketBase has `ai_usage_logs` and `ai_usage_daily_summaries`
 * collections with open read rules so client WebSockets receive realtime usage updates.
 */
export async function ensureAiUsageCollections(): Promise<void> {
  if (_usageColsEnsured) return;
  try {
    const admPb = await pbAdmin();

    // 1. Ensure ai_usage_logs collection exists
    const logsCol = await admPb.collections.getOne("ai_usage_logs").catch(() => null);
    if (!logsCol) {
      await admPb.collections.create({
        name: "ai_usage_logs",
        type: "base",
        listRule: "",
        viewRule: "",
        createRule: "",
        fields: [
          { name: "userId", type: "text", required: false },
          { name: "agent", type: "text", required: true },
          { name: "model", type: "text" },
          { name: "promptTokens", type: "number" },
          { name: "completionTokens", type: "number" },
          { name: "totalTokens", type: "number" },
          { name: "durationMs", type: "number" },
        ],
        indexes: [
          "CREATE INDEX idx_aul_user ON ai_usage_logs (userId);",
          "CREATE INDEX idx_aul_agent ON ai_usage_logs (agent);",
        ],
      });
      console.log("[PB_AI_USAGE] Created ai_usage_logs collection in PocketBase");
    } else {
      if ((logsCol as any).listRule !== "" || (logsCol as any).viewRule !== "") {
        await admPb.collections.update(logsCol.id, { listRule: "", viewRule: "", createRule: "" }).catch(() => {});
      }
    }

    // 2. Ensure ai_usage_daily_summaries collection exists
    const summaryCol = await admPb.collections.getOne("ai_usage_daily_summaries").catch(() => null);
    if (!summaryCol) {
      await admPb.collections.create({
        name: "ai_usage_daily_summaries",
        type: "base",
        listRule: "",
        viewRule: "",
        createRule: "",
        updateRule: "",
        fields: [
          { name: "userId", type: "text", required: true },
          { name: "date", type: "text", required: true },
          { name: "totalTokens", type: "number" },
          { name: "promptTokens", type: "number" },
          { name: "completionTokens", type: "number" },
          { name: "requestCount", type: "number" },
          { name: "agentBreakdown", type: "text" },
        ],
        indexes: [
          "CREATE UNIQUE INDEX idx_auds_user_date ON ai_usage_daily_summaries (userId, date);",
        ],
      });
      console.log("[PB_AI_USAGE] Created ai_usage_daily_summaries collection in PocketBase");
    } else {
      if ((summaryCol as any).listRule !== "" || (summaryCol as any).viewRule !== "") {
        await admPb.collections.update(summaryCol.id, { listRule: "", viewRule: "", createRule: "", updateRule: "" }).catch(() => {});
      }
    }

    _usageColsEnsured = true;
  } catch (err: any) {
    console.warn("[PB_AI_USAGE] Collection setup warning (non-fatal):", err?.message);
  }
}

/**
 * Logs AI token usage to Prisma database AND syncs to PocketBase in realtime.
 * Triggers PocketBase WebSocket event so client dashboard components instantly update.
 */
export async function logAndSyncAiUsage(
  userId: string | null,
  agent: string,
  model: string,
  durationMs: number,
  promptTokens: number,
  completionTokens: number,
  totalTokens?: number
): Promise<void> {
  const totTokens = totalTokens ?? (promptTokens + completionTokens);
  const today = new Date().toISOString().slice(0, 10);

  // ── 1. Save to Prisma DB ──
  try {
    await prisma.aiUsageLog.create({
      data: {
        userId,
        agent,
        model,
        promptTokens,
        completionTokens,
        totalTokens: totTokens,
        durationMs,
      },
    });

    if (userId) {
      const existing = await prisma.aiUsageDailySummary.findUnique({
        where: { userId_date: { userId, date: today } },
        select: { agentBreakdown: true },
      });

      const prevBreakdown = existing ? JSON.parse(existing.agentBreakdown || '{}') : {};
      prevBreakdown[agent] = (prevBreakdown[agent] || 0) + totTokens;

      await prisma.aiUsageDailySummary.upsert({
        where: { userId_date: { userId, date: today } },
        update: {
          totalTokens: { increment: totTokens },
          promptTokens: { increment: promptTokens },
          completionTokens: { increment: completionTokens },
          requestCount: { increment: 1 },
          agentBreakdown: JSON.stringify(prevBreakdown),
        },
        create: {
          userId,
          date: today,
          totalTokens: totTokens,
          promptTokens,
          completionTokens,
          requestCount: 1,
          agentBreakdown: JSON.stringify(prevBreakdown),
        },
      });
    }
  } catch (prismaErr) {
    console.warn('[PB_AI_USAGE] Prisma save warning:', prismaErr);
  }

  // ── 2. Sync to PocketBase (Fires Realtime WebSocket to Client Dashboards) ──
  try {
    await ensureAiUsageCollections();
    const admPb = await pbAdmin();

    // Log detail record in PocketBase
    await admPb.collection("ai_usage_logs").create({
      userId: userId || "",
      agent,
      model,
      promptTokens,
      completionTokens,
      totalTokens: totTokens,
      durationMs,
    }).catch(() => {});

    // Upsert daily summary record in PocketBase
    if (userId) {
      const existingPbRecords = await admPb.collection("ai_usage_daily_summaries").getFullList({
        filter: `userId = "${userId}" && date = "${today}"`,
        requestKey: null,
      }).catch(() => []);

      if (existingPbRecords.length > 0) {
        const rec = existingPbRecords[0];
        let bd: Record<string, number> = {};
        try { bd = JSON.parse(rec.agentBreakdown || '{}'); } catch {}
        bd[agent] = (bd[agent] || 0) + totTokens;

        await admPb.collection("ai_usage_daily_summaries").update(rec.id, {
          totalTokens: (rec.totalTokens || 0) + totTokens,
          promptTokens: (rec.promptTokens || 0) + promptTokens,
          completionTokens: (rec.completionTokens || 0) + completionTokens,
          requestCount: (rec.requestCount || 0) + 1,
          agentBreakdown: JSON.stringify(bd),
        }).catch(() => {});
      } else {
        const bd = { [agent]: totTokens };
        await admPb.collection("ai_usage_daily_summaries").create({
          userId,
          date: today,
          totalTokens: totTokens,
          promptTokens,
          completionTokens,
          requestCount: 1,
          agentBreakdown: JSON.stringify(bd),
        }).catch(() => {});
      }
    }
  } catch (pbErr) {
    console.warn('[PB_AI_USAGE] PocketBase sync warning:', pbErr);
  }
}
