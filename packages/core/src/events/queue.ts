import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Application } from '../foundation/Application';
import { currentApp } from '../foundation/registry';
import { isClass } from '../support/reflect';
import { Job } from '../queue/Job';
import { Model } from '../orm/Model';
import type { ModelClass } from '../orm/Model';

/**
 * Laravel's `ShouldQueue` contract for listeners, ported as a marker base
 * class (TypeScript `implements` is erased at runtime, so a class is the
 * checkable equivalent). A listener that extends it has its `handle()`
 * dispatched onto the queue instead of running inside the request:
 *
 *   export class SendWelcomeNotification extends ShouldQueue {
 *     public static queue = 'default';
 *     public static delay = 0;
 *     public static tries = 3;
 *     public async handle(event: UserRegistered): Promise<void> { ... }
 *   }
 *
 * The event is serialized (models become class + key identifiers and are
 * re-retrieved when the job runs), so a slow or failing mail/notification
 * can never break the request that dispatched the event.
 */
export abstract class ShouldQueue {
  /** Queue connection to use (Laravel: $connection). */
  public static connection?: string;
  /** Queue name (Laravel: $queue). */
  public static queue?: string;
  /** Seconds to delay before the job is available (Laravel: $delay). */
  public static delay?: number;
  /** Attempts before the job fails (Laravel: $tries). */
  public static tries?: number;
}

/** The static config fields a ShouldQueue listener may declare. */
export interface ShouldQueueConfig {
  connection?: string;
  queue?: string;
  delay?: number;
  tries?: number;
}

/** Runtime check: is this listener class marked ShouldQueue? */
export function isShouldQueueListener(listener: unknown): boolean {
  if (!isClass(listener)) return false;
  const prototype = (listener as { prototype?: object }).prototype;
  return prototype instanceof ShouldQueue;
}

/**
 * Serialize an event for the queue. Model instances become
 * `{ __chava_model, key }` markers (Laravel's SerializesModels) and Dates
 * become `{ __chava_date, value }` markers, so the payload is JSON-safe and
 * models are re-fetched fresh when the job runs.
 */
export function serializeEvent(event: object): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(event)) {
    payload[key] = serializeValue(value);
  }
  return payload;
}

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
    for (const [key, item] of Object.entries(value)) {
      record[key] = serializeValue(item);
    }
    return record;
  }
  return value;
}

/**
 * Rehydrate an event instance from a serialized payload (models re-fetched).
 * The instance is built with `Object.create(prototype)` + field assignment,
 * so events should be plain data holders (Laravel's convention too) — any
 * constructor-side computation is skipped in the worker process.
 */
export async function deserializeEventPayload(
  eventName: string,
  payload: Record<string, unknown>,
  app: Application,
): Promise<object> {
  const eventClass = (await resolveAppClass(app, 'Events', eventName)) as { prototype?: object } | undefined;
  const instance = (eventClass && isClass(eventClass) ? Object.create(eventClass.prototype ?? null) : {}) as Record<
    string,
    unknown
  >;
  for (const [key, value] of Object.entries(payload)) {
    instance[key] = await deserializeValue(value, app);
  }
  return instance;
}

async function deserializeValue(value: unknown, app: Application): Promise<unknown> {
  if (Array.isArray(value)) {
    return Promise.all(value.map((item) => deserializeValue(item, app)));
  }
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (typeof record.__chava_model === 'string') {
      const modelClass = (await resolveAppClass(app, 'Models', record.__chava_model)) as ModelClass | undefined;
      if (modelClass && typeof modelClass.findOrFail === 'function') {
        return modelClass.findOrFail(record.key);
      }
      return record; // model class not importable — keep the raw marker
    }
    if (typeof record.__chava_date === 'string') {
      return new Date(record.__chava_date);
    }
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(record)) {
      out[key] = await deserializeValue(item, app);
    }
    return out;
  }
  return value;
}

/** Import a class from app/<dir>/<name>.ts (Laravel's autoloading). */
async function resolveAppClass(app: Application, dir: 'Listeners' | 'Events' | 'Models', name: string): Promise<unknown> {
  try {
    const module = (await import(pathToFileURL(join(app.path('app', dir), `${name}.ts`)).href)) as Record<string, unknown>;
    return module.default ?? module[name];
  } catch {
    return undefined;
  }
}

/**
 * The job the dispatcher pushes for a ShouldQueue listener. When it runs
 * (queue:work), the listener class and the event are re-imported, models are
 * re-fetched, and `handle(event)` is called — in the worker process, never
 * in the request.
 */
export class CallQueuedListener extends Job {
  // Constructor args carry defaults so the job is rehydratable with the
  // zero-arg `new ctor()` pattern (queue drivers copy the props afterwards).
  public constructor(
    public readonly listener: string = '',
    public readonly event: string = '',
    public readonly payload: Record<string, unknown> = {},
  ) {
    super();
  }

  public async handle(): Promise<void> {
    const app = currentApp();
    const eventInstance = await deserializeEventPayload(this.event, this.payload, app);

    const listenerClass = await resolveAppClass(app, 'Listeners', this.listener);
    if (!listenerClass || !isClass(listenerClass)) {
      throw new Error(`Cannot resolve queued listener [${this.listener}] from app/Listeners.`);
    }
    const instance = app.make(listenerClass);
    const handle = (instance as Record<string, unknown>).handle;
    if (typeof handle !== 'function') {
      throw new Error(`Queued listener [${this.listener}] must implement handle(event).`);
    }
    await (handle as (payload: unknown) => unknown).call(instance, eventInstance);
  }
}
