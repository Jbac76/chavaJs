import { describe, expect, it } from 'vitest';
import { Dispatcher } from '../../src/events/Dispatcher';
import { freshApp } from '../helpers/db';
import type { DatabaseManager } from '../../src/database/DatabaseManager';
import { DatabaseNotification } from '../../src/notifications/Notifiable';
import { User } from '../../app/Models/User';
import { UserRegistered } from '../../app/Events/UserRegistered';

class OrderShipped {
  public constructor(public readonly orderId: number) {}
}

/** A class listener resolved from the container (no-arg constructor). */
const classCalls: number[] = [];
class ReorderListener {
  public async handle(event: OrderShipped): Promise<void> {
    classCalls.push(event.orderId);
  }
}

describe('Event dispatcher (Phase 5)', () => {
  it('calls listeners registered with listen()', async () => {
    const app = await freshApp();
    const dispatcher = app.make<Dispatcher>('events');
    const calls: number[] = [];
    dispatcher.listen(OrderShipped, (event: OrderShipped) => {
      calls.push(event.orderId);
    });

    await dispatcher.dispatch(new OrderShipped(42));
    expect(calls).toEqual([42]);
  });

  it('runs class listeners resolved from the container', async () => {
    const app = await freshApp();
    const dispatcher = app.make<Dispatcher>('events');
    dispatcher.listen(OrderShipped, ReorderListener);

    await dispatcher.dispatch(new OrderShipped(7));
    expect(classCalls).toEqual([7]);
  });

  it('once() listeners fire a single time', async () => {
    const app = await freshApp();
    const dispatcher = app.make<Dispatcher>('events');
    let calls = 0;
    dispatcher.once(OrderShipped, () => {
      calls++;
    });

    await dispatcher.dispatch(new OrderShipped(1));
    await dispatcher.dispatch(new OrderShipped(2));
    expect(calls).toBe(1);
    expect(await dispatcher.hasListeners(OrderShipped)).toBe(false);
  });

  it('forget() removes listeners', async () => {
    const app = await freshApp();
    const dispatcher = app.make<Dispatcher>('events');
    let calls = 0;
    dispatcher.listen(OrderShipped, () => {
      calls++;
    });
    dispatcher.forget(OrderShipped);

    await dispatcher.dispatch(new OrderShipped(1));
    expect(calls).toBe(0);
    expect(await dispatcher.hasListeners(OrderShipped)).toBe(false);
  });

  it('auto-discovers listeners in app/Listeners by handle() type-hint', async () => {
    // freshApp boots the real application, so the dispatcher scans the real
    // app/Listeners — SendWelcomeNotification.handle(event: UserRegistered)
    // must be discovered and bound.
    const app = await freshApp();
    const dispatcher = app.make<Dispatcher>('events');
    expect(await dispatcher.hasListeners('UserRegistered')).toBe(true);
  });

  it('runs ShouldQueue listeners inline when the default connection is sync', async () => {
    // This file does not set QUEUE_CONNECTION, so the default connection is
    // the sync driver: the auto-discovered ShouldQueue listener still
    // executes — via the CallQueuedListener job — inside the dispatch call,
    // never on a queue.
    const app = await freshApp();
    const dispatcher = app.make<Dispatcher>('events');
    expect(await dispatcher.hasListeners('UserRegistered')).toBe(true);
    const user = (await User.create({
      name: 'Inline',
      email: 'inline@chava.dev',
      password: 'secret',
    })) as User;

    await dispatcher.dispatch(new UserRegistered(user));

    // Delivered immediately through the sync driver…
    const notifications = (await DatabaseNotification.query().get()) as DatabaseNotification[];
    expect(notifications).toHaveLength(1);
    expect(notifications[0].getAttribute('type')).toBe('WelcomeNotification');
    // …and nothing was left on the database queue.
    expect(await app.make<DatabaseManager>('db').table('jobs').count()).toBe(0);
  });
});
