// Set before any import of config/queue.ts — ESM caches the module, so the
// default connection is fixed for this file's process.
process.env.QUEUE_CONNECTION = 'database';

import { describe, expect, it } from 'vitest';
import { freshApp } from '../helpers/db';
import { Dispatcher } from '../../src/events/Dispatcher';
import { CallQueuedListener, deserializeEventPayload, serializeEvent, ShouldQueue } from '../../src/events/queue';
import { Job } from '../../src/queue/Job';
import type { QueueManager } from '../../src/queue/QueueManager';
import type { DatabaseDriver } from '../../src/queue/drivers/DatabaseDriver';
import type { DatabaseManager } from '../../src/database/DatabaseManager';
import { DatabaseNotification } from '../../src/notifications/Notifiable';
import { User } from '../../app/Models/User';
import { UserRegistered } from '../../app/Events/UserRegistered';

/** A local event class auto-discovery can never bind (no app/Listeners file). */
class InventoryLow {
  public constructor(public readonly sku: string) {}
}

/** A local ShouldQueue listener with static queue config (never run here). */
class EmailsListener extends ShouldQueue {
  public static queue = 'emails';
  public static tries = 1;
  public static delay = 2;
  public async handle(_event: InventoryLow): Promise<void> {}
}

describe('ShouldQueue listeners (queued events)', () => {
  it('serializes events with models as identifiers and re-fetches them on deserialize', async () => {
    const app = await freshApp();
    const user = (await User.create({
      name: 'Serge',
      email: 'serge@chava.dev',
      password: 'secret',
    })) as User;

    // A model becomes a { class, key } marker — never serialized wholesale.
    const payload = serializeEvent(new UserRegistered(user));
    expect(payload).toEqual({ user: { __chava_model: 'User', key: user.getKey() } });

    // Deserializing re-imports the event class and re-fetches the model.
    const revived = (await deserializeEventPayload('UserRegistered', payload, app)) as UserRegistered;
    expect(revived).toBeInstanceOf(UserRegistered);
    expect(revived.user).toBeInstanceOf(User);
    expect(revived.user.getKey()).toBe(user.getKey());
    expect(revived.user.getAttribute('email')).toBe('serge@chava.dev');
  });

  it('routes ShouldQueue listeners to the queue instead of running inline', async () => {
    // SendWelcomeNotification extends ShouldQueue and is auto-discovered from
    // app/Listeners — dispatching must enqueue, not run handle() in-process.
    const app = await freshApp();
    const dispatcher = app.make<Dispatcher>('events');
    expect(await dispatcher.hasListeners('UserRegistered')).toBe(true);

    const user = (await User.create({
      name: 'Queued',
      email: 'queued@chava.dev',
      password: 'secret',
    })) as User;

    await dispatcher.dispatch(new UserRegistered(user));

    // Nothing was delivered inside the request…
    expect(await DatabaseNotification.query().count()).toBe(0);
    // …but a CallQueuedListener job is waiting on the database queue.
    const jobs = (await app.make<DatabaseManager>('db').table('jobs').get()) as Array<Record<string, unknown>>;
    expect(jobs).toHaveLength(1);
    expect(jobs[0].queue).toBe('default');
    const payload = JSON.parse(String(jobs[0].payload)) as { class: string };
    expect(payload.class).toBe('CallQueuedListener');
  });

  it('processes the queued listener job and delivers the notification', async () => {
    const app = await freshApp();
    const dispatcher = app.make<Dispatcher>('events');
    const user = (await User.create({
      name: 'Worker',
      email: 'worker@chava.dev',
      password: 'secret',
    })) as User;

    await dispatcher.dispatch(new UserRegistered(user));

    // Simulate queue:work — pop the job, rehydrate it, run handle().
    const driver = app.make<QueueManager>('queue').connection() as DatabaseDriver;
    const popped = await driver.pop('default');
    expect(popped).not.toBeNull();
    const job = Job.deserialize<CallQueuedListener>(popped!.payload);
    expect(job).toBeInstanceOf(CallQueuedListener);
    expect(job.listener).toBe('SendWelcomeNotification');
    expect(job.event).toBe('UserRegistered');
    await job.handle();
    await driver.delete(popped!.id);

    const notifications = (await DatabaseNotification.query().get()) as DatabaseNotification[];
    expect(notifications).toHaveLength(1);
    expect(notifications[0].getAttribute('type')).toBe('WelcomeNotification');
  });

  it('honours the listener static queue/tries/delay config', async () => {
    const app = await freshApp();
    const dispatcher = app.make<Dispatcher>('events');
    dispatcher.listen('InventoryLow', EmailsListener);

    await dispatcher.dispatch(new InventoryLow('SKU-1'));

    const jobs = (await app.make<DatabaseManager>('db').table('jobs').get()) as Array<Record<string, unknown>>;
    expect(jobs).toHaveLength(1);
    expect(jobs[0].queue).toBe('emails');
    // delay: 2 → the job is not available until ~2s from now.
    const availableAt = Number(jobs[0].available_at);
    expect(availableAt).toBeGreaterThan(Math.floor(Date.now() / 1000) + 1);

    const job = Job.deserialize<CallQueuedListener>(String(jobs[0].payload));
    expect(job.tries).toBe(1);
    expect(job.queue).toBe('emails');
  });
});
