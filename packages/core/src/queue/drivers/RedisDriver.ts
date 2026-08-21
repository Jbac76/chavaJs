import { createRequire } from 'node:module';
import type { Job } from '../Job';
import type { QueueDriver } from '../types';

/** Minimal BullMQ surface used by this driver (types only). */
interface BullMQLike {
  Queue: new (
    name: string,
    options?: { connection?: Record<string, unknown> },
  ) => {
    add(name: string, data: unknown, opts?: { delay?: number }): Promise<unknown>;
  };
}

/**
 * Laravel's `redis` queue driver, backed by BullMQ. BullMQ is an optional
 * dependency (`npm i bullmq ioredis`) - this driver is only instantiated when
 * config/queue.ts selects it, so the framework stays zero-dependency by
 * default.
 */
export class RedisDriver implements QueueDriver {
  private readonly queues = new Map<string, unknown>();

  public constructor(private readonly config: Record<string, unknown>) {}

  private queue(name: string): { add(name: string, data: unknown, opts?: { delay?: number }): Promise<unknown> } {
    const cached = this.queues.get(name);
    if (cached) {
      return cached as { add(name: string, data: unknown, opts?: { delay?: number }): Promise<unknown> };
    }

    const require = createRequire(import.meta.url);
    let BullMQ: BullMQLike;
    try {
      BullMQ = require('bullmq') as BullMQLike;
    } catch {
      throw new Error(
        'The redis queue driver requires bullmq - run `npm i bullmq ioredis` ' +
          'and configure config/queue.ts with a redis connection.',
      );
    }

    const connection = (this.config.connection ?? {}) as Record<string, unknown>;
    const queue = new BullMQ.Queue(name, {
      connection: {
        host: String(connection.host ?? '127.0.0.1'),
        port: Number(connection.port ?? 6379),
      },
    });
    this.queues.set(name, queue);
    return queue;
  }

  public async push(job: Job): Promise<void> {
    await this.queue(job.queue).add('job', { payload: job.serialize() });
  }

  public async later(delaySeconds: number, job: Job): Promise<void> {
    await this.queue(job.queue).add(
      'job',
      { payload: job.serialize() },
      { delay: Math.round(delaySeconds * 1000) },
    );
  }
}
