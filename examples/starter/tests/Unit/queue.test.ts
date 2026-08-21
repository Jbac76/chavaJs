// Set before any import of config/queue.ts — ESM caches the module, so the
// default connection is fixed for this file's process.
process.env.QUEUE_CONNECTION = 'database';

import { describe, expect, it } from 'vitest';
import { freshApp } from '../helpers/db';
import { Job } from '../../src/queue/Job';
import { QueueManager } from '../../src/queue/QueueManager';
import type { DatabaseDriver } from '../../src/queue/drivers/DatabaseDriver';

/** Module-level sink so rehydrated job instances are observable. */
const processed: string[] = [];

class EchoJob extends Job {
  public constructor(public readonly message: string = 'hi') {
    super();
  }

  public async handle(): Promise<void> {
    processed.push(this.message);
  }
}

class FailingJob extends Job {
  public tries = 3;
  public backoff = 0;

  public constructor(public readonly label: string = 'x') {
    super();
  }

  public async handle(): Promise<void> {
    throw new Error(`boom:${this.label}`);
  }
}

describe('Queue (Phase 5)', () => {
  it('runs jobs immediately on the sync driver', async () => {
    const app = await freshApp();
    const queue = app.make<QueueManager>('queue');

    await queue.connection('sync').push(new EchoJob('a'));
    await queue.connection('sync').push(new EchoJob('b'));
    expect(processed).toEqual(['a', 'b']);
  });

  it('pushes and pops jobs on the database driver', async () => {
    const app = await freshApp();
    const queue = app.make<QueueManager>('queue');
    const driver = queue.connection('database') as unknown as DatabaseDriver;

    await queue.push(new EchoJob('queued'));
    expect(await driver.count()).toBe(1);

    const popped = await driver.pop('default');
    expect(popped).not.toBeNull();
    expect(popped?.attempts).toBe(1);

    const job = Job.deserialize<EchoJob>(String(popped?.payload));
    expect(job.message).toBe('queued');
    await job.handle();
    expect(processed).toContain('queued');

    await driver.delete(Number(popped?.id));
    expect(await driver.count()).toBe(0);
  });

  it('keeps delayed jobs unavailable until available_at', async () => {
    const app = await freshApp();
    const queue = app.make<QueueManager>('queue');
    const driver = queue.connection('database') as unknown as DatabaseDriver;

    await queue.later(60, new EchoJob('later'));
    expect(await driver.count()).toBe(1);
    expect(await driver.pop('default')).toBeNull(); // not yet available
  });

  it('retries with backoff and moves exhausted jobs to failed_jobs', async () => {
    const app = await freshApp();
    const queue = app.make<QueueManager>('queue');
    const driver = queue.connection('database') as unknown as DatabaseDriver;

    await queue.push(new FailingJob('f'));

    // Three pops; attempts 1 and 2 retry, the third fails out.
    for (let attempt = 1; attempt <= 3; attempt++) {
      const popped = await driver.pop('default');
      expect(popped).not.toBeNull();
      expect(popped?.attempts).toBe(attempt);
      try {
        const job = Job.deserialize<FailingJob>(String(popped?.payload));
        await job.handle();
        throw new Error('should have thrown');
      } catch (error) {
        await driver.fail(Number(popped?.id), String(popped?.payload), popped?.attempts ?? 0, error);
      }
    }

    // Exhausted: gone from jobs, present in failed_jobs.
    expect(await driver.count()).toBe(0);
    const db = app.make<import('../../src/database/DatabaseManager').DatabaseManager>('db');
    expect(await db.table('failed_jobs').count()).toBe(1);
  });

  it('honours a tries override passed to fail() (queue:work --tries)', async () => {
    // Regression: the worker re-deserializes the payload inside fail(), so a
    // CLI `--tries 1` override must be passed through explicitly — otherwise
    // the job's original tries (3) wins and it retries anyway.
    const app = await freshApp();
    const queue = app.make<QueueManager>('queue');
    const driver = queue.connection('database') as unknown as DatabaseDriver;

    await queue.push(new FailingJob('f'));
    const popped = await driver.pop('default');
    expect(popped?.attempts).toBe(1);

    // maxTries override of 1 → attempt 1 is already exhausted → failed_jobs.
    await driver.fail(Number(popped?.id), String(popped?.payload), popped?.attempts ?? 0, new Error('boom'), 1);

    expect(await driver.count()).toBe(0);
    const db = app.make<import('../../src/database/DatabaseManager').DatabaseManager>('db');
    expect(await db.table('failed_jobs').count()).toBe(1);
  });

  it('resolves the configured driver from config (database default)', async () => {
    const app = await freshApp();
    const queue = app.make<QueueManager>('queue');
    const driver = queue.connection();
    expect(typeof (driver as unknown as DatabaseDriver).pop).toBe('function');
  });
});
