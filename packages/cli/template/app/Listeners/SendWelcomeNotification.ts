import { ShouldQueue } from '../../src/events/queue';
import type { UserRegistered } from '../Events/UserRegistered';
import { WelcomeNotification } from '../Notifications/WelcomeNotification';

/**
 * Listens for UserRegistered and sends the welcome notification. This class
 * lives in app/Listeners and is auto-discovered: the event dispatcher reads
 * the `handle(event: UserRegistered)` type-hint and wires it up at boot —
 * Laravel's EventServiceProvider discovery, ported.
 *
 * It extends ShouldQueue, so dispatch pushes a CallQueuedListener job and
 * `handle()` runs on the queue (queue:work) instead of inside the register
 * request — a slow or failing mail transport can never break signup.
 */
export class SendWelcomeNotification extends ShouldQueue {
  // public static queue = 'default';
  // public static delay = 0;
  // public static tries = 3;

  public async handle(event: UserRegistered): Promise<void> {
    await event.user.notify(new WelcomeNotification());
  }
}
