import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Application } from '../foundation/Application';
import { isClass } from '../support/reflect';
import type { QueueManager } from '../queue/QueueManager';
import {
  CallQueuedListener,
  isShouldQueueListener,
  serializeEvent,
} from './queue';
import type { ShouldQueueConfig } from './queue';

/**
 * A listener — either a class whose `handle(event)` runs, or a plain function.
 */
export type Listener = object | ((event: unknown) => unknown);

/**
 * Laravel's event dispatcher:
 *
 *   Event.listen(UserRegistered, SendWelcomeNotification);
 *   await Event.dispatch(new UserRegistered(user));
 *
 * Auto-discovery mirrors Laravel's `EventServiceProvider`: listeners in
 * `app/Listeners/*.ts` whose `handle(event: SomeEvent)` type-hints an event
 * class are wired up automatically. TypeScript annotations are erased at
 * runtime, so discovery reads the listener's source and extracts the type of
 * the `handle()` parameter — same developer contract, one file read at boot.
 */
export class Dispatcher {
  private readonly listeners = new Map<string, Array<Listener>>();
  private discoveryPromise: Promise<void> | undefined;

  public constructor(private readonly app: Application) {}

  /** Register a listener for an event class name (Laravel: $listen map). */
  public listen(event: string | object, listener: Listener): this {
    const key = eventKey(event);
    const list = this.listeners.get(key) ?? [];
    list.push(listener);
    this.listeners.set(key, list);
    return this;
  }

  /** Remove every listener for an event (Laravel: forget()). */
  public forget(event: string | object): this {
    const key = eventKey(event);
    this.listeners.delete(key);
    return this;
  }

  /** Register a one-time listener: removed after its first invocation. */
  public once(event: string | object, listener: Listener): this {
    const wrapper: Listener = {
      handle: async (payload: unknown) => {
        this.forget(event);
        await this.callListener(listener, payload);
      },
    };
    return this.listen(event, wrapper);
  }

  /** Run every listener bound to an event (Laravel: Event::dispatch()). */
  public async dispatch(event: object): Promise<unknown[]> {
    await this.discoverOnce();
    const key = event.constructor.name;
    const list = this.listeners.get(key) ?? [];
    const results: unknown[] = [];
    for (const listener of list) {
      if (isShouldQueueListener(listener)) {
        results.push(await this.dispatchQueued(listener, event));
        continue;
      }
      results.push(await this.callListener(listener, event));
    }
    return results;
  }

  /**
   * Dispatch a ShouldQueue listener as a queued job instead of running its
   * handle() in the request — a slow or failing listener can't break the
   * caller (Laravel: ShouldQueue listeners). Honours the listener's static
   * connection/queue/delay/tries config.
   */
  private async dispatchQueued(listener: Listener, event: object): Promise<unknown> {
    const config = listener as { name: string } & ShouldQueueConfig;
    const queue = this.app.make<QueueManager>('queue');
    const job = new CallQueuedListener(config.name, event.constructor.name, serializeEvent(event));
    if (config.tries && config.tries > 0) job.tries = config.tries;
    if (config.queue) job.queue = config.queue;
    const connection = queue.connection(config.connection);
    if (config.delay && config.delay > 0) {
      await connection.later(config.delay, job);
    } else {
      await connection.push(job);
    }
    return job;
  }

  public async hasListeners(event: string | object): Promise<boolean> {
    await this.discoverOnce();
    const key = eventKey(event);
    return (this.listeners.get(key)?.length ?? 0) > 0;
  }

  /** Listeners registered so far (event name → listener count). */
  public listenerCounts(): Map<string, number> {
    const counts = new Map<string, number>();
    for (const [event, list] of this.listeners) counts.set(event, list.length);
    return counts;
  }

  // -------------------------------------------------------------- internals

  private async callListener(listener: Listener, event: unknown): Promise<unknown> {
    // Classes are functions too — check class-ness first so they are
    // constructed (auto-wired from the container) instead of invoked bare.
    const ctor = listener as { name?: string };
    if (isClass(ctor)) {
      const instance = this.app.make(ctor);
      const handle = (instance as Record<string, unknown>).handle;
      if (typeof handle !== 'function') {
        throw new Error(`Listener [${ctor.name}] must implement handle(event).`);
      }
      return (handle as (payload: unknown) => unknown).call(instance, event);
    }
    if (typeof listener === 'function') return listener(event);
    const handle = (listener as Record<string, unknown>).handle;
    if (typeof handle !== 'function') {
      throw new Error('Listener objects must implement handle(event).');
    }
    return (handle as (payload: unknown) => unknown).call(listener, event);
  }

  /**
   * Run discovery exactly once, even under concurrent first dispatches —
   * concurrent callers await the same promise instead of racing it.
   */
  private discoverOnce(): Promise<void> {
    if (!this.discoveryPromise) {
      this.discoveryPromise = this.discover().catch((error: unknown) => {
        this.discoveryPromise = undefined; // allow a later retry
        throw error;
      });
    }
    return this.discoveryPromise;
  }

  /**
   * Scan app/Listeners/*.ts and bind each class whose `handle()` type-hints an
   * event class. The type name is parsed from the source file (annotations
   * don't survive transpilation), exactly like Laravel's type-hint discovery.
   */
  private async discover(): Promise<void> {
    const dir = join(this.app.path('app', 'Listeners'));
    let files: string[];
    try {
      files = readdirSync(dir).filter((file) => file.endsWith('.ts') || file.endsWith('.js'));
    } catch {
      return; // no app/Listeners directory yet
    }

    for (const file of files) {
      const source = readFileSync(join(dir, file), 'utf8');
      const eventType = extractHandleEventType(source);
      if (!eventType) continue;
      const module = (await import(pathToFileURL(join(dir, file)).href)) as Record<string, unknown>;
      const exportValue = module.default ?? module[classNameOfFile(file)];
      if (!isClass(exportValue)) continue;
      // Verify the referenced event class exists before binding.
      const resolved = await this.resolveEventClass(eventType);
      if (!resolved) continue;
      this.listen(eventType, exportValue as Listener);
    }
  }

  private async resolveEventClass(name: string): Promise<object | undefined> {
    try {
      const module = (await import(
        pathToFileURL(join(this.app.path('app', 'Events', `${name}.ts`))).href
      )) as Record<string, unknown>;
      const value = module.default ?? module[name];
      return isClass(value) ? (value as object) : undefined;
    } catch {
      return undefined;
    }
  }
}

/** Key an event by name — instances and classes both work. */
function eventKey(event: string | object): string {
  if (typeof event === 'string') return event;
  if (typeof event === 'function') return (event as { name: string }).name;
  return (event as { constructor: { name: string } }).constructor.name;
}

function extractHandleEventType(source: string): string | undefined {
  // `handle(event: UserRegistered)` at the start of a line — grab the first
  // parameter's type annotation. Line-anchored so comments can't trigger it.
  const match = /^\s*(?:public\s+|private\s+|protected\s+)?(?:async\s+)?handle\s*\(\s*[\w$]+\s*:\s*([A-Za-z_$][\w$]*)/m.exec(
    source,
  );
  return match?.[1];
}

function classNameOfFile(file: string): string {
  return file.replace(/\.(ts|js)$/, '');
}
