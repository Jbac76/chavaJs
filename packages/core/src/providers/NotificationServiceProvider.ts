import { ServiceProvider } from '../container/ServiceProvider';
import { NotificationManager } from '../notifications/NotificationManager';

/** Binds the `notifications` manager that backs the `Notification` facade. */
export class NotificationServiceProvider extends ServiceProvider {
  public register(): void {
    this.app.singleton('notifications', () => new NotificationManager(this.app));
    this.app.alias('Notification', 'notifications');
  }
}
