import { currentApp } from '../foundation/registry';
import { Model } from '../orm/Model';
import type { CastType } from '../orm/Model';
import type { Relation } from '../orm/relations/Relation';
import type { NotificationManager } from './NotificationManager';
import type { Notification } from './types';

/**
 * Laravel's `Notifiable` trait, ported as a base class:
 *
 *   export class User extends Notifiable { ... }
 *
 *   await user.notify(new WelcomeNotification());
 *   const unread = await user.unreadNotifications().get();
 *   await user.markAllAsRead();
 */
export class Notifiable extends Model {
  /** Send a notification to this model (Laravel: $user->notify()). */
  public async notify(notification: Notification): Promise<void> {
    const manager = currentApp().make<NotificationManager>('notifications');
    await manager.send(this, notification);
  }

  /** All notifications for this model (Laravel: $user->notifications()). */
  public notifications(): Relation {
    return this.morphMany(DatabaseNotification, 'notifiable');
  }

  /** Unread notifications (Laravel: $user->unreadNotifications()). */
  public unreadNotifications(): Relation {
    return this.notifications().whereNull('read_at') as Relation;
  }

  /** Read notifications (Laravel: $user->readNotifications()). */
  public readNotifications(): Relation {
    return this.notifications().whereNotNull('read_at') as Relation;
  }

  /** Mark every unread notification as read (Laravel: markAsRead()). */
  public async markAllAsRead(): Promise<void> {
    const unread = (await this.unreadNotifications().get()) as DatabaseNotification[];
    for (const notification of unread) {
      await notification.markAsRead();
    }
  }
}

/** The database notification model backing the notifications table. */
export class DatabaseNotification extends Model {
  public static tableName = 'notifications';
  public static primaryKey = 'id';
  public static keyType: 'int' | 'string' = 'string';
  public static incrementing = false;
  public static timestamps = true;
  public static fillable: string[] = ['type', 'data', 'read_at'];
  public static casts: Record<string, CastType> = {
    data: 'json',
    read_at: 'datetime',
  };

  /** Mark this notification as read (Laravel: markAsRead()). */
  public async markAsRead(): Promise<this> {
    return this.update({ read_at: new Date() });
  }

  /** Mark this notification as unread (Laravel: markAsUnread()). */
  public async markAsUnread(): Promise<this> {
    return this.update({ read_at: null });
  }

  public read(): boolean {
    return this.getAttribute('read_at') !== null && this.getAttribute('read_at') !== undefined;
  }

  public unread(): boolean {
    return !this.read();
  }
}
