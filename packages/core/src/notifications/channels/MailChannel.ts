import type { Application } from '../../foundation/Application';
import type { MailManager } from '../../mail/MailManager';
import type { NotifiableModel, NotificationChannel } from '../types';
import type { Notification } from '../types';

/** Laravel's mail channel: builds a Mailable from toMail() and sends it. */
export class MailChannel implements NotificationChannel {
  public constructor(private readonly app: Application) {}

  public async send(notifiable: NotifiableModel, notification: Notification): Promise<void> {
    const mailable = notification.toMail(notifiable);
    const mail = this.app.make<MailManager>('mail');
    await mail.send(mailable);
  }
}
