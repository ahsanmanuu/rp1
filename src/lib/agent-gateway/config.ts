import type { GatewayConfig, ProviderConfig } from './types';

const PROVIDERS: ProviderConfig[] = [
  {
    name: 'openrouter',
    apiKey: process.env.OPENROUTER_API_KEY || '',
    baseUrl: 'https://openrouter.ai/api/v1',
    models: [
      'stealth/space-bunny-alpha',
      'qwen/qwen3.8-27b:free',
      'nvidia/nemotron-3.5-lightning:free',
      'thinkingmachines/inkling:free',
      'cohere/north-mini-code:free',
      'google/gemini-2.5-flash',
      'meta-llama/llama-3.3-70b-instruct',
    ],
  },
  {
    name: 'pollinations',
    apiKey: 'pollinations',
    baseUrl: 'https://text.pollinations.ai/openai',
    models: [
      'openai',
      'openai-fast',
    ],
  },
  {
    name: 'opencode',
    apiKey: process.env.OPENCODE_API_KEY || '',
    baseUrl: 'https://opencode.ai/zen/v1',
    models: [
      'big-pickle',
      'deepseek-v4-flash-free',
      'mimo-v2.5-free',
      'north-mini-code-free',
      'nemotron-3-ultra-free',
    ],
  },
  {
    name: 'gemini',
    apiKey: process.env.GEMINI_API_KEY || '',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    models: [
      'gemini-2.5-flash',
      'gemini-2.5-pro',
      'gemini-2.0-flash-lite',
    ],
  },
].filter(p => p.apiKey);

const PRIMARY = PROVIDERS[0] || { name: 'pollinations', apiKey: 'pollinations', baseUrl: 'https://text.pollinations.ai/openai', models: ['openai'] };

export const GATEWAY_CONFIG: GatewayConfig = {
  providers: PROVIDERS,
  maxConcurrency: 10,
  defaultTimeout: 300000,
  model: PRIMARY.models[0] || 'openai',
};
