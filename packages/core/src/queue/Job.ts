import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { currentApp } from '../foundation/registry';
import { Model } from '../orm/Model';
import type { ModelClass } from '../orm/Model';

/**
 * A queued job — Laravel's `Illuminate\Contracts\Queue\ShouldQueue` job,
 * ported. Jobs define `handle()`; the queue driver runs it.
 *
 *   export class SendWelcomeEmail extends Job {
 *     public constructor(public readonly user: User) { super(); }
 *     public async handle(): Promise<void> { ... }
 *   }
 *
 * Serialization stores the class name + the job's own data properties so the
 * database driver can rehydrate it later. Model instances are stored as
 * `{ __chava_model, key }` markers (like Laravel's SerializesModels) and
 * re-fetched when the job runs. Dates are stored as ISO strings.
 */
export abstract class Job {
  /** How many times to attempt the job before it fails (Laravel: $tries). */
  public tries = 3;

  /**
   * Seconds to wait before retrying after a failure (Laravel: $backoff).
   * A number applies the same delay to every retry; an array gives the delay
   * per attempt (the last value repeats for further retries) — e.g.
   * `[3, 15, 60]` waits 3s, then 15s, then 60s instead of hammering a
   * struggling dependency at a constant rate.
   */
  public backoff: number | number[] = [3, 15, 60];

  /** Seconds after which the job is abandoned. */
  public timeout = 60;

  /** The queue this job runs on (Laravel: $queue). */
  public queue = 'default';

  /** Seconds to delay the job before it becomes available. */
  public delay = 0;

  /** The job's work. */
  public abstract handle(): Promise<unknown> | unknown;

  /**
   * Resolve the retry delay in seconds for the given (1-based) attempt count.
   */
  public getBackoffDelay(attempts: number): number {
    if (Array.isArray(this.backoff)) {
      if (this.backoff.length === 0) return 0;
      const index = Math.min(Math.max(0, attempts - 1), this.backoff.length - 1);
      return this.backoff[index] ?? this.backoff[this.backoff.length - 1] ?? 0;
    }
    return this.backoff;
  }

  /** Serialize for a queue driver — class name + own data properties. */
  public serialize(): string {
    return JSON.stringify(this.toPayload());
  }

  /** The serializable payload (class + own enumerable data properties). */
  public toPayload(): { class: string; data: Record<string, unknown> } {
    const data: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(this)) {
      if (key.startsWith('_')) continue;
      data[key] = serializeValue(value);
    }
    return { class: this.constructor.name, data };
  }

  /** Rehydrate a job from a serialized payload. */
  public static deserialize<T extends Job>(payload: string): T {
    const parsed = JSON.parse(payload) as { class: string; data: Record<string, unknown> };
    return Job.fromPayload<T>(parsed);
  }

  /** Rehydrate a job from a { class, data } payload. */
  public static async fromPayloadAsync<T extends Job>(payload: { class: string; data: Record<string, unknown> }): Promise<T> {
    const ctor = jobRegistry.get(payload.class);
    if (!ctor) {
      throw new Error(
        `Cannot rehydrate job [${payload.class}] — it was never pushed through a queue ` +
          `in this process. Register it with Queue.register(JobClass).`,
      );
    }
    const instance = new ctor() as Job;
    const app = currentApp();
    for (const [key, value] of Object.entries(payload.data)) {
      (instance as unknown as Record<string, unknown>)[key] = await deserializeValue(value, app);
    }
    return instance as T;
  }

  /** Rehydrate a job from a { class, data } payload (sync driver — no model re-fetch). */
  public static fromPayload<T extends Job>(payload: { class: string; data: Record<string, unknown> }): T {
    const ctor = jobRegistry.get(payload.class);
    if (!ctor) {
      throw new Error(
        `Cannot rehydrate job [${payload.class}] — it was never pushed through a queue ` +
          `in this process. Register it with Queue.register(JobClass).`,
      );
    }
    const instance = new ctor() as Job;
    for (const [key, value] of Object.entries(payload.data)) {
      (instance as unknown as Record<string, unknown>)[key] = value;
    }
    return instance as T;
  }
}

// ------------------------------------------------------------------ serialization helpers

function serializeValue(value: unknown): unknown {
  if (value instanceof Model) {
    return { __chava_model: (value.constructor as { name: string }).name, key: value.getKey() };
  }
  if (value instanceof Date) {
    return { __chava_date: value.toISOString() };
  }
  if (Array.isArray(value)) {
    return value.map(serializeValue);
  }
  if (value !== null && typeof value === 'object') {
    const record: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      record[k] = serializeValue(v);
    }
    return record;
  }
  return value;
}

async function deserializeValue(value: unknown, app: { path: (...parts: string[]) => string }): Promise<unknown> {
  if (Array.isArray(value)) {
    return Promise.all(value.map((item) => deserializeValue(item, app)));
  }
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (typeof record.__chava_model === 'string') {
      try {
        const module = (await import(pathToFileURL(join(app.path('app', 'Models'), `${record.__chava_model}.ts`)).href)) as Record<string, unknown>;
        const modelClass = (module.default ?? module[record.__chava_model]) as ModelClass | undefined;
        if (modelClass && typeof modelClass.findOrFail === 'function') {
          return modelClass.findOrFail(record.key);
        }
      } catch {
        // model class not importable — keep the raw marker
      }
      return record;
    }
    if (typeof record.__chava_date === 'string') {
      return new Date(record.__chava_date);
    }
    const out: Record<string, unknown> = {};
    for (const [k, item] of Object.entries(record)) {
      out[k] = await deserializeValue(item, app);
    }
    return out;
  }
  return value;
}

/** Class-name → job class registry, used by Job.fromPayload(). */
const jobRegistry = new Map<string, new () => Job>();

/** Register a job class so its serialized form can be rehydrated. */
export function registerJob(JobClass: new () => Job): void {
  jobRegistry.set(JobClass.name, JobClass);
}

/**
 * Auto-discover and register every job class in app/Jobs/*.ts — Laravel's
 * job autoloading. `queue:work` calls this at startup so a worker process
 * can rehydrate jobs pushed by a different process.
 */
export async function registerJobsFrom(jobsDir: string): Promise<void> {
  let files: string[];
  try {
    files = readdirSync(jobsDir).filter((file) => file.endsWith('.ts') || file.endsWith('.js'));
  } catch {
    return; // no app/Jobs directory yet
  }
  for (const file of files) {
    const module = (await import(pathToFileURL(join(jobsDir, file)).href)) as Record<string, unknown>;
    const className = file.replace(/\.(ts|js)$/, '');
    const value = module.default ?? module[className];
    if (typeof value === 'function' && value.prototype instanceof Job) {
      registerJob(value as new () => Job);
    }
  }
}
