export type AgentId = 'chat' | 'reviewer' | 'ai-fix' | 'extract' | 'diagram' | 'doc2latex';

export interface ProviderConfig {
  name: string;
  apiKey: string;
  baseUrl: string;
  models: string[];
}

export interface GatewayConfig {
  providers: ProviderConfig[];
  maxConcurrency: number;
  defaultTimeout: number;
  model: string;
}

export interface SubAgentConfig {
  id: AgentId;
  name: string;
  description: string;
  model?: string;
  temperature: number;
  maxTokens: number;
  rateLimit: number;
  buildSystemPrompt: (context: Record<string, unknown>) => string;
  parseResponse: (raw: string, context: Record<string, unknown>) => unknown | Promise<unknown>;
}

export interface GatewayRequest {
  agent: AgentId;
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  context?: Record<string, unknown>;
  signal?: AbortSignal;
}

export interface GatewayResponse {
  success: boolean;
  data?: unknown;
  error?: string;
  agent: AgentId;
  model: string;
  timing: {
    queueWait: number;
    llmCall: number;
    total: number;
  };
}

export interface QueueTask {
  id: string;
  agent: AgentId;
  priority: number;
  execute: () => Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
  enqueuedAt: number;
}
