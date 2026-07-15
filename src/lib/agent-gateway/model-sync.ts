import type { ProviderConfig } from './types';
import { prisma } from '../prisma';

const CACHE_TTL = 10 * 60 * 1000;
let cachedProviders: ProviderConfig[] | null = null;
let lastFetch = 0;
let syncTimer: ReturnType<typeof setInterval> | null = null;

async function fetchOpenCodeFreeModels(apiKey: string): Promise<string[]> {
  try {
    const res = await fetch('https://opencode.ai/zen/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const models: string[] = [];

    const rawList: any[] = data?.data || data?.models || Array.isArray(data) ? data : [];
    for (const m of rawList) {
      const id = m?.id || m?.model || '';
      if (!id) continue;
      const isFree = id.endsWith('-free') || id === 'big-pickle' || m?.pricing?.prompt === '0';
      if (isFree && !models.includes(id)) models.push(id);
    }

    return models.length > 0 ? models : [
      'big-pickle',
      'deepseek-v4-flash-free',
      'mimo-v2.5-free',
      'north-mini-code-free',
      'nemotron-3-ultra-free',
    ];
  } catch {
    return [
      'big-pickle',
      'deepseek-v4-flash-free',
      'mimo-v2.5-free',
      'north-mini-code-free',
      'nemotron-3-ultra-free',
    ];
  }
}

async function fetchOpenRouterFreeModels(): Promise<string[]> {
  try {
    const res = await fetch('https://openrouter.ai/api/v1/models', {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const models: string[] = [];

    const rawList: any[] = data?.data || [];
    for (const m of rawList) {
      const id = m?.id || '';
      if (!id) continue;
      const promptPrice = parseFloat(m?.pricing?.prompt);
      const completionPrice = parseFloat(m?.pricing?.completion);
      if ((promptPrice === 0 || isNaN(promptPrice)) && (completionPrice === 0 || isNaN(completionPrice))) {
        if (!models.includes(id)) models.push(id);
      }
    }

    return models.length > 0 ? models : [
      'google/gemini-2.0-flash-001',
      'google/gemini-2.5-flash-001',
      'google/gemini-2.0-flash-lite-001',
      'mistral/mistral-small-3.1-24b-instruct',
    ];
  } catch {
    return [
      'google/gemini-2.0-flash-001',
      'google/gemini-2.5-flash-001',
      'google/gemini-2.0-flash-lite-001',
      'mistral/mistral-small-3.1-24b-instruct',
    ];
  }
}

async function syncFreeModels(): Promise<ProviderConfig[]> {
  const providers: ProviderConfig[] = [];

  const openCodeKey = process.env.OPENCODE_API_KEY || '';
  if (openCodeKey) {
    const models = await fetchOpenCodeFreeModels(openCodeKey);
    providers.push({ name: 'opencode', apiKey: openCodeKey, baseUrl: 'https://opencode.ai/zen/v1', models });
  }

  const openRouterKey = process.env.OPENROUTER_API_KEY || '';
  if (openRouterKey) {
    const models = await fetchOpenRouterFreeModels();
    providers.push({ name: 'openrouter', apiKey: openRouterKey, baseUrl: 'https://openrouter.ai/api/v1', models });
  }

  const geminiKey = process.env.GEMINI_API_KEY || '';
  if (geminiKey) {
    providers.push({
      name: 'gemini',
      apiKey: geminiKey,
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
      models: ['gemini-2.0-flash-exp', 'gemini-2.5-flash', 'gemini-2.0-flash-lite'],
    });
  }

  return providers;
}

export async function getActiveProviders(): Promise<ProviderConfig[]> {
  const now = Date.now();
  if (cachedProviders && (now - lastFetch) < CACHE_TTL) {
    return cachedProviders;
  }

  cachedProviders = await syncFreeModels();
  lastFetch = Date.now();
  return cachedProviders;
}

let monitorTimer: ReturnType<typeof setInterval> | null = null;

async function runTokenMonitor(): Promise<void> {
  try {
    const logs = await prisma.aiUsageLog.findMany({
      where: {
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
      select: {
        model: true,
        promptTokens: true,
        completionTokens: true,
        totalTokens: true,
      },
      take: 5000,
    });

    let opencodeTokens = 0;
    let openrouterTokens = 0;
    let geminiTokens = 0;

    for (const log of logs) {
      const model = (log.model || '').toLowerCase();
      if (model.startsWith('opencode/')) {
        opencodeTokens += log.totalTokens;
      } else if (model.startsWith('openrouter/')) {
        openrouterTokens += log.totalTokens;
      } else if (model.startsWith('gemini/')) {
        geminiTokens += log.totalTokens;
      }
    }

    console.log(`[AI-Gateway Background Monitor] Cumulative Token Usage: ` +
                `OpenCode: ${opencodeTokens.toLocaleString()} tokens | ` +
                `OpenRouter: ${openrouterTokens.toLocaleString()} tokens | ` +
                `Gemini: ${geminiTokens.toLocaleString()} tokens`);
  } catch (error: any) {
    console.warn('[AI-Gateway Background Monitor] Error running token monitor:', error.message);
  }
}

export function startModelSync(): void {
  if (syncTimer) return;
  getActiveProviders();
  syncTimer = setInterval(async () => {
    cachedProviders = await syncFreeModels();
    lastFetch = Date.now();
    console.log(`[ModelSync] Refreshed free models — ${cachedProviders.length} providers active`);
  }, CACHE_TTL);

  if (!monitorTimer) {
    // Run once initially after 5 seconds, then every 5 minutes
    setTimeout(() => {
      runTokenMonitor();
    }, 5000);
    monitorTimer = setInterval(() => {
      runTokenMonitor();
    }, 5 * 60 * 1000);
  }
}

export function stopModelSync(): void {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
  }
  if (monitorTimer) {
    clearInterval(monitorTimer);
    monitorTimer = null;
  }
}
