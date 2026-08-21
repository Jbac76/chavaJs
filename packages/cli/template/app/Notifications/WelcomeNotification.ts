import type { Mailable } from '../../src/mail/Mailable';
import { Notification } from '../../src/notifications/types';
import type { DatabaseNotificationData, NotifiableModel } from '../../src/notifications/types';
import { WelcomeMail } from '../Mail/WelcomeMail';

/**
 * Sent to newly registered users — Laravel's database+mail notification,
 * ported. `via()` declares the channels; toMail()/toDatabase() build the
 * per-channel payloads.
 */
export class WelcomeNotification extends Notification {
  public via(_notifiable: NotifiableModel): string[] {
    return ['mail', 'database'];
  }

  public toMail(notifiable: NotifiableModel): Mailable {
    return new WelcomeMail(notifiable);
  }

  public toDatabase(notifiable: NotifiableModel): DatabaseNotificationData {
    const name = notifiable.getAttribute('name') ?? 'there';
    return {
      title: 'Welcome to chavaJs!',
      body: `Hi ${String(name)} — your account is ready.`,
      url: '/dashboard',
    };
  }
}
