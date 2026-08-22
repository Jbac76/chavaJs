import type { Application } from '../../foundation/Application';
import { Config } from '../../config/Config';
import type { DatabaseManager } from '../../database/DatabaseManager';
import type { Row } from '../../database/types';
import { Job, registerJob } from '../Job';
import type { DatabaseJobRecord, PoppedJob, QueueDriver } from '../types';

/**
 * Laravel's `database` queue driver: jobs live in a `jobs` table, consumed by
 * `chava queue:work`. Supports retries (attempts), backoff (available_at
 * pushed into the future on failure), delays, and moves exhausted jobs into
 * the `failed_jobs` table.
 */
export class DatabaseDriver implements QueueDriver {
  private readonly manager: DatabaseManager;
  private readonly table: string;
  private readonly failedTable: string;
  private readonly defaultQueue: string;

  public constructor(private readonly app: Application) {
    this.manager = app.make<DatabaseManager>('db');
    const config = app.make<Config>('config').get<Record<string, unknown>>('queue.connections.database', {});
    this.table = String(config.table ?? 'jobs');
    this.failedTable = String(config.failed ?? 'failed_jobs');
    this.defaultQueue = String(config.queue ?? 'default');
  }

  public async push(job: Job): Promise<void> {
    await this.insert(job, 0);
  }

  public async later(delaySeconds: number, job: Job): Promise<void> {
    await this.insert(job, delaySeconds);
  }

  /** Insert a job row (Laravel: DatabaseQueue::pushRaw). */
  private async insert(job: Job, delaySeconds: number): Promise<void> {
    registerJob(job.constructor as new () => Job);
    const now = Math.floor(Date.now() / 1000);
    await this.manager.table(this.table).insert({
      queue: job.queue,
      payload: job.serialize(),
      attempts: 0,
      reserved_at: null,
      available_at: now + delaySeconds,
      created_at: now,
    });
  }

  /** Pop the next available job for a queue (Laravel: DatabaseQueue::pop). */
  public async pop(queue?: string): Promise<PoppedJob | null> {
    const queueName = queue ?? this.defaultQueue;
    const now = Math.floor(Date.now() / 1000);
    const rows = (await this.manager.table(this.table)
      .where('queue', queueName)
      .where('available_at', '<=', now)
      .whereNull('reserved_at')
      .orderBy('id')
      .limit(1)
      .get()) as Row[];

    const row = (rows[0] as unknown) as DatabaseJobRecord | undefined;
    if (!row) return null;

    // Reserve the job (Laravel: update + atomic increment of attempts).
    await this.manager.table(this.table)
      .where('id', row.id)
      .update({ reserved_at: now, attempts: row.attempts + 1 });

    return { id: row.id, payload: row.payload, attempts: row.attempts + 1 };
  }

  /** Mark a successfully processed job as done. */
  public async delete(id: number | string): Promise<void> {
    await this.manager.table(this.table).where('id', id).delete();
  }

  /**
   * Handle a failed job: retry with backoff or move to failed_jobs.
   * `maxTries` lets the worker override the per-job tries (Laravel's
   * `queue:work --tries`); otherwise the job's own `tries` is used.
   */
  public async fail(
    id: number | string,
    payload: string,
    attempts: number,
    error: unknown,
    maxTriesOverride?: number,
  ): Promise<void> {
    let job: Job;
    try {
      const parsed = JSON.parse(payload) as { class: string; data: Record<string, unknown> };
      job = await Job.fromPayloadAsync(parsed);
    } catch {
      job = new (class extends Job {
        public async handle(): Promise<void> {}
      })() as Job;
    }
    const maxTries = maxTriesOverride !== undefined && maxTriesOverride > 0 ? maxTriesOverride : job.tries;

    if (attempts < maxTries) {
      // Backoff: push available_at into the future and release the reservation.
      // Per-attempt delays when the job declares an array (Laravel-style).
      const backoff = job.getBackoffDelay(attempts);
      const now = Math.floor(Date.now() / 1000);
      await this.manager.table(this.table)
        .where('id', id)
        .update({ reserved_at: null, available_at: now + backoff });
      return;
    }

    // Exhausted — move to failed_jobs.
    const now = Math.floor(Date.now() / 1000);
    await this.manager.table(this.failedTable).insert({
      queue: job.queue,
      payload,
      exception: serializeException(error),
      failed_at: now,
    });
    await this.delete(id);
  }

  /** Total number of jobs currently waiting on the queue. */
  public async count(): Promise<number> {
    const row = await this.manager.table(this.table).count();
    return row;
  }
}

function serializeException(error: unknown): string {
  if (error instanceof Error) {
    return `${error.stack ?? error.message}`;
  }
  return String(error);
}
