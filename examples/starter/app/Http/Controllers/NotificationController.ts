import { Inertia } from '../../../src/facades';
import { Controller } from '../../../src/http/Controller';
import { Request } from '../../../src/http/Request';
import { AuthorizationException } from '../../../src/support/exceptions';
import { DatabaseNotification } from '../../../src/notifications/Notifiable';
import { User } from '../../Models/User';

interface NotificationViewModel {
  id: string;
  type: string;
  data: Record<string, unknown>;
  read_at: string | null;
  created_at: string | null;
}

/**
 * The database-channel notification inbox — Laravel's `NotificationController`,
 * ported. Lists the authenticated user's notifications (read + unread) and
 * exposes mark-as-read actions built on the Notifiable API:
 *
 *   user.unreadNotifications() / user.markAllAsRead() / $n->markAsRead()
 */
export class NotificationController extends Controller {
  /** GET /notifications — the Inertia inbox page. */
  public async index(request: Request) {
    const user = (await request.user()) as User;
    const notifications = (await user
      .notifications()
      .orderBy('created_at', 'desc')
      .limit(50)
      .get()) as DatabaseNotification[];

    return Inertia.render('Notifications/Index', {
      notifications: notifications.map((notification) => this.toViewModel(notification)),
      unreadCount: await user.unreadNotifications().count(),
    });
  }

  /** POST /notifications/{notification}/read */
  public async markRead(request: Request, notification: DatabaseNotification) {
    const user = (await request.user()) as User;
    this.ensureOwnedBy(user, notification);
    await notification.markAsRead();
    return request.back();
  }

  /** POST /notifications/read-all */
  public async markAllRead(request: Request) {
    const user = (await request.user()) as User;
    await user.markAllAsRead();
    return request.back();
  }

  /** A notification may only be marked read by the user it belongs to. */
  private ensureOwnedBy(user: User, notification: DatabaseNotification): void {
    const ownerId = notification.getAttribute('notifiable_id');
    const ownerType = notification.getAttribute('notifiable_type');
    if (String(ownerId) !== String(user.getKey()) || String(ownerType) !== 'User') {
      throw new AuthorizationException('You do not own this notification.');
    }
  }

  private toViewModel(notification: DatabaseNotification): NotificationViewModel {
    return {
      id: String(notification.getKey()),
      type: String(notification.getAttribute('type') ?? ''),
      data: (notification.getAttribute('data') as Record<string, unknown> | null) ?? {},
      read_at: notification.getAttribute('read_at') as string | null,
      created_at: notification.getAttribute('created_at') as string | null,
    };
  }
}
