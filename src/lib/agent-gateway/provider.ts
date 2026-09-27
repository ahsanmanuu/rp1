import { generateText } from 'ai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { getActiveProviders } from './model-sync';
import type { ProviderConfig } from './types';

export interface LLMRequest {
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  temperature?: number;
  maxOutputTokens?: number;
  abortSignal?: AbortSignal;
  model?: string;
}

export interface LLMResponse {
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const providerCooldowns = new Map<string, number>();

export function recordProviderFailure(providerName: string, statusCode?: number | string, reason?: string) {
  const code = Number(statusCode);
  const cooldownMinutes = code === 429 ? 3 : 10;
  console.warn(`[Gateway] Provider ${providerName} cooling down for ${cooldownMinutes}m due to failure (${statusCode || reason})`);
  providerCooldowns.set(providerName, Date.now() + cooldownMinutes * 60 * 1000);
}

export function isProviderCooledDown(providerName: string): boolean {
  const until = providerCooldowns.get(providerName) || 0;
  return until > Date.now();
}

export function sortProviders(providers: ProviderConfig[], requestedModel?: string): ProviderConfig[] {
  let preferred: string | null = null;
  if (requestedModel) {
    if (requestedModel.includes('/')) {
      preferred = 'openrouter';
    } else if (requestedModel.startsWith('gemini-')) {
      preferred = 'gemini';
    } else if (requestedModel === 'openai' || requestedModel.startsWith('mistral') || requestedModel.startsWith('qwen-coder')) {
      preferred = 'pollinations';
    } else {
      preferred = 'opencode';
    }
  }

  const now = Date.now();
  const available: ProviderConfig[] = [];
  const cooledDownList: ProviderConfig[] = [];

  for (const p of providers) {
    const cooldownUntil = providerCooldowns.get(p.name) || 0;
    if (cooldownUntil > now) {
      cooledDownList.push(p);
    } else {
      available.push(p);
    }
  }

  // Sort available: preferred first
  available.sort((a, b) => {
    if (a.name === preferred) return -1;
    if (b.name === preferred) return 1;
    return 0;
  });

  return [...available, ...cooledDownList];
}

/**
 * High-speed direct fallback using Pollinations text API.
 * Bypasses token exhaustion and reasoning limits for guaranteed response.
 */
export async function callPollinationsDirect(
  messages: Array<{ role: string; content: string }>,
  jsonMode = false,
  abortSignal?: AbortSignal
): Promise<string | null> {
  try {
    const userMsg = messages.filter(m => m.role === 'user').map(m => m.content).join('\n\n');
    const sysMsg = messages.filter(m => m.role === 'system').map(m => m.content).join('\n\n');
    const maxSysLen = Math.max(800, 3400 - userMsg.length);
    const trimmedSys = sysMsg.length > maxSysLen ? sysMsg.slice(0, maxSysLen) : sysMsg;
    const fullPrompt = trimmedSys ? `${trimmedSys}\n\nCRITICAL USER INSTRUCTION:\n${userMsg}` : userMsg;
    const encoded = encodeURIComponent(fullPrompt);
    const url = `https://text.pollinations.ai/${encoded}?model=openai${jsonMode ? '&json=true' : ''}`;

    const res = await fetch(url, {
      signal: abortSignal || AbortSignal.timeout(30000),
    });

    if (res.ok) {
      const text = await res.text();
      if (text && text.trim().length > 10) {
        return text.trim();
      }
    }
  } catch (err) {
    console.warn('[Pollinations Direct] Fallback failed:', err);
  }
  return null;
}

export async function callLLM(req: LLMRequest): Promise<LLMResponse> {
  const requestedModel = req.model;
  const rawProviders = await getActiveProviders();

  if (rawProviders.length === 0) {
    throw new Error('No AI providers configured.');
  }

  const providers = sortProviders(rawProviders, requestedModel);

  // Identify preferred provider
  let preferredProviderName: string | null = null;
  if (requestedModel) {
    if (requestedModel.includes('/')) {
      preferredProviderName = 'openrouter';
    } else if (requestedModel.startsWith('gemini-')) {
      preferredProviderName = 'gemini';
    } else if (requestedModel === 'openai' || requestedModel.startsWith('mistral') || requestedModel.startsWith('qwen-coder')) {
      preferredProviderName = 'pollinations';
    } else {
      preferredProviderName = 'opencode';
    }
  }

  let lastError: any = null;

  for (const provider of providers) {
    const llm = createOpenAICompatible({
      name: provider.name,
      baseURL: provider.baseUrl,
      apiKey: provider.apiKey,
    });

    const isPreferred = provider.name === preferredProviderName;
    let modelsToTry: string[] = [];

    if (isPreferred && requestedModel) {
      modelsToTry = [requestedModel, ...provider.models.filter(m => m !== requestedModel)];
    } else {
      // Non-preferred provider or fallback loop.
      modelsToTry = provider.models.filter(m => {
        if (provider.name === 'openrouter') {
          return m.includes('/');
        } else if (provider.name === 'gemini') {
          return m.startsWith('gemini-');
        } else if (provider.name === 'pollinations') {
          return ['openai', 'openai-fast'].includes(m);
        } else {
          return !m.includes('/') && !m.startsWith('gemini-');
        }
      });
      if (modelsToTry.length === 0) {
        modelsToTry = provider.models;
      }
    }

    for (const modelName of modelsToTry) {
      if (req.abortSignal?.aborted) {
        throw new Error('Operation was aborted by the user.');
      }

      try {
        const activeModel = llm.chatModel(modelName);
        console.log(`[LLM Call] Trying ${provider.name}/${modelName}...`);

        // Cap maxOutputTokens for OpenRouter to 2048 to prevent 402 "can only afford 2062 tokens" errors
        const effectiveMaxTokens = provider.name === 'openrouter'
          ? Math.min(req.maxOutputTokens ?? 2048, 2048)
          : (req.maxOutputTokens ?? 4096);

        const result = await generateText({
          model: activeModel,
          messages: req.messages,
          temperature: req.temperature ?? 0.2,
          maxOutputTokens: effectiveMaxTokens,
          abortSignal: req.abortSignal,
          maxRetries: 0,
        });

        let text = result?.text?.trim() || '';

        // Handle reasoning model output: if text is empty, check reasoning block for code/JSON
        if (!text && (result as any)?.reasoning) {
          const r = (result as any).reasoning;
          const rText = typeof r === 'string' ? r : Array.isArray(r) ? r.map((item: any) => item.text || '').join('') : '';
          if (rText) {
            const jsonMatch = rText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
            if (jsonMatch) {
              text = jsonMatch[1].trim();
            } else if (rText.trim().startsWith('{') && rText.trim().endsWith('}')) {
              text = rText.trim();
            }
          }
        }

        // If pollinations returned empty text due to reasoning token limit, immediately use direct REST endpoint
        if (!text && provider.name === 'pollinations') {
          console.log(`[LLM Call] Pollinations chatModel returned empty, invoking direct REST endpoint...`);
          const isJsonExpected = req.messages.some(m => m.content.includes('valid JSON') || m.content.includes('"nodes"'));
          const direct = await callPollinationsDirect(req.messages, isJsonExpected, req.abortSignal);
          if (direct) {
            text = direct;
          }
        }

        if (text) {
          console.log(`[LLM Call] Success with ${provider.name}/${modelName}`);
          providerCooldowns.delete(provider.name);
          return {
            content: text,
            model: `${provider.name}/${modelName}`,
            usage: result.usage ? {
              promptTokens: result.usage.inputTokens || 0,
              completionTokens: result.usage.outputTokens || 0,
              totalTokens: result.usage.totalTokens || 0,
            } : undefined,
          };
        }

        throw new Error('LLM returned an empty response.');
      } catch (err: any) {
        lastError = err;
        const msg = err?.message || String(err);
        const statusCode = Number((err as any)?.statusCode ?? (err as any)?.status);
        console.warn(`[LLM Call] Failed ${provider.name}/${modelName} (${statusCode || 'ERR'}): ${msg}`);

        // FAST-SWITCH ON ACCOUNT/PROVIDER-LEVEL FAILURES:
        // 401 (Unauthorized / invalid key), 402 (Insufficient funds), 403 (FreeTierError / leaked key),
        // 429 (Rate limit / free limit exceeded). Retrying other models on the SAME provider will fail again.
        // Immediately cooldown and auto-switch to next provider.
        const isProviderLevelFailure =
          statusCode === 401 ||
          statusCode === 402 ||
          statusCode === 403 ||
          statusCode === 429 ||
          /unauthorized|forbidden|authentication|invalid api key|api key.*invalid|user not found|no such user|invalid credentials|access denied|rate limit|quota|insufficient.*funds|free tier.*only be used|reported as leaked|fewer max_tokens/i.test(msg);

        if (isProviderLevelFailure) {
          recordProviderFailure(provider.name, statusCode, msg);
          break; // Immediately move to next provider!
        }

        if (msg.includes('Invalid model name') || statusCode === 404) {
          console.warn(`[LLM Call] Model ${modelName} not available at ${provider.name}, skipping to next model.`);
        }
        await sleep(200);
      }
    }
  }

  // ULTRA-RELIABLE POLLINATIONS DIRECT ENGINE:
  // If all SDK-based providers failed (quota, 403, reasoning token exhaustion),
  // invoke the direct Pollinations engine to ensure seamless response.
  console.log('[LLM Call] Engaging Pollinations Direct Engine as ultimate auto-switch fallback...');
  const isJsonExpected = req.messages.some(m => m.content.includes('valid JSON') || m.content.includes('"nodes"'));
  const directText = await callPollinationsDirect(req.messages, isJsonExpected, req.abortSignal);
  if (directText) {
    console.log('[LLM Call] Success with pollinations/direct engine!');
    return {
      content: directText,
      model: 'pollinations/direct',
      usage: {
        promptTokens: Math.max(1, Math.round(req.messages.map(m => m.content).join(' ').length / 4)),
        completionTokens: Math.max(1, Math.round(directText.length / 4)),
        totalTokens: Math.max(2, Math.round((req.messages.map(m => m.content).join(' ').length + directText.length) / 4)),
      },
    };
  }

  throw new Error(
    `All AI providers failed. Last error: ${lastError?.message || lastError}`
  );
}
