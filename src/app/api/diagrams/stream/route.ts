import { NextRequest } from 'next/server';
import { AGENT_REGISTRY } from '@/lib/agent-gateway/registry';
import { getActiveProviders, startModelSync } from '@/lib/agent-gateway/model-sync';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { streamText } from 'ai';

startModelSync();
import { prisma } from '@/lib/prisma';
import { enforceAiCapRules } from '@/lib/aiCapRules';
import { getClientGeoInfo } from '@/lib/clientGeo';

import { getServerSession } from "@/lib/auth-pb";
// ─── SSE helpers ──────────────────────────────────────────────────────────────

function sseChunk(event: string, data: string) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function sseDone() {
  return `event: done\ndata: {}\n\n`;
}

function sseError(message: string) {
  return `event: error\ndata: ${JSON.stringify(message)}\n\n`;
}

// ─── Route ───────────────────────────────────────────────────────────────────

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/diagrams/stream
 *
 * Streams diagram agent LLM tokens as Server-Sent Events (SSE).
 * Each SSE "token" event carries a raw text chunk from the LLM.
 * When the full response is ready a "done" event is emitted.
 *
 * Body:
 *   { messages: [{role, content}], context: { nodes, connections } }
 *
 * SSE events emitted:
 *   event: token   data: "<chunk>"          – incremental LLM token
 *   event: done    data: {}                 – stream complete
 *   event: error   data: "<message>"        – fatal error
 */
export async function POST(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const session = await getServerSession();
  if (!session) {
    return new Response(sseError('Unauthorized'), {
      status: 401,
      headers: { 'Content-Type': 'text/event-stream' },
    });
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: { messages?: any[]; context?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return new Response(sseError('Invalid JSON body'), {
      status: 400,
      headers: { 'Content-Type': 'text/event-stream' },
    });
  }

  const { messages = [], context = {} } = body;

  // ── Build prompt via diagram agent registry ───────────────────────────────
  const agentConfig = AGENT_REGISTRY.get('diagram');
  if (!agentConfig) {
    return new Response(sseError('Diagram agent not registered'), {
      status: 500,
      headers: { 'Content-Type': 'text/event-stream' },
    });
  }

  // Build the system prompt separately — do NOT inject it into messages[]
  // to avoid the SDK security warning and model confusion.
  const systemPrompt = agentConfig.buildSystemPrompt(context);

  // Only include user/assistant turns in messages[]
  const userMessages: any[] = messages.map((m: any) => {
    if (m.role === 'user' && m.image) {
      const matches = m.image.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
      if (matches) {
        const mimeType = matches[1];
        const base64Data = matches[2];
        return {
          role: 'user',
          content: [
            { type: 'text', text: m.content },
            { type: 'image', image: base64Data, mimeType: mimeType },
          ],
        };
      }
    }
    return {
      role: m.role as 'user' | 'assistant',
      content: String(m.content),
    };
  });

  // ── Auto-configure provider from model-sync ──────────────────────────────
  // Models are periodically synced from OpenCode Zen and OpenRouter.
  // Tries each provider's free models in order with zero built-in retries.
  const providers = await getActiveProviders();
  const activeProvider = providers[0] || { name: 'none', apiKey: '', baseUrl: '', models: [] };
  const FALLBACK_MODELS = activeProvider.models.length > 0
    ? activeProvider.models
    : ['big-pickle', 'deepseek-v4-flash-free'];

  const provider = createOpenAICompatible({
    name: activeProvider.name,
    baseURL: activeProvider.baseUrl,
    apiKey: activeProvider.apiKey,
  });

  // ── AI Cap Rule Enforcement ─────────────────────────────────────────────
  const userId = session.user.id as string;
  const geo = await getClientGeoInfo(req);
  const ruleResult = await enforceAiCapRules(userId, {
    email: session.user.email || undefined,
    ipAddress: geo.ipAddress || undefined,
    location: geo.location || undefined,
    country: geo.country || undefined,
    agent: 'diagram',
  });
  if (ruleResult.capped) {
    return new Response(sseError(`AI_CAP_RULE_BLOCKED:${ruleResult.ruleName || ''}:${ruleResult.reason || ''}`), {
      status: 403,
      headers: { 'Content-Type': 'text/event-stream' },
    });
  }

  // ── Plan-based cap check ─────────────────────────────────────────────────
  const planCap = await (async () => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { aiDailyCapOverride: true, aiAgentReactivatesAt: true, aiCapPlan: { select: { dailyTokenCap: true } } },
      });
      if (!user) return null;
      if (user.aiAgentReactivatesAt && user.aiAgentReactivatesAt > new Date()) return { capped: true };
      if (user.aiAgentReactivatesAt && user.aiAgentReactivatesAt <= new Date()) {
        await prisma.user.update({ where: { id: userId }, data: { aiAgentReactivatesAt: null } });
      }
      const dailyCap = user.aiDailyCapOverride ?? user.aiCapPlan?.dailyTokenCap ?? 0;
      if (dailyCap <= 0) return null;
      const today = new Date().toISOString().slice(0, 10);
      const summary = await prisma.aiUsageDailySummary.findUnique({
        where: { userId_date: { userId, date: today } },
        select: { totalTokens: true },
      });
      const usedToday = summary?.totalTokens ?? 0;
      if (usedToday >= dailyCap) return { capped: true, dailyCap, usedToday };
      return null;
    } catch { return null; }
  })();
  if (planCap?.capped) {
    return new Response(sseError('AI_CAP_REACHED:Daily token limit exceeded'), {
      status: 403,
      headers: { 'Content-Type': 'text/event-stream' },
    });
  }

  // ── SSE stream ────────────────────────────────────────────────────────────
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const enqueue = (chunk: string) => controller.enqueue(encoder.encode(chunk));

      const logUsage = async (promptTokens: number, completionTokens: number) => {
        const totalTokens = promptTokens + completionTokens;
        try {
          await prisma.aiUsageLog.create({
            data: { userId, agent: 'diagram', model: 'diagram-stream', promptTokens, completionTokens, totalTokens, durationMs: 0 },
          });
          const today = new Date().toISOString().slice(0, 10);
          await prisma.aiUsageDailySummary.upsert({
            where: { userId_date: { userId, date: today } },
            update: {
              totalTokens: { increment: totalTokens },
              promptTokens: { increment: promptTokens },
              completionTokens: { increment: completionTokens },
              requestCount: { increment: 1 },
            },
            create: {
              userId, date: today, totalTokens, promptTokens, completionTokens,
              requestCount: 1, agentBreakdown: JSON.stringify({ diagram: totalTokens }),
            },
          });
          // Update agentBreakdown
          const existing = await prisma.aiUsageDailySummary.findUnique({
            where: { userId_date: { userId, date: today } },
            select: { agentBreakdown: true },
          });
          if (existing) {
            const bd = JSON.parse(existing.agentBreakdown || '{}');
            bd.diagram = (bd.diagram || 0) + totalTokens;
            await prisma.aiUsageDailySummary.update({
              where: { userId_date: { userId, date: today } },
              data: { agentBreakdown: JSON.stringify(bd) },
            });
          }
        } catch (e) {
          console.warn('[DiagramStream] Usage logging fail-safe:', e);
        }
      };

      for (const modelName of FALLBACK_MODELS) {
        if (req.signal?.aborted) {
          enqueue(sseError('Request aborted'));
          controller.close();
          return;
        }

        try {
          console.log(`[DiagramStream] Trying model: ${modelName}`);
          const model = provider.chatModel(modelName);

          const result = streamText({
            model,
            system: systemPrompt,
            messages: userMessages,
            temperature: agentConfig.temperature,
            maxOutputTokens: agentConfig.maxTokens,
            abortSignal: req.signal,
            maxRetries: 0,
          });

          let charsStreamed = 0;
          for await (const textPart of result.textStream) {
            if (req.signal?.aborted) break;
            enqueue(sseChunk('token', textPart));
            charsStreamed += textPart.length;
          }

          if (charsStreamed < 10) {
            throw new Error(`Model returned empty or too short response (${charsStreamed} chars)`);
          }

          // Log usage
          try {
            const usage = await result.usage;
            logUsage(usage.inputTokens || 0, usage.outputTokens || 0);
          } catch { /* best-effort */ }

          enqueue(sseDone());
          controller.close();
          console.log(`[DiagramStream] Completed with model: ${modelName}`);
          return;
        } catch (err: any) {
          if (req.signal?.aborted) {
            enqueue(sseError('Request aborted'));
            controller.close();
            return;
          }
          const status = err?.statusCode ?? err?.status ?? '?';
          console.warn(`[DiagramStream] Model ${modelName} failed (${status}): ${err?.message}`);
        }
      }

      enqueue(sseError('All AI models failed. Please try again in a moment.'));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
