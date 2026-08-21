import { randomUUID } from 'node:crypto';
import type { Application } from '../../foundation/Application';
import type { DatabaseManager } from '../../database/DatabaseManager';
import type { NotifiableModel, NotificationChannel } from '../types';
import type { Notification } from '../types';

/**
 * Laravel's database channel: stores the notification in a `notifications`
 * table, morph-relationed to the notifiable model.
 */
export class DatabaseChannel implements NotificationChannel {
  public constructor(private readonly app: Application) {}

  public async send(notifiable: NotifiableModel, notification: Notification): Promise<void> {
    const data = notification.toDatabase(notifiable);
    const db = this.app.make<DatabaseManager>('db');
    const now = new Date();
    await db.table('notifications').insert({
      id: randomUUID(),
      type: notification.constructor.name,
      notifiable_type: (notifiable.constructor as { name: string }).name,
      notifiable_id: notifiable.getKey(),
      data: JSON.stringify(data),
      read_at: null,
      created_at: now,
      updated_at: now,
    });
  }
}
