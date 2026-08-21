import type { Model } from '../orm/Model';
import type { Mailable } from '../mail/Mailable';

/** A notifiable model (Laravel: $notifiable). */
export type NotifiableModel = Model & {
  notify(...args: unknown[]): Promise<void>;
  getKey(): unknown;
};

/** A channel can deliver a notification to a notifiable. */
export interface NotificationChannel {
  send(notifiable: NotifiableModel, notification: Notification): Promise<void>;
}

/** The shape a database notification takes. */
export interface DatabaseNotificationData {
  title?: string;
  body?: string;
  url?: string;
  [key: string]: unknown;
}

/** Base class for notifications (Laravel: Illuminate\\Notifications\\Notification). */
export abstract class Notification {
  /** Which channels deliver this notification (Laravel: via()). */
  public abstract via(notifiable: NotifiableModel): string[];

  /** Data for the database channel (Laravel: toDatabase()). */
  public toDatabase(notifiable: NotifiableModel): DatabaseNotificationData {
    void notifiable;
    return {};
  }

  /** A mailable for the mail channel (Laravel: toMail()). */
  public toMail(notifiable: NotifiableModel): Mailable {
    void notifiable;
    throw new Error('This notification does not implement toMail().');
  }

  /** Array form (Laravel: toArray()), used by broadcast/other channels. */
  public toArray(notifiable: NotifiableModel): Record<string, unknown> {
    return this.toDatabase(notifiable) as unknown as Record<string, unknown>;
  }
}
