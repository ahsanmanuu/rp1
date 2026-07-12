import type { QueueTask, AgentId } from './types';

const rng = () => crypto.randomUUID();

export class AgentQueue {
  private tasks: QueueTask[] = [];
  private active = 0;
  private limits = new Map<AgentId, { count: number; windowStart: number }>();
  private running = false;

  constructor(
    private maxConcurrency: number,
    private rateLimitPerAgent: number,
    private rateWindowMs: number,
  ) {}

  enqueue<T>(
    agent: AgentId,
    priority: number,
    fn: () => Promise<T>,
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const task: QueueTask = {
        id: rng(),
        agent,
        priority,
        execute: fn,
        resolve: resolve as (v: unknown) => void,
        reject,
        enqueuedAt: Date.now(),
      };
      this.tasks.push(task);
      this.tasks.sort((a, b) => b.priority - a.priority);
      this.drain();
    });
  }

  private drain() {
    if (this.running) return;
    this.running = true;
    while (this.active < this.maxConcurrency && this.tasks.length > 0) {
      const task = this.tasks.shift();
      if (!task) break;
      if (!this.checkRateLimit(task.agent)) {
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
}

export const gatewayQueue = new AgentQueue(100, 60, 60_000);
