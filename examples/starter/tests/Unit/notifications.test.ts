import { describe, expect, it } from 'vitest';
import { freshApp } from '../helpers/db';
import { User } from '../../app/Models/User';
import { Notification } from '../../src/notifications/types';
import type { DatabaseNotificationData, NotifiableModel } from '../../src/notifications/types';

class TestNotification extends Notification {
  public via(_notifiable: NotifiableModel): string[] {
    return ['database'];
  }

  public toDatabase(_notifiable: NotifiableModel): DatabaseNotificationData {
    return { title: 'Test', body: 'Body text', url: '/test' };
  }
}

describe('Notifications (Phase 5)', () => {
  it('stores database notifications morph-related to the notifiable', async () => {
    const app = await freshApp();
    const user = (await User.create({ name: 'Ada', email: 'ada@example.com', password: 'x' })) as User;

    await user.notify(new TestNotification());

    const notifications = (await user.notifications().get()) as unknown as Array<{
      getAttribute(name: string): unknown;
      data: Record<string, unknown>;
      unread(): boolean;
    }>;
    expect(notifications).toHaveLength(1);
    const notification = notifications[0];
    expect(notification.getAttribute('type')).toBe('TestNotification');
    expect(notification.getAttribute('notifiable_id')).toBe(user.getKey());
    expect(notification.data.title).toBe('Test'); // json-cast attribute
    expect(notification.unread()).toBe(true);
  });

  it('tracks read/unread and markAllAsRead()', async () => {
    const app = await freshApp();
    const user = (await User.create({ name: 'Grace', email: 'grace@example.com', password: 'x' })) as User;

    await user.notify(new TestNotification());
    await user.notify(new TestNotification());
    expect((await user.unreadNotifications().get())).toHaveLength(2);
    expect((await user.readNotifications().get())).toHaveLength(0);

    await user.markAllAsRead();

    expect((await user.unreadNotifications().get())).toHaveLength(0);
    expect((await user.readNotifications().get())).toHaveLength(2);
  });

  it('sends to multiple notifiables at once', async () => {
    const app = await freshApp();
    const first = (await User.create({ name: 'First', email: 'first@example.com', password: 'x' })) as User;
    const second = (await User.create({ name: 'Second', email: 'second@example.com', password: 'x' })) as User;

    const notifications = app.make<import('../../src/notifications/NotificationManager').NotificationManager>('notifications');
    await notifications.send([first, second], new TestNotification());

    expect((await first.notifications().get())).toHaveLength(1);
    expect((await second.notifications().get())).toHaveLength(1);
  });
});
