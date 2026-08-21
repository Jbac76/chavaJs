import type { Application } from '../foundation/Application';
import type { NotifiableModel, Notification, NotificationChannel } from './types';
import { DatabaseChannel } from './channels/DatabaseChannel';
import { MailChannel } from './channels/MailChannel';

/**
 * Laravel's NotificationSender — routes a notification to every notifiable
 * through the channels each notification declares:
 *
 *   await Notification.send(user, new WelcomeNotification());
 *   await user.notify(new WelcomeNotification());
 */
export class NotificationManager {
  private readonly channels = new Map<string, NotificationChannel>();

  public constructor(private readonly app: Application) {}

  /** Send a notification to one notifiable. */
  public async send(notifiable: NotifiableModel | NotifiableModel[], notification: Notification): Promise<void> {
    const list = Array.isArray(notifiable) ? notifiable : [notifiable];
    for (const target of list) {
      for (const channelName of notification.via(target)) {
        const channel = this.channel(channelName);
        await channel.send(target, notification);
      }
    }
  }

  /** Resolve a channel by name (Laravel: Notification::channel()). */
  public channel(name: string): NotificationChannel {
    const cached = this.channels.get(name);
    if (cached) return cached;
    let channel: NotificationChannel;
    switch (name) {
      case 'database':
        channel = new DatabaseChannel(this.app);
        break;
      case 'mail':
        channel = new MailChannel(this.app);
        break;
      default:
        throw new Error(`Notification channel [${name}] is not supported.`);
    }
    this.channels.set(name, channel);
    return channel;
  }
}
