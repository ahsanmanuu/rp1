import type { QueueTask, AgentId } from './types';

const rng = () => crypto.randomUUID();

export interface QueueOptions {
  maxConcurrency?: number;
  priority?: number;
  skipRateLimit?: boolean;
}

export class AgentQueue {
  private tasks: QueueTask[] = [];
  private active = 0;
  private limits = new Map<AgentId, { count: number; windowStart: number }>();
  private running = false;
  private maxConcurrency: number;
  private rateLimitPerAgent: number;
  private rateWindowMs: number;

  constructor(
    maxConcurrency: number = 100,
    rateLimitPerAgent: number = 60,
    rateWindowMs: number = 60_000,
  ) {
    this.maxConcurrency = maxConcurrency;
    this.rateLimitPerAgent = rateLimitPerAgent;
    this.rateWindowMs = rateWindowMs;
  }

  enqueue<T>(
    agent: AgentId,
    priority: number,
    fn: () => Promise<T>,
    options: QueueOptions = {}
  ): Promise<T> {
    const { skipRateLimit = false } = options;
    return new Promise<T>((resolve, reject) => {
      const task: QueueTask = {
        id: rng(),
        agent,
        priority,
        execute: fn,
        resolve: resolve as (v: unknown) => void,
        reject,
        enqueuedAt: Date.now(),
        skipRateLimit,
      };
      this.tasks.push(task);
      this.tasks.sort((a, b) => b.priority - a.priority);
      this.drain();
    });
  }

  enqueueParallel<T>(
    agent: AgentId,
    tasks: Array<{ fn: () => Promise<T>; priority?: number }>,
    options: QueueOptions = {}
  ): Promise<T[]> {
    const { priority = 0 } = options;
    return Promise.all(
      tasks.map(({ fn, priority: taskPriority = priority }) =>
        this.enqueue(agent, taskPriority, fn, options)
      )
    );
  }

  private drain() {
    if (this.running) return;
    this.running = true;
    while (this.active < this.maxConcurrency && this.tasks.length > 0) {
      const task = this.tasks.shift();
      if (!task) break;
      if (!task.skipRateLimit && !this.checkRateLimit(task.agent)) {
        this.tasks.unshift(task);
        break;
      }
      this.active++;
      task
        .execute()
        .then((v) => task.resolve(v))
        .catch((e) => task.reject(e))
        .finally(() => {
          this.active--;
          this.drain();
        });
    }
    this.running = false;
  }

  private checkRateLimit(agent: AgentId): boolean {
    const now = Date.now();
    const entry = this.limits.get(agent) || { count: 0, windowStart: now };
    if (now - entry.windowStart > this.rateWindowMs) {
      entry.count = 0;
      entry.windowStart = now;
    }
    if (entry.count >= this.rateLimitPerAgent) return false;
    entry.count++;
    this.limits.set(agent, entry);
    return true;
  }

  getPendingCount(): number {
    return this.tasks.length;
  }

  getActiveCount(): number {
    return this.active;
  }

  getStats(): { pending: number; active: number; maxConcurrency: number; rateLimitPerAgent: number } {
    return {
      pending: this.tasks.length,
      active: this.active,
      maxConcurrency: this.maxConcurrency,
      rateLimitPerAgent: this.rateLimitPerAgent,
    };
  }

  setMaxConcurrency(concurrency: number): void {
    this.maxConcurrency = Math.max(1, concurrency);
  }

  setRateLimit(agent: AgentId, limit: number, windowMs: number): void {
    this.rateLimitPerAgent = limit;
    this.rateWindowMs = windowMs;
    this.limits.set(agent, { count: 0, windowStart: Date.now() });
  }

  clearRateLimit(agent: AgentId): void {
    this.limits.delete(agent);
  }
}

export const gatewayQueue = new AgentQueue(100, 60, 60_000);
