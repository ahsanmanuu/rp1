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

function sortProviders(providers: ProviderConfig[], requestedModel?: string): ProviderConfig[] {
  let preferred: string | null = null;
  if (requestedModel) {
    if (requestedModel.includes('/')) {
      preferred = 'openrouter';
    } else if (requestedModel.startsWith('gemini-')) {
      preferred = 'gemini';
    } else {
      preferred = 'opencode';
    }
  }

  const preferredList: ProviderConfig[] = [];
  const middleList: ProviderConfig[] = [];
  const lastList: ProviderConfig[] = [];

  for (const p of providers) {
    if (p.name === preferred) {
      preferredList.push(p);
    } else if (p.name === 'gemini') {
      lastList.push(p);
    } else {
      middleList.push(p);
    }
  }

  return [...preferredList, ...middleList, ...lastList];
}

export async function callLLM(req: LLMRequest): Promise<LLMResponse> {
  const requestedModel = req.model;
  const rawProviders = await getActiveProviders();

  if (rawProviders.length === 0) {
    throw new Error('No AI providers configured. Set OPENCODE_API_KEY or OPENROUTER_API_KEY or GEMINI_API_KEY.');
  }

  const providers = sortProviders(rawProviders, requestedModel);

  // Identify preferred provider
  let preferredProviderName: string | null = null;
  if (requestedModel) {
    if (requestedModel.includes('/')) {
      preferredProviderName = 'openrouter';
    } else if (requestedModel.startsWith('gemini-')) {
      preferredProviderName = 'gemini';
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
      // Filter out model names belonging to other providers.
      modelsToTry = provider.models.filter(m => {
        if (provider.name === 'openrouter') {
          return m.includes('/');
        } else if (provider.name === 'gemini') {
          return m.startsWith('gemini-');
        } else {
          return !m.includes('/') && !m.startsWith('gemini-');
        }
      });
    }

    for (const modelName of modelsToTry) {
      if (req.abortSignal?.aborted) {
        throw new Error('Operation was aborted by the user.');
      }

      try {
        const activeModel = llm.chatModel(modelName);
        console.log(`[LLM Call] Trying ${provider.name}/${modelName}...`);

        const result = await generateText({
          model: activeModel,
          messages: req.messages,
          temperature: req.temperature ?? 0.2,
          maxOutputTokens: req.maxOutputTokens ?? 4096,
          abortSignal: req.abortSignal,
          maxRetries: 0,
        });

        if (result && result.text) {
          console.log(`[LLM Call] Success with ${provider.name}/${modelName}`);
          return {
            content: result.text,
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
        console.warn(`[LLM Call] Failed ${provider.name}/${modelName}: ${msg}`);
        if (msg.includes('Invalid model name')) {
          console.warn(`[LLM Call] Model ${modelName} not available at ${provider.name}, skipping.`);
        }
        await sleep(500);
      }
    }
  }

  throw new Error(
    `All AI providers failed. Last error: ${lastError?.message || lastError}`
  );
}
