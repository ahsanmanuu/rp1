import type { GatewayConfig, ProviderConfig } from './types';

const PROVIDERS: ProviderConfig[] = [
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
    name: 'openrouter',
    apiKey: process.env.OPENROUTER_API_KEY || '',
    baseUrl: 'https://openrouter.ai/api/v1',
    models: [
      'google/gemini-2.0-flash-001',
      'google/gemini-2.5-flash-001',
      'google/gemini-2.0-flash-lite-001',
      'mistral/mistral-small-3.1-24b-instruct',
    ],
  },
  {
    name: 'gemini',
    apiKey: process.env.GEMINI_API_KEY || '',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    models: [
      'gemini-2.0-flash-exp',
      'gemini-2.5-flash',
      'gemini-2.0-flash-lite',
    ],
  },
].filter(p => p.apiKey);

const PRIMARY = PROVIDERS[0] || { name: 'none', apiKey: '', baseUrl: '', models: [] };

export const GATEWAY_CONFIG: GatewayConfig = {
  providers: PROVIDERS,
  maxConcurrency: 10,
  defaultTimeout: 300000,
  model: PRIMARY.models[0] || '',
};
